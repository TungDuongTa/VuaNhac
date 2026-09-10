import { NextResponse } from "next/server";
import { assertAdmin } from "@/src/lib/admin-auth";
import { getTrack, hasSpotifyCredentials } from "@/src/lib/spotify";
import { parseSpotifyTrackId } from "@/src/lib/spotify-url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  if (!hasSpotifyCredentials()) {
    return NextResponse.json(
      {
        error: "missing_credentials",
        message: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local",
      },
      { status: 503 },
    );
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trackId = parseSpotifyTrackId(body.url ?? "");
  if (!trackId) {
    return NextResponse.json(
      { error: "Could not parse a Spotify track ID from that link" },
      { status: 400 },
    );
  }

  try {
    const track = await getTrack(trackId);
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    return NextResponse.json({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name ?? null,
      previewUrl: track.preview_url,
      previewUpdatedAt: new Date().toISOString(),
      imageUrl: track.album.images[0]?.url ?? null,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
