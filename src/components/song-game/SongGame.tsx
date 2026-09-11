"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  DIFFICULTY_META,
  GUESS_DURATIONS,
  PROGRESS_SPEED_FLOOR,
} from "@/src/lib/constants";
import type {
  Difficulty,
  PublicSong,
  SearchResult,
  SongAnswer,
} from "@/src/lib/types";
import { DifficultyPills } from "./DifficultyPills";
import { DifficultySidebar } from "./DifficultySidebar";
import { GuessSearchBar } from "./GuessSearchBar";
import { useRevealAnimations } from "./hooks/useRevealAnimations";
import { MobileSettingsMenu } from "./MobileSettingsMenu";
import { PlayControls } from "./PlayControls";
import { ProgressBar } from "./ProgressBar";
import { ResultReveal } from "./ResultReveal";
import { SettingsSidebar } from "./SettingsSidebar";
import { SetupErrorPanel } from "./SetupErrorPanel";
import type { GameStatus, SongStartMode } from "./types";
import { playbackPlan } from "./utils";

gsap.registerPlugin(useGSAP);

export function SongGame() {
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

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a - b),
    [stages],
  );
  const maxGuesses = orderedStages.length;
  const currentDuration =
    orderedStages[Math.min(guessIndex, Math.max(maxGuesses - 1, 0))] ?? 0.1;
  const meta = DIFFICULTY_META[difficulty];

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
  });

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
    async (diff: Difficulty, opts?: { reroll?: boolean }) => {
      setMessage(null);
      setGuessIndex(0);
      setAnswer(null);
      setGuessedInSeconds(null);
      setQuery("");
      setResults([]);
      setSelectedGuess(null);
      resetPlayback();

      try {
        const params = new URLSearchParams({ difficulty: diff });
        if (opts?.reroll) {
          params.set("reroll", "1");
          if (songIdRef.current) params.set("exclude", songIdRef.current);
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

        setSong(data.song);
        songIdRef.current = data.song?.id ?? null;
        setStatus("ready");
      } catch {
        setSong(null);
        songIdRef.current = null;
        setStatus("error");
        setMessage("Network error loading song");
      }
    },
    [resetPlayback],
  );

  useEffect(() => {
    void loadSong(difficulty);
  }, [difficulty, loadSong]);

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
          `/api/search?q=${encodeURIComponent(query)}&difficulty=${difficulty}`,
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
  }, [query, difficulty, status, revealDismissed]);

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
    setRevealDismissed(true);
    pauseAudio();
  }, [pauseAudio]);

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

      <MobileSettingsMenu
        open={menuOpen}
        status={status}
        onOpen={() => setMenuOpen(true)}
        onClose={() => setMenuOpen(false)}
        onReroll={() => void loadSong(difficulty, { reroll: true })}
        {...settingsProps}
      />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1400px] flex-1 grid-cols-1 px-0 pb-0 pt-0 lg:grid-cols-[minmax(0,1fr)_440px_minmax(0,1fr)] lg:items-stretch lg:px-6 lg:pb-8 lg:pt-8">
        <DifficultySidebar
          difficulty={difficulty}
          status={status}
          onDifficultyChange={setDifficulty}
          onReroll={() => void loadSong(difficulty, { reroll: true })}
        />

        <section
          ref={panelRef}
          className="mode-panel relative mx-auto flex h-dvh w-full max-w-none flex-col items-center justify-center overflow-y-auto px-5 py-14 sm:px-6 lg:mt-0 lg:h-[calc(100vh-4rem)] lg:max-w-none lg:self-center lg:px-6 lg:py-10"
          data-status={
            status === "lost" || status === "won" ? status : undefined
          }
          style={{
            backgroundColor: status === "lost" ? undefined : meta.panelBg,
            borderColor: "rgba(255,255,255,0.12)",
          }}
          onClick={() => {
            if (showingReveal) dismissReveal();
          }}
          onKeyDown={(e) => {
            if (!showingReveal) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dismissReveal();
            }
          }}
          role={showingReveal ? "button" : undefined}
          tabIndex={showingReveal ? 0 : undefined}
          aria-label={showingReveal ? "Dismiss reveal and show game controls" : undefined}
        >
          {status === "won" && (
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
              <DifficultyPills
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
              />
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
                  <p className="mt-6 text-center text-xs text-white/45">
                    Tap anywhere to continue
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
          </div>
        </section>

        <SettingsSidebar {...settingsProps} />
      </div>

      <audio ref={audioRef} preload="auto" className="hidden" />
    </div>
  );
}
