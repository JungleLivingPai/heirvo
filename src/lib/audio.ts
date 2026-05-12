/**
 * Heirvo audio cues — Apple-feeling chimes for long unattended recovery sessions.
 *
 * Why Web Audio synthesis (vs. bundled .wav/.mp3 or a sample library):
 *   • Zero binary asset weight in the installer (DVDs already cost MB).
 *   • No third-party sample licensing risk (Apple's actual chimes are ©Apple).
 *   • Tunable at runtime — frequencies, envelopes, reverb tail can shift per
 *     event without rebuilding/re-bundling.
 *   • Apple's own cues (tri-tone, AirPods, ring-close) are mostly synthesised
 *     FM/AM tones with shaped envelopes + a touch of reverb — perfectly
 *     reproducible with OscillatorNode + GainNode + ConvolverNode.
 *
 * All sounds are short, sine-based (with optional triangle blend for warmth),
 * envelope-shaped to avoid clicks, and routed through a low-pass filter +
 * synthesised plate-style reverb so they read as "expensive" rather than
 * "Windows ding".
 *
 * TODO(wiring): Other modules should call `audio.play("milestone" | …)` from:
 *   - Dashboard.tsx: when `pct` crosses each 10% boundary (track previous pct
 *     in a ref and fire on threshold transitions). Likely near the existing
 *     `pct` calc around src/screens/dashboard/Dashboard.tsx:161.
 *   - Dashboard.tsx: inside the `events.onComplete` handler (~line 73) →
 *     audio.play("recovery_done").
 *   - ActivityRing variants (src/screens/dashboard/disc-variants/ActivityRing.tsx
 *     and disc-variants/index.tsx): fire "ring_complete" when a ring's value
 *     transitions from <1 to >=1.
 *   - Drive-health watcher: fire "drive_warning" when health flips to Suspect.
 */

export type AudioEvent =
  | "milestone"
  | "ring_complete"
  | "recovery_done"
  | "drive_warning";

export interface AudioPrefs {
  enabled: boolean;
  volume: number; // 0..1, master
}

const STORAGE_KEY = "heirvo-audio-prefs";

const DEFAULT_PREFS: AudioPrefs = {
  enabled: false, // opt-in
  volume: 0.7,
};

// Per-event gain (relative to master), tuned so triumphant sounds feel louder
// than informational ones without clipping.
const EVENT_GAIN: Record<AudioEvent, number> = {
  milestone: 0.35,
  ring_complete: 0.6,
  recovery_done: 0.8,
  drive_warning: 0.5,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function loadPrefs(): AudioPrefs {
  if (!isBrowser()) return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_PREFS.enabled,
      volume:
        typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_PREFS.volume,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: AudioPrefs): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // quota / private mode — not fatal
  }
}

let prefs: AudioPrefs = loadPrefs();

// Lazy-initialised AudioContext + reverb impulse. Browsers/webview require a
// user gesture before audio can start, so we only create the context on the
// first play() call (which will originate from a click or — once toggled on —
// progress events that fire after the user has interacted with Settings).
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let voiceInputNode: AudioNode | null = null;
let initFailed = false;
let lastPlayAt: Partial<Record<AudioEvent, number>> = {};

interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  /** Entry node all per-event voices should connect to. */
  input: AudioNode;
}

function ensureGraph(): AudioGraph | null {
  if (initFailed) return null;
  if (ctx && masterGain && voiceInputNode) {
    return { ctx, master: masterGain, input: voiceInputNode };
  }
  if (!isBrowser()) return null;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      initFailed = true;
      return null;
    }
    const c = new Ctor();
    const master = c.createGain();
    master.gain.value = prefs.volume;

    // Soft low-pass keeps everything feeling rounded, never piercing.
    const lpf = c.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 6000;
    lpf.Q.value = 0.5;

    const reverb = c.createConvolver();
    reverb.buffer = makeImpulseResponse(c, 1.4, 2.2);

    // Wet/dry split so reverb is a tasteful tail, not a wash.
    const dry = c.createGain();
    dry.gain.value = 0.85;
    const wet = c.createGain();
    wet.gain.value = 0.18;

    lpf.connect(dry).connect(master);
    lpf.connect(reverb).connect(wet).connect(master);
    master.connect(c.destination);

    ctx = c;
    masterGain = master;
    voiceInputNode = lpf;
    return { ctx: c, master, input: lpf };
  } catch {
    initFailed = true;
    return null;
  }
}

/**
 * Synthesised plate-style reverb impulse: exponentially decaying noise.
 * `duration` seconds, `decay` controls how quickly the tail fades.
 */
function makeImpulseResponse(
  c: AudioContext,
  duration: number,
  decay: number,
): AudioBuffer {
  const sampleRate = c.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buf = c.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Pre-delay-ish ramp + exponential decay of white noise
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

interface VoiceOpts {
  freq: number;
  type?: OscillatorType;
  detune?: number;
  start: number; // seconds, relative to ctx.currentTime
  duration: number; // seconds (envelope length)
  attack?: number; // seconds
  release?: number; // seconds (exponential decay)
  gain?: number; // peak gain (before master)
  /** Optional FM modulator. */
  fm?: { ratio: number; depth: number };
}

function playVoice(graph: AudioGraph, dest: AudioNode, opts: VoiceOpts): void {
  const { ctx: c } = graph;
  const t0 = c.currentTime + opts.start;
  const attack = opts.attack ?? 0.008;
  const release = opts.release ?? 0.18;
  const peak = opts.gain ?? 0.5;

  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.value = opts.freq;
  if (opts.detune) osc.detune.value = opts.detune;

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + opts.duration + release);

  osc.connect(env).connect(dest);

  if (opts.fm) {
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.value = opts.freq * opts.fm.ratio;
    const modGain = c.createGain();
    modGain.gain.value = opts.freq * opts.fm.depth;
    mod.connect(modGain).connect(osc.frequency);
    mod.start(t0);
    mod.stop(t0 + attack + opts.duration + release + 0.05);
  }

  osc.start(t0);
  osc.stop(t0 + attack + opts.duration + release + 0.05);
}

function renderEvent(graph: AudioGraph, event: AudioEvent): void {
  const dest = graph.input;
  const eventGain = EVENT_GAIN[event];

  switch (event) {
    case "milestone": {
      // Single short soft tone — iOS keyboard tap, slightly more musical.
      // Pitch sits around E6 (~1318 Hz) with a subtle FM shimmer for life.
      playVoice(graph, dest, {
        freq: 1318.5,
        type: "sine",
        start: 0,
        duration: 0.04,
        attack: 0.005,
        release: 0.08,
        gain: 0.18 * eventGain,
        fm: { ratio: 2.01, depth: 0.4 },
      });
      // Tiny octave-down body so it feels grounded, not thin.
      playVoice(graph, dest, {
        freq: 659.25,
        type: "sine",
        start: 0,
        duration: 0.04,
        attack: 0.006,
        release: 0.1,
        gain: 0.06 * eventGain,
      });
      break;
    }
    case "ring_complete": {
      // Two-note ascending interval (C5 → G5) with slight detune for warmth.
      // Each note ~120ms, second begins ~110ms after first → ~250ms total.
      const c5 = 523.25;
      const g5 = 783.99;
      [
        { f: c5, s: 0 },
        { f: g5, s: 0.11 },
      ].forEach(({ f, s }) => {
        playVoice(graph, dest, {
          freq: f,
          type: "sine",
          start: s,
          duration: 0.09,
          attack: 0.008,
          release: 0.18,
          gain: 0.28 * eventGain,
        });
        playVoice(graph, dest, {
          freq: f,
          type: "sine",
          detune: 6,
          start: s,
          duration: 0.09,
          attack: 0.012,
          release: 0.18,
          gain: 0.14 * eventGain,
        });
      });
      break;
    }
    case "recovery_done": {
      // Triumphant arpeggio C5 - E5 - G5, sine + soft triangle blend, with
      // slight overlap into a longer reverb tail for warmth.
      const notes = [
        { f: 523.25, s: 0.0 },   // C5
        { f: 659.25, s: 0.13 },  // E5
        { f: 783.99, s: 0.26 },  // G5
      ];
      notes.forEach(({ f, s }) => {
        playVoice(graph, dest, {
          freq: f,
          type: "sine",
          start: s,
          duration: 0.12,
          attack: 0.01,
          release: 0.35,
          gain: 0.3 * eventGain,
        });
        playVoice(graph, dest, {
          freq: f,
          type: "triangle",
          detune: -4,
          start: s,
          duration: 0.12,
          attack: 0.014,
          release: 0.35,
          gain: 0.1 * eventGain,
        });
      });
      // Final sustain on the G5 to give it that "received" warmth.
      playVoice(graph, dest, {
        freq: 783.99,
        type: "sine",
        start: 0.4,
        duration: 0.18,
        attack: 0.02,
        release: 0.6,
        gain: 0.18 * eventGain,
      });
      break;
    }
    case "drive_warning": {
      // Single warm low tone (~A4, 440Hz) with slow decay and gentle tremolo.
      // Informative, never alarming.
      const freq = 440;
      playVoice(graph, dest, {
        freq,
        type: "sine",
        start: 0,
        duration: 0.32,
        attack: 0.025,
        release: 0.5,
        gain: 0.32 * eventGain,
      });
      // Tremolo via a second voice slightly detuned, beating against the first.
      playVoice(graph, dest, {
        freq,
        type: "sine",
        detune: 8,
        start: 0,
        duration: 0.32,
        attack: 0.04,
        release: 0.5,
        gain: 0.18 * eventGain,
      });
      // Sub-octave body for warmth.
      playVoice(graph, dest, {
        freq: freq / 2,
        type: "sine",
        start: 0,
        duration: 0.32,
        attack: 0.03,
        release: 0.55,
        gain: 0.12 * eventGain,
      });
      break;
    }
  }
}

function play(event: AudioEvent): void {
  if (!prefs.enabled) return;
  if (!isBrowser()) return;

  // Throttle so rapid milestone crossings (or repeated calls) don't stack.
  const now = Date.now();
  const last = lastPlayAt[event] ?? 0;
  const minGap = event === "milestone" ? 200 : 120;
  if (now - last < minGap) return;
  lastPlayAt[event] = now;

  const graph = ensureGraph();
  if (!graph) return;

  // Resume if suspended (autoplay policy).
  if (graph.ctx.state === "suspended") {
    graph.ctx.resume().catch(() => {
      /* ignore */
    });
  }

  try {
    renderEvent(graph, event);
  } catch {
    // Swallow — audio must never break recovery.
  }
}

function setPrefs(next: Partial<AudioPrefs>): void {
  prefs = {
    ...prefs,
    ...next,
  };
  if (typeof prefs.volume === "number") {
    prefs.volume = Math.max(0, Math.min(1, prefs.volume));
  }
  savePrefs(prefs);
  if (masterGain && ctx) {
    // Smooth the volume change so slider drags don't zipper.
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.linearRampToValueAtTime(prefs.volume, t + 0.05);
  }
}

function getPrefs(): AudioPrefs {
  return { ...prefs };
}

export const audio = {
  play,
  setPrefs,
  getPrefs,
};
