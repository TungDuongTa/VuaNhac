import confetti from "canvas-confetti";
import type { PublicSong } from "@/src/lib/types";
import type { SongStartMode } from "./types";

/** Same palette as guessable.gg; bursts clipped to the middle panel canvas */
const WIN_CONFETTI_COLORS = ["#1FDF6A", "#F2F4F3", "#0FBF56", "#7CF5AD"];

export function fireWinConfetti(canvas: HTMLCanvasElement): {
  timers: number[];
  reset: () => void;
} {
  const timers: number[] = [];
  const fire = confetti.create(canvas, {
    resize: true,
    disableForReducedMotion: true,
  });

  const burst = (opts: confetti.Options) => {
    fire({
      colors: WIN_CONFETTI_COLORS,
      ticks: 160,
      gravity: 1.05,
      scalar: 0.9,
      ...opts,
    });
  };

  burst({
    particleCount: 48,
    spread: 58,
    angle: 60,
    startVelocity: 32,
    origin: { x: 0.02, y: 0.62 },
  });
  burst({
    particleCount: 48,
    spread: 58,
    angle: 120,
    startVelocity: 32,
    origin: { x: 0.98, y: 0.62 },
  });
  timers.push(
    window.setTimeout(() => {
      burst({
        particleCount: 56,
        spread: 72,
        angle: 90,
        startVelocity: 36,
        origin: { x: 0.5, y: 0.96 },
      });
    }, 220),
  );

  return { timers, reset: () => fire.reset() };
}

export function playbackPlan(
  song: PublicSong,
  mode: SongStartMode,
): { src: string } | null {
  if (mode === "fromStart") {
    return song.hostedUrl ? { src: song.hostedUrl } : null;
  }
  return song.previewUrl ? { src: song.previewUrl } : null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${seconds}s`;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds}s`;
}
