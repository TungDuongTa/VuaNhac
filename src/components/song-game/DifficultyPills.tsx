import { DIFFICULTIES, DIFFICULTY_META } from "@/src/lib/constants";
import type { Difficulty } from "@/src/lib/types";

type Props = {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  disabled?: boolean;
};

/** Compact difficulty pills shown inside the middle panel (mobile + desktop). */
export function DifficultyPills({
  difficulty,
  onDifficultyChange,
  disabled = false,
}: Props) {
  return (
    <div
      className="flex w-full flex-nowrap items-center justify-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {DIFFICULTIES.map((d) => {
        const m = DIFFICULTY_META[d];
        const active = d === difficulty;
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onDifficultyChange(d)}
            className="shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:text-sm"
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
  );
}
