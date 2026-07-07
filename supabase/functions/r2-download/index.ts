import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

type EntityType = 'beat' | 'prod_by_song' | 'beat_tape_track';
type DownloadStep =
  | 'method_check'
  | 'parse_request'
  | 'validate_request'
  | 'read_environment'
  | 'load_target'
  | 'check_authorization'
  | 'generate_signed_url'
  | 'return_success';

type R2Config = {
  endpoint: string;
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

const FUNCTION_NAME = 'r2-download';

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

function fail(step: DownloadStep, error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
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
    throw new Error('Supabase service role is not configured for signed downloads.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
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

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!*'()]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildCanonicalQuery(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
}

async function createSignedGetUrl(
  config: R2Config,
  storagePath: string,
  fileName: string,
  expiresInSeconds = 300,
) {
  const region = 'auto';
  const service = 's3';
  const { amzDate, dateStamp } = amzDateParts();
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
    'response-content-disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
  };

  const canonicalQuery = buildCanonicalQuery(queryParams);
  const canonicalRequest = [
    'GET',
    `/${config.bucketName}/${encodedPath}`,
    canonicalQuery,
    `host:${config.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(config.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return `${config.endpoint}/${config.bucketName}/${encodedPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function extractStoragePathFromUrl(url: string) {
  if (!url) return '';

  const publicBase = normalizeUrl(Deno.env.get('R2_PUBLIC_URL') || '');
  if (publicBase && url.startsWith(publicBase)) {
    return url.slice(publicBase.length).replace(/^\/+/, '');
  }

  const endpoint = normalizeUrl(Deno.env.get('R2_ENDPOINT') || '');
  const bucket = Deno.env.get('R2_BUCKET_NAME') || '';
  if (endpoint && bucket) {
    const bucketBase = `${endpoint}/${bucket}`;
    if (url.startsWith(bucketBase)) {
      return url.slice(bucketBase.length).replace(/^\/+/, '');
    }
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');
  } catch {
    return '';
  }
}

async function resolveBeatDownload(admin: ReturnType<typeof createAdminClient>, entityId: string) {
  const { data: beat, error } = await admin
    .from('beats')
    .select('id,title,audio_file_url,release_download,is_free,sold,hidden,admin_approved')
    .eq('id', entityId)
    .single();

  if (error || !beat) {
    throw new Error(error?.message || 'Beat not found.');
  }

  if (beat.hidden || beat.admin_approved === false || beat.sold) {
    throw new Error('This beat is not available for download.');
  }

  if (!beat.is_free) {
    const { data: matchingOrders, error: orderError } = await admin
      .from('orders')
      .select('id,payment_received,release_download,status')
      .eq('beat_id', beat.id)
      .eq('payment_received', true)
      .eq('release_download', true)
      .limit(1);

    if (orderError) {
      throw new Error(orderError.message || 'Could not verify beat download approval.');
    }

    if (!beat.release_download || !matchingOrders || matchingOrders.length === 0) {
      throw new Error('Download is locked until payment is approved and release is enabled.');
    }
  }

  return {
    fileName: `${beat.title || 'thisbeatizbananaz-beat'}.mp3`,
    storagePath: extractStoragePathFromUrl(beat.audio_file_url || ''),
  };
}

async function resolveSongDownload(admin: ReturnType<typeof createAdminClient>, entityId: string) {
  const { data: song, error } = await admin
    .from('prod_by_songs')
    .select('id,title,audio_file_url,release_download,is_free,sold,hidden,admin_approved')
    .eq('id', entityId)
    .single();

  if (error || !song) {
    throw new Error(error?.message || 'Song not found.');
  }

  if (song.hidden || song.admin_approved === false || song.sold) {
    throw new Error('This song is not available for download.');
  }

  if (!song.is_free && !song.release_download) {
    throw new Error('Song download is still locked.');
  }

  return {
    fileName: `${song.title || 'thisbeatizbananaz-song'}.mp3`,
    storagePath: extractStoragePathFromUrl(song.audio_file_url || ''),
  };
}

async function resolveTapeTrackDownload(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  parentTapeId: string,
) {
  const { data: tape, error: tapeError } = await admin
    .from('beat_tapes')
    .select('id,title,is_free,release_download,hidden,admin_approved')
    .eq('id', parentTapeId)
    .single();

  if (tapeError || !tape) {
    throw new Error(tapeError?.message || 'Beat tape not found.');
  }

  if (tape.hidden || tape.admin_approved === false) {
    throw new Error('This beat tape is not available for download.');
  }

  if (!tape.is_free) {
    const { data: matchingOrders, error: orderError } = await admin
      .from('orders')
      .select('id,payment_received,release_download,status')
      .eq('beat_id', tape.id)
      .eq('payment_received', true)
      .eq('release_download', true)
      .limit(1);

    if (orderError) {
      throw new Error(orderError.message || 'Could not verify beat tape download approval.');
    }

    if (!tape.release_download || !matchingOrders || matchingOrders.length === 0) {
      throw new Error('Beat tape download is still locked.');
    }
  }

  const { data: track, error: trackError } = await admin
    .from('beat_tape_tracks')
    .select('id,title,audio_file_url')
    .eq('id', entityId)
    .eq('tape_id', tape.id)
    .single();

  if (trackError || !track) {
    throw new Error(trackError?.message || 'Beat tape track not found.');
  }

  return {
    fileName: `${track.title || tape.title || 'thisbeatizbananaz-tape'}.mp3`,
    storagePath: extractStoragePathFromUrl(track.audio_file_url || ''),
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return fail('method_check', 'Method not allowed.', 405);
  }

  let body: { entityType?: EntityType; entityId?: string; parentTapeId?: string };
  try {
    body = await request.json();
  } catch (error) {
    return fail('parse_request', error, 400);
  }

  const { entityType, entityId, parentTapeId } = body;
  if (!entityType || !entityId) {
    return fail('validate_request', 'Missing download target.', 400);
  }

  let admin: ReturnType<typeof createAdminClient>;
  let config: R2Config;
  try {
    admin = createAdminClient();
    config = getR2Config();
  } catch (error) {
    return fail('read_environment', error, 500);
  }

  let resolved: { storagePath: string; fileName: string };
  try {
    if (entityType === 'beat') {
      resolved = await resolveBeatDownload(admin, entityId);
    } else if (entityType === 'prod_by_song') {
      resolved = await resolveSongDownload(admin, entityId);
    } else if (entityType === 'beat_tape_track') {
      if (!parentTapeId) {
        throw new Error('Beat tape parent id is required.');
      }
      resolved = await resolveTapeTrackDownload(admin, entityId, parentTapeId);
    } else {
      throw new Error('Unsupported download target.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const step: DownloadStep =
      message.includes('locked') || message.includes('available for download')
        ? 'check_authorization'
        : 'load_target';
    return fail(step, error, 400);
  }

  if (!resolved.storagePath) {
    return fail('load_target', 'No R2 object key found for this download.', 400);
  }

  try {
    const signedUrl = await createSignedGetUrl(config, resolved.storagePath, resolved.fileName);
    return responseJson({
      ok: true,
      function: FUNCTION_NAME,
      objectKey: resolved.storagePath,
      url: signedUrl,
      record: entityId,
      fileName: resolved.fileName,
    });
  } catch (error) {
    return fail('generate_signed_url', error, 500);
  }
});
