import { NextResponse } from "next/server";
import { hasSpotifyCredentials } from "@/src/lib/spotify";
import { syncSongLibrary } from "@/src/lib/sync";
import { readSongs } from "@/src/lib/songs";
import { DIFFICULTIES } from "@/src/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const songs = await readSongs();
  const withPreview = songs.filter((s) => s.previewUrl);
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => [
      d,
      withPreview.filter((s) => s.difficulty === d).length,
    ]),
  );

  return NextResponse.json({
    configured: hasSpotifyCredentials(),
    total: songs.length,
    withPreview: withPreview.length,
    byDifficulty,
  });
}

export async function POST(request: Request) {
  if (!hasSpotifyCredentials()) {
    return NextResponse.json(
      {
        error: "missing_credentials",
        message: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local",
      },
      { status: 503 },
    );
  }

  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const header = request.headers.get("x-sync-secret");
    if (header !== syncSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncSongLibrary();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
