import { supabase } from '../lib/supabase';

export type UploadResult = {
  url: string;
  publicUrl: string;
  path: string;
  storagePath: string;
};

type UploadKind = 'audio' | 'cover-art' | 'profile-media' | 'submission';

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

async function uploadToBucket(
  file: File,
  folder: string,
  kind: UploadKind
): Promise<UploadResult> {
  const fileName = cleanFileName(file.name);
  const storagePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('bananaz-media')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw new Error(error.message);

  const savedPath = data?.path || storagePath;

  const { data: publicData } = supabase.storage
    .from('bananaz-media')
    .getPublicUrl(savedPath);

  return {
    url: publicData.publicUrl,
    publicUrl: publicData.publicUrl,
    path: savedPath,
    storagePath: savedPath
  };
}

export const uploadAudio = (file: File) =>
  uploadToBucket(file, 'audio', 'audio');

export const uploadCoverArt = (file: File) =>
  uploadToBucket(file, 'covers', 'cover-art');

export const uploadProfileMedia = (file: File) =>
  uploadToBucket(file, 'profile', 'profile-media');

export const uploadSubmissionFile = (file: File) =>
  uploadToBucket(file, 'submissions', 'submission');
