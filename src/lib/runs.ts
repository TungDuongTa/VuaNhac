import { type Collection, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import { normalizeCatalogListOrDefault } from "./songs";
import type { Difficulty, MusicCatalog } from "./types";
import type { RunResult, RunSubmitInput } from "./run-types";

type RunRecord = {
  playerName: string;
  catalog: MusicCatalog;
  catalogs?: MusicCatalog[];
  correctCount: number;
  points?: number;
  instantHits?: number;
  /** Legacy fields from older runs. */
  avgTimeMs?: number;
  totalTimeMs?: number;
  highestDifficulty: Difficulty;
  createdAt: Date;
};

const COLLECTION = "runs";
let indexesReady = false;

async function ensureIndexes(col: Collection<RunRecord>): Promise<void> {
  if (indexesReady) return;
  await col.createIndex(
    { points: -1, instantHits: -1, correctCount: -1, createdAt: 1 },
    { name: "ranking_sort_v3" },
  );
  indexesReady = true;
}

async function runsCollection(): Promise<Collection<RunRecord>> {
  const db = await getDb();
  const col = db.collection<RunRecord>(COLLECTION);
  await ensureIndexes(col);
  return col;
}

function toRunResult(doc: WithId<RunRecord>): RunResult {
  const catalogs = normalizeCatalogListOrDefault(
    doc.catalogs?.length ? doc.catalogs : [doc.catalog],
  );
  return {
    id: doc._id.toHexString(),
    playerName: doc.playerName,
    catalog: catalogs[0] ?? "vietnamese",
    catalogs,
    correctCount: doc.correctCount,
    points: Math.max(0, Math.floor(doc.points ?? 0)),
    instantHits: Math.max(0, Math.floor(doc.instantHits ?? 0)),
    highestDifficulty: doc.highestDifficulty,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createRun(input: RunSubmitInput): Promise<RunResult> {
  const playerName = input.playerName.trim().slice(0, 24);
  if (!playerName) throw new Error("Player name is required");
  if (input.correctCount < 0 || !Number.isFinite(input.correctCount)) {
    throw new Error("Invalid correctCount");
  }
  if (input.points < 0 || !Number.isFinite(input.points)) {
    throw new Error("Invalid points");
  }
  if (input.instantHits < 0 || !Number.isFinite(input.instantHits)) {
    throw new Error("Invalid instantHits");
  }

  const catalogs = normalizeCatalogListOrDefault(input.catalogs);
  const correctCount = Math.floor(input.correctCount);
  const points = Math.max(0, Math.floor(input.points));
  const instantHits = Math.min(
    correctCount,
    Math.max(0, Math.floor(input.instantHits)),
  );

  const col = await runsCollection();
  const now = new Date();
  const result = await col.insertOne({
    playerName,
    catalog: catalogs[0]!,
    catalogs,
    correctCount,
    points,
    instantHits,
    highestDifficulty: input.highestDifficulty,
    createdAt: now,
  });
  const doc = await col.findOne({ _id: result.insertedId });
  if (!doc) throw new Error("Failed to read created run");
  return toRunResult(doc);
}

export async function listRankings(limit = 100): Promise<RunResult[]> {
  const col = await runsCollection();
  const docs = await col
    .find({})
    .sort({ points: -1, instantHits: -1, correctCount: -1, createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();
  return docs.map(toRunResult);
}
