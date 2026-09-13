import { NextResponse } from "next/server";
import { isMusicCatalog, readSongs } from "@/src/lib/songs";
import type { SearchResult } from "@/src/lib/types";
import { normalizeVietnamese } from "@/src/lib/vietnamese";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const catalogParam = searchParams.get("catalog");

  if (q.length < 1) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  const catalog =
    catalogParam && isMusicCatalog(catalogParam) ? catalogParam : undefined;
  const pool = await readSongs(catalog ? { catalog } : undefined);
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
    .slice(0, 12);

  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const { song } of scored) {
    if (seen.has(song.spotifyId)) continue;
    seen.add(song.spotifyId);
    results.push({
      id: song.spotifyId,
      title: song.title,
      artist: song.artist,
      imageUrl: song.imageUrl,
    });
  }

  return NextResponse.json({ results });
}
