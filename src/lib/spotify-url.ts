/** Extract a Spotify track ID from a URL, URI, or bare ID. */
export function parseSpotifyTrackId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9]{22}$/.test(raw)) return raw;

  const uri = raw.match(/spotify:track:([a-zA-Z0-9]{22})/i);
  if (uri?.[1]) return uri[1];

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const trackIdx = parts.findIndex((p) => p === "track");
    if (trackIdx >= 0 && parts[trackIdx + 1]) {
      const id = parts[trackIdx + 1]!.split("?")[0]!;
      if (/^[a-zA-Z0-9]{22}$/.test(id)) return id;
    }
  } catch {
    // not a URL
  }

  const loose = raw.match(/track\/([a-zA-Z0-9]{22})/i);
  return loose?.[1] ?? null;
}
