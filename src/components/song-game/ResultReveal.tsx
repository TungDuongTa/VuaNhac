import type { RefObject } from "react";
import type { SongAnswer } from "@/src/lib/types";
import { formatDuration } from "./utils";

type Props = {
  revealRef: RefObject<HTMLDivElement | null>;
  status: "won" | "lost";
  answer: SongAnswer;
  guessedInSeconds: number | null;
};

export function ResultReveal({
  revealRef,
  status,
  answer,
  guessedInSeconds,
}: Props) {
  return (
    <div
      ref={revealRef}
      className={`result-reveal${status === "lost" ? " is-lost" : " is-won"}`}
    >
      <div className="result-artwork-wrap">
        <div className="result-artwork-stage">
          <span aria-hidden className={`result-artwork-glow ${status}`} />
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

      {status === "lost" && <p className="result-kicker">It was...</p>}

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
  );
}
