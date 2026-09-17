import { CATALOG_META, MUSIC_CATALOGS } from "@/src/lib/constants";
import type { MusicCatalog } from "@/src/lib/types";

type Props = {
  catalog: MusicCatalog;
  onCatalogChange: (c: MusicCatalog) => void;
  disabled?: boolean;
};

/** Việt Nam / Worldwide filter shown in the middle panel. */
export function CatalogPills({
  catalog,
  onCatalogChange,
  disabled = false,
}: Props) {
  return (
    <div
      className="flex w-full items-center justify-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {MUSIC_CATALOGS.map((c) => {
        const m = CATALOG_META[c];
        const active = c === catalog;
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onCatalogChange(c)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
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
