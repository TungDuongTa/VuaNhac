/** Client-side player name cookie for run mode. */
export const PLAYER_NAME_COOKIE = "vuanhac-player-name";

export function readPlayerName(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PLAYER_NAME_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim().slice(0, 24);
  } catch {
    return "";
  }
}

export function writePlayerName(name: string): void {
  if (typeof document === "undefined") return;
  const cleaned = name.trim().slice(0, 24);
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${PLAYER_NAME_COOKIE}=${encodeURIComponent(cleaned)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
