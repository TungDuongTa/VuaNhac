"use client";

import Link from "next/link";
import { RUN_META } from "@/src/lib/constants";

type Props = {
  open: boolean;
  playerName: string;
  correctCount: number;
  avgTimeMs: number;
  onPlayAgain: () => void;
  onCasual: () => void;
};

function formatAvg(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toFixed(0)}s`;
}

export function RunEndDialog({
  open,
  playerName,
  correctCount,
  avgTimeMs,
  onPlayAgain,
  onCasual,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-end-title"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#121212] p-5 shadow-2xl"
      >
        <h2
          id="run-end-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Run over
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Nice try, <span className="text-white">{playerName}</span>.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Correct
            </p>
            <p className="mt-1 text-2xl font-bold text-white">{correctCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Avg time
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {formatAvg(avgTimeMs)}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/ranking"
            className="rounded-full py-2.5 text-center text-sm font-semibold"
            style={{
              backgroundColor: RUN_META.startBg,
              color: RUN_META.startText,
            }}
          >
            View rankings
          </Link>
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-full border border-white/15 py-2.5 text-sm text-zinc-200 hover:border-white/30 hover:text-white"
          >
            Run again
          </button>
          <button
            type="button"
            onClick={onCasual}
            className="rounded-full py-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            Back to casual
          </button>
        </div>
      </div>
    </div>
  );
}
