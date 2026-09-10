import { NextResponse } from "next/server";
import { DIFFICULTIES } from "@/src/lib/constants";
import { findSong } from "@/src/lib/songs";
import type { Difficulty, SongAnswer } from "@/src/lib/types";

export const dynamic = "force-dynamic";

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

type GuessBody = {
  difficulty?: string;
  songId?: string;
  guessId?: string;
  reveal?: boolean;
};

export async function POST(request: Request) {
  let body: GuessBody;
  try {
    body = (await request.json()) as GuessBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { difficulty, songId, guessId, reveal } = body;

  if (!difficulty || !isDifficulty(difficulty) || !songId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const answer = await findSong(songId, difficulty);
  if (!answer) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const answerPayload: SongAnswer = {
    id: answer.spotifyId,
    title: answer.title,
    artist: answer.artist,
    album: answer.album ?? null,
    imageUrl: answer.imageUrl,
    spotifyUrl: answer.spotifyId.startsWith("demo-")
      ? null
      : `https://open.spotify.com/track/${answer.spotifyId}`,
  };

  if (reveal) {
    return NextResponse.json({ correct: false, reveal: true, answer: answerPayload });
  }

  if (!guessId) {
    return NextResponse.json({ error: "Missing guessId" }, { status: 400 });
  }

  const correct = guessId === songId;
  return NextResponse.json({
    correct,
    answer: correct ? answerPayload : undefined,
  });
}
