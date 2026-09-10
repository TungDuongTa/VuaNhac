import { NextResponse } from "next/server";
import { assertAdmin } from "@/src/lib/admin-auth";
import { DIFFICULTIES } from "@/src/lib/constants";
import {
  createSong,
  listAdminSongs,
  migrateFromJsonIfEmpty,
} from "@/src/lib/songs";
import type { Difficulty, Song } from "@/src/lib/types";

export const dynamic = "force-dynamic";

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

export async function GET(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  await migrateFromJsonIfEmpty();

  const { searchParams } = new URL(request.url);
  const difficultyParam = searchParams.get("difficulty");
  const q = searchParams.get("q") ?? undefined;
  const difficulty =
    difficultyParam && isDifficulty(difficultyParam)
      ? difficultyParam
      : undefined;

  const songs = await listAdminSongs({ difficulty, q });
  return NextResponse.json({ songs });
}

export async function POST(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  let body: Partial<Song>;
  try {
    body = (await request.json()) as Partial<Song>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.spotifyId?.trim() || !body.title?.trim() || !body.artist?.trim()) {
    return NextResponse.json(
      { error: "spotifyId, title, and artist are required" },
      { status: 400 },
    );
  }
  if (!isDifficulty(body.difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  try {
    const song = await createSong({
      spotifyId: body.spotifyId,
      title: body.title,
      artist: body.artist,
      album: body.album ?? null,
      previewUrl: body.previewUrl ?? null,
      previewUpdatedAt: body.previewUpdatedAt ?? new Date().toISOString(),
      imageUrl: body.imageUrl ?? null,
      difficulty: body.difficulty,
      hostedUrl: body.hostedUrl ?? null,
    });
    return NextResponse.json({ song }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
