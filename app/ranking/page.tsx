"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATALOG_META, DIFFICULTY_META } from "@/src/lib/constants";
import type { RunResult } from "@/src/lib/run-types";

function formatAvg(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toFixed(0)}s`;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function RankingPage() {
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/runs?limit=50");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load rankings");
        if (!cancelled) setRuns(data.runs ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load rankings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500">
            VUANHAC
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Run rankings
          </h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-400">
            Sorted by songs cleared, then fastest average solve time.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:border-white/30 hover:text-white"
        >
          ← Back to game
        </Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 sm:p-6">
        {loading && (
          <p className="py-10 text-center text-sm text-zinc-500">Loading…</p>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && runs.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">
            No runs yet. Start a run from the game.
          </p>
        )}
        {!loading && !error && runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-3 font-semibold">#</th>
                  <th className="px-2 py-3 font-semibold">Player</th>
                  <th className="px-2 py-3 font-semibold">Correct</th>
                  <th className="px-2 py-3 font-semibold">Avg time</th>
                  <th className="px-2 py-3 font-semibold">Catalog</th>
                  <th className="px-2 py-3 font-semibold">Peak</th>
                  <th className="px-2 py-3 font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {runs.map((run, index) => (
                  <tr key={run.id} className="text-zinc-200">
                    <td className="px-2 py-3 tabular-nums text-zinc-500">
                      {index + 1}
                    </td>
                    <td className="px-2 py-3 font-medium text-white">
                      {run.playerName}
                    </td>
                    <td className="px-2 py-3 tabular-nums font-semibold text-white">
                      {run.correctCount}
                    </td>
                    <td className="px-2 py-3 tabular-nums">
                      {formatAvg(run.avgTimeMs)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor:
                            CATALOG_META[run.catalog]?.idleBg ??
                            "rgba(255,255,255,0.1)",
                          color:
                            CATALOG_META[run.catalog]?.color ?? "#a1a1aa",
                        }}
                      >
                        {CATALOG_META[run.catalog]?.label ?? run.catalog}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor:
                            DIFFICULTY_META[run.highestDifficulty].idleBg,
                          color: DIFFICULTY_META[run.highestDifficulty].color,
                        }}
                      >
                        {DIFFICULTY_META[run.highestDifficulty].label}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs text-zinc-500">
                      {formatWhen(run.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
