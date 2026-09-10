import { NextResponse } from "next/server";
import { assertAdmin } from "@/src/lib/admin-auth";
import { DIFFICULTIES } from "@/src/lib/constants";
import { hasR2Credentials, uploadHostedAudio } from "@/src/lib/r2";
import { updateSongById } from "@/src/lib/songs";
import type { Difficulty } from "@/src/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".wav")) return "wav";
  if (name.endsWith(".m4a")) return "m4a";
  if (name.endsWith(".ogg")) return "ogg";
  if (name.endsWith(".aac")) return "aac";
  return "mp3";
}

export async function POST(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  if (!hasR2Credentials()) {
    return NextResponse.json(
      {
        error: "missing_r2",
        message:
          "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const spotifyId = String(form.get("spotifyId") || "").trim();
  const difficultyRaw = String(form.get("difficulty") || "").trim();
  const songId = String(form.get("songId") || "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (!spotifyId) {
    return NextResponse.json({ error: "Missing spotifyId" }, { status: 400 });
  }
  if (!isDifficulty(difficultyRaw)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  const maxBytes = 40 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: "File too large (max 40MB)" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extFromFile(file);
    const contentType = file.type || `audio/${ext === "mp3" ? "mpeg" : ext}`;
    const hostedUrl = await uploadHostedAudio({
      spotifyId,
      difficulty: difficultyRaw,
      buffer,
      contentType,
      ext,
    });

    let song = null;
    if (songId) {
      song = await updateSongById(songId, { hostedUrl });
    }

    return NextResponse.json({ hostedUrl, song });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
