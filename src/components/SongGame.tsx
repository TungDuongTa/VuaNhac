"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import confetti from "canvas-confetti";
import {
  DIFFICULTIES,
  DIFFICULTY_META,
  GUESS_DURATIONS,
  PANEL_IDLE,
  PROGRESS_SPEED_FLOOR,
  STAGE_OPTIONS,
} from "@/src/lib/constants";
import type {
  Difficulty,
  PublicSong,
  SearchResult,
  SongAnswer,
} from "@/src/lib/types";

gsap.registerPlugin(useGSAP, SplitText);

/** Same palette as guessable.gg; bursts clipped to the middle panel canvas */
const WIN_CONFETTI_COLORS = ["#1FDF6A", "#F2F4F3", "#0FBF56", "#7CF5AD"];

function fireWinConfetti(canvas: HTMLCanvasElement): {
  timers: number[];
  reset: () => void;
} {
  const timers: number[] = [];
  const fire = confetti.create(canvas, {
    resize: true,
    disableForReducedMotion: true,
  });

  const burst = (opts: confetti.Options) => {
    fire({
      colors: WIN_CONFETTI_COLORS,
      ticks: 160,
      gravity: 1.05,
      scalar: 0.9,
      ...opts,
    });
  };

  // Left + right first, then bottom — all origins inside the panel canvas
  burst({
    particleCount: 48,
    spread: 58,
    angle: 60,
    startVelocity: 32,
    origin: { x: 0.02, y: 0.62 },
  });
  burst({
    particleCount: 48,
    spread: 58,
    angle: 120,
    startVelocity: 32,
    origin: { x: 0.98, y: 0.62 },
  });
  timers.push(
    window.setTimeout(() => {
      burst({
        particleCount: 56,
        spread: 72,
        angle: 90,
        startVelocity: 36,
        origin: { x: 0.5, y: 0.96 },
      });
    }, 220),
  );

  return { timers, reset: () => fire.reset() };
}

type GameStatus = "loading" | "ready" | "won" | "lost" | "setup" | "error";
type SongStartMode = "spotify" | "fromStart";

function playbackPlan(
  song: PublicSong,
  mode: SongStartMode,
): { src: string } | null {
  if (mode === "fromStart") {
    return song.hostedUrl ? { src: song.hostedUrl } : null;
  }
  return song.previewUrl ? { src: song.previewUrl } : null;
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return `${seconds}s`;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds}s`;
}

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
  /** Seconds into the song currently reflected on the progress bar / playhead */
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [songStart, setSongStart] = useState<SongStartMode>("fromStart");
  const [stages, setStages] = useState<number[]>([...GUESS_DURATIONS]);
  const [volume, setVolume] = useState(0.35);

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

  /** Timeline width in seconds — at least 8s so early stages share the same px/s. Grows to 15s with GSAP. */
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

  useGSAP(
    () => {
      if (status !== "lost" || !answer) return;

      const panel = panelRef.current;
      const root = revealRef.current;
      if (!panel || !root) return;

      const kicker = root.querySelector<HTMLElement>(".result-kicker");
      const artWrap = root.querySelector<HTMLElement>(".result-artwork-wrap");
      const titleEl = root.querySelector<HTMLElement>(".result-title");
      const artist = root.querySelector<HTMLElement>(".result-artist");
      const stamp = root.querySelector<HTMLElement>(".result-stamp");

      if (!kicker || !artWrap || !titleEl || !artist || !stamp) return;

      const split = SplitText.create(titleEl, {
        type: "words",
        wordsClass: "result-title-word",
        mask: "words",
      });
      const words = split.words;

      const wash = { value: 0 };
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      gsap.set(kicker, { opacity: 0 });
      gsap.set(artWrap, { yPercent: 25, opacity: 0 });
      if (words.length > 0) gsap.set(words, { yPercent: 110 });
      gsap.set(artist, { opacity: 0, y: 12 });
      gsap.set(stamp, { opacity: 0, scale: 1.2, rotation: -8 });
      panel.style.setProperty("--lost-wash-opacity", "0");

      // 1) Background + "It was..." fade in, panel shakes
      panel.classList.add("is-shaking");
      tl.to(
        wash,
        {
          value: 1,
          duration: 0.75,
          onUpdate: () => {
            panel.style.setProperty("--lost-wash-opacity", String(wash.value));
          },
        },
        0,
      );
      tl.to(kicker, { opacity: 1, duration: 0.75 }, 0);

      // 2) Album: start slightly below (25%) at 0 opacity → settle + full opacity
      const albumStart = 0.85;
      const albumDur = 0.95;
      const wordDelay = 0.28;
      const wordStart = albumStart + wordDelay;
      const wordWindow = albumDur - wordDelay;
      const wordStagger =
        words.length > 1 ? Math.min(0.055, wordWindow / (words.length + 3)) : 0;
      const wordDur = Math.max(
        0.28,
        wordWindow - wordStagger * Math.max(0, words.length - 1),
      );

      tl.to(
        artWrap,
        {
          yPercent: 0,
          opacity: 1,
          duration: albumDur,
          ease: "power3.out",
        },
        albumStart,
      );

      // Title starts later but finishes with the album (SplitText words)
      if (words.length > 0) {
        tl.to(
          words,
          {
            yPercent: 0,
            duration: wordDur,
            stagger: wordStagger,
            ease: "power3.out",
          },
          wordStart,
        );
      }

      // 3) Artist / album
      tl.to(artist, { opacity: 1, y: 0, duration: 0.48 }, ">-0.05");

      // 4) Lost stamp bounce: 1.2 → 0.8 → 1.1 → 1
      tl.to(stamp, { opacity: 1, duration: 0.06 }, ">-0.02");
      tl.to(
        stamp,
        {
          keyframes: [
            { scale: 1.2, duration: 0.16 },
            { scale: 0.8, duration: 0.2 },
            { scale: 1.1, duration: 0.18 },
            { scale: 1, duration: 0.22 },
          ],
          ease: "power2.out",
        },
        "<",
      );

      return () => {
        panel.classList.remove("is-shaking");
        panel.style.removeProperty("--lost-wash-opacity");
        tl.kill();
        split.revert();
      };
    },
    { dependencies: [status, answer?.id] },
  );

  useGSAP(
    () => {
      if (status !== "won" || !answer) return;

      const panel = panelRef.current;
      const root = revealRef.current;
      if (!panel || !root) return;

      const flash = panel.querySelector<HTMLElement>(".win-flash");
      const artStage = root.querySelector<HTMLElement>(".result-artwork-stage");
      const veil = root.querySelector<HTMLElement>(".result-artwork-veil");
      const titleEl = root.querySelector<HTMLElement>(".result-title");
      const artist = root.querySelector<HTMLElement>(".result-artist");
      const stamp = root.querySelector<HTMLElement>(".result-stamp");

      if (!flash || !artStage || !veil || !titleEl || !artist || !stamp) {
        return;
      }

      const split = SplitText.create(titleEl, {
        type: "words",
        wordsClass: "result-title-word",
        mask: "words",
      });
      const words = split.words;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      const confettiTimers: number[] = [];
      let resetConfetti: (() => void) | undefined;

      gsap.set(flash, { opacity: 1 });
      gsap.set(artStage, { scale: 1.55, rotation: -18, opacity: 1 });
      gsap.set(veil, { clipPath: "inset(0% 0 0 0)", opacity: 1 });
      if (words.length > 0) gsap.set(words, { yPercent: 110 });
      gsap.set(artist, { opacity: 0, y: 12 });
      gsap.set(stamp, { opacity: 0, scale: 1.2, rotation: -8 });

      // 1–3) Flash + album + veil
      tl.to(flash, { opacity: 0, duration: 0.22, ease: "power2.in" }, 0);

      tl.to(
        artStage,
        {
          scale: 1,
          rotation: 0,
          duration: 0.48,
          ease: "power2.out",
        },
        0.04,
      );

      tl.to(
        veil,
        {
          clipPath: "inset(100% 0 0 0)",
          duration: 0.2,
          ease: "power2.in",
        },
        0.1,
      );

      // Bounce: gentler + slower for album cover
      tl.to(
        artStage,
        {
          keyframes: [
            { scale: 1.1, duration: 0.22 },
            { scale: 0.92, duration: 0.28 },
            { scale: 1.05, duration: 0.24 },
            { scale: 1, duration: 0.3 },
          ],
          ease: "power2.out",
        },
        0.22,
      );

      // Confetti clipped to middle panel: left + right, then bottom
      tl.call(
        () => {
          const canvas = confettiCanvasRef.current;
          if (!canvas) return;
          const { timers, reset } = fireWinConfetti(canvas);
          confettiTimers.push(...timers);
          resetConfetti = reset;
        },
        undefined,
        0.35,
      );

      // 4) Title / artist / stamp after the intro beat
      const textAt = 0.85;
      if (words.length > 0) {
        tl.to(
          words,
          {
            yPercent: 0,
            duration: 0.42,
            stagger: 0.07,
            ease: "power3.out",
          },
          textAt,
        );
      }
      tl.to(artist, { opacity: 1, y: 0, duration: 0.42 }, textAt + 0.28);
      tl.to(stamp, { opacity: 1, duration: 0.06 }, textAt + 0.45);
      tl.to(
        stamp,
        {
          keyframes: [
            { scale: 1.2, duration: 0.16 },
            { scale: 0.8, duration: 0.2 },
            { scale: 1.1, duration: 0.18 },
            { scale: 1, duration: 0.22 },
          ],
          ease: "power2.out",
        },
        textAt + 0.45,
      );

      return () => {
        confettiTimers.forEach((id) => window.clearTimeout(id));
        resetConfetti?.();
        tl.kill();
        split.revert();
        gsap.set(flash, { clearProps: "opacity" });
      };
    },
    { dependencies: [status, answer?.id] },
  );

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

  /** Pause without rewinding — used when guessing so the playhead stays. */
  const pauseAudio = useCallback(() => {
    clearStopTimer();
    clearPlayRaf();
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(false);
  }, []);

  /** Full reset for a new song / difficulty. */
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
      // Keep middle UI mounted while swapping (avoids mode-row jump/flash)
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
    if (query.trim().length < 1 || status !== "ready") {
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
  }, [query, difficulty, status]);

  useEffect(() => {
    if (status !== "ready") return;

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
  }, [status, query, selectedGuess, searchOpen]);

  const playClip = async () => {
    if (!song || status === "won" || status === "lost") return;
    if (maxGuesses === 0) return;
    const plan = playbackPlan(song, songStart);
    if (!plan) return;
    const audio = audioRef.current;
    if (!audio) return;

    // Toggle pause if already playing
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
      // Clear any prior CORS mode — R2 public URLs often lack ACAO headers.
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

      // Only rewind after the current stage has been fully heard
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

  /** On win/lose reveal: play the chosen mode clip from the start (full available audio). */
  useEffect(() => {
    if (status !== "won" && status !== "lost") return;
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
    // Intentionally keyed to reveal identity + mode (not volume — volume has its own effect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, answer?.id, song?.id, songStart, startProgressTracking]);

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
    // Extending the stage: keep playhead, continue (or stay paused) toward the new end
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

  const inPlay = status === "ready" || status === "won" || status === "lost";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[10%] hidden select-none items-center lg:flex"
      >
        <span className="rotate-180 text-[9rem] font-black uppercase tracking-tighter text-white/[0.04] [writing-mode:vertical-rl]">
          VuaNhac
        </span>
      </div>

      <p className="absolute left-5 top-4 z-20 text-sm font-semibold tracking-tight text-white/90">
        VuaNhac
      </p>

      {/* Fixed 400px middle column; equal side gutters — not a stretching 1fr center */}
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1400px] flex-1 grid-cols-1 px-4 pb-6 pt-14 lg:grid-cols-[minmax(0,1fr)_440px_minmax(0,1fr)] lg:items-stretch lg:px-6 lg:pb-8 lg:pt-8">
        <aside className="hidden flex-col items-center justify-center gap-3 pr-4 lg:flex">
          {DIFFICULTIES.map((d) => {
            const m = DIFFICULTY_META[d];
            const active = d === difficulty;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className="w-[7.75rem] rounded-full py-2.5 text-center text-sm font-semibold transition-all"
                style={
                  active
                    ? { backgroundColor: m.activeBg, color: "#0a0a0a" }
                    : { backgroundColor: "#1c1c1c", color: "#a1a1aa" }
                }
              >
                {m.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void loadSong(difficulty, { reroll: true })}
            disabled={status === "loading"}
            className="mt-2 flex w-[7.75rem] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#1c1c1c] py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.9 3.1L6.7 17.5A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7zm-5 5a5 5 0 0 1 8.9-3.1l1.4-1.4A7 7 0 0 0 5 13c0 .7.1 1.37.3 2H7.1A5 5 0 0 1 7 11z" />
            </svg>
            Reroll
          </button>
        </aside>

        <section
          ref={panelRef}
          className="mode-panel relative mx-auto mt-4 flex w-full max-w-[440px] flex-col items-center justify-center px-5 py-10 sm:px-6 lg:mt-0 lg:h-[calc(100vh-4rem)] lg:max-w-none lg:self-center"
          data-status={
            status === "lost" || status === "won" ? status : undefined
          }
          style={{
            backgroundColor: status === "lost" ? undefined : meta.panelBg,
            borderColor: "rgba(255,255,255,0.12)",
          }}
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
          {/* All game controls clustered and vertically centered */}
          <div className="flex w-full flex-col items-center gap-10">
            {status !== "won" && status !== "lost" && (
              <div className="flex w-full flex-nowrap items-center justify-center gap-1.5">
                {DIFFICULTIES.map((d) => {
                  const m = DIFFICULTY_META[d];
                  const active = d === difficulty;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className="shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-all sm:px-3.5 sm:text-sm"
                      style={
                        active
                          ? { backgroundColor: m.activeBg, color: "#0a0a0a" }
                          : { backgroundColor: m.idleBg, color: m.color }
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Keep play/progress slot mounted so mode switches don't reflow the mode row */}
            <div className="flex w-full flex-col items-center gap-10">
              {status === "ready" && (
                <div className="w-full">
                  <div className="relative h-5 w-full overflow-hidden rounded-full bg-[#2a2a2a] sm:h-6">
                    {(() => {
                      const unlockedTime = currentDuration;
                      const elapsed = Math.min(elapsedSeconds, unlockedTime);
                      return (
                        <>
                          {/* Unlocked range — faded */}
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${Math.min(100, (unlockedTime / layoutDomain) * 100)}%`,
                              backgroundColor: meta.activeBg,
                              opacity: 0.35,
                            }}
                          />
                          {/* Playback fill — constant speed vs layoutDomain (min 8s) */}
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${Math.min(100, (elapsed / layoutDomain) * 100)}%`,
                              backgroundColor: meta.activeBg,
                            }}
                          />
                        </>
                      );
                    })()}
                    {/* Stage checkpoints — slide left as layoutDomain grows (e.g. 8 → 15) */}
                    {orderedStages.map((stage) => {
                      if (stage >= layoutDomain - 0.0001) return null;
                      return (
                        <div
                          key={stage}
                          className="absolute top-0 bottom-0 z-[1] w-px bg-black/55"
                          style={{
                            left: `${(stage / layoutDomain) * 100}%`,
                          }}
                          title={formatDuration(stage)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {status === "loading" && (
                <div className="flex h-28 w-full items-center justify-center sm:h-32">
                  <p className="text-zinc-500">Loading song...</p>
                </div>
              )}

              {inPlay && status === "ready" && (
                <div className="relative flex w-full items-center justify-center">
                  <button
                    type="button"
                    onClick={() => void playClip()}
                    disabled={
                      !song ||
                      maxGuesses === 0 ||
                      (songStart === "fromStart"
                        ? !song.hostedUrl
                        : !song.previewUrl)
                    }
                    className="flex h-28 w-28 items-center justify-center rounded-full text-black transition hover:scale-105 active:scale-95 disabled:opacity-40 sm:h-32 sm:w-32"
                    style={{
                      backgroundColor: meta.activeBg,
                      boxShadow: `0 0 48px ${meta.activeBg}55`,
                    }}
                    aria-label="Play clip"
                  >
                    {playing ? (
                      <span className="flex gap-2">
                        <span className="h-10 w-2.5 rounded-full bg-black" />
                        <span className="h-10 w-2.5 rounded-full bg-black" />
                      </span>
                    ) : (
                      <PlayIcon className="ml-1.5 h-14 w-14 text-black sm:h-16 sm:w-16" />
                    )}
                  </button>
                  <span
                    className="absolute right-0 font-mono text-lg font-semibold tabular-nums sm:text-xl"
                    style={{ color: meta.activeBg }}
                  >
                    {formatDuration(currentDuration)}
                  </span>
                </div>
              )}

              {(status === "setup" || status === "error") && (
                <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
                  <p className="text-sm text-zinc-300">{message}</p>
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    disabled={syncing}
                    className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {syncing ? "Syncing..." : "Sync song library"}
                  </button>
                </div>
              )}

              {(status === "won" || status === "lost") && answer && (
                <div
                  ref={revealRef}
                  className={`result-reveal${status === "lost" ? " is-lost" : " is-won"}`}
                >
                  <div className="result-artwork-wrap">
                    <div className="result-artwork-stage">
                      <span
                        aria-hidden
                        className={`result-artwork-glow ${status}`}
                      />
                      <div className="result-artwork-inner">
                        <div className="result-artwork-slide">
                          {answer.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={answer.imageUrl}
                              alt=""
                              className="result-artwork"
                            />
                          ) : (
                            <div
                              className="result-artwork grid place-items-center bg-zinc-900 text-3xl text-zinc-500"
                              aria-hidden
                            >
                              ♪
                            </div>
                          )}
                        </div>
                        {status === "won" && (
                          <div className="result-artwork-veil" aria-hidden />
                        )}
                      </div>
                    </div>
                  </div>

                  {status === "lost" && (
                    <p className="result-kicker">It was...</p>
                  )}

                  <h1
                    className="result-title"
                    style={status === "won" ? { marginTop: 22 } : undefined}
                  >
                    {answer.title}
                  </h1>

                  <p className="result-artist">
                    {answer.artist}
                    {answer.album ? ` · ${answer.album}` : ""}
                  </p>

                  <div className={`result-stamp ${status}`}>
                    {status === "won" && guessedInSeconds != null
                      ? `Guessed in ${formatDuration(guessedInSeconds)}!`
                      : "Lost!"}
                  </div>
                </div>
              )}
            </div>

            {status === "ready" && (
              <div ref={searchBarRef} className="relative flex w-full gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 fill-none stroke-current stroke-2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3-3" />
                    </svg>
                  </span>
                  <input
                    value={query}
                    onChange={(e) => {
                      const next = e.target.value;
                      setQuery(next);
                      if (
                        !selectedGuess ||
                        next !==
                          `${selectedGuess.title} - ${selectedGuess.artist}`
                      ) {
                        setSelectedGuess(null);
                      }
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search songs..."
                    className="w-full rounded-full border border-white/25 bg-[#141414] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/40"
                    autoComplete="off"
                  />
                  {searchOpen && results.length > 0 && (
                    <ul className="absolute bottom-full z-20 mb-2 max-h-52 w-full overflow-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-xl">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-900"
                            onClick={() => {
                              setSelectedGuess(r);
                              setQuery(`${r.title} - ${r.artist}`);
                              setSearchOpen(false);
                              setResults([]);
                            }}
                          >
                            {r.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.imageUrl}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <span className="h-8 w-8 rounded bg-zinc-800" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-white">
                                {r.title}
                              </span>
                              <span className="block truncate text-xs text-zinc-500">
                                {r.artist}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {query.trim().length > 0 ? (
                  <button
                    type="button"
                    disabled={!selectedGuess}
                    onClick={() => {
                      if (selectedGuess) void submitGuess(selectedGuess);
                    }}
                    className="flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-white/25 bg-[#141414] px-7 text-sm font-medium text-white hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Guess
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void skip()}
                    className="flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-white/25 bg-[#141414] px-7 text-sm font-medium text-white hover:border-white/40"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M4 5v14l9-7zm11 0v14h2V5z" />
                    </svg>
                    Skip
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="mx-auto mt-8 flex w-full max-w-[220px] flex-col items-center justify-center space-y-7 lg:mx-0 lg:mt-0 lg:max-w-[240px] lg:justify-self-center lg:pl-6">
          <section className="w-full">
            <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
              <WaveIcon />
              SONG START
            </h2>
            <div className="flex flex-col gap-2">
              <SettingsPill
                active={songStart === "spotify"}
                onClick={() => {
                  setSongStart("spotify");
                  resetPlayback();
                }}
                label="Spotify preview"
                accent={meta.activeBg}
              />
              <SettingsPill
                active={songStart === "fromStart"}
                onClick={() => {
                  setSongStart("fromStart");
                  resetPlayback();
                }}
                label="From the start"
                accent={meta.activeBg}
              />
            </div>
            {songStart === "fromStart" && !song?.hostedUrl && (
              <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
                Needs a hosted ~30s R2 clip (`hostedUrl`).
              </p>
            )}
            {songStart === "spotify" && !song?.previewUrl && (
              <p className="mt-2 text-center text-[10px] leading-snug text-zinc-500">
                No Spotify preview for this track.
              </p>
            )}
          </section>

          <section className="w-full">
            <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
              <TimerIcon />
              STAGES
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {STAGE_OPTIONS.map((stage) => {
                const active = stages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => toggleStage(stage)}
                    className="flex h-9 w-[3.75rem] items-center justify-center rounded-full text-center text-sm font-semibold transition-colors"
                    style={
                      active
                        ? { backgroundColor: meta.activeBg, color: "#0a0a0a" }
                        : { backgroundColor: PANEL_IDLE, color: "#e4e4e7" }
                    }
                  >
                    {formatDuration(stage)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="w-full">
            <h2 className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white">
              <SpeakerIcon />
              VOLUME
            </h2>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="volume-slider w-full"
              style={
                {
                  ["--vol" as never]: Math.round(volume * 100),
                  ["--accent" as never]: meta.activeBg,
                } as CSSProperties
              }
              aria-label="Volume"
            />
          </section>
        </aside>
      </div>

      <audio ref={audioRef} preload="auto" className="hidden" />
    </div>
  );
}

function SettingsPill({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center rounded-full px-5 text-center text-sm font-semibold transition-colors"
      style={
        active
          ? { backgroundColor: accent, color: "#0a0a0a" }
          : { backgroundColor: PANEL_IDLE, color: "#f4f4f5" }
      }
    >
      {label}
    </button>
  );
}

function PlayIcon({ className }: { className?: string }) {
  // Soft rounded triangle (similar to songless / modern media UIs)
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M3 10h2v4H3zm4-4h2v12H7zm4-3h2v18h-2zm4 5h2v8h-2zm4-2h2v12h-2z" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 fill-none stroke-current stroke-2"
      aria-hidden
    >
      <circle cx="12" cy="13" r="7" />
      <path d="M12 10v3l2 1M9 3h6" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a3.5 3.5 0 0 0-1.5-2.8v5.6a3.5 3.5 0 0 0 1.5-2.8z" />
    </svg>
  );
}
