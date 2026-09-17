"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  DIFFICULTY_META,
  GUESS_DURATIONS,
  PROGRESS_SPEED_FLOOR,
  RUN_META,
  nextDifficulty,
  previousDifficulty,
} from "@/src/lib/constants";
import type {
  Difficulty,
  MusicCatalog,
  PublicSong,
  SearchResult,
  SongAnswer,
} from "@/src/lib/types";
import { readPlayerName, writePlayerName } from "@/src/lib/player-cookie";
import Link from "next/link";
import { CatalogPills } from "./CatalogPills";
import { DifficultyPills } from "./DifficultyPills";
import { DifficultySidebar } from "./DifficultySidebar";
import { GuessSearchBar } from "./GuessSearchBar";
import { useRevealAnimations } from "./hooks/useRevealAnimations";
import { RerollIcon } from "./icons";
import { MobileSettingsMenu } from "./MobileSettingsMenu";
import { PlayControls } from "./PlayControls";
import { ProgressBar } from "./ProgressBar";
import { ResultReveal } from "./ResultReveal";
import { RunEndDialog } from "./RunEndDialog";
import { RunStartDialog } from "./RunStartDialog";
import { SettingsSidebar } from "./SettingsSidebar";
import { SetupErrorPanel } from "./SetupErrorPanel";
import type { GameStatus, SongStartMode } from "./types";
import { playbackPlan } from "./utils";

gsap.registerPlugin(useGSAP);

export function SongGame() {
  const [catalog, setCatalog] = useState<MusicCatalog>("vietnamese");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [status, setStatus] = useState<GameStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [song, setSong] = useState<PublicSong | null>(null);
  const [guessIndex, setGuessIndex] = useState(0);
  const [answer, setAnswer] = useState<SongAnswer | null>(null);
  const [guessedInSeconds, setGuessedInSeconds] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedGuess, setSelectedGuess] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [songStart, setSongStart] = useState<SongStartMode>("fromStart");
  const [stages, setStages] = useState<number[]>([...GUESS_DURATIONS]);
  const [volume, setVolume] = useState(0.35);
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const [revealCanDismiss, setRevealCanDismiss] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [runActive, setRunActive] = useState(false);
  const [runStartOpen, setRunStartOpen] = useState(false);
  const [runFinished, setRunFinished] = useState(false);
  const [runCorrectCount, setRunCorrectCount] = useState(0);
  const [runTimesMs, setRunTimesMs] = useState<number[]>([]);
  const [runSubmitted, setRunSubmitted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const playRafRef = useRef<number | null>(null);
  const durationRef = useRef(0.1);
  const offsetRef = useRef(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const songIdRef = useRef<string | null>(null);
  /** Session-only: songs already shown per catalog+difficulty (for no-repeat rerolls). */
  const seenSongsRef = useRef<Map<string, Set<string>>>(new Map());
  const roundStartedAtRef = useRef<number | null>(null);
  const roundRecordedRef = useRef<string | null>(null);
  const runActiveRef = useRef(false);
  const difficultyRef = useRef<Difficulty>(difficulty);
  const lastClearedDifficultyRef = useRef<Difficulty | null>(null);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a - b),
    [stages],
  );
  const maxGuesses = orderedStages.length;
  const currentDuration =
    orderedStages[Math.min(guessIndex, Math.max(maxGuesses - 1, 0))] ?? 0.1;
  const meta = DIFFICULTY_META[difficulty];
  runActiveRef.current = runActive;
  difficultyRef.current = difficulty;

  const runAvgTimeMs = useMemo(() => {
    if (runTimesMs.length === 0) return 0;
    return Math.round(
      runTimesMs.reduce((sum, t) => sum + t, 0) / runTimesMs.length,
    );
  }, [runTimesMs]);

  useEffect(() => {
    setPlayerName(readPlayerName());
  }, []);

  useEffect(() => {
    if (status === "ready" && song?.id) {
      roundStartedAtRef.current = performance.now();
      roundRecordedRef.current = null;
    }
  }, [status, song?.id]);

  useEffect(() => {
    if (!runActive || status !== "won" || !song?.id) return;
    if (roundRecordedRef.current === song.id) return;
    roundRecordedRef.current = song.id;
    const started = roundStartedAtRef.current;
    const ms =
      started != null ? Math.max(0, Math.round(performance.now() - started)) : 0;
    setRunTimesMs((prev) => [...prev, ms]);
    setRunCorrectCount((c) => c + 1);
    lastClearedDifficultyRef.current = difficultyRef.current;
  }, [runActive, status, song?.id]);

  const [layoutDomain, setLayoutDomain] = useState(PROGRESS_SPEED_FLOOR);
  const layoutDomainProxy = useRef({ value: PROGRESS_SPEED_FLOOR });

  const targetLayoutDomain = useMemo(() => {
    if (status === "won" || status === "lost") {
      return Math.max(
        orderedStages[orderedStages.length - 1] ?? PROGRESS_SPEED_FLOOR,
        PROGRESS_SPEED_FLOOR,
      );
    }
    return Math.max(currentDuration, PROGRESS_SPEED_FLOOR);
  }, [currentDuration, orderedStages, status]);

  useGSAP(
    () => {
      const proxy = layoutDomainProxy.current;
      gsap.to(proxy, {
        value: targetLayoutDomain,
        duration: targetLayoutDomain > proxy.value ? 0.65 : 0.35,
        ease: "power2.out",
        onUpdate: () => setLayoutDomain(proxy.value),
      });
    },
    { dependencies: [targetLayoutDomain] },
  );

  useRevealAnimations({
    status,
    answer,
    panelRef,
    revealRef,
    confettiCanvasRef,
    onComplete: () => setRevealCanDismiss(true),
  });

  useEffect(() => {
    if (status !== "won" && status !== "lost") {
      setRevealCanDismiss(false);
      return;
    }
    setRevealCanDismiss(false);
    // Safety: unlock dismiss if animation callback never fires
    const fallback = window.setTimeout(() => setRevealCanDismiss(true), 3500);
    return () => window.clearTimeout(fallback);
  }, [status, answer?.id]);

  useEffect(() => {
    durationRef.current = currentDuration;
  }, [currentDuration]);

  const clearStopTimer = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const clearPlayRaf = () => {
    if (playRafRef.current !== null) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = null;
    }
  };

  const pauseAudio = useCallback(() => {
    clearStopTimer();
    clearPlayRaf();
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(false);
  }, []);

  const resetPlayback = useCallback(() => {
    clearStopTimer();
    clearPlayRaf();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = offsetRef.current;
      } catch {
        // ignore
      }
    }
    setPlaying(false);
    setElapsedSeconds(0);
  }, []);

  const startProgressTracking = useCallback((audio: HTMLAudioElement) => {
    clearPlayRaf();
    const tick = () => {
      const relative = Math.max(0, audio.currentTime - offsetRef.current);
      const t = Math.min(relative, durationRef.current);
      setElapsedSeconds(t);
      if (!audio.paused && relative < durationRef.current - 0.001) {
        playRafRef.current = requestAnimationFrame(tick);
      }
    };
    playRafRef.current = requestAnimationFrame(tick);
  }, []);

  const scheduleStopAtDuration = useCallback(
    (audio: HTMLAudioElement, targetSeconds: number) => {
      clearStopTimer();
      const absoluteStop = offsetRef.current + targetSeconds;
      const remainingMs = Math.max(
        0,
        (absoluteStop - audio.currentTime) * 1000,
      );
      stopTimerRef.current = setTimeout(() => {
        audio.pause();
        try {
          audio.currentTime = absoluteStop;
        } catch {
          // ignore
        }
        clearPlayRaf();
        setElapsedSeconds(targetSeconds);
        setPlaying(false);
      }, remainingMs);
    },
    [],
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const loadSong = useCallback(
    async (diff: Difficulty, opts?: { reroll?: boolean; catalog?: MusicCatalog }) => {
      const activeCatalog = opts?.catalog ?? catalog;
      const poolKey = `${activeCatalog}:${diff}`;
      let seen = seenSongsRef.current.get(poolKey);
      if (!seen) {
        seen = new Set<string>();
        seenSongsRef.current.set(poolKey, seen);
      }

      setMessage(null);
      setGuessIndex(0);
      setAnswer(null);
      setGuessedInSeconds(null);
      setQuery("");
      setResults([]);
      setSelectedGuess(null);
      resetPlayback();

      try {
        const params = new URLSearchParams({
          difficulty: diff,
          catalog: activeCatalog,
        });
        if (opts?.reroll) {
          params.set("reroll", "1");
          // Current song counts as seen before picking the next one
          if (songIdRef.current) seen.add(songIdRef.current);
          if (seen.size > 0) {
            params.set("exclude", [...seen].join(","));
          }
        }
        const res = await fetch(`/api/song?${params}`);
        const data = await res.json();

        if (!res.ok) {
          setSong(null);
          songIdRef.current = null;
          setStatus(
            data.error === "missing_credentials" || data.error === "empty_pool"
              ? "setup"
              : "error",
          );
          setMessage(data.message ?? data.error ?? "Failed to load song");
          return;
        }

        // Pool exhausted — start a fresh cycle of exclusions for this mode
        if (data.excludedReset) {
          seen.clear();
        }

        const nextId = data.song?.id ?? null;
        setSong(data.song);
        songIdRef.current = nextId;
        if (nextId) seen.add(nextId);
        setStatus("ready");
      } catch {
        setSong(null);
        songIdRef.current = null;
        setStatus("error");
        setMessage("Network error loading song");
      }
    },
    [catalog, resetPlayback],
  );

  useEffect(() => {
    void loadSong(difficulty, { catalog, reroll: runActiveRef.current });
  }, [difficulty, catalog, loadSong]);

  useEffect(() => {
    return () => {
      clearStopTimer();
      clearPlayRaf();
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const canInteract =
      status === "ready" ||
      ((status === "won" || status === "lost") && revealDismissed);
    if (query.trim().length < 1 || !canInteract) {
      setResults([]);
      return;
    }

    const handle = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&catalog=${catalog}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results ?? []);
        setSearchOpen(true);
      } catch {
        // aborted
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [query, status, revealDismissed, catalog]);

  useEffect(() => {
    const canInteract =
      status === "ready" ||
      ((status === "won" || status === "lost") && revealDismissed);
    if (!canInteract) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = searchBarRef.current;
      if (!root || root.contains(event.target as Node)) return;
      if (!query && !selectedGuess && !searchOpen) return;
      searchAbortRef.current?.abort();
      setQuery("");
      setResults([]);
      setSelectedGuess(null);
      setSearchOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [status, revealDismissed, query, selectedGuess, searchOpen]);

  const playClip = async () => {
    if (!song) return;
    if (status === "won" || status === "lost") {
      if (!revealDismissed) return;
    } else if (status !== "ready") {
      return;
    }
    if (maxGuesses === 0) return;
    const plan = playbackPlan(song, songStart);
    if (!plan) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      pauseAudio();
      try {
        const relative = Math.max(0, audio.currentTime - offsetRef.current);
        setElapsedSeconds(Math.min(relative, durationRef.current));
      } catch {
        // ignore
      }
      return;
    }

    clearStopTimer();
    clearPlayRaf();

    try {
      offsetRef.current = 0;
      const absolute = new URL(plan.src, window.location.href).href;
      if (audio.src !== absolute) {
        audio.src = plan.src;
      }
      audio.volume = volume;
      audio.crossOrigin = null;

      if (audio.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };
          audio.addEventListener("loadedmetadata", onLoaded);
          audio.load();
        });
      }

      const target = currentDuration;
      durationRef.current = target;

      const fullyHeard = audio.currentTime >= target - 0.02;
      if (fullyHeard || audio.currentTime < 0) {
        audio.currentTime = 0;
        setElapsedSeconds(0);
      }

      await audio.play();
      setPlaying(true);
      startProgressTracking(audio);
      scheduleStopAtDuration(audio, target);
    } catch {
      setMessage(
        songStart === "fromStart"
          ? plan
            ? "Could not play hosted clip. Check the audio URL / R2 file."
            : "No hosted clip for this song. Upload an R2 intro or switch to Spotify preview."
          : "Could not play Spotify preview. Try again.",
      );
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (status !== "won" && status !== "lost") return;
    if (revealDismissed) return;
    if (!song || !answer) return;

    const plan = playbackPlan(song, songStart);
    if (!plan) return;

    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;

    const run = async () => {
      clearStopTimer();
      clearPlayRaf();
      try {
        offsetRef.current = 0;
        const absolute = new URL(plan.src, window.location.href).href;
        if (audio.src !== absolute) {
          audio.src = plan.src;
        }
        audio.volume = volume;
        audio.crossOrigin = null;

        if (audio.readyState < 1) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error("audio load failed"));
            };
            const cleanup = () => {
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
            };
            audio.addEventListener("loadedmetadata", onLoaded);
            audio.addEventListener("error", onError);
            audio.load();
          });
        }

        if (cancelled) return;

        const full =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : 30;
        durationRef.current = full;
        audio.currentTime = 0;
        setElapsedSeconds(0);

        const onEnded = () => {
          clearPlayRaf();
          setPlaying(false);
          setElapsedSeconds(durationRef.current);
        };
        audio.addEventListener("ended", onEnded, { once: true });

        await audio.play();
        if (cancelled) {
          audio.pause();
          return;
        }
        setPlaying(true);
        startProgressTracking(audio);
      } catch {
        if (!cancelled) setPlaying(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      clearStopTimer();
      clearPlayRaf();
      audio.pause();
      setPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, answer?.id, song?.id, songStart, revealDismissed, startProgressTracking]);

  const dismissReveal = useCallback(() => {
    if (!revealCanDismiss) return;

    pauseAudio();
    const panel = panelRef.current;
    if (panel) {
      panel.classList.remove("is-shaking");
      panel.style.removeProperty("--lost-wash-opacity");
    }

    if (runActiveRef.current && status === "won") {
      const next = nextDifficulty(difficultyRef.current);
      setRevealDismissed(true);
      setAnswer(null);
      setGuessedInSeconds(null);
      setDifficulty(next);
      return;
    }

    if (runActiveRef.current && status === "lost") {
      setRevealDismissed(true);
      setRunFinished(true);
      return;
    }

    // Casual mode: load a new song for the current difficulty/catalog
    setRevealDismissed(true);
    setAnswer(null);
    setGuessedInSeconds(null);
    void loadSong(difficultyRef.current, {
      catalog,
      reroll: true,
    });
  }, [pauseAudio, revealCanDismiss, status, loadSong, catalog]);

  const submitRunScore = useCallback(
    async (correctCount: number, times: number[]) => {
      if (runSubmitted) return;
      setRunSubmitted(true);
      const totalTimeMs = times.reduce((sum, t) => sum + t, 0);
      const highest =
        lastClearedDifficultyRef.current ??
        (correctCount > 0
          ? previousDifficulty(difficultyRef.current)
          : "easy");
      try {
        await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerName,
            catalog,
            correctCount,
            totalTimeMs,
            highestDifficulty: highest,
          }),
        });
      } catch {
        // Ranking save is best-effort; still show end dialog.
      }
    },
    [catalog, playerName, runSubmitted],
  );

  useEffect(() => {
    if (!runActive || status !== "lost" || runSubmitted) return;
    void submitRunScore(runCorrectCount, runTimesMs);
  }, [
    runActive,
    status,
    runSubmitted,
    runCorrectCount,
    runTimesMs,
    submitRunScore,
  ]);

  const beginRun = (name: string) => {
    const cleaned = name.trim().slice(0, 24);
    if (!cleaned) return;
    writePlayerName(cleaned);
    setPlayerName(cleaned);
    setRunStartOpen(false);
    setRunActive(true);
    setRunFinished(false);
    setRunCorrectCount(0);
    setRunTimesMs([]);
    setRunSubmitted(false);
    lastClearedDifficultyRef.current = null;
    setRevealDismissed(false);
    setAnswer(null);
    setGuessedInSeconds(null);
    setDifficulty("easy");
    void loadSong("easy", { reroll: true, catalog });
  };

  const exitToCasual = () => {
    setRunActive(false);
    setRunFinished(false);
    setRunCorrectCount(0);
    setRunTimesMs([]);
    setRunSubmitted(false);
    void loadSong(difficulty, { catalog });
  };

  const revealAnswer = async () => {
    if (!song) return;
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty,
        songId: song.id,
        reveal: true,
      }),
    });
    const data = await res.json();
    setAnswer(data.answer ?? null);
    setStatus("lost");
  };

  const submitGuess = async (guess: SearchResult) => {
    if (!song || status !== "ready") return;
    const stageWhenGuessed = currentDuration;
    setQuery("");
    setResults([]);
    setSelectedGuess(null);
    setSearchOpen(false);
    pauseAudio();

    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty,
        songId: song.id,
        guessId: guess.id,
      }),
    });
    const data = await res.json();

    if (data.correct) {
      setAnswer(data.answer);
      setGuessedInSeconds(stageWhenGuessed);
      setStatus("won");
      return;
    }

    if (guessIndex >= maxGuesses - 1) {
      await revealAnswer();
      return;
    }

    setGuessIndex((i) => i + 1);
  };

  const skip = async () => {
    if (!song || status !== "ready") return;

    if (guessIndex >= maxGuesses - 1) {
      pauseAudio();
      await revealAnswer();
      return;
    }

    const nextIndex = guessIndex + 1;
    const nextDuration = orderedStages[nextIndex]!;
    setGuessIndex(nextIndex);
    durationRef.current = nextDuration;

    const audio = audioRef.current;
    if (audio && playing) {
      clearStopTimer();
      startProgressTracking(audio);
      scheduleStopAtDuration(audio, nextDuration);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? data.error ?? "Sync failed");
        return;
      }
      const warn =
        Array.isArray(data.warnings) && data.warnings.length > 0
          ? ` (${data.warnings.length} query warning(s))`
          : "";
      setMessage(
        `Synced ${data.totalWithPreview} tracks with previews (${data.added} new, scanned ${data.scanned ?? "?"}).${warn}`,
      );
      await loadSong(difficulty);
    } catch {
      setMessage("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  const toggleStage = (value: number) => {
    setStages((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((v) => v !== value);
      }
      return [...prev, value];
    });
    setGuessIndex(0);
    resetPlayback();
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (
      !selectedGuess ||
      next !== `${selectedGuess.title} - ${selectedGuess.artist}`
    ) {
      setSelectedGuess(null);
    }
  };

  const handleSelectResult = (r: SearchResult) => {
    setSelectedGuess(r);
    setQuery(`${r.title} - ${r.artist}`);
    setSearchOpen(false);
    setResults([]);
  };

  useEffect(() => {
    if (status === "won" || status === "lost") {
      setRevealDismissed(false);
    } else {
      setRevealDismissed(false);
    }
  }, [status, answer?.id]);

  const settingsProps = {
    song,
    songStart,
    stages,
    volume,
    accent: meta.activeBg,
    onSongStartChange: (mode: SongStartMode) => {
      setSongStart(mode);
      resetPlayback();
    },
    onToggleStage: toggleStage,
    onVolumeChange: setVolume,
  };

  const showingReveal =
    (status === "won" || status === "lost") && Boolean(answer) && !revealDismissed;
  const showingBoard =
    status === "ready" ||
    ((status === "won" || status === "lost") && revealDismissed);

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[10%] hidden select-none items-center lg:flex"
      >
        <span className="rotate-180 text-[9rem] font-black uppercase tracking-tighter text-white/[0.04] [writing-mode:vertical-rl]">
          VuaNhac
        </span>
      </div>

      <p className="absolute left-4 top-3.5 z-30 text-sm font-semibold tracking-tight text-white/90 sm:left-5 sm:top-4">
        VuaNhac
      </p>

      <div className="absolute right-16 top-3 z-30 flex max-w-[calc(100%-8rem)] flex-wrap items-center justify-end gap-2 sm:top-3.5 lg:right-5">
        <Link
          href="/ranking"
          className="rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:text-white"
        >
          Rankings
        </Link>
      </div>

      <MobileSettingsMenu
        open={menuOpen}
        onOpen={() => setMenuOpen(true)}
        onClose={() => setMenuOpen(false)}
        {...settingsProps}
      />

      <RunStartDialog
        open={runStartOpen}
        initialName={playerName}
        onClose={() => setRunStartOpen(false)}
        onStart={beginRun}
      />

      <RunEndDialog
        open={runFinished}
        playerName={playerName}
        correctCount={runCorrectCount}
        avgTimeMs={runAvgTimeMs}
        onPlayAgain={() => beginRun(playerName || readPlayerName())}
        onCasual={exitToCasual}
      />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1400px] flex-1 grid-cols-1 px-0 pb-0 pt-0 lg:grid-cols-[minmax(0,1fr)_440px_minmax(0,1fr)] lg:items-stretch lg:px-6 lg:pb-8 lg:pt-8">
        <DifficultySidebar
          difficulty={difficulty}
          status={status}
          onDifficultyChange={setDifficulty}
          onReroll={() => void loadSong(difficulty, { reroll: true })}
          runLocked={runActive}
          runActive={runActive}
          onStartRun={() => setRunStartOpen(true)}
          onEndRun={exitToCasual}
        />

        <section
          ref={panelRef}
          className="mode-panel relative mx-auto flex h-dvh w-full max-w-none flex-col items-center justify-center overflow-y-auto px-5 py-14 sm:px-6 lg:mt-0 lg:h-[calc(100vh-4rem)] lg:max-w-none lg:self-center lg:px-6 lg:py-10"
          data-status={
            showingReveal && (status === "lost" || status === "won")
              ? status
              : undefined
          }
          style={{
            backgroundColor:
              showingReveal && status === "lost" ? undefined : meta.panelBg,
            borderColor: "rgba(255,255,255,0.12)",
          }}
          onClick={() => {
            if (showingReveal && revealCanDismiss) dismissReveal();
          }}
          onKeyDown={(e) => {
            if (!showingReveal || !revealCanDismiss) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dismissReveal();
            }
          }}
          role={showingReveal && revealCanDismiss ? "button" : undefined}
          tabIndex={showingReveal && revealCanDismiss ? 0 : undefined}
          aria-label={
            showingReveal && revealCanDismiss
              ? "Dismiss reveal and show game controls"
              : undefined
          }
        >
          {showingReveal && status === "won" && (
            <>
              <div className="win-flash" aria-hidden />
              <canvas
                ref={confettiCanvasRef}
                className="win-confetti-canvas"
                aria-hidden
              />
            </>
          )}

          <div className="flex w-full flex-col items-center gap-8 sm:gap-10">
            {!showingReveal && status !== "setup" && status !== "error" && (
              <div className="flex w-full flex-col items-center gap-3">
                {runActive && (
                  <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-xs font-semibold text-zinc-200">
                    <span>Run · {playerName || "Player"}</span>
                    <span className="text-white/30">|</span>
                    <span>{runCorrectCount} correct</span>
                  </div>
                )}
                <CatalogPills
                  catalog={catalog}
                  onCatalogChange={setCatalog}
                  disabled={runActive}
                />
                <DifficultyPills
                  difficulty={difficulty}
                  onDifficultyChange={setDifficulty}
                  disabled={runActive}
                />
              </div>
            )}

            <div className="flex w-full flex-col items-center gap-8 sm:gap-10">
              {showingBoard && (
                <ProgressBar
                  currentDuration={currentDuration}
                  elapsedSeconds={elapsedSeconds}
                  layoutDomain={layoutDomain}
                  orderedStages={orderedStages}
                  accent={meta.activeBg}
                />
              )}

              {status === "loading" && (
                <div className="flex h-28 w-full items-center justify-center sm:h-32">
                  <p className="text-zinc-500">Loading song...</p>
                </div>
              )}

              {showingBoard && (
                <PlayControls
                  song={song}
                  playing={playing}
                  maxGuesses={maxGuesses}
                  currentDuration={currentDuration}
                  songStart={songStart}
                  accent={meta.activeBg}
                  onPlay={() => void playClip()}
                />
              )}

              {(status === "setup" || status === "error") && (
                <SetupErrorPanel
                  message={message}
                  syncing={syncing}
                  onSync={() => void runSync()}
                />
              )}

              {showingReveal && answer && (status === "won" || status === "lost") && (
                <div className="w-full">
                  <ResultReveal
                    revealRef={revealRef}
                    status={status}
                    answer={answer}
                    guessedInSeconds={guessedInSeconds}
                  />
                  <p
                    className={`mt-6 text-center text-xs transition-opacity duration-300 ${
                      revealCanDismiss ? "text-white/45" : "text-transparent"
                    }`}
                  >
                    {runActive && status === "won"
                      ? "Tap for next difficulty"
                      : runActive && status === "lost"
                        ? "Tap to see your score"
                        : "Tap for next song"}
                  </p>
                </div>
              )}
            </div>

            {showingBoard && (
              <GuessSearchBar
                searchBarRef={searchBarRef}
                query={query}
                results={results}
                selectedGuess={selectedGuess}
                searchOpen={searchOpen}
                actionsDisabled={status !== "ready"}
                onQueryChange={handleQueryChange}
                onFocus={() => setSearchOpen(true)}
                onSelectResult={handleSelectResult}
                onGuess={() => {
                  if (status !== "ready") return;
                  if (selectedGuess) void submitGuess(selectedGuess);
                }}
                onSkip={() => {
                  if (status !== "ready") return;
                  void skip();
                }}
              />
            )}

            {(showingBoard || status === "loading") && !runActive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void loadSong(difficulty, { reroll: true });
                }}
                disabled={status === "loading"}
                className="mt-1 flex w-full max-w-xs items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/25 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-40 lg:hidden"
              >
                <RerollIcon />
                Reroll
              </button>
            )}

            {!showingReveal && status !== "setup" && status !== "error" && (
              <div
                className="flex w-full max-w-xs flex-col gap-2 lg:hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {runActive ? (
                  <button
                    type="button"
                    onClick={exitToCasual}
                    className="w-full rounded-full py-2.5 text-sm font-semibold transition hover:brightness-110"
                    style={{
                      backgroundColor: RUN_META.endBg,
                      border: `1px solid ${RUN_META.endBorder}`,
                      color: RUN_META.endColor,
                    }}
                  >
                    End run
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRunStartOpen(true)}
                    className="w-full rounded-full py-2.5 text-sm font-semibold transition hover:brightness-110"
                    style={{
                      backgroundColor: RUN_META.startBg,
                      color: RUN_META.startText,
                    }}
                  >
                    Start a run
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <SettingsSidebar {...settingsProps} />
      </div>

      <audio ref={audioRef} preload="auto" className="hidden" />
    </div>
  );
}
