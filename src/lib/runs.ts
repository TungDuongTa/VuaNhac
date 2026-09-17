import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import type { Difficulty, MusicCatalog } from "./types";
import type { RunResult, RunSubmitInput } from "./run-types";

type RunRecord = {
  playerName: string;
  catalog: MusicCatalog;
  correctCount: number;
  avgTimeMs: number;
  totalTimeMs: number;
  highestDifficulty: Difficulty;
  createdAt: Date;
};

const COLLECTION = "runs";
let indexesReady = false;

async function ensureIndexes(col: Collection<RunRecord>): Promise<void> {
  if (indexesReady) return;
  await col.createIndex(
    { correctCount: -1, avgTimeMs: 1, createdAt: 1 },
    { name: "ranking_sort" },
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
  return {
    id: doc._id.toHexString(),
    playerName: doc.playerName,
    catalog: doc.catalog,
    correctCount: doc.correctCount,
    avgTimeMs: doc.avgTimeMs,
    totalTimeMs: doc.totalTimeMs,
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
  if (input.totalTimeMs < 0 || !Number.isFinite(input.totalTimeMs)) {
    throw new Error("Invalid totalTimeMs");
  }

  const correctCount = Math.floor(input.correctCount);
  const totalTimeMs = Math.round(input.totalTimeMs);
  const avgTimeMs =
    correctCount > 0 ? Math.round(totalTimeMs / correctCount) : 0;

  const col = await runsCollection();
  const now = new Date();
  const result = await col.insertOne({
    playerName,
    catalog: input.catalog,
    correctCount,
    avgTimeMs,
    totalTimeMs,
    highestDifficulty: input.highestDifficulty,
    createdAt: now,
  });
  const doc = await col.findOne({ _id: result.insertedId });
  if (!doc) throw new Error("Failed to read created run");
  return toRunResult(doc);
}

export async function listRankings(limit = 50): Promise<RunResult[]> {
  const col = await runsCollection();
  const docs = await col
    .find({})
    .sort({ correctCount: -1, avgTimeMs: 1, createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();
  return docs.map(toRunResult);
}
