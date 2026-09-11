"use client";

import { useEffect } from "react";
import { RerollIcon } from "./icons";
import { SettingsPanel, type SettingsPanelProps } from "./SettingsPanel";
import type { GameStatus } from "./types";

type Props = SettingsPanelProps & {
  open: boolean;
  status: GameStatus;
  onClose: () => void;
  onOpen: () => void;
  onReroll: () => void;
};

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function MobileSettingsMenu({
  open,
  status,
  onClose,
  onOpen,
  onReroll,
  ...settings
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className="absolute right-4 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white lg:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <HamburgerIcon open={open} />
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Close menu overlay"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(100vw-3rem,20rem)] flex-col bg-[#0c0c0c] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open
            ? "pointer-events-auto translate-x-0"
            : "pointer-events-none translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">Settings</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-zinc-400 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <button
            type="button"
            onClick={() => {
              onReroll();
              onClose();
            }}
            disabled={status === "loading"}
            className="mb-7 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#1c1c1c] py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            <RerollIcon />
            Reroll
          </button>

          <SettingsPanel {...settings} />
        </div>
      </div>
    </>
  );
}
