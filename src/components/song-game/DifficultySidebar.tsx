import { DIFFICULTIES, DIFFICULTY_META } from "@/src/lib/constants";
import type { Difficulty } from "@/src/lib/types";
import { RerollIcon } from "./icons";
import type { GameStatus } from "./types";

type Props = {
  difficulty: Difficulty;
  status: GameStatus;
  onDifficultyChange: (d: Difficulty) => void;
  onReroll: () => void;
};

export function DifficultySidebar({
  difficulty,
  status,
  onDifficultyChange,
  onReroll,
}: Props) {
  return (
    <aside className="hidden flex-col items-center justify-center gap-3 pr-4 lg:flex">
      {DIFFICULTIES.map((d) => {
        const m = DIFFICULTY_META[d];
        const active = d === difficulty;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onDifficultyChange(d)}
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
        onClick={onReroll}
        disabled={status === "loading"}
        className="mt-2 flex w-[7.75rem] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#1c1c1c] py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-40"
      >
        <RerollIcon />
        Reroll
      </button>
    </aside>
  );
}
