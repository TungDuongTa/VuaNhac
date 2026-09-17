import { CATALOG_META, MUSIC_CATALOGS } from "@/src/lib/constants";
import type { MusicCatalog } from "@/src/lib/types";

type Props = {
  enabledCatalogs: MusicCatalog[];
  onToggleCatalog: (c: MusicCatalog) => void;
  disabled?: boolean;
};

/** Việt Nam / Worldwide toggles — one or both can be enabled. */
export function CatalogPills({
  enabledCatalogs,
  onToggleCatalog,
  disabled = false,
}: Props) {
  return (
    <div
      className="flex w-full items-center justify-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {MUSIC_CATALOGS.map((c) => {
        const m = CATALOG_META[c];
        const on = enabledCatalogs.includes(c);
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggleCatalog(c)}
            className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-sm"
            style={
              on
                ? {
                    backgroundColor: m.activeBg,
                    color: "#0a0a0a",
                    borderColor: m.activeBg,
                    boxShadow: `0 0 20px ${m.activeBg}44`,
                  }
                : {
                    backgroundColor: m.offBg,
                    color: m.offColor,
                    borderColor: m.offBorder,
                    boxShadow: "none",
                  }
            }
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
