import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import type { Difficulty, Song } from "./types";

export type SongRecord = Song & {
  createdAt: Date;
  updatedAt: Date;
};

export type AdminSong = Song & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

const COLLECTION = "songs";
let indexesReady = false;

async function ensureIndexes(col: Collection<SongRecord>): Promise<void> {
  if (indexesReady) return;

  // Drop legacy composite unique index (same track was allowed on multiple difficulties).
  try {
    await col.dropIndex("spotifyId_difficulty_unique");
  } catch {
    // Index may not exist on fresh DBs.
  }

  // If older duplicates exist, keep the newest doc per spotifyId.
  const dupes = await col
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      {
        $group: {
          _id: "$spotifyId",
          ids: { $push: "$_id" },
          newest: { $max: "$updatedAt" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const group of dupes) {
    const keep = await col.findOne(
      { spotifyId: group._id },
      { sort: { updatedAt: -1 } },
    );
    if (!keep) continue;
    await col.deleteMany({
      spotifyId: group._id,
      _id: { $ne: keep._id },
    });
  }

  await col.createIndex({ spotifyId: 1 }, { unique: true, name: "spotifyId_unique" });
  await col.createIndex({ difficulty: 1 }, { name: "difficulty_1" });
  indexesReady = true;
}

async function songsCollection(): Promise<Collection<SongRecord>> {
  const db = await getDb();
  const col = db.collection<SongRecord>(COLLECTION);
  await ensureIndexes(col);
  return col;
}

function toSong(doc: WithId<SongRecord>): Song {
  return {
    spotifyId: doc.spotifyId,
    title: doc.title,
    artist: doc.artist,
    album: doc.album ?? null,
    previewUrl: doc.previewUrl,
    previewUpdatedAt: doc.previewUpdatedAt,
    imageUrl: doc.imageUrl,
    difficulty: doc.difficulty,
    hostedUrl: doc.hostedUrl ?? null,
  };
}

function toAdminSong(doc: WithId<SongRecord>): AdminSong {
  return {
    id: doc._id.toHexString(),
    ...toSong(doc),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizeSongInput(song: Song): Song {
  return {
    spotifyId: song.spotifyId.trim(),
    title: song.title.trim(),
    artist: song.artist.trim(),
    album: song.album?.trim() || null,
    previewUrl: song.previewUrl || null,
    previewUpdatedAt: song.previewUpdatedAt || null,
    imageUrl: song.imageUrl || null,
    difficulty: song.difficulty,
    hostedUrl: song.hostedUrl || null,
  };
}

export async function readSongs(): Promise<Song[]> {
  const col = await songsCollection();
  const docs = await col.find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map(toSong);
}

export async function listAdminSongs(filters?: {
  difficulty?: Difficulty;
  q?: string;
}): Promise<AdminSong[]> {
  const col = await songsCollection();
  const query: Record<string, unknown> = {};
  if (filters?.difficulty) query.difficulty = filters.difficulty;
  if (filters?.q?.trim()) {
    const re = { $regex: filters.q.trim(), $options: "i" };
    query.$or = [{ title: re }, { artist: re }, { album: re }, { spotifyId: re }];
  }
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  return docs.map(toAdminSong);
}

export async function getSongById(id: string): Promise<AdminSong | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await songsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? toAdminSong(doc) : null;
}

export async function getSongsByDifficulty(
  difficulty: Difficulty,
): Promise<Song[]> {
  const col = await songsCollection();
  const docs = await col.find({ difficulty }).toArray();
  return docs
    .map(toSong)
    .filter((s) => Boolean(s.hostedUrl || s.previewUrl));
}

export async function upsertSongs(incoming: Song[]): Promise<number> {
  const col = await songsCollection();
  let added = 0;
  const now = new Date();

  for (const raw of incoming) {
    const song = normalizeSongInput(raw);
    const existing = await col.findOne({ spotifyId: song.spotifyId });
    if (!existing) added += 1;

    await col.updateOne(
      { spotifyId: song.spotifyId },
      {
        $set: {
          title: song.title,
          artist: song.artist,
          album: song.album ?? existing?.album ?? null,
          previewUrl: song.previewUrl,
          previewUpdatedAt: song.previewUpdatedAt,
          imageUrl: song.imageUrl,
          // Keep existing difficulty if the track is already in the library.
          difficulty: existing?.difficulty ?? song.difficulty,
          spotifyId: song.spotifyId,
          hostedUrl: song.hostedUrl ?? existing?.hostedUrl ?? null,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  return added;
}

export async function createSong(raw: Song): Promise<AdminSong> {
  const col = await songsCollection();
  const song = normalizeSongInput(raw);
  const now = new Date();

  const existing = await col.findOne({ spotifyId: song.spotifyId });
  if (existing) {
    throw new Error(
      `Song already exists (difficulty: ${existing.difficulty}). Each Spotify track can only be added once.`,
    );
  }

  try {
    const result = await col.insertOne({
      ...song,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await col.findOne({ _id: result.insertedId });
    if (!doc) throw new Error("Failed to read created song");
    return toAdminSong(doc);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new Error(
        `Song already exists for Spotify ID ${song.spotifyId}. Each track can only be added once.`,
      );
    }
    throw error;
  }
}

export async function updateSongById(
  id: string,
  patch: Partial<Song>,
): Promise<AdminSong> {
  if (!ObjectId.isValid(id)) throw new Error("Invalid song id");
  const col = await songsCollection();
  const _id = new ObjectId(id);
  const existing = await col.findOne({ _id });
  if (!existing) throw new Error("Song not found");

  const nextSpotifyId = (patch.spotifyId ?? existing.spotifyId).trim();

  if (nextSpotifyId !== existing.spotifyId) {
    const clash = await col.findOne({
      spotifyId: nextSpotifyId,
      _id: { $ne: _id },
    });
    if (clash) {
      throw new Error(
        `Song already exists for Spotify ID ${nextSpotifyId} (difficulty: ${clash.difficulty}). Each track can only be added once.`,
      );
    }
  }

  const $set: Partial<SongRecord> = { updatedAt: new Date() };
  if (patch.spotifyId !== undefined) $set.spotifyId = patch.spotifyId.trim();
  if (patch.title !== undefined) $set.title = patch.title.trim();
  if (patch.artist !== undefined) $set.artist = patch.artist.trim();
  if (patch.album !== undefined) $set.album = patch.album?.trim() || null;
  if (patch.previewUrl !== undefined) $set.previewUrl = patch.previewUrl || null;
  if (patch.previewUpdatedAt !== undefined) {
    $set.previewUpdatedAt = patch.previewUpdatedAt;
  }
  if (patch.imageUrl !== undefined) $set.imageUrl = patch.imageUrl || null;
  if (patch.difficulty !== undefined) $set.difficulty = patch.difficulty;
  if (patch.hostedUrl !== undefined) $set.hostedUrl = patch.hostedUrl || null;

  await col.updateOne({ _id }, { $set });
  const doc = await col.findOne({ _id });
  if (!doc) throw new Error("Song not found after update");
  return toAdminSong(doc);
}

export async function deleteSongById(id: string): Promise<AdminSong | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await songsCollection();
  const doc = await col.findOneAndDelete({ _id: new ObjectId(id) });
  return doc ? toAdminSong(doc) : null;
}

export async function updateSongPreview(
  spotifyId: string,
  previewUrl: string | null,
): Promise<void> {
  const col = await songsCollection();
  await col.updateMany(
    { spotifyId },
    {
      $set: {
        previewUrl,
        previewUpdatedAt: new Date().toISOString(),
        updatedAt: new Date(),
      },
    },
  );
}

export async function findSong(
  spotifyId: string,
  difficulty?: Difficulty,
): Promise<Song | undefined> {
  const col = await songsCollection();
  const doc = await col.findOne(
    difficulty ? { spotifyId, difficulty } : { spotifyId },
  );
  return doc ? toSong(doc) : undefined;
}

/** Stable daily index from date + difficulty. */
export function dailyIndex(
  dateKey: string,
  difficulty: Difficulty,
  length: number,
): number {
  if (length <= 0) return 0;
  let hash = 0;
  const key = `${dateKey}:${difficulty}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function todayKey(timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
