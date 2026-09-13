import { CATALOG_META, MUSIC_CATALOGS } from "@/src/lib/constants";
import type { MusicCatalog } from "@/src/lib/types";

type Props = {
  catalog: MusicCatalog;
  onCatalogChange: (c: MusicCatalog) => void;
};

/** Việt Nam / Worldwide filter shown in the middle panel. */
export function CatalogPills({ catalog, onCatalogChange }: Props) {
  return (
    <div
      className="flex w-full items-center justify-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {MUSIC_CATALOGS.map((c) => {
        const active = c === catalog;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onCatalogChange(c)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
              active
                ? "bg-white text-black"
                : "bg-white/10 text-zinc-300 hover:bg-white/15 hover:text-white"
            }`}
          >
            {CATALOG_META[c].label}
          </button>
        );
      })}
    </div>
  );
}
