"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DIFFICULTIES, DIFFICULTY_META } from "@/src/lib/constants";
import type { Difficulty } from "@/src/lib/types";

type AdminSong = {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  album: string | null;
  previewUrl: string | null;
  previewUpdatedAt: string | null;
  imageUrl: string | null;
  difficulty: Difficulty;
  hostedUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type SongForm = {
  spotifyUrl: string;
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  imageUrl: string;
  difficulty: Difficulty;
  hostedUrl: string;
};

const EMPTY_FORM: SongForm = {
  spotifyUrl: "",
  spotifyId: "",
  title: "",
  artist: "",
  album: "",
  previewUrl: "",
  imageUrl: "",
  difficulty: "easy",
  hostedUrl: "",
};

const SECRET_KEY = "heardit-admin-secret";

function adminHeaders(secret: string, json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (secret) headers["x-admin-secret"] = secret;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [secretDraft, setSecretDraft] = useState("");
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<SongForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_KEY) ?? "";
    setSecret(saved);
    setSecretDraft(saved);
  }, []);

  const loadSongs = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterDifficulty !== "all") params.set("difficulty", filterDifficulty);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/songs?${params}`, {
        headers: adminHeaders(secret, false),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load songs");
      setSongs(data.songs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load songs");
    } finally {
      setLoadingList(false);
    }
  }, [filterDifficulty, query, secret]);

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  const saveSecret = () => {
    sessionStorage.setItem(SECRET_KEY, secretDraft);
    setSecret(secretDraft);
  };

  const setField = <K extends keyof SongForm>(key: K, value: SongForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFile(null);
  };

  const lookupSpotify = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/spotify-lookup", {
        method: "POST",
        headers: adminHeaders(secret),
        body: JSON.stringify({ url: form.spotifyUrl || form.spotifyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Lookup failed");
      setForm((prev) => ({
        ...prev,
        spotifyUrl: data.spotifyUrl ?? prev.spotifyUrl,
        spotifyId: data.spotifyId ?? "",
        title: data.title ?? "",
        artist: data.artist ?? "",
        album: data.album ?? "",
        previewUrl: data.previewUrl ?? "",
        imageUrl: data.imageUrl ?? "",
      }));
      setStatus("Spotify metadata loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadHosted = async (songId?: string | null) => {
    if (!file) return form.hostedUrl || null;
    if (!form.spotifyId) throw new Error("Spotify ID required before upload");

    const body = new FormData();
    body.set("file", file);
    body.set("spotifyId", form.spotifyId);
    body.set("difficulty", form.difficulty);
    if (songId) body.set("songId", songId);

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: adminHeaders(secret, false),
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || "Upload failed");
    return data.hostedUrl as string;
  };

  const saveSong = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let hostedUrl = form.hostedUrl || null;
      if (file) {
        hostedUrl = await uploadHosted(editingId);
      }

      const payload = {
        spotifyId: form.spotifyId,
        title: form.title,
        artist: form.artist,
        album: form.album || null,
        previewUrl: form.previewUrl || null,
        previewUpdatedAt: form.previewUrl
          ? new Date().toISOString()
          : null,
        imageUrl: form.imageUrl || null,
        difficulty: form.difficulty,
        hostedUrl,
      };

      const res = await fetch(
        editingId ? `/api/admin/songs/${editingId}` : "/api/admin/songs",
        {
          method: editingId ? "PATCH" : "POST",
          headers: adminHeaders(secret),
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setStatus(editingId ? "Song updated" : "Song created");
      resetForm();
      await loadSongs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const editSong = (song: AdminSong) => {
    setEditingId(song.id);
    setForm({
      spotifyUrl: `https://open.spotify.com/track/${song.spotifyId}`,
      spotifyId: song.spotifyId,
      title: song.title,
      artist: song.artist,
      album: song.album ?? "",
      previewUrl: song.previewUrl ?? "",
      imageUrl: song.imageUrl ?? "",
      difficulty: song.difficulty,
      hostedUrl: song.hostedUrl ?? "",
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeSong = async (song: AdminSong) => {
    if (
      !window.confirm(
        `Delete "${song.title}" (${song.difficulty})? This also removes the R2 file if we uploaded it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/songs/${song.id}`, {
        method: "DELETE",
        headers: adminHeaders(secret, false),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (editingId === song.id) resetForm();
      setStatus("Song deleted");
      await loadSongs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const filteredLabel = useMemo(() => {
    if (loadingList) return "Loading…";
    return `${songs.length} song${songs.length === 1 ? "" : "s"}`;
  }, [loadingList, songs.length]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500">
            HEARDIT
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Song admin
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Paste a Spotify link to autofill metadata, pick a difficulty, upload
            an R2 clip for “From the start”, then save to MongoDB.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:border-white/30 hover:text-white"
        >
          ← Back to game
        </Link>
      </div>

      <section className="mb-8 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 sm:p-5">
        <label className="block text-xs font-semibold tracking-wide text-zinc-500">
          Admin secret
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={secretDraft}
            onChange={(e) => setSecretDraft(e.target.value)}
            placeholder="ADMIN_SECRET or SYNC_SECRET (leave empty if unset)"
            className="flex-1 rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35"
          />
          <button
            type="button"
            onClick={saveSecret}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
          >
            Use secret
          </button>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            {editingId ? "Edit song" : "Add song"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-zinc-400 hover:text-white"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={form.spotifyUrl}
              onChange={(e) => setField("spotifyUrl", e.target.value)}
              placeholder="https://open.spotify.com/track/…"
              className="flex-1 rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void lookupSpotify()}
              className="rounded-full border border-[#1ed760]/40 bg-[#1ed760]/15 px-5 py-2.5 text-sm font-semibold text-[#1ed760] disabled:opacity-50"
            >
              Autofill from Spotify
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Spotify ID"
              value={form.spotifyId}
              onChange={(v) => setField("spotifyId", v)}
            />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-500">
                Difficulty
              </span>
              <select
                value={form.difficulty}
                onChange={(e) =>
                  setField("difficulty", e.target.value as Difficulty)
                }
                className="w-full rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_META[d].label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Title"
              value={form.title}
              onChange={(v) => setField("title", v)}
            />
            <Field
              label="Artist"
              value={form.artist}
              onChange={(v) => setField("artist", v)}
            />
            <Field
              label="Album"
              value={form.album}
              onChange={(v) => setField("album", v)}
            />
            <Field
              label="Image URL"
              value={form.imageUrl}
              onChange={(v) => setField("imageUrl", v)}
            />
            <Field
              label="Preview URL (Spotify ~30s)"
              value={form.previewUrl}
              onChange={(v) => setField("previewUrl", v)}
            />
            <Field
              label="Hosted URL (R2 full/start clip)"
              value={form.hostedUrl}
              onChange={(v) => setField("hostedUrl", v)}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-500">
              Upload audio to R2 (sets hosted URL)
            </span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            />
            {file && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </label>

          {form.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imageUrl}
              alt=""
              className="h-24 w-24 rounded-xl object-cover"
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !form.spotifyId || !form.title || !form.artist}
              onClick={() => void saveSong()}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy ? "Saving…" : editingId ? "Update song" : "Create song"}
            </button>
          </div>

          {status && <p className="text-sm text-[#1ed760]">{status}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Library · {filteredLabel}
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterDifficulty}
              onChange={(e) =>
                setFilterDifficulty(e.target.value as Difficulty | "all")
              }
              className="rounded-full border border-white/15 bg-black px-3 py-2 text-sm"
            >
              <option value="all">All difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_META[d].label}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="rounded-full border border-white/15 bg-black px-4 py-2 text-sm outline-none focus:border-white/35"
            />
            <button
              type="button"
              onClick={() => void loadSongs()}
              className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-white/30"
            >
              Refresh
            </button>
          </div>
        </div>

        <ul className="divide-y divide-white/8">
          {songs.map((song) => (
            <li
              key={song.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {song.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={song.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-zinc-900 text-zinc-500">
                    ♪
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{song.title}</p>
                  <p className="truncate text-sm text-zinc-400">{song.artist}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    <span
                      className="mr-2 inline-block rounded-full px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: DIFFICULTY_META[song.difficulty].idleBg,
                        color: DIFFICULTY_META[song.difficulty].color,
                      }}
                    >
                      {DIFFICULTY_META[song.difficulty].label}
                    </span>
                    {song.previewUrl ? "preview · " : "no preview · "}
                    {song.hostedUrl ? "hosted" : "no hosted"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => editSong(song)}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-white/30"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeSong(song)}
                  className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:border-red-400/50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {!loadingList && songs.length === 0 && (
            <li className="py-10 text-center text-sm text-zinc-500">
              No songs yet. Add one above.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35"
      />
    </label>
  );
}
