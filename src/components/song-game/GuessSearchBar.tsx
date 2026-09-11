import type { RefObject } from "react";
import type { SearchResult } from "@/src/lib/types";
import { SearchIcon, SkipIcon } from "./icons";

type Props = {
  searchBarRef: RefObject<HTMLDivElement | null>;
  query: string;
  results: SearchResult[];
  selectedGuess: SearchResult | null;
  searchOpen: boolean;
  actionsDisabled?: boolean;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onSelectResult: (result: SearchResult) => void;
  onGuess: () => void;
  onSkip: () => void;
};

export function GuessSearchBar({
  searchBarRef,
  query,
  results,
  selectedGuess,
  searchOpen,
  actionsDisabled = false,
  onQueryChange,
  onFocus,
  onSelectResult,
  onGuess,
  onSkip,
}: Props) {
  return (
    <div
      ref={searchBarRef}
      className="relative flex w-full gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={onFocus}
          placeholder="Search songs..."
          className="w-full rounded-full border border-white/25 bg-[#141414] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/40"
          autoComplete="off"
        />
        {searchOpen && results.length > 0 && (
          <ul className="app-scrollbar absolute bottom-full z-20 mb-2 max-h-52 w-full overflow-auto rounded-2xl border border-white/15 bg-[#141414] py-1 shadow-xl shadow-black/50">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  onClick={() => onSelectResult(r)}
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
          disabled={actionsDisabled || !selectedGuess}
          onClick={onGuess}
          className="flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-white/25 bg-[#141414] px-7 text-sm font-medium text-white hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guess
        </button>
      ) : (
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={onSkip}
          className="flex min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-white/25 bg-[#141414] px-7 text-sm font-medium text-white hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipIcon />
          Skip
        </button>
      )}
    </div>
  );
}
