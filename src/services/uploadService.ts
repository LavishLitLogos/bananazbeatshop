import { supabase } from '../lib/supabase';

export type UploadResult = {
  url: string;
  publicUrl: string;
  path: string;
  storagePath: string;
  contentType?: string;
  size?: number;
};

export type UploadOptions = {
  mediaRole?: string;
  relatedTable?: string;
  relatedId?: string;
};

type UploadKind = 'audio' | 'image' | 'video' | 'file';

type EdgeUploadResponse = {
  publicUrl: string;
  storagePath: string;
  path: string;
  contentType: string;
  size: number;
};

function normalizeContentType(file: File) {
  const rawType = String(file.type || '').toLowerCase().trim();

  if (!rawType) return undefined;
  if (rawType === 'audio/mp3') return 'audio/mpeg';
  if (rawType === 'audio/wave') return 'audio/wav';
  if (rawType === 'image/jpg') return 'image/jpeg';

  return rawType;
}

async function uploadViaR2Function(
  file: File,
  type: UploadKind,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const normalizedType = normalizeContentType(file);
  const normalizedFile =
    normalizedType && normalizedType !== file.type
      ? new File([file], file.name, {
          type: normalizedType,
          lastModified: file.lastModified,
        })
      : file;

  const formData = new FormData();
  formData.append('file', normalizedFile);
  formData.append('type', type);

  if (options.mediaRole) {
    formData.append('role', options.mediaRole);
  }

  if (options.relatedTable) {
    formData.append('relatedTable', options.relatedTable);
  }

  if (options.relatedId) {
    formData.append('relatedId', options.relatedId);
  }

  const { data, error } = await supabase.functions.invoke('r2-upload', {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || 'R2 upload failed.');
  }

  const response = data as EdgeUploadResponse | null;
  if (!response?.publicUrl || !response.storagePath) {
    throw new Error('R2 upload succeeded, but no storage path was returned.');
  }

  return {
    url: response.publicUrl,
    publicUrl: response.publicUrl,
    path: response.storagePath,
    storagePath: response.storagePath,
    contentType: response.contentType,
    size: response.size,
  };
}

export function uploadAudio(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return uploadViaR2Function(file, 'audio', {
    mediaRole: options.mediaRole || 'preview',
    relatedTable: options.relatedTable,
    relatedId: options.relatedId,
  });
}

export function uploadCoverArt(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return uploadViaR2Function(file, 'image', {
    mediaRole: options.mediaRole || 'cover_art',
    relatedTable: options.relatedTable,
    relatedId: options.relatedId,
  });
}

export function uploadProfileMedia(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return uploadViaR2Function(file, file.type.startsWith('video/') ? 'video' : 'image', {
    mediaRole: options.mediaRole || (file.type.startsWith('video/') ? 'profile_video' : 'profile_media'),
    relatedTable: options.relatedTable,
    relatedId: options.relatedId,
  });
}

export function uploadSubmissionFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  return uploadViaR2Function(file, file.type.startsWith('audio/') ? 'audio' : 'file', {
    mediaRole: options.mediaRole || 'submission_file',
    relatedTable: options.relatedTable,
    relatedId: options.relatedId,
  });
}

export function uploadBananazRoomFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const type: UploadKind = file.type.startsWith('audio/')
    ? 'audio'
    : file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'file';

  return uploadViaR2Function(file, type, {
    mediaRole: options.mediaRole || 'bananaz_room',
    relatedTable: options.relatedTable,
    relatedId: options.relatedId,
  });
}
