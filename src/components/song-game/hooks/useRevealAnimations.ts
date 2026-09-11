import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import type { SongAnswer } from "@/src/lib/types";
import type { GameStatus } from "../types";
import { fireWinConfetti } from "../utils";

gsap.registerPlugin(useGSAP, SplitText);

type Args = {
  status: GameStatus;
  answer: SongAnswer | null;
  panelRef: RefObject<HTMLElement | null>;
  revealRef: RefObject<HTMLDivElement | null>;
  confettiCanvasRef: RefObject<HTMLCanvasElement | null>;
};

export function useRevealAnimations({
  status,
  answer,
  panelRef,
  revealRef,
  confettiCanvasRef,
}: Args) {
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

      tl.to(artist, { opacity: 1, y: 0, duration: 0.48 }, ">-0.05");
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
}
