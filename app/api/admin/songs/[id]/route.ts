import { NextResponse } from "next/server";
import { assertAdmin } from "@/src/lib/admin-auth";
import { DIFFICULTIES } from "@/src/lib/constants";
import { deleteHostedAudioByUrl } from "@/src/lib/r2";
import {
  deleteSongById,
  getSongById,
  updateSongById,
} from "@/src/lib/songs";
import type { Difficulty, Song } from "@/src/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

export async function GET(request: Request, ctx: Ctx) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const song = await getSongById(id);
  if (!song) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ song });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  let body: Partial<Song>;
  try {
    body = (await request.json()) as Partial<Song>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.difficulty !== undefined && !isDifficulty(body.difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  try {
    const song = await updateSongById(id, body);
    return NextResponse.json({ song });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("already exists")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const song = await deleteSongById(id);
  if (!song) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteHostedAudioByUrl(song.hostedUrl);
  return NextResponse.json({ ok: true, song });
}
