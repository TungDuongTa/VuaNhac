import type { Difficulty, MusicCatalog } from "./types";

export type RunResult = {
  id: string;
  playerName: string;
  catalog: MusicCatalog;
  correctCount: number;
  /** Average wall-clock solve time in ms across correct songs (0 if none). */
  avgTimeMs: number;
  totalTimeMs: number;
  highestDifficulty: Difficulty;
  createdAt: string;
};

export type RunSubmitInput = {
  playerName: string;
  catalog: MusicCatalog;
  correctCount: number;
  totalTimeMs: number;
  highestDifficulty: Difficulty;
};
