import {
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

export async function deleteHostedAudioByUrl(
  hostedUrl: string | null | undefined,
): Promise<void> {
  if (!hostedUrl || !hasR2Credentials()) return;
  try {
    const base = getPublicBaseUrl();
    if (!hostedUrl.startsWith(`${base}/`)) return;
    const key = hostedUrl.slice(base.length + 1).split("?")[0];
    if (!key.startsWith("audio/guess-the-song/")) return;
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
    );
  } catch (error) {
    console.error("Failed to delete hosted audio from R2:", error);
  }
}
