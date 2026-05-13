import { TranscodePanel } from "./TranscodePanel";

export function Transcode() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 font-display text-[2rem] font-semibold tracking-[-0.02em] text-ink-900">
        Save a video
      </h1>
      <p className="mb-6 max-w-2xl text-[15px] leading-[1.55] text-ink-600">
        Already rescued a disc? Save it as a standard MP4 file you can play on
        any phone, TV, or computer.
      </p>
      <TranscodePanel />
    </div>
  );
}
