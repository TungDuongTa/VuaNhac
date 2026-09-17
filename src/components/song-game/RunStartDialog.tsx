"use client";

import { useEffect, useState } from "react";
import { RUN_META } from "@/src/lib/constants";

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onStart: (name: string) => void;
};

export function RunStartDialog({
  open,
  initialName,
  onClose,
  onStart,
}: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  const trimmed = name.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-start-title"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-[#121212] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="run-start-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Start a run
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Climb Easy → Impossible, then loop. One wrong song ends the run.
          Your best streak is saved to the rankings.
        </p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-500">
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed) onStart(trimmed);
            }}
            placeholder="Enter a name"
            autoFocus
            maxLength={24}
            className="w-full rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm text-white outline-none focus:border-white/35"
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/15 py-2.5 text-sm text-zinc-300 hover:border-white/30 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onStart(trimmed)}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{
              backgroundColor: RUN_META.startBg,
              color: RUN_META.startText,
            }}
          >
            Start run
          </button>
        </div>
      </div>
    </div>
  );
}
