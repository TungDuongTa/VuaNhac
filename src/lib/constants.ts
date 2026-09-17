import type { Difficulty, MusicCatalog } from "./types";

export const DIFFICULTIES: Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "impossible",
];

export function nextDifficulty(current: Difficulty): Difficulty {
  const index = DIFFICULTIES.indexOf(current);
  if (index < 0) return "easy";
  return DIFFICULTIES[(index + 1) % DIFFICULTIES.length]!;
}

export function previousDifficulty(current: Difficulty): Difficulty {
  const index = DIFFICULTIES.indexOf(current);
  if (index < 0) return "easy";
  return DIFFICULTIES[(index - 1 + DIFFICULTIES.length) % DIFFICULTIES.length]!;
}

export const MUSIC_CATALOGS: MusicCatalog[] = ["vietnamese", "worldwide"];

export const CATALOG_META: Record<
  MusicCatalog,
  {
    label: string;
    shortLabel: string;
    color: string;
    activeBg: string;
    idleBg: string;
  }
> = {
  vietnamese: {
    label: "Việt Nam",
    shortLabel: "VN",
    color: "#fb7185",
    activeBg: "#e11d48",
    idleBg: "rgba(225, 29, 72, 0.16)",
  },
  worldwide: {
    label: "Worldwide",
    shortLabel: "World",
    color: "#38bdf8",
    activeBg: "#0ea5e9",
    idleBg: "rgba(14, 165, 233, 0.16)",
  },
};

export const RUN_META = {
  startBg: "#1ed760",
  startText: "#0a0a0a",
  startHover: "#17c653",
  endColor: "#f87171",
  endBorder: "rgba(248, 113, 113, 0.35)",
  endBg: "rgba(248, 113, 113, 0.12)",
} as const;

export const DIFFICULTY_META: Record<
  Difficulty,
  {
    label: string;
    color: string;
    activeBg: string;
    idleBg: string;
    /** Middle panel wash / border tint */
    panelBg: string;
    panelBorder: string;
  }
> = {
  easy: {
    label: "Easy",
    color: "#4ade80",
    activeBg: "#22c55e",
    idleBg: "rgba(34, 197, 94, 0.14)",
    panelBg: "#0a100c",
    panelBorder: "rgba(34, 197, 94, 0.28)",
  },
  medium: {
    label: "Medium",
    color: "#facc15",
    activeBg: "#eab308",
    idleBg: "rgba(234, 179, 8, 0.14)",
    panelBg: "#16180f",
    panelBorder: "rgba(234, 179, 8, 0.35)",
  },
  hard: {
    label: "Hard",
    color: "#fb923c",
    activeBg: "#f97316",
    idleBg: "rgba(249, 115, 22, 0.14)",
    panelBg: "#1a0e08",
    panelBorder: "rgba(249, 115, 22, 0.45)",
  },
  expert: {
    label: "Expert",
    color: "#f87171",
    activeBg: "#ef4444",
    idleBg: "rgba(239, 68, 68, 0.14)",
    panelBg: "#1a080a",
    panelBorder: "rgba(239, 68, 68, 0.5)",
  },
  impossible: {
    label: "Impossible",
    color: "#c084fc",
    activeBg: "#a855f7",
    idleBg: "rgba(168, 85, 247, 0.14)",
    panelBg: "#14081a",
    panelBorder: "rgba(168, 85, 247, 0.5)",
  },
};

/** Default clip lengths per guess (seconds). */
export const GUESS_DURATIONS = [0.1, 0.5, 2, 8, 15] as const;

/** Progress bar uses at least this many seconds as its timeline (keeps early stages from feeling too fast). */
export const PROGRESS_SPEED_FLOOR = 8;

/** All stage chips shown in settings (toggle to include). */
export const STAGE_OPTIONS = [0.01, 0.1, 0.5, 2, 4, 8, 15] as const;

export const ACCENT = "#1ed760";
export const PANEL_IDLE = "#2a2a2a";

/**
 * Fallback search queries used by /api/sync when playlist IDs are not set.
 */
export const SEED_QUERIES: Record<Difficulty, string[]> = {
  easy: [
    "Blinding Lights The Weeknd",
    "Shape of You Ed Sheeran",
    "Levitating Dua Lipa",
    "As It Was Harry Styles",
    "Flowers Miley Cyrus",
  ],
  medium: [
    "Somebody That I Used To Know Gotye",
    "Pumped Up Kicks Foster the People",
    "Take Me To Church Hozier",
    "Radioactive Imagine Dragons",
  ],
  hard: [
    "Mr Brightside The Killers",
    "Seven Nation Army White Stripes",
    "Clocks Coldplay",
    "Karma Police Radiohead",
  ],
  expert: [
    "Only Shallow My Bloody Valentine",
    "Everlong Foo Fighters",
    "Paranoid Android Radiohead",
    "Where Is My Mind Pixies",
  ],
  impossible: [
    "Idioteque Radiohead",
    "Venus In Furs Velvet Underground",
    "Heroin Velvet Underground",
    "A Day In The Life The Beatles",
  ],
};
