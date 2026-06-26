const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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

interface R2UploadResponse {
  publicUrl?: string;
  storagePath?: string;
  url?: string;
  path?: string;
  error?: string;
}

const MAX_AUDIO_MB = 250;
const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 500;

const acceptedMimeTypes: Record<UploadKind, string[]> = {
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4', 'audio/ogg', 'audio/flac'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
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

function getUploadEndpoint() {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured.');
  }

  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/r2-upload`;
}

function getAuthHeaders() {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Supabase anon key is not configured.');
  }

  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

function validateFile(file: File, kind: UploadKind) {
  if (!file) {
    throw new Error('Choose a file before uploading.');
  }

  const accepted = acceptedMimeTypes[kind];
  const fileType = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const extensionFallback =
    (kind === 'audio' && ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(extension)) ||
    (kind === 'image' && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) ||
    (kind === 'video' && ['mp4', 'mov', 'webm', 'mpeg', 'mpg'].includes(extension));

  if (fileType && !accepted.includes(fileType) && !extensionFallback) {
    throw new Error(`Unsupported ${kind} file type.`);
  }

  if (file.size > maxSizeByKind[kind]) {
    const limit = Math.round(maxSizeByKind[kind] / 1024 / 1024);
    throw new Error(`${kind[0].toUpperCase()}${kind.slice(1)} uploads must be ${limit}MB or smaller.`);
  }
}

function normalizeUploadResponse(response: R2UploadResponse): UploadResult {
  const publicUrl = response.publicUrl || response.url;
  const storagePath = response.storagePath || response.path;

  if (!publicUrl || !storagePath) {
    throw new Error('Upload finished, but the server did not return a valid file URL.');
  }

  return {
    publicUrl,
    storagePath,
    url: publicUrl,
    path: storagePath,
  };
}

function uploadWithProgress(formData: FormData, onProgress?: (progress: number) => void): Promise<R2UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', getUploadEndpoint(), true);

    const headers = getAuthHeaders();
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.setRequestHeader('apikey', headers.apikey);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const progress = Math.min(95, Math.round((event.loaded / event.total) * 95));
      onProgress(progress);
    };

    xhr.onload = () => {
      let parsed: R2UploadResponse = {};

      try {
        parsed = xhr.responseText ? (JSON.parse(xhr.responseText) as R2UploadResponse) : {};
      } catch {
        reject(new Error('Upload failed because the server returned an invalid response.'));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(parsed.error || `Upload failed with status ${xhr.status}.`));
        return;
      }

      onProgress?.(100);
      resolve(parsed);
    };

    xhr.onerror = () => reject(new Error('Upload failed because the network request could not complete.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.send(formData);
  });
}

export async function uploadToR2(file: File, folder: UploadFolder, options: UploadOptions = {}): Promise<UploadResult> {
  const kind = options.kind || (folder === 'audio' ? 'audio' : folder === 'videos' ? 'video' : 'image');
  validateFile(file, kind);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('kind', kind);

  options.onProgress?.(1);
  const response = await uploadWithProgress(formData, options.onProgress);
  return normalizeUploadResponse(response);
}

export async function uploadAudio(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.audio, { kind: 'audio', onProgress });
}

export async function uploadCoverArt(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.image, { kind: 'image', onProgress });
}

export async function uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  return uploadToR2(file, defaultFolderByKind.video, { kind: 'video', onProgress });
}

export async function uploadProfileMedia(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  const kind: UploadKind = file.type.startsWith('video/') ? 'video' : 'image';
  return uploadToR2(file, 'profile', { kind, onProgress });
}

export async function uploadSubmissionFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  const kind: UploadKind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
  return uploadToR2(file, 'submissions', { kind, onProgress });
}
