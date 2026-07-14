import { supabase } from '../lib/supabase';
import type { Beat, BeatTape, ProdBySong } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_FUNCTION_TOKEN = 'GLOKEY';

type AdminEntity = 'beats' | 'songs' | 'tapes';
type AdminAction = 'create' | 'update' | 'delete';

type AdminFunctionResponse<T> = {
  ok?: boolean;
  record?: T;
  error?: string;
  step?: string;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function callAdminFunction<T>(entity: AdminEntity, action: AdminAction, body: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment is missing for admin saves.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/admin-beats/${entity}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'X-Admin-Token': ADMIN_FUNCTION_TOKEN,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as AdminFunctionResponse<T> | null;

  if (!response.ok || !payload?.ok) {
    const prefix = payload?.step ? `${payload.step}: ` : '';
    throw new Error(`${prefix}${payload?.error || `Admin ${entity} ${action} failed.`}`);
  }

  return payload.record as T;
}

async function directSaveBeat(payload: Record<string, unknown>, id?: string) {
  if (id) {
    const { data, error } = await supabase.from('beats').update(payload).eq('id', id).select().single();
    if (error) throw new Error(errorMessage(error, 'Beat update failed.'));
    return data as Beat;
  }

  const { data, error } = await supabase.from('beats').insert(payload).select().single();
  if (error) throw new Error(errorMessage(error, 'Beat creation failed.'));
  return data as Beat;
}

async function directSaveSong(payload: Record<string, unknown>, id?: string) {
  if (id) {
    const { data, error } = await supabase.from('prod_by_songs').update(payload).eq('id', id).select().single();
    if (error) throw new Error(errorMessage(error, 'Song update failed.'));
    return data as ProdBySong;
  }

  const { data, error } = await supabase.from('prod_by_songs').insert(payload).select().single();
  if (error) throw new Error(errorMessage(error, 'Song creation failed.'));
  return data as ProdBySong;
}

async function directSaveTape(payload: Record<string, unknown>, id?: string) {
  const { tracks = [], ...tapePayload } = payload as Record<string, unknown> & {
    tracks?: Array<Record<string, unknown>>;
  };

  let tapeId = id;

  if (tapeId) {
    const { data, error } = await supabase.from('beat_tapes').update(tapePayload).eq('id', tapeId).select().single();
    if (error) throw new Error(errorMessage(error, 'Beat tape update failed.'));
    await supabase.from('beat_tape_tracks').delete().eq('tape_id', tapeId);
    tapeId = String((data as { id?: string } | null)?.id || tapeId);
  } else {
    const { data, error } = await supabase.from('beat_tapes').insert(tapePayload).select().single();
    if (error) throw new Error(errorMessage(error, 'Beat tape creation failed.'));
    tapeId = String((data as { id?: string } | null)?.id || '');
  }

  if (tracks.length > 0) {
    const trackRows = tracks.map((track) => ({ ...track, tape_id: tapeId }));
    const { error } = await supabase.from('beat_tape_tracks').insert(trackRows);
    if (error) throw new Error(errorMessage(error, 'Beat tape tracks save failed.'));
  }

  const { data, error } = await supabase.from('beat_tapes').select('*, tracks:beat_tape_tracks(*)').eq('id', tapeId).single();
  if (error) throw new Error(errorMessage(error, 'Beat tape reload failed.'));
  return data as BeatTape;
}

export async function saveAdminBeat(payload: Record<string, unknown>, id?: string) {
  try {
    return await callAdminFunction<Beat>('beats', id ? 'update' : 'create', id ? { id, ...payload } : payload);
  } catch {
    return directSaveBeat(payload, id);
  }
}

export async function deleteAdminBeat(id: string) {
  try {
    return await callAdminFunction<{ id: string; deleted: boolean }>('beats', 'delete', { id });
  } catch {
    const { error } = await supabase.from('beats').delete().eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Beat delete failed.'));
    return { id, deleted: true };
  }
}

export async function saveAdminSong(payload: Record<string, unknown>, id?: string) {
  try {
    return await callAdminFunction<ProdBySong>('songs', id ? 'update' : 'create', id ? { id, ...payload } : payload);
  } catch {
    return directSaveSong(payload, id);
  }
}

export async function deleteAdminSong(id: string) {
  try {
    return await callAdminFunction<{ id: string; deleted: boolean }>('songs', 'delete', { id });
  } catch {
    const { error } = await supabase.from('prod_by_songs').delete().eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Song delete failed.'));
    return { id, deleted: true };
  }
}

export async function saveAdminTape(payload: Record<string, unknown>, id?: string) {
  try {
    return await callAdminFunction<BeatTape>('tapes', id ? 'update' : 'create', id ? { id, ...payload } : payload);
  } catch {
    return directSaveTape(payload, id);
  }
}

export async function deleteAdminTape(id: string) {
  try {
    return await callAdminFunction<{ id: string; deleted: boolean }>('tapes', 'delete', { id });
  } catch {
    await supabase.from('beat_tape_tracks').delete().eq('tape_id', id);
    const { error } = await supabase.from('beat_tapes').delete().eq('id', id);
    if (error) throw new Error(errorMessage(error, 'Beat tape delete failed.'));
    return { id, deleted: true };
  }
}
