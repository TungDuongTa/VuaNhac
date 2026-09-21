import type { PublicSong } from "@/src/lib/types";
import { PlayIcon } from "./icons";
import type { SongStartMode } from "./types";
import { formatDuration } from "./utils";

type Props = {
  song: PublicSong | null;
  playing: boolean;
  loading?: boolean;
  maxGuesses: number;
  currentDuration: number;
  songStart: SongStartMode;
  accent: string;
  onPlay: () => void;
};

export function PlayControls({
  song,
  playing,
  loading = false,
  maxGuesses,
  currentDuration,
  songStart,
  accent,
  onPlay,
}: Props) {
  const disabled =
    loading ||
    !song ||
    maxGuesses === 0 ||
    (songStart === "fromStart" ? !song.hostedUrl : !song.previewUrl);

  return (
    <div
      className="relative flex w-full items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onPlay}
        disabled={disabled}
        className="flex h-28 w-28 items-center justify-center rounded-full text-black transition hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:active:scale-100 sm:h-32 sm:w-32"
        style={{
          backgroundColor: accent,
          boxShadow: playing && !loading ? `0 0 48px ${accent}55` : "none",
          opacity: loading ? 0.85 : disabled && !loading ? 0.4 : 1,
        }}
        aria-label={
          loading ? "Loading song" : playing ? "Pause clip" : "Play clip"
        }
        aria-busy={loading}
      >
        {loading ? (
          <span
            className="h-12 w-12 animate-spin rounded-full border-[3px] border-black/25 border-t-black sm:h-14 sm:w-14"
            aria-hidden
          />
        ) : playing ? (
          <span className="flex gap-2">
            <span className="h-10 w-2.5 rounded-full bg-black" />
            <span className="h-10 w-2.5 rounded-full bg-black" />
          </span>
        ) : (
          <PlayIcon className="ml-1.5 h-14 w-14 text-black sm:h-16 sm:w-16" />
        )}
      </button>
      <span
        className="absolute right-0 font-mono text-lg font-semibold tabular-nums sm:text-xl"
        style={{ color: accent, opacity: loading ? 0.45 : 1 }}
      >
        {formatDuration(currentDuration)}
      </span>
    </div>
  );
}
