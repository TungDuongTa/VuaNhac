import { NextResponse } from "next/server";
import { GUESS_DURATIONS } from "@/src/lib/constants";
import {
  dailyIndex,
  getSongsByDifficulty,
  migrateFromJsonIfEmpty,
  todayKey,
  updateSongPreview,
} from "@/src/lib/songs";
import { getTrack, hasSpotifyCredentials } from "@/src/lib/spotify";
import type { Difficulty, PublicSong } from "@/src/lib/types";
import { DIFFICULTIES } from "@/src/lib/constants";

export const dynamic = "force-dynamic";

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficultyParam = searchParams.get("difficulty") ?? "easy";

  if (!isDifficulty(difficultyParam)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  await migrateFromJsonIfEmpty();

  const pool = await getSongsByDifficulty(difficultyParam);

  if (pool.length === 0) {
    if (!hasSpotifyCredentials()) {
      return NextResponse.json(
        {
          error: "missing_credentials",
          message:
            "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local, then add songs via /admin or POST /api/sync.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: "empty_pool",
        message:
          "No playable songs for this difficulty. Add tracks in /admin or run POST /api/sync.",
      },
      { status: 404 },
    );
  }

  const dateKey = todayKey();
  const excludeId = searchParams.get("exclude")?.trim() || null;
  const random = searchParams.get("random") === "1" || searchParams.get("reroll") === "1";

  let index = dailyIndex(dateKey, difficultyParam, pool.length);
  if (random) {
    if (pool.length === 1) {
      index = 0;
    } else {
      const candidates = pool
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !excludeId || s.spotifyId !== excludeId);
      const pick = candidates.length > 0 ? candidates : pool.map((s, i) => ({ s, i }));
      index = pick[Math.floor(Math.random() * pick.length)]!.i;
    }
  }
  let song = pool[index]!;

  const isLocalPreview =
    song.previewUrl?.startsWith("/") ||
    song.previewUrl?.startsWith("http://localhost");

  // Refresh Spotify CDN previews when we rely on them (skip if hosted clip exists).
  if (
    !song.hostedUrl &&
    hasSpotifyCredentials() &&
    !isLocalPreview
  ) {
    try {
      const fresh = await getTrack(song.spotifyId);
      if (fresh?.preview_url) {
        await updateSongPreview(song.spotifyId, fresh.preview_url);
        song = { ...song, previewUrl: fresh.preview_url };
      } else if (!song.previewUrl) {
        for (let i = 1; i < pool.length; i += 1) {
          const candidate = pool[(index + i) % pool.length]!;
          if (candidate.hostedUrl) {
            song = candidate;
            break;
          }
          const t = await getTrack(candidate.spotifyId);
          if (t?.preview_url) {
            await updateSongPreview(candidate.spotifyId, t.preview_url);
            song = { ...candidate, previewUrl: t.preview_url };
            break;
          }
        }
      }
    } catch {
      // Keep cached preview if refresh fails
    }
  }

  if (!song.hostedUrl && !song.previewUrl) {
    return NextResponse.json(
      {
        error: "no_preview",
        message: "Could not get a playable clip for today's song.",
      },
      { status: 502 },
    );
  }

  const payload: PublicSong = {
    id: song.spotifyId,
    previewUrl: song.previewUrl,
    hostedUrl: song.hostedUrl ?? null,
    imageUrl: song.imageUrl,
    difficulty: song.difficulty,
    guessDurations: [...GUESS_DURATIONS],
  };

  return NextResponse.json({
    date: dateKey,
    song: payload,
  });
}
