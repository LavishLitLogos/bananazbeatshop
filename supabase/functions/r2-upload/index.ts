import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type UploadKind = 'audio' | 'image' | 'video' | 'file';

type UploadResponse = {
  publicUrl: string;
  storagePath: string;
  path: string;
  contentType: string;
  size: number;
};

type R2Config = {
  endpoint: string;
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const encoder = new TextEncoder();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
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

function normalizeUrl(value: string) {
  return value.replace(/\/+$/g, '');
}

function deriveHostFromEndpoint(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    throw new Error('Invalid R2 endpoint configuration.');
  }
}

function getR2Config(): R2Config {
  const endpoint =
    Deno.env.get('R2_ENDPOINT') ||
    Deno.env.get('S3_ENDPOINT') ||
    (Deno.env.get('R2_ACCOUNT_ID')
      ? `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
      : '');

  if (!endpoint) {
    throw new Error('Missing required environment variable: R2_ENDPOINT');
  }

  return {
    endpoint: normalizeUrl(endpoint),
    host: deriveHostFromEndpoint(endpoint),
    accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    bucketName: getRequiredEnv('R2_BUCKET_NAME'),
    publicBaseUrl: normalizeUrl(Deno.env.get('R2_PUBLIC_URL') || ''),
  };
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'upload';
}

function extensionFromMime(contentType: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
  };

  return map[contentType] || 'bin';
}

function normalizeUploadKind(value: FormDataEntryValue | null): UploadKind {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'audio') return 'audio';
  if (raw === 'image' || raw === 'cover' || raw === 'artwork') return 'image';
  if (raw === 'video') return 'video';
  if (raw === 'file' || raw === 'zip' || raw === 'download') return 'file';
  throw new Error('Invalid upload type.');
}

function validateFileType(kind: UploadKind, contentType: string): void {
  if (kind === 'audio' && !contentType.startsWith('audio/')) {
    throw new Error('Invalid audio upload.');
  }
  if (kind === 'image' && !contentType.startsWith('image/')) {
    throw new Error('Invalid image upload.');
  }
  if (kind === 'video' && !contentType.startsWith('video/')) {
    throw new Error('Invalid video upload.');
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data: BufferSource =
    typeof value === 'string'
      ? encoder.encode(value)
      : value;
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value) as BufferSource);
}

async function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const dateKey = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  return hmacSha256(serviceKey, 'aws4_request');
}

function amzDateParts(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildStoragePath(kind: UploadKind, file: File, mediaRole: string): string {
  const safeName = sanitizeFileName(file.name);
  const hasExtension = /\.[a-z0-9]+$/i.test(safeName);
  const extension = extensionFromMime(file.type);
  const finalName = hasExtension ? safeName : `${safeName}.${extension}`;
  const year = new Date().getFullYear();
  const uniqueId = crypto.randomUUID();
  const safeRole = sanitizeFileName(mediaRole || kind);
  return `${kind}/${safeRole}/${year}/${uniqueId}-${finalName}`;
}

function publicUrlForPath(config: R2Config, storagePath: string): string {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${storagePath}`;
  }
  return `${config.endpoint}/${config.bucketName}/${storagePath}`;
}

async function putObjectToR2(params: {
  config: R2Config;
  storagePath: string;
  contentType: string;
  body: ArrayBuffer;
}): Promise<void> {
  const { config, storagePath, contentType, body } = params;
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const url = `${config.endpoint}/${config.bucketName}/${encodedPath}`;
  const { amzDate, dateStamp } = amzDateParts();
  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${config.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    `/${config.bucketName}/${encodedPath}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(config.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorizationHeader,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Cloudflare R2 upload failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`);
  }
}

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

async function saveMediaAsset(params: {
  relatedTable: string;
  relatedRecordId: string;
  mediaRole: string;
  storagePath: string;
  publicUrl: string;
  contentType: string;
  size: number;
  kind: UploadKind;
  bucketName: string;
  originalFileName: string;
}) {
  const adminClient = createAdminClient();
  if (!adminClient) return;

  const payload = {
    related_table: params.relatedTable,
    related_record_id: params.relatedRecordId,
    media_role: params.mediaRole || params.kind,
    storage_provider: 'r2',
    bucket_name: params.bucketName,
    original_filename: params.originalFileName,
    storage_path: params.storagePath,
    public_url: params.publicUrl,
    mime_type: params.contentType,
    file_size: params.size,
    content_kind: params.kind,
    updated_at: new Date().toISOString(),
  };

  const { error } = await adminClient
    .from('media_assets')
    .upsert(payload, { onConflict: 'storage_path' });

  if (error) {
    throw new Error(error.message || 'Media metadata save failed.');
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const kind = normalizeUploadKind(formData.get('type'));
    const mediaRole = String(formData.get('role') || kind).trim() || kind;
    const relatedTable = String(formData.get('relatedTable') || '').trim();
    const relatedRecordId = String(formData.get('relatedId') || '').trim();

    if (!(fileEntry instanceof File)) {
      return jsonResponse({ error: 'Missing upload file.' }, 400);
    }

    const contentType = fileEntry.type || 'application/octet-stream';
    validateFileType(kind, contentType);

    const config = getR2Config();
    const storagePath = buildStoragePath(kind, fileEntry, mediaRole);
    const body = await fileEntry.arrayBuffer();

    await putObjectToR2({ config, storagePath, contentType, body });

    const publicUrl = publicUrlForPath(config, storagePath);

    await saveMediaAsset({
      relatedTable,
      relatedRecordId,
      mediaRole,
      storagePath,
      publicUrl,
      contentType,
      size: fileEntry.size,
      kind,
      bucketName: config.bucketName,
      originalFileName: fileEntry.name,
    });

    const result: UploadResponse = {
      publicUrl,
      storagePath,
      path: storagePath,
      contentType,
      size: fileEntry.size,
    };

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return jsonResponse({ error: message }, 500);
  }
});
