import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "./mongodb";
import type { Difficulty, MusicCatalog, Song } from "./types";
import { MUSIC_CATALOGS } from "./constants";
import { normalizeVietnamese } from "./vietnamese";

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

export function isMusicCatalog(value: unknown): value is MusicCatalog {
  return (
    typeof value === "string" &&
    MUSIC_CATALOGS.includes(value as MusicCatalog)
  );
}

/** Legacy docs without catalog count as worldwide. */
export function resolveCatalog(
  value: MusicCatalog | null | undefined,
): MusicCatalog {
  return value === "vietnamese" ? "vietnamese" : "worldwide";
}

function catalogQuery(catalog: MusicCatalog): Record<string, unknown> {
  if (catalog === "vietnamese") return { catalog: "vietnamese" };
  return {
    $or: [{ catalog: "worldwide" }, { catalog: { $exists: false } }, { catalog: null }],
  };
}

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
  await col.createIndex({ catalog: 1, difficulty: 1 }, { name: "catalog_difficulty_1" });
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
    catalog: resolveCatalog(doc.catalog),
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
    catalog: resolveCatalog(song.catalog),
    hostedUrl: song.hostedUrl || null,
  };
}

export async function readSongs(filters?: {
  catalog?: MusicCatalog;
}): Promise<Song[]> {
  const col = await songsCollection();
  const query = filters?.catalog ? catalogQuery(filters.catalog) : {};
  const docs = await col.find(query).sort({ updatedAt: -1 }).toArray();
  return docs.map(toSong);
}

export async function listAdminSongs(filters?: {
  difficulty?: Difficulty;
  catalog?: MusicCatalog;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  songs: AdminSong[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const col = await songsCollection();
  const clauses: Record<string, unknown>[] = [];
  if (filters?.difficulty) clauses.push({ difficulty: filters.difficulty });
  if (filters?.catalog) clauses.push(catalogQuery(filters.catalog));
  const query =
    clauses.length === 0
      ? {}
      : clauses.length === 1
        ? clauses[0]!
        : { $and: clauses };
  let docs = await col.find(query).sort({ updatedAt: -1 }).toArray();

  // Accent-insensitive filter (e.g. "son tung" → Sơn Tùng)
  const needle = filters?.q?.trim()
    ? normalizeVietnamese(filters.q)
    : "";
  if (needle) {
    docs = docs.filter((doc) => {
      const hay = normalizeVietnamese(
        [doc.title, doc.artist, doc.album ?? "", doc.spotifyId].join(" "),
      );
      return hay.includes(needle);
    });
  }

  const total = docs.length;
  const pageSize = Math.min(Math.max(filters?.pageSize ?? 30, 1), 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(Math.max(filters?.page ?? 1, 1), totalPages);
  const start = (page - 1) * pageSize;
  const songs = docs.slice(start, start + pageSize).map(toAdminSong);

  return { songs, total, page, pageSize, totalPages };
}

export async function getSongById(id: string): Promise<AdminSong | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await songsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? toAdminSong(doc) : null;
}

export async function getSongsByDifficulty(
  difficulty: Difficulty,
  catalog: MusicCatalog = "worldwide",
): Promise<Song[]> {
  const col = await songsCollection();
  const query =
    catalog === "vietnamese"
      ? { difficulty, catalog: "vietnamese" as const }
      : {
          difficulty,
          $or: [
            { catalog: "worldwide" as const },
            { catalog: { $exists: false } },
            { catalog: null },
          ],
        };
  const matched = await col.find(query as Record<string, unknown>).toArray();
  return matched
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
          // Keep existing difficulty/catalog if the track is already in the library.
          difficulty: existing?.difficulty ?? song.difficulty,
          catalog: existing ? resolveCatalog(existing.catalog) : song.catalog,
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
  if (patch.catalog !== undefined) $set.catalog = resolveCatalog(patch.catalog);
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

/** Stable daily index from date + catalog + difficulty. */
export function dailyIndex(
  dateKey: string,
  difficulty: Difficulty,
  length: number,
  catalog: MusicCatalog = "worldwide",
): number {
  if (length <= 0) return 0;
  let hash = 0;
  const key = `${dateKey}:${catalog}:${difficulty}`;
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
