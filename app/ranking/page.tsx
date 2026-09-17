"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATALOG_META } from "@/src/lib/constants";
import type { RunResult } from "@/src/lib/run-types";

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
        const res = await fetch("/api/runs?limit=100");
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
            Top 100 · sorted by points (shorter clip + harder difficulty =
            more), then 0.1s hits, then wins.
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
            <table className="w-full min-w-[24rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-3 font-semibold">#</th>
                  <th className="px-2 py-3 font-semibold">Player</th>
                  <th className="px-2 py-3 font-semibold">Catalog</th>
                  <th className="px-2 py-3 font-semibold">Points</th>
                  <th className="px-2 py-3 font-semibold">0.1s</th>
                  <th className="px-2 py-3 font-semibold">Win</th>
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
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(run.catalogs?.length
                          ? run.catalogs
                          : [run.catalog]
                        ).map((c) => (
                          <span
                            key={c}
                            className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor:
                                CATALOG_META[c]?.activeBg ??
                                "rgba(255,255,255,0.1)",
                              color: CATALOG_META[c]?.color ?? "#a1a1aa",
                            }}
                          >
                            {CATALOG_META[c]?.shortLabel ?? c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 tabular-nums font-semibold text-white">
                      {run.points ?? 0}
                    </td>
                    <td className="px-2 py-3 tabular-nums">
                      {run.instantHits ?? 0}
                    </td>
                    <td className="px-2 py-3 tabular-nums font-semibold text-white">
                      {run.correctCount}
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
