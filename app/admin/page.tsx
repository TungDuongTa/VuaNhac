"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CATALOG_META,
  DIFFICULTIES,
  DIFFICULTY_META,
  MUSIC_CATALOGS,
} from "@/src/lib/constants";
import type { Difficulty, MusicCatalog } from "@/src/lib/types";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  catalog: MusicCatalog;
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
  catalog: MusicCatalog;
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
  catalog: "vietnamese",
  hostedUrl: "",
};

const SECRET_KEY = "heardit-admin-secret";
const PAGE_SIZE = 30;

function buildPageItems(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let i = current - 1; i <= current + 1; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const pageNum = sorted[i]!;
    if (i > 0 && pageNum - sorted[i - 1]! > 1) {
      items.push("ellipsis");
    }
    items.push(pageNum);
  }
  return items;
}

function adminHeaders(secret: string, json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (secret) headers["x-admin-secret"] = secret;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [secretDraft, setSecretDraft] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "all">(
    "all",
  );
  const [filterCatalog, setFilterCatalog] = useState<MusicCatalog | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState<SongForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifySecret = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setVerified(false);
      setSecret("");
      setError("Enter the admin secret to unlock this page.");
      return false;
    }
    setVerifying(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/verify", {
        headers: adminHeaders(trimmed, false),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerified(false);
        setSecret("");
        sessionStorage.removeItem(SECRET_KEY);
        throw new Error(
          typeof data.error === "string" ? data.error : "Invalid admin secret",
        );
      }
      sessionStorage.setItem(SECRET_KEY, trimmed);
      setSecret(trimmed);
      setSecretDraft(trimmed);
      setVerified(true);
      setStatus("Admin unlocked.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify secret");
      return false;
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_KEY) ?? "";
    if (saved) void verifySecret(saved);
  }, [verifySecret]);

  const loadSongs = useCallback(async () => {
    if (!verified || !secret) {
      setSongs([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setLoadingList(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterDifficulty !== "all")
        params.set("difficulty", filterDifficulty);
      if (filterCatalog !== "all") params.set("catalog", filterCatalog);
      if (query.trim()) params.set("q", query.trim());
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/admin/songs?${params}`, {
        headers: adminHeaders(secret, false),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setVerified(false);
          setSecret("");
          sessionStorage.removeItem(SECRET_KEY);
        }
        throw new Error(data.error || "Failed to load songs");
      }
      setSongs(data.songs ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(
        typeof data.totalPages === "number" ? data.totalPages : 1,
      );
      if (typeof data.page === "number" && data.page !== page) {
        setPage(data.page);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load songs");
    } finally {
      setLoadingList(false);
    }
  }, [filterDifficulty, filterCatalog, query, page, secret, verified]);

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  const saveSecret = () => {
    void verifySecret(secretDraft);
  };

  const setField = <K extends keyof SongForm>(key: K, value: SongForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    clearFile();
  };

  const lockAdmin = () => {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret("");
    setSecretDraft("");
    setVerified(false);
    setSongs([]);
    resetForm();
    setStatus(null);
    setError(null);
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
      if (!res.ok)
        throw new Error(data.error || data.message || "Lookup failed");
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
        previewUpdatedAt: form.previewUrl ? new Date().toISOString() : null,
        imageUrl: form.imageUrl || null,
        difficulty: form.difficulty,
        catalog: form.catalog,
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
      catalog: song.catalog ?? "worldwide",
      hostedUrl: song.hostedUrl ?? "",
    });
    clearFile();
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
    if (total === 0) return "0 songs";
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return `${from}–${to} of ${total}`;
  }, [loadingList, page, total]);

  const pageItems = useMemo(
    () => buildPageItems(page, totalPages),
    [page, totalPages],
  );

  const goToPage = (next: number) => {
    if (loadingList) return;
    setPage(Math.min(Math.max(1, next), totalPages));
  };

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
            onKeyDown={(e) => {
              if (e.key === "Enter") saveSecret();
            }}
            placeholder="ADMIN_SECRET or SYNC_SECRET"
            disabled={verifying}
            className="flex-1 rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={saveSecret}
            disabled={verifying || !secretDraft.trim()}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black cursor-pointer disabled:opacity-40"
          >
            {verifying ? "Verifying…" : verified ? "Re-verify" : "Unlock"}
          </button>
          {verified && (
            <button
              type="button"
              onClick={lockAdmin}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-300 hover:border-white/30 hover:text-white cursor-pointer"
            >
              Lock
            </button>
          )}
        </div>
        {!verified && (
          <p className="mt-3 text-sm text-zinc-500">
            Enter a valid admin secret to show the add-song form and library.
          </p>
        )}
        {verified && (
          <p className="mt-3 text-sm text-[#1ed760]">Admin verified.</p>
        )}
        {!verified && error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </section>

      {verified && (
      <>
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
              className="rounded-full border border-[#1ed760]/40 bg-[#1ed760]/15 px-5 py-2.5 text-sm font-semibold text-[#1ed760] disabled:opacity-50 cursor-pointer"
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
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-500">
                Catalog
              </span>
              <select
                value={form.catalog}
                onChange={(e) =>
                  setField("catalog", e.target.value as MusicCatalog)
                }
                className="w-full rounded-full border border-white/15 bg-black px-4 py-2.5 text-sm outline-none focus:border-white/35"
              >
                {MUSIC_CATALOGS.map((c) => (
                  <option key={c} value={c}>
                    {CATALOG_META[c].label}
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
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            />
            {file && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-2 text-zinc-400 underline hover:text-white"
                >
                  Clear
                </button>
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
              onChange={(e) => {
                setFilterDifficulty(e.target.value as Difficulty | "all");
                setPage(1);
              }}
              className="rounded-full border border-white/15 bg-black px-3 py-2 text-sm"
            >
              <option value="all">All difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_META[d].label}
                </option>
              ))}
            </select>
            <select
              value={filterCatalog}
              onChange={(e) => {
                setFilterCatalog(e.target.value as MusicCatalog | "all");
                setPage(1);
              }}
              className="rounded-full border border-white/15 bg-black px-3 py-2 text-sm"
            >
              <option value="all">All catalogs</option>
              {MUSIC_CATALOGS.map((c) => (
                <option key={c} value={c}>
                  {CATALOG_META[c].label}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
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
                  <p className="truncate font-medium text-white">
                    {song.title}
                  </p>
                  <p className="truncate text-sm text-zinc-400">
                    {song.artist}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    <span
                      className="mr-2 inline-block rounded-full px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor:
                          DIFFICULTY_META[song.difficulty].idleBg,
                        color: DIFFICULTY_META[song.difficulty].color,
                      }}
                    >
                      {DIFFICULTY_META[song.difficulty].label}
                    </span>
                    <span className="mr-2 inline-block rounded-full bg-white/10 px-2 py-0.5 font-semibold text-zinc-300">
                      {CATALOG_META[song.catalog ?? "worldwide"].label}
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

        {totalPages > 1 && (
          <div className="mt-5 flex flex-col items-center gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-zinc-500">
              {PAGE_SIZE} per page
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="Prev"
                    className={
                      page <= 1 || loadingList
                        ? "pointer-events-none opacity-40"
                        : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {pageItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`e-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        className={
                          loadingList
                            ? "pointer-events-none opacity-40"
                            : undefined
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="Next"
                    className={
                      page >= totalPages || loadingList
                        ? "pointer-events-none opacity-40"
                        : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </section>
      </>
      )}
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
