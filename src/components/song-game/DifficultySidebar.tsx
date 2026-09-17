import { DIFFICULTIES, DIFFICULTY_META, RUN_META } from "@/src/lib/constants";
import type { Difficulty } from "@/src/lib/types";
import { RerollIcon } from "./icons";
import type { GameStatus } from "./types";

type Props = {
  difficulty: Difficulty;
  status: GameStatus;
  onDifficultyChange: (d: Difficulty) => void;
  onReroll: () => void;
  runLocked?: boolean;
  runActive?: boolean;
  onStartRun?: () => void;
  onEndRun?: () => void;
};

export function DifficultySidebar({
  difficulty,
  status,
  onDifficultyChange,
  onReroll,
  runLocked = false,
  runActive = false,
  onStartRun,
  onEndRun,
}: Props) {
  return (
    <aside className="hidden flex-col items-center justify-center gap-3 pr-4 lg:flex">
      {runActive ? (
        <button
          type="button"
          onClick={onEndRun}
          className="mb-1 w-[7.75rem] rounded-full py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
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
          onClick={onStartRun}
          className="mb-1 w-[7.75rem] rounded-full py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
          style={{
            backgroundColor: RUN_META.startBg,
            color: RUN_META.startText,
          }}
        >
          Start a run
        </button>
      )}

      {DIFFICULTIES.map((d) => {
        const m = DIFFICULTY_META[d];
        const active = d === difficulty;
        return (
          <button
            key={d}
            type="button"
            disabled={runLocked}
            onClick={() => onDifficultyChange(d)}
            className="w-[7.75rem] rounded-full py-2.5 text-center text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
        disabled={status === "loading" || runLocked}
        className="mt-2 flex w-[7.75rem] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#1c1c1c] py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-white/30 hover:text-white disabled:opacity-40"
      >
        <RerollIcon />
        Reroll
      </button>
    </aside>
  );
}
