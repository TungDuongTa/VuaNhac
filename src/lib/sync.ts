import { SEED_QUERIES } from "./constants";
import {
  getPlaylistTracks,
  hasSpotifyCredentials,
  resolvePreviewUrl,
  searchTracks,
  type SpotifyTrack,
} from "./spotify";
import { upsertSongs } from "./songs";
import type { Difficulty, Song } from "./types";
import { DIFFICULTIES } from "./constants";

function playlistEnvKey(difficulty: Difficulty): string {
  return `SPOTIFY_PLAYLIST_${difficulty.toUpperCase()}`;
}

async function withPreview(
  track: SpotifyTrack,
): Promise<(SpotifyTrack & { preview_url: string }) | null> {
  const fromApi = track.preview_url;
  if (fromApi) return { ...track, preview_url: fromApi };

  const fromEmbed = await resolvePreviewUrl(track.id);
  if (!fromEmbed) return null;
  return { ...track, preview_url: fromEmbed };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function trackToSong(
  track: SpotifyTrack & { preview_url: string },
  difficulty: Difficulty,
): Song {
  return {
    spotifyId: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name ?? null,
    previewUrl: track.preview_url,
    previewUpdatedAt: new Date().toISOString(),
    imageUrl: track.album.images[0]?.url ?? null,
    difficulty,
  };
}

export async function syncSongLibrary(): Promise<{
  added: number;
  totalWithPreview: number;
  scanned: number;
  byDifficulty: Record<Difficulty, number>;
  warnings: string[];
}> {
  if (!hasSpotifyCredentials()) {
    throw new Error("Spotify credentials missing");
  }

  const collected: Song[] = [];
  const warnings: string[] = [];
  let scanned = 0;

  for (const difficulty of DIFFICULTIES) {
    const playlistId = process.env[playlistEnvKey(difficulty)]?.trim();
    let tracks: SpotifyTrack[] = [];

    if (playlistId) {
      try {
        tracks = await getPlaylistTracks(playlistId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`${difficulty} playlist: ${message}`);
      }
    } else {
      for (const query of SEED_QUERIES[difficulty]) {
        try {
          const found = await searchTracks(query, 5);
          tracks.push(...found);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`${difficulty} "${query}": ${message}`);
        }
      }
    }

    const unique: SpotifyTrack[] = [];
    const seen = new Set<string>();
    for (const track of tracks) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      unique.push(track);
    }
    scanned += unique.length;

    const resolved = await mapPool(unique, 4, withPreview);
    for (const playable of resolved) {
      if (!playable) continue;
      collected.push(trackToSong(playable, difficulty));
    }
  }

  if (collected.length === 0) {
    throw new Error(
      warnings[0] ??
        `Synced 0 playable tracks (scanned ${scanned}). Spotify API no longer returns preview_url for new apps; embed lookup also failed.`,
    );
  }

  const added = await upsertSongs(collected);
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => [
      d,
      collected.filter((s) => s.difficulty === d).length,
    ]),
  ) as Record<Difficulty, number>;

  return {
    added,
    totalWithPreview: collected.length,
    scanned,
    byDifficulty,
    warnings,
  };
}
