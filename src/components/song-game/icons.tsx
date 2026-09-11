import type { CSSProperties } from "react";
import { PANEL_IDLE } from "@/src/lib/constants";

export function SettingsPill({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center rounded-full px-5 text-center text-sm font-semibold transition-colors"
      style={
        active
          ? { backgroundColor: accent, color: "#0a0a0a" }
          : { backgroundColor: PANEL_IDLE, color: "#f4f4f5" }
      }
    >
      {label}
    </button>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
    </svg>
  );
}

export function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M3 10h2v4H3zm4-4h2v12H7zm4-3h2v18h-2zm4 5h2v8h-2zm4-2h2v12h-2z" />
    </svg>
  );
}

export function TimerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 fill-none stroke-current stroke-2"
      aria-hidden
    >
      <circle cx="12" cy="13" r="7" />
      <path d="M12 10v3l2 1M9 3h6" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a3.5 3.5 0 0 0-1.5-2.8v5.6a3.5 3.5 0 0 0 1.5-2.8z" />
    </svg>
  );
}

export function RerollIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.9 3.1L6.7 17.5A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7zm-5 5a5 5 0 0 1 8.9-3.1l1.4-1.4A7 7 0 0 0 5 13c0 .7.1 1.37.3 2H7.1A5 5 0 0 1 7 11z" />
    </svg>
  );
}

export function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M4 5v14l9-7zm11 0v14h2V5z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current stroke-2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

export type VolumeStyle = CSSProperties & {
  "--vol"?: number;
  "--accent"?: string;
};
