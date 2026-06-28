import { supabase } from '../lib/supabase';

export type UploadFolder = 'audio' | 'covers' | 'videos' | 'profile' | 'submissions';
export type UploadKind = 'audio' | 'image' | 'video';

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  url: string;
  path: string;
}

export interface UploadOptions {
  folder?: UploadFolder;
  kind?: UploadKind;
  onProgress?: (progress: number) => void;
}

const MAX_AUDIO_MB = 250;
const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 500;

const bucketByFolder: Record<UploadFolder, string> = {
  audio: 'beat-audio',
  covers: 'cover-art',
  videos: 'videos',
  profile: 'profile-media',
  submissions: 'submissions',
};

const acceptedMimeTypes: Record<UploadKind, string[]> = {
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/mp4',
    'audio/ogg',
    'audio/flac',
  ],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'],
};

const maxSizeByKind: Record<UploadKind, number> = {
  audio: MAX_AUDIO_MB * 1024 * 1024,
  image: MAX_IMAGE_MB * 1024 * 1024,
  video: MAX_VIDEO_MB * 1024 * 1024,
};

const defaultFolderByKind: Record<UploadKind, UploadFolder> = {
  audio: 'audio',
  image: 'covers',
  video: 'videos',
};

function validateFile(file: File, kind: UploadKind) {
  if (!file) throw new Error('Choose a file before uploading.');

  const accepted = acceptedMimeTypes[kind];
  const fileType = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  const extensionFallback =
    (kind === 'audio' && ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(extension)) ||
    (kind === 'image' && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension)) ||
    (kind === 'video' && ['mp4', 'mov', 'webm', 'mpeg', 'mpg'].includes(extension));

  if (fileType && !accepted.includes(fileType) && !extensionFallback) {
    throw new Error(`Unsupported ${kind} file type.`);
  }

  if (file.size > maxSizeByKind[kind]) {
    const limit = Math.round(maxSizeByKind[kind] / 1024 / 1024);
    throw new Error(`${kind[0].toUpperCase()}${kind.slice(1)} uploads must be ${limit}MB or smaller.`);
  }
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

export async function uploadToR2(
  file: File,
  folder: UploadFolder,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const kind = options.kind || (folder === 'audio' ? 'audio' : folder === 'videos' ? 'video' : 'image');

  validateFile(file, kind);
  options.onProgress?.(10);

  const bucket = bucketByFolder[folder];
  const fileName = cleanFileName(file.name);
  const storagePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error(error.message || 'Upload failed.');
  }

  options.onProgress?.(85);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  if (!data.publicUrl) {
    throw new Error('Upload finished, but no public URL was returned.');
  }

  options.onProgress?.(100);

  return {
    publicUrl: data.publicUrl,
    storagePath,
    url: data.publicUrl,
    path: storagePath,
  };
}

export async function uploadAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.audio, { kind: 'audio', onProgress });
}

export async function uploadCoverArt(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.image, { kind: 'image', onProgress });
}

export async function uploadVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.video, { kind: 'video', onProgress });
}

export async function uploadProfileMedia(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const kind: UploadKind = file.type.startsWith('video/') ? 'video' : 'image';
  return uploadToR2(file, 'profile', { kind, onProgress });
}

export async function uploadSubmissionFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const kind: UploadKind = file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('audio/')
      ? 'audio'
      : 'image';

  return uploadToR2(file, 'submissions', { kind, onProgress });
}