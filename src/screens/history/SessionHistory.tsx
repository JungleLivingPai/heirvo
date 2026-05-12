import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ipc } from "@/lib/ipc";
import type { Session, SessionStatus } from "@/lib/types";
import { Trash2, ChevronRight, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = async () => setSessions(await ipc.listSessions());

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-10 py-6">
      <header className="mb-5">
        <span className="eyebrow">Your archive</span>
        <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.025em] text-ink-900">
          Sessions
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Every disc you've rescued, in the order you rescued them.
        </p>
      </header>

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-ink-200/70 border-y border-ink-200/70">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onDelete={async () => {
                if (!confirm(`Delete session "${s.user_label ?? s.disc_label}"?`)) return;
                await ipc.deleteSession(s.id);
                refresh();
              }}
              onRenamed={refresh}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-8 py-10 text-center">
      <EmptyMark />
      <h2 className="mt-4 font-display text-[18px] font-semibold tracking-tightish text-ink-900">
        No discs rescued yet.
      </h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">
        When you're ready, pop one in. We'll meet you here with everything you
        save.
      </p>
      <Link to="/wizard" className="btn btn-primary mt-5">
        Rescue your first disc
      </Link>
    </div>
  );
}

/**
 * Warm SVG illustration: a gentle disc with a soft halo and subtle
 * concentric rings — feels archival rather than clinical.
 */
function EmptyMark() {
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
      <defs>
        <radialGradient id="es-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="es-disc" x1="0" y1="0" x2="84" y2="84">
          <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#5AC8FA" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r="42" fill="url(#es-halo)" />
      <circle cx="42" cy="42" r="26" fill="url(#es-disc)" />
      <circle cx="42" cy="42" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      <circle cx="42" cy="42" r="17" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
      <circle cx="42" cy="42" r="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
      <circle cx="42" cy="42" r="6" fill="#F4F6FA" />
    </svg>
  );
}

function SessionRow({
  session: s,
  onDelete,
  onRenamed,
}: {
  session: Session;
  onDelete: () => void;
  onRenamed: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = () => {
    setDraft(s.user_label ?? s.disc_label ?? "");
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    setRenaming(false);
    await ipc.renameSession(s.id, draft);
    onRenamed();
  };

  const updated = new Date(s.updated_at * 1000);
  const dateText = updated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeText = updated.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const gb = ((s.total_sectors * 2048) / 1024 / 1024 / 1024).toFixed(2);
  const displayLabel = s.user_label || s.disc_label || "Untitled disc";

  return (
    <li className="group flex items-center gap-6 py-5">
      <div className="w-24 shrink-0">
        <div className="font-display text-[15px] font-semibold tabular-nums text-ink-900">
          {dateText}
        </div>
        <div className="text-[11px] tabular-nums text-ink-400">{timeText}</div>
      </div>

      <div className="min-w-0 flex-1">
        {renaming ? (
          <div className="flex items-center gap-2">
            <StatusDot status={s.status} />
            <input
              ref={inputRef}
              className="flex-1 rounded-lg border border-brand-300 bg-white px-2 py-0.5 text-[15px] font-medium text-ink-900 outline-none focus:ring-2 focus:ring-brand-400/30"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              autoFocus
            />
            <button
              className="rounded-lg p-1.5 text-ios-green hover:bg-ios-green/10"
              onClick={commitRename}
              title="Save name"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              to={`/session/${s.id}`}
              className="inline-flex items-center gap-1.5 text-[16px] font-medium text-ink-900 transition hover:text-brand-600"
            >
              <StatusDot status={s.status} />
              <span className="truncate">{displayLabel}</span>
              <ChevronRight className="h-4 w-4 -translate-x-0.5 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>
            <button
              className="rounded p-0.5 text-ink-300 opacity-0 transition hover:text-ink-600 group-hover:opacity-100"
              onClick={startRename}
              title="Rename session"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-500">
          <span className="capitalize">{s.status}</span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">Pass {s.current_pass || 0}</span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">{gb} GB</span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">
            {s.total_sectors.toLocaleString()} sectors
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-ink-400">
          {s.output_dir}
        </div>
      </div>

      <button
        className="rounded-lg p-2 text-ink-400 opacity-0 transition hover:bg-ios-red/10 hover:text-ios-red group-hover:opacity-100"
        onClick={onDelete}
        title="Delete session"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function StatusDot({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { color: string; pulse?: boolean }> = {
    created: { color: "#9AA6B8" },
    scanning: { color: "#0A84FF", pulse: true },
    recovering: { color: "#34C759", pulse: true },
    paused: { color: "#FF9500" },
    completed: { color: "#34C759" },
    failed: { color: "#FF3B30" },
    cancelled: { color: "#9AA6B8" },
  };
  const { color, pulse } = map[status];
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && (
        <span
          className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60")}
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}
