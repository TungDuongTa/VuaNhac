export type Difficulty = "easy" | "medium" | "hard" | "expert" | "impossible";

export type Song = {
  spotifyId: string;
  title: string;
  artist: string;
  album?: string | null;
  /** Spotify ~30s highlight preview. */
  previewUrl: string | null;
  previewUpdatedAt: string | null;
  imageUrl: string | null;
  difficulty: Difficulty;
  /** Hosted ~30s clip from song start (R2). Used by "From the start" mode. */
  hostedUrl?: string | null;
};

export type PublicSong = {
  id: string;
  previewUrl: string | null;
  hostedUrl: string | null;
  imageUrl: string | null;
  difficulty: Difficulty;
  guessDurations: number[];
};

export type SongAnswer = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
};

export type SearchResult = {
  id: string;
  title: string;
  artist: string;
  imageUrl: string | null;
};
