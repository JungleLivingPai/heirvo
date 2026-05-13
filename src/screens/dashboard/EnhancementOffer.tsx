import { useEffect, useState, useRef } from "react";
import { Sparkles, ArrowRight, Loader2, X, CheckCircle2, Info } from "lucide-react";
import { ipc, events } from "@/lib/ipc";
import type { AiPreset, EnhancementJob } from "@/lib/types";

interface Props {
  /** Path to the saved MP4 the user just produced, or null if not yet saved. */
  savedVideoPath: string | null;
  /** Called when the user clicks "Keep the improved version". */
  onAccepted?: (newPath: string) => void;
}

type Step = "idle" | "working" | "preview" | "failed";

/**
 * Contextual offer + 3-step modal that replaces the old "AI Enhancement
 * Studio" screen. Stays silent until the user has actually saved a video,
 * then offers a single optional clean-up. No jargon, no model picker, no
 * amber warnings — and the user's original is never touched.
 */
export function EnhancementOffer({ savedVideoPath, onAccepted }: Props): JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("heirvo:enhancement-offer-dismissed") === "1";
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<number | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);

  const jobIdRef = useRef<number | null>(null);
  jobIdRef.current = jobId;

  useEffect(() => {
    if (!modalOpen) return;

    const offProgress = events.onEnhancementProgress((payload: any) => {
      const id = payload?.jobId ?? payload?.id;
      const pct = payload?.progress ?? payload?.percent ?? payload;
      if (jobIdRef.current != null && id != null && id !== jobIdRef.current) return;
      if (typeof pct === "number") {
        setProgress(Math.max(0, Math.min(100, pct)));
      }
    });

    const offComplete = events.onEnhancementComplete(async (payload: any) => {
      const id = payload?.jobId ?? payload?.id;
      if (jobIdRef.current != null && id != null && id !== jobIdRef.current) return;

      const outputPath: string | undefined =
        payload?.outputPath ?? payload?.output ?? payload?.path;
      if (outputPath) setResultPath(outputPath);

      try {
        if (!savedVideoPath) throw new Error("missing input");
        const preview: any = await ipc.enhancePreview(
          savedVideoPath,
          30,
          "auto" as unknown as AiPreset,
        );
        setOriginalPreview(preview?.originalPath ?? preview?.original_path ?? null);
        setEnhancedPreview(preview?.enhancedPath ?? preview?.enhanced_path ?? null);
        setProgress(100);
        setStep("preview");
      } catch (err) {
        console.error("[EnhancementOffer] preview failed", err);
        setStep("failed");
      }
    });

    const offError = events.onEnhancementError((payload: any) => {
      const id = payload?.jobId ?? payload?.id;
      if (jobIdRef.current != null && id != null && id !== jobIdRef.current) return;
      console.error("[EnhancementOffer] enhancement error", payload);
      setStep("failed");
    });

    return () => {
      void offProgress.then((fn) => fn());
      void offComplete.then((fn) => fn());
      void offError.then((fn) => fn());
    };
  }, [modalOpen, savedVideoPath]);

  if (!savedVideoPath) return null;

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem("heirvo:enhancement-offer-dismissed", "1");
    } catch (e) {
      /* noop */
    }
    setDismissed(true);
  };

  const startEnhancement = async () => {
    setModalOpen(true);
    setStep("working");
    setProgress(0);
    setOriginalPreview(null);
    setEnhancedPreview(null);
    setResultPath(null);
    setSliderPos(50);

    try {
      const job = {
        input: savedVideoPath,
        preset: "auto",
        model: "auto",
      } as unknown as EnhancementJob;
      const id = await ipc.queueEnhancement(job);
      setJobId(id);
    } catch (err) {
      console.error("[EnhancementOffer] failed to queue enhancement", err);
      setStep("failed");
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setStep("idle");
    setJobId(null);
    setProgress(0);
    setOriginalPreview(null);
    setEnhancedPreview(null);
    setResultPath(null);
  };

  const handleStop = async () => {
    try {
      if (jobId != null) {
        await (ipc as any).cancelEnhancement?.(jobId);
      }
    } catch (err) {
      console.error("[EnhancementOffer] cancel failed", err);
    }
    closeModal();
  };

  const handleKeep = () => {
    if (resultPath && onAccepted) {
      onAccepted(resultPath);
    }
    closeModal();
  };

  return (
    <>
      {!dismissed && !modalOpen && (
        <div className="mt-4 rounded-3xl border border-brand-100 bg-brand-50/60 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink-900">
                Want to make this video look sharper?
              </h3>
              <p className="mt-1 text-[15px] leading-[1.55] text-ink-600">
                We can clean up old, grainy footage in about a minute. Your
                original stays safe.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={startEnhancement}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-2.5 text-[15px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  Try it
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-[14px] text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {step !== "working" && (
              <button
                type="button"
                onClick={closeModal}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            )}

            {step === "working" && (
              <div className="px-8 py-10">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden />
                  <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink-900">
                    Cleaning up your video…
                  </h2>
                </div>
                <p className="mt-2 text-[15px] leading-[1.55] text-ink-600">
                  This usually takes a minute or two.
                </p>

                <div className="mt-8">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[13px] text-ink-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" aria-hidden />
                      Your original is safe.
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStop}
                    className="rounded-2xl border border-ink-200 bg-white px-5 py-2.5 text-[15px] font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {step === "preview" && (
              <div className="px-8 py-10">
                <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink-900">
                  Take a look at the difference.
                </h2>
                <p className="mt-2 text-[15px] leading-[1.55] text-ink-600">
                  Drag the slider to compare.
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-ink-50">
                  <div className="relative aspect-video w-full select-none">
                    {originalPreview && (
                      <img
                        src={originalPreview}
                        alt="Original frame"
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                      />
                    )}
                    {enhancedPreview && (
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: `${sliderPos}%` }}
                      >
                        <img
                          src={enhancedPreview}
                          alt="Improved frame"
                          className="absolute inset-0 h-full object-cover"
                          style={{
                            width: `${(100 / Math.max(sliderPos, 1)) * 100}%`,
                            maxWidth: "none",
                          }}
                          draggable={false}
                        />
                      </div>
                    )}
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-md"
                      style={{ left: `${sliderPos}%` }}
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
                      Improved
                    </div>
                    <div className="absolute right-3 top-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
                      Original
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                      aria-label="Compare improved and original"
                    />
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-ink-200 bg-white px-5 py-3 text-[15px] font-medium text-ink-700 transition hover:bg-ink-50"
                  >
                    No thanks, keep my original
                  </button>
                  <button
                    type="button"
                    onClick={handleKeep}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-[15px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Keep the improved version
                  </button>
                </div>
              </div>
            )}

            {step === "failed" && (
              <div className="px-8 py-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Info className="h-5 w-5" aria-hidden />
                  </div>
                  <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink-900">
                    We weren't able to clean this one up.
                  </h2>
                </div>
                <p className="mt-3 text-[15px] leading-[1.55] text-ink-600">
                  Your original video is safe and unchanged. You can try again
                  later or just keep it as it is.
                </p>

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl bg-brand-600 px-5 py-3 text-[15px] font-medium text-white shadow-glow-blue transition hover:bg-brand-500"
                  >
                    OK, that's fine
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
