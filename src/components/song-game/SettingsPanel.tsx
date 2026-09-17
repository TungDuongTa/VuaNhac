import type { CSSProperties } from "react";
import Link from "next/link";
import { PANEL_IDLE, STAGE_OPTIONS } from "@/src/lib/constants";
import type { PublicSong } from "@/src/lib/types";
import { SettingsPill, SpeakerIcon, TimerIcon, WaveIcon } from "./icons";
import type { SongStartMode } from "./types";
import { formatDuration } from "./utils";

export type SettingsPanelProps = {
  song: PublicSong | null;
  songStart: SongStartMode;
  stages: number[];
  volume: number;
  accent: string;
  onSongStartChange: (mode: SongStartMode) => void;
  onToggleStage: (stage: number) => void;
  onVolumeChange: (volume: number) => void;
};

export function SettingsPanel({
  song,
  songStart,
  stages,
  volume,
  accent,
  onSongStartChange,
  onToggleStage,
  onVolumeChange,
}: SettingsPanelProps) {
  return (
    <div className="flex w-full flex-col items-center space-y-7">
      <Link
        href="/ranking"
        className="w-full rounded-full border border-white/15 bg-[#1c1c1c] py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:text-white"
      >
        Rankings
      </Link>

      <section className="w-full">
        <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
          <WaveIcon />
          SONG START
        </h2>
        <div className="flex flex-col gap-2">
          <SettingsPill
            active={songStart === "spotify"}
            onClick={() => onSongStartChange("spotify")}
            label="Spotify preview"
            accent={accent}
          />
          <SettingsPill
            active={songStart === "fromStart"}
            onClick={() => onSongStartChange("fromStart")}
            label="From the start"
            accent={accent}
          />
        </div>
        {songStart === "fromStart" && !song?.hostedUrl && (
          <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
            Needs a hosted ~30s R2 clip (`hostedUrl`).
          </p>
        )}
        {songStart === "spotify" && !song?.previewUrl && (
          <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
            No Spotify preview for this track.
          </p>
        )}
      </section>

      <section className="w-full">
        <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
          <TimerIcon />
          STAGES
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {STAGE_OPTIONS.map((stage) => {
            const active = stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onToggleStage(stage)}
                className="flex h-9 w-[3.75rem] items-center justify-center rounded-full text-center text-sm font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: accent, color: "#0a0a0a" }
                    : { backgroundColor: PANEL_IDLE, color: "#e4e4e7" }
                }
              >
                {formatDuration(stage)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="w-full">
        <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
          <SpeakerIcon />
          VOLUME
        </h2>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="volume-slider w-full"
          style={
            {
              ["--vol" as never]: Math.round(volume * 100),
              ["--accent" as never]: accent,
            } as CSSProperties
          }
          aria-label="Volume"
        />
      </section>
    </div>
  );
}
