const PUBLIC_R2_BASE = 'https://pub-19f9cd09f0ec4680b19baced6e0b4cb7.r2.dev';
const PRIVATE_R2_BUCKET_SEGMENT = '/bananazshop/';

export function normalizeR2MediaUrl(url?: string | null) {
  const value = String(url || '').trim();
  if (!value) return '';

  if (value.startsWith(PUBLIC_R2_BASE)) {
    return value;
  }

  const privateIndex = value.indexOf('.r2.cloudflarestorage.com');
  const bucketIndex = value.indexOf(PRIVATE_R2_BUCKET_SEGMENT);

  if (privateIndex >= 0 && bucketIndex >= 0) {
    const objectPath = value.slice(bucketIndex + PRIVATE_R2_BUCKET_SEGMENT.length).replace(/^\/+/, '');
    return objectPath ? `${PUBLIC_R2_BASE}/${objectPath}` : value;
  }

  return value;
}
