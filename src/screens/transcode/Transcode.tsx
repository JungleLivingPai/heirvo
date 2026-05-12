import { TranscodePanel } from "./TranscodePanel";

export function Transcode() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Transcode</h1>
      <p className="mb-6 text-zinc-400">
        Convert recovered VOB or ISO files into modern streaming formats with
        deinterlacing and denoising.
      </p>
      <TranscodePanel />
    </div>
  );
}
