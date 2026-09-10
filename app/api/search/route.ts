import { NextResponse } from "next/server";
import { DIFFICULTIES } from "@/src/lib/constants";
import { getSongsByDifficulty } from "@/src/lib/songs";
import type { Difficulty, SearchResult } from "@/src/lib/types";
import { normalizeVietnamese } from "@/src/lib/vietnamese";

export const dynamic = "force-dynamic";

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const difficultyParam = searchParams.get("difficulty") ?? "easy";

  if (!isDifficulty(difficultyParam)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  if (q.length < 1) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  const pool = await getSongsByDifficulty(difficultyParam);
  const needle = normalizeVietnamese(q);

  const scored = pool
    .map((song) => {
      const title = normalizeVietnamese(song.title);
      const artist = normalizeVietnamese(song.artist);
      const hay = `${title} ${artist}`;
      let score = 0;
      if (title.startsWith(needle)) score += 100;
      else if (title.includes(needle)) score += 60;
      if (artist.startsWith(needle)) score += 40;
      else if (artist.includes(needle)) score += 20;
      if (hay.includes(needle)) score += 10;
      return { song, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const results: SearchResult[] = scored.map(({ song }) => ({
    id: song.spotifyId,
    title: song.title,
    artist: song.artist,
    imageUrl: song.imageUrl,
  }));

  return NextResponse.json({ results });
}
