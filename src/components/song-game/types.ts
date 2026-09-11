import type { Difficulty, PublicSong, SearchResult, SongAnswer } from "@/src/lib/types";

export type GameStatus =
  | "loading"
  | "ready"
  | "won"
  | "lost"
  | "setup"
  | "error";

export type SongStartMode = "spotify" | "fromStart";

export type DifficultyMeta = {
  label: string;
  color: string;
  activeBg: string;
  idleBg: string;
  panelBg: string;
  panelBorder: string;
};

export type { Difficulty, PublicSong, SearchResult, SongAnswer };
