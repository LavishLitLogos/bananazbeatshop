c
export type UploadResult = {
  url: string;
  publicUrl: string;
  path: string;
  storagePath: string;
};

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
  kind: 'audio' | 'cover-art' | 'profile-media'
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

  if (error) {
    throw new Error(error.message || `${kind} upload failed.`);
  }

  const { data: publicData } = supabase.storage
    .from('bananaz-media')
    .getPublicUrl(data?.path || storagePath);

  const publicUrl = publicData?.publicUrl;

  if (!publicUrl) {
    throw new Error(`${kind} uploaded, but no public URL was returned.`);
  }

  return {
    url: publicUrl,
    publicUrl,
    path: data?.path || storagePath,
    storagePath: data?.path || storagePath,
  };
}

export async function uploadAudio(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'audio', 'audio');
}

export async function uploadCoverArt(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'covers', 'cover-art');
}

export async function uploadProfileMedia(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'profile', 'profile-media');
}

export async function uploadSubmissionFile(file: File): Promise<UploadResult> {
  return uploadToBucket(file, 'submissions', 'submission');
}
