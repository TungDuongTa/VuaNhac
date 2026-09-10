type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export function hasSpotifyCredentials(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET,
  );
}

export async function getSpotifyToken(): Promise<string> {
  if (!hasSpotifyCredentials()) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local",
    );
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCache.accessToken;
}

export type SpotifyTrack = {
  id: string;
  name: string;
  preview_url: string | null;
  artists: { name: string }[];
  album: { name?: string; images: { url: string }[] };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyFetch(path: string): Promise<Response> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await getSpotifyToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const retryable =
      res.status === 429 || res.status === 502 || res.status === 503;
    if (!retryable || attempt === maxAttempts) return res;

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 400 * 2 ** (attempt - 1);
    await sleep(waitMs);
  }

  throw new Error("Spotify request failed after retries");
}

/**
 * New Spotify apps get preview_url: null from the Web API.
 * Public embed pages still expose a 30s MP3 under audioPreview.url.
 */
export async function resolvePreviewUrl(
  trackId: string,
): Promise<string | null> {
  const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; HeardIt/1.0; +https://localhost)",
      Accept: "text/html",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) return null;

  try {
    const data = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          state?: {
            data?: {
              entity?: {
                audioPreview?: { url?: string | null } | null;
              };
            };
          };
        };
      };
    };
    const url =
      data.props?.pageProps?.state?.data?.entity?.audioPreview?.url ?? null;
    return url && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

/** Spotify /search max limit is 10 (Feb 2026 API change). */
const SEARCH_PAGE_SIZE = 10;

export async function searchTracks(
  query: string,
  limit = 20,
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const target = Math.max(1, limit);

  while (tracks.length < target) {
    const pageSize = Math.min(SEARCH_PAGE_SIZE, target - tracks.length);
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: String(pageSize),
      offset: String(offset),
    });
    const res = await spotifyFetch(`/search?${params}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify search failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      tracks: { items: SpotifyTrack[]; total: number };
    };
    const page = data.tracks.items.filter(Boolean);
    tracks.push(...page);
    offset += page.length;
    if (page.length < pageSize || offset >= data.tracks.total) break;
  }

  return tracks;
}

export async function getTrack(id: string): Promise<SpotifyTrack | null> {
  const res = await spotifyFetch(`/tracks/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify track failed: ${res.status} ${text}`);
  }
  const track = (await res.json()) as SpotifyTrack;
  if (!track.preview_url) {
    track.preview_url = await resolvePreviewUrl(id);
  }
  return track;
}

export async function getPlaylistTracks(
  playlistId: string,
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let path: string | null = `/playlists/${playlistId}/tracks?limit=50`;

  while (path) {
    const res = await spotifyFetch(path);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify playlist failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      items: { track: SpotifyTrack | null }[];
      next: string | null;
    };
    for (const item of data.items) {
      if (item.track?.id) tracks.push(item.track);
    }
    path = data.next
      ? data.next.replace("https://api.spotify.com/v1", "")
      : null;
  }

  return tracks;
}
