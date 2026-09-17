import { NextResponse } from "next/server";
import { MUSIC_CATALOGS, DIFFICULTIES } from "@/src/lib/constants";
import { createRun, listRankings } from "@/src/lib/runs";
import type { Difficulty, MusicCatalog } from "@/src/lib/types";

export const dynamic = "force-dynamic";

function isCatalog(value: unknown): value is MusicCatalog {
  return (
    typeof value === "string" &&
    MUSIC_CATALOGS.includes(value as MusicCatalog)
  );
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "100") || 100;
  try {
    const runs = await listRankings(limit);
    return NextResponse.json({ runs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load rankings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: {
    playerName?: string;
    catalog?: string;
    catalogs?: string[];
    correctCount?: number;
    points?: number;
    instantHits?: number;
    highestDifficulty?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.playerName?.trim()) {
    return NextResponse.json(
      { error: "playerName is required" },
      { status: 400 },
    );
  }

  const catalogsRaw = Array.isArray(body.catalogs)
    ? body.catalogs
    : body.catalog
      ? [body.catalog]
      : [];
  const catalogs = catalogsRaw.filter(isCatalog);
  if (catalogs.length === 0) {
    return NextResponse.json({ error: "Invalid catalogs" }, { status: 400 });
  }
  if (!isDifficulty(body.highestDifficulty)) {
    return NextResponse.json(
      { error: "Invalid highestDifficulty" },
      { status: 400 },
    );
  }
  if (
    typeof body.correctCount !== "number" ||
    typeof body.points !== "number" ||
    typeof body.instantHits !== "number"
  ) {
    return NextResponse.json({ error: "Missing score fields" }, { status: 400 });
  }

  try {
    const run = await createRun({
      playerName: body.playerName,
      catalogs,
      correctCount: body.correctCount,
      points: body.points,
      instantHits: body.instantHits,
      highestDifficulty: body.highestDifficulty,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
