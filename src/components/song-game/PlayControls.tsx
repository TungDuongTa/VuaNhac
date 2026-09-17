import type { PublicSong } from "@/src/lib/types";
import { PlayIcon } from "./icons";
import type { SongStartMode } from "./types";
import { formatDuration } from "./utils";

type Props = {
  song: PublicSong | null;
  playing: boolean;
  maxGuesses: number;
  currentDuration: number;
  songStart: SongStartMode;
  accent: string;
  onPlay: () => void;
};

export function PlayControls({
  song,
  playing,
  maxGuesses,
  currentDuration,
  songStart,
  accent,
  onPlay,
}: Props) {
  const disabled =
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
        className="flex h-28 w-28 items-center justify-center rounded-full text-black transition hover:scale-105 active:scale-95 disabled:opacity-40 sm:h-32 sm:w-32"
        style={{
          backgroundColor: accent,
          boxShadow: playing ? `0 0 48px ${accent}55` : "none",
        }}
        aria-label={playing ? "Pause clip" : "Play clip"}
      >
        {playing ? (
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
        style={{ color: accent }}
      >
        {formatDuration(currentDuration)}
      </span>
    </div>
  );
}
