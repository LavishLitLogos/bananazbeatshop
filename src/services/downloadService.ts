import { supabase } from '../lib/supabase';

type DownloadEntityType = 'beat' | 'prod_by_song' | 'beat_tape_track';

type SignedDownloadResponse = {
  ok?: boolean;
  function?: string;
  objectKey?: string;
  url: string;
  fileName?: string;
  storagePath?: string;
  record?: string;
};

function cleanDownloadName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'download';
}

export async function requestSignedDownload(params: {
  entityType: DownloadEntityType;
  entityId: string;
  parentTapeId?: string;
}) {
  const functionName = 'r2-download';
  const payloadType = 'json';
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: params,
  });

  if (error) {
    let detail: any = null;
    if ((error as any)?.context && typeof (error as any).context.json === 'function') {
      try {
        detail = await (error as any).context.json();
      } catch {
        detail = null;
      }
    }

    console.error(`[${functionName}] invoke failed`, {
      function: functionName,
      payloadType,
      returnedData: data,
      returnedError: error,
      detail,
    });

    const step = detail?.step ? `${detail.step}: ` : '';
    throw new Error(step + (detail?.error || error.message || 'Could not authorize download.'));
  }

  const response = data as SignedDownloadResponse | null;
  if (!response?.ok || !response?.url) {
    console.error(`[${functionName}] unexpected response`, {
      function: functionName,
      payloadType,
      returnedData: data,
      returnedError: error,
    });
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
