import type { Difficulty, MusicCatalog } from "./types";

export type RunResult = {
  id: string;
  playerName: string;
  /** Primary catalog (first enabled) — kept for older rows. */
  catalog: MusicCatalog;
  /** Catalogs enabled during the run. */
  catalogs: MusicCatalog[];
  /** Songs cleared during the run (displayed as Wins). */
  correctCount: number;
  /** Total points from correct guesses (shorter clip = more points). */
  points: number;
  /** How many songs were guessed correctly at the 0.1s clip. */
  instantHits: number;
  highestDifficulty: Difficulty;
  createdAt: string;
};

export type RunSubmitInput = {
  playerName: string;
  catalogs: MusicCatalog[];
  correctCount: number;
  points: number;
  instantHits: number;
  highestDifficulty: Difficulty;
};
