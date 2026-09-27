import type { RefObject } from "react";
import { formatDuration } from "./utils";

type Props = {
  currentDuration: number;
  fillRef: RefObject<HTMLDivElement | null>;
  layoutDomain: number;
  orderedStages: number[];
  accent: string;
};

export function ProgressBar({
  currentDuration,
  fillRef,
  layoutDomain,
  orderedStages,
  accent,
}: Props) {
  const unlockedTime = currentDuration;

  return (
    <div className="w-full">
      <div className="relative h-5 w-full overflow-hidden rounded-full bg-[#2a2a2a] sm:h-6">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${Math.min(100, (unlockedTime / layoutDomain) * 100)}%`,
            backgroundColor: accent,
            opacity: 0.35,
          }}
        />
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0"
          style={{ backgroundColor: accent }}
        />
        {orderedStages.map((stage) => {
          if (stage >= layoutDomain - 0.0001) return null;
          return (
            <div
              key={stage}
              className="absolute top-0 bottom-0 z-[1] w-px bg-black/55"
              style={{ left: `${(stage / layoutDomain) * 100}%` }}
              title={formatDuration(stage)}
            />
          );
        })}
      </div>
    </div>
  );
}
