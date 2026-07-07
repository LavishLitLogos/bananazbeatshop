import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type UploadKind = 'audio' | 'image' | 'video' | 'file';
type UploadStep =
  | 'method_check'
  | 'parse_form_data'
  | 'validate_file'
  | 'validate_metadata'
  | 'read_environment'
  | 'create_r2_client'
  | 'upload_to_r2'
  | 'save_metadata_to_supabase'
  | 'return_success';

type R2Config = {
  endpoint: string;
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

type UploadResult = {
  ok: true;
  function: 'r2-upload';
  objectKey: string;
  storagePath: string;
  path: string;
  url: string;
  publicUrl: string;
  record: string;
  contentType: string;
  size: number;
};

const FUNCTION_NAME = 'r2-upload';
const FALLBACK_R2_PUBLIC_URL = 'https://pub-19f9cd09f0ec4680b19baced6e0b4cb7.r2.dev';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const encoder = new TextEncoder();

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function fail(step: UploadStep, error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');

  console.error(`[${FUNCTION_NAME}] ${step}`, {
    step,
    error: message,
  });

  return responseJson(
    {
      ok: false,
      function: FUNCTION_NAME,
      step,
      error: message,
    },
    status,
  );
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
    host: new URL(endpoint).host,
    accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    bucketName: getRequiredEnv('R2_BUCKET_NAME'),
    publicBaseUrl: normalizeUrl(Deno.env.get('R2_PUBLIC_URL') || FALLBACK_R2_PUBLIC_URL),
  };
}

function createAdminClient() {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('PROJECT_URL') ||
    Deno.env.get('SB_URL') ||
    '';

  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SERVICE_ROLE_KEY') ||
    '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role environment is missing for metadata save.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
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

function getFileExtension(fileName: string): string {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function extensionFromMime(contentType: string, fileName = ''): string {
  const normalizedType = String(contentType || '').toLowerCase().trim();
  const fileExtension = getFileExtension(fileName);

  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/aac': 'aac',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',

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

  return map[normalizedType] || fileExtension || 'bin';
}

function normalizeUploadKind(value: FormDataEntryValue | null): UploadKind {
  const raw = String(value || '').toLowerCase().trim();

  if (raw === 'audio') return 'audio';
  if (raw === 'image' || raw === 'cover' || raw === 'artwork') return 'image';
  if (raw === 'video') return 'video';
  if (raw === 'file' || raw === 'zip' || raw === 'download') return 'file';

  throw new Error('Invalid upload type.');
}

function validateFileType(kind: UploadKind, contentType: string, fileName: string): void {
  const normalizedType = String(contentType || '').toLowerCase().trim();
  const extension = getFileExtension(fileName);
  const typeIsGeneric = !normalizedType || normalizedType === 'application/octet-stream';

  const audioExtensions = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']);
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
  const videoExtensions = new Set(['mp4', 'mov', 'webm']);
  const fileExtensions = new Set(['zip']);

  if (kind === 'audio') {
    if ((!typeIsGeneric && normalizedType.startsWith('audio/')) || audioExtensions.has(extension)) return;

    throw new Error(
      `Invalid audio upload. MIME=${normalizedType || 'missing'}, extension=${extension || 'missing'}`,
    );
  }

  if (kind === 'image') {
    if ((!typeIsGeneric && normalizedType.startsWith('image/')) || imageExtensions.has(extension)) return;

    throw new Error(
      `Invalid image upload. MIME=${normalizedType || 'missing'}, extension=${extension || 'missing'}`,
    );
  }

  if (kind === 'video') {
    if ((!typeIsGeneric && normalizedType.startsWith('video/')) || videoExtensions.has(extension)) return;

    throw new Error(
      `Invalid video upload. MIME=${normalizedType || 'missing'}, extension=${extension || 'missing'}`,
    );
  }

  if (kind === 'file') {
    if (
      normalizedType === 'application/zip' ||
      normalizedType === 'application/x-zip-compressed' ||
      normalizedType === 'application/octet-stream' ||
      fileExtensions.has(extension)
    ) {
      return;
    }

    throw new Error(
      `Invalid file upload. MIME=${normalizedType || 'missing'}, extension=${extension || 'missing'}`,
    );
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data: BufferSource = typeof value === 'string' ? encoder.encode(value) : value;
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
  const extension = extensionFromMime(file.type, file.name);
  const finalName = hasExtension ? safeName : `${safeName}.${extension}`;
  const year = new Date().getFullYear();
  const uniqueId = crypto.randomUUID();
  const safeRole = sanitizeFileName(mediaRole || kind);

  return `${kind}/${safeRole}/${year}/${uniqueId}-${finalName}`;
}

function publicUrlForPath(config: R2Config, storagePath: string): string {
  return `${config.publicBaseUrl}/${storagePath}`;
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
    throw new Error(
      `Cloudflare R2 upload failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`,
    );
  }
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

  const { data, error } = await adminClient
    .from('media_assets')
    .upsert(payload, { onConflict: 'storage_path' })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message || 'Media metadata save failed.');
  }

  return String(data?.id || params.storagePath);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return fail('method_check', 'Method not allowed.', 405);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    return fail('parse_form_data', error, 400);
  }

  let fileEntry: File;
  let kind: UploadKind;
  let mediaRole = '';
  let relatedTable = '';
  let relatedRecordId = '';
  let providedFilename = '';

  try {
    const parsedFile = formData.get('file');

    kind = normalizeUploadKind(formData.get('type'));
    mediaRole = String(formData.get('role') || formData.get('mediaRole') || kind).trim() || kind;
    relatedTable = String(formData.get('relatedTable') || '').trim();
    relatedRecordId = String(formData.get('relatedId') || formData.get('beatId') || '').trim();
    providedFilename = String(formData.get('filename') || '').trim();

    if (!(parsedFile instanceof File)) {
      throw new Error('Missing upload file.');
    }

    const derivedFileName = providedFilename || parsedFile.name || 'upload';
    const contentType = parsedFile.type || 'application/octet-stream';

    validateFileType(kind, contentType, derivedFileName);

    fileEntry =
      derivedFileName !== parsedFile.name
        ? new File([parsedFile], derivedFileName, {
            type: parsedFile.type,
            lastModified: parsedFile.lastModified,
          })
        : parsedFile;
  } catch (error) {
    return fail('validate_file', error, 400);
  }

  try {
    if (!mediaRole) {
      throw new Error('Missing media role.');
    }
  } catch (error) {
    return fail('validate_metadata', error, 400);
  }

  let config: R2Config;

  try {
    config = getR2Config();
  } catch (error) {
    return fail('read_environment', error, 500);
  }

  try {
    createAdminClient();
  } catch (error) {
    return fail('create_r2_client', error, 500);
  }

  const contentType = fileEntry.type || 'application/octet-stream';
  const storagePath = buildStoragePath(kind, fileEntry, mediaRole);
  const publicUrl = publicUrlForPath(config, storagePath);

  try {
    const body = await fileEntry.arrayBuffer();

    await putObjectToR2({
      config,
      storagePath,
      contentType,
      body,
    });
  } catch (error) {
    return fail('upload_to_r2', error, 500);
  }

  let recordId = storagePath;

  try {
    recordId = await saveMediaAsset({
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
  } catch (error) {
    return fail('save_metadata_to_supabase', error, 500);
  }

  const result: UploadResult = {
    ok: true,
    function: FUNCTION_NAME,
    objectKey: storagePath,
    storagePath,
    path: storagePath,
    url: publicUrl,
    publicUrl,
    record: recordId,
    contentType,
    size: fileEntry.size,
  };

  return responseJson(result, 200);
});
