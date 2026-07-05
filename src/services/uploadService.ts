import { supabase } from '../lib/supabase';

export type UploadResult = {
  url: string;
  publicUrl: string;
  path: string;
  storagePath: string;
};

type UploadBucket = 'beat-audio' | 'cover-art' | 'profile-media' | 'submissions' | 'videos' | 'bananaz-room';

function normalizeContentType(file: File) {
  const rawType = String(file.type || '').toLowerCase().trim();

  if (!rawType) return undefined;
  if (rawType === 'audio/mp3') return 'audio/mpeg';
  if (rawType === 'audio/wave') return 'audio/wav';
  if (rawType === 'image/jpg') return 'image/jpeg';

  return rawType;
}

function cleanFileName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() || 'file';
  const base = name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${base || 'upload'}-${Date.now()}.${extension}`;
}

async function uploadToBucket(file: File, bucket: UploadBucket, folder = ''): Promise<UploadResult> {
  const fileName = cleanFileName(file.name);
  const storagePath = folder ? `${folder}/${fileName}` : fileName;
  const contentType = normalizeContentType(file);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType,
    });

  if (error) {
    throw new Error(error.message || `Upload failed in ${bucket}.`);
  }

  const savedPath = data?.path || storagePath;

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(savedPath);

  const publicUrl = publicData?.publicUrl;

  if (!publicUrl) {
    throw new Error(`Upload saved in ${bucket}, but no public URL returned.`);
  }

  return {
    url: publicUrl,
    publicUrl,
    path: savedPath,
    storagePath: savedPath,
  };
}

export function uploadAudio(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'beat-audio', 'audio');
}

export function uploadCoverArt(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'cover-art', 'covers');
}

export function uploadProfileMedia(file: File): Promise<UploadResult> {
  const bucket = file.type.startsWith('video/') ? 'videos' : 'profile-media';
  return uploadToBucket(file, bucket);
}

export function uploadSubmissionFile(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'submissions');
}

export function uploadBananazRoomFile(file: File): Promise<UploadResult> {
  const folder = file.type.startsWith('audio/')
    ? 'audio'
    : file.type.startsWith('image/')
      ? 'images'
      : file.type.startsWith('video/')
        ? 'video'
        : 'files';

  return uploadToBucket(file, 'bananaz-room', folder);
}
