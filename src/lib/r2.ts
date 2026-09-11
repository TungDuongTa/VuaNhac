import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

function requireEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

function getPublicBaseUrl(): string {
  return requireEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

function getBucket(): string {
  return requireEnv("R2_BUCKET");
}

export function hasR2Credentials(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

export function audioObjectKey(
  spotifyId: string,
  difficulty: string,
  ext = "mp3",
): string {
  return `audio/guess-the-song/${difficulty}/${spotifyId}.${ext}`;
}

/** Extract managed object key from a public CDN / r2.dev URL. */
export function getAudioObjectKeyFromUrl(
  hostedUrl: string | null | undefined,
): string | null {
  if (!hostedUrl) return null;
  const trimmed = hostedUrl.trim();
  const marker = "audio/guess-the-song/";
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    const key = trimmed.slice(idx).split("?")[0] ?? "";
    return key.startsWith(marker) ? key : null;
  }
  if (!hasR2Credentials()) return null;
  try {
    const base = getPublicBaseUrl();
    if (!trimmed.startsWith(`${base}/`)) return null;
    const key = trimmed.slice(base.length + 1).split("?")[0] ?? "";
    return key.startsWith(marker) ? key : null;
  } catch {
    return null;
  }
}

function extFromKey(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return "mp3";
  return key.slice(dot + 1).toLowerCase() || "mp3";
}

function contentTypeForExt(ext: string): string {
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "aac") return "audio/aac";
  return "audio/mpeg";
}

/** Upload an audio clip and return its public CDN URL. */
export async function uploadHostedAudio(params: {
  spotifyId: string;
  difficulty: string;
  buffer: Buffer;
  contentType: string;
  ext?: string;
}): Promise<string> {
  const ext = params.ext ?? "mp3";
  const key = audioObjectKey(params.spotifyId, params.difficulty, ext);

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${getPublicBaseUrl()}/${key}`;
}

/**
 * Copy hosted audio to the path for a new difficulty / spotifyId, then delete the old object.
 * Returns the new public URL.
 */
export async function moveHostedAudio(params: {
  fromUrl: string;
  spotifyId: string;
  difficulty: string;
}): Promise<string> {
  if (!hasR2Credentials()) {
    throw new Error("R2 is not configured");
  }

  const fromKey = getAudioObjectKeyFromUrl(params.fromUrl);
  if (!fromKey) {
    throw new Error("Hosted URL is not a managed R2 audio path");
  }

  const ext = extFromKey(fromKey);
  const toKey = audioObjectKey(params.spotifyId, params.difficulty, ext);
  if (fromKey === toKey) {
    return `${getPublicBaseUrl()}/${toKey}`;
  }

  const bucket = getBucket();
  const client = getClient();

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${fromKey}`,
      Key: toKey,
      ContentType: contentTypeForExt(ext),
      CacheControl: "public, max-age=31536000, immutable",
      MetadataDirective: "REPLACE",
    }),
  );

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: fromKey }),
    );
  } catch (error) {
    console.error("Copied R2 audio but failed to delete old object:", error);
  }

  return `${getPublicBaseUrl()}/${toKey}`;
}

export async function deleteHostedAudioByUrl(
  hostedUrl: string | null | undefined,
): Promise<void> {
  if (!hostedUrl || !hasR2Credentials()) return;
  try {
    const key = getAudioObjectKeyFromUrl(hostedUrl);
    if (!key) return;
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    );
  } catch (error) {
    console.error("Failed to delete hosted audio from R2:", error);
  }
}
