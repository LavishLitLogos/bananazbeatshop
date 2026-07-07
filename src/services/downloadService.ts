import { supabase } from '../lib/supabase';

type DownloadEntityType = 'beat' | 'prod_by_song' | 'beat_tape_track';

type SignedDownloadResponse = {
  url: string;
  fileName?: string;
  storagePath?: string;
};

function cleanDownloadName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'download';
}

export async function requestSignedDownload(params: {
  entityType: DownloadEntityType;
  entityId: string;
  parentTapeId?: string;
}) {
  const { data, error } = await supabase.functions.invoke('r2-download', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Could not authorize download.');
  }

  const response = data as SignedDownloadResponse | null;
  if (!response?.url) {
    throw new Error('Download authorization did not return a URL.');
  }

  return response;
}

export function triggerBrowserDownload(url: string, fileName?: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  if (fileName) {
    anchor.download = cleanDownloadName(fileName);
  }
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
