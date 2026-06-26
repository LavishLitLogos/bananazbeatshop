/// <reference lib="deno.ns" />
/// <reference lib="deno.net" />

type UploadKind = "audio" | "image" | "video";

type UploadResponse = {
  publicUrl: string;
  storagePath: string;
  path: string;
  contentType: string;
  size: number;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

// ─── DO NOT redeclare Deno here. The triple-slash refs above pull in the real
// Deno namespace from deno.ns, which has the correct crypto / SubtleCrypto
// typings where BufferSource = ArrayBuffer | ArrayBufferView (no SharedArrayBuffer
// ambiguity). The hand-rolled declare block was overriding those types and
// causing TS2769 on every crypto.subtle call. ──────────────────────────────────

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getR2Config(): R2Config {
  const publicBaseUrl =
    Deno.env.get("R2_PUBLIC_BASE_URL") ||
    Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ||
    "";

  return {
    accountId:
      Deno.env.get("R2_ACCOUNT_ID") ||
      Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ||
      getRequiredEnv("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId:
      Deno.env.get("R2_ACCESS_KEY_ID") ||
      getRequiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey:
      Deno.env.get("R2_SECRET_ACCESS_KEY") ||
      getRequiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName:
      Deno.env.get("R2_BUCKET") ||
      Deno.env.get("R2_BUCKET_NAME") ||
      getRequiredEnv("CLOUDFLARE_R2_BUCKET"),
    publicBaseUrl,
  };
}

function sanitizeFileName(fileName: string): string {
  const fallback = "upload";
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || fallback;
}

function extensionFromMime(contentType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };

  return map[contentType] || "bin";
}

function normalizeUploadKind(value: FormDataEntryValue | null): UploadKind {
  const raw = String(value || "").toLowerCase();

  if (raw === "audio") return "audio";
  if (raw === "cover" || raw === "image" || raw === "artwork") return "image";
  if (raw === "video") return "video";

  throw new Error(
    "Invalid upload type. Use audio, image, cover, artwork, or video.",
  );
}

function validateFileType(kind: UploadKind, contentType: string): void {
  if (kind === "audio" && !contentType.startsWith("audio/")) {
    throw new Error("Invalid audio upload. File must be an audio type.");
  }
  if (kind === "image" && !contentType.startsWith("image/")) {
    throw new Error("Invalid image upload. File must be an image type.");
  }
  if (kind === "video" && !contentType.startsWith("video/")) {
    throw new Error("Invalid video upload. File must be a video type.");
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// crypto.subtle.digest expects BufferSource (ArrayBuffer | ArrayBufferView).
// Wrapping string-branch output in Uint8Array and casting the ArrayBuffer branch
// to ArrayBuffer explicitly keeps TypeScript happy under both DOM and Deno libs.
async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data: BufferSource =
    typeof value === "string"
      ? encoder.encode(value)          // Uint8Array — always a valid ArrayBufferView
      : (value as ArrayBuffer);        // narrow: we already know it's ArrayBuffer
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

// key is always the result of importKey/sign (ArrayBuffer) or encoder.encode
// (Uint8Array). Both satisfy BufferSource; the explicit cast removes the
// Uint8Array<ArrayBufferLike> ambiguity that TS2769 was complaining about.
async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  value: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,      // ← the fix: assert BufferSource, not the union
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(value) as BufferSource,  // Uint8Array cast to BufferSource
  );
}

async function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const dateKey = await hmacSha256(
    encoder.encode(`AWS4${secretAccessKey}`),
    dateStamp,
  );
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  return hmacSha256(serviceKey, "aws4_request");
}

function amzDateParts(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildStoragePath(kind: UploadKind, file: File): string {
  const safeName = sanitizeFileName(file.name);
  const hasExtension = /\.[a-z0-9]+$/i.test(safeName);
  const extension = extensionFromMime(file.type);
  const finalName = hasExtension ? safeName : `${safeName}.${extension}`;
  const uniqueId = crypto.randomUUID();

  return `${kind}/${new Date().getFullYear()}/${uniqueId}-${finalName}`;
}

function publicUrlForPath(config: R2Config, storagePath: string): string {
  const normalizedBase = config.publicBaseUrl.replace(/\/+$/g, "");

  if (normalizedBase) {
    return `${normalizedBase}/${storagePath}`;
  }

  return `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${storagePath}`;
}

async function putObjectToR2(params: {
  config: R2Config;
  storagePath: string;
  contentType: string;
  body: ArrayBuffer;
}): Promise<void> {
  const { config, storagePath, contentType, body } = params;
  const region = "auto";
  const service = "s3";
  const method = "PUT";
  const encodedPath = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${config.bucketName}/${encodedPath}`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const { amzDate, dateStamp } = amzDateParts();
  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    `/${config.bucketName}/${encodedPath}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(
    config.secretAccessKey,
    dateStamp,
    region,
    service,
  );

  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Cloudflare R2 upload failed with status ${response.status}${
        errorText ? `: ${errorText}` : ""
      }`,
    );
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const kind = normalizeUploadKind(formData.get("type"));

    if (!(fileEntry instanceof File)) {
      return jsonResponse({ error: "Missing upload file." }, 400);
    }

    const contentType = fileEntry.type || "application/octet-stream";
    validateFileType(kind, contentType);

    const config = getR2Config();
    const storagePath = buildStoragePath(kind, fileEntry);
    const body = await fileEntry.arrayBuffer();

    await putObjectToR2({ config, storagePath, contentType, body });

    const result: UploadResponse = {
      publicUrl: publicUrlForPath(config, storagePath),
      storagePath,
      path: storagePath,
      contentType,
      size: fileEntry.size,
    };

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return jsonResponse({ error: message }, 500);
  }
});