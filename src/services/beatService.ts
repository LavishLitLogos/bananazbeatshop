import { supabase } from '../lib/supabase';
import type { Beat, BeatTape, BeatTapeTrack, ProdBySong, Room } from '../types';
import {
  canDownloadBeat as canAccessBeatDownload,
  canBuyBeat,
  DEFAULT_BEAT_PRICE,
  isBeatExclusive,
  isBeatFree,
  isBeatInBeatLab,
  isBeatInFreeDLs,
  isBeatVisibleToBuyer,
} from '../utils/beatAccess';

export type BeatRoomFilter = {
  style?: string;
  vibe?: string;
  genre?: string;
  type?: string;
  search?: string;
};

export type BeatPayload = Partial<Beat> & {
  title: string;
};

export type BeatTapePayload = Partial<BeatTape> & {
  title: string;
  tracks?: Partial<BeatTapeTrack>[];
};

export type ProdByPayload = Partial<ProdBySong> & {
  title: string;
};

const DEFAULT_TERMS =
  'Full use allowed, including for profit. If released on DSPs, 10% split requested. Credit required: prod. by ThisBeatIzBananaz.';

function cleanListValue(value?: string) {
  if (!value) return '';
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

function applyBeatFilters(query: any, filters?: BeatRoomFilter) {
  let q = query;

  if (filters?.search) {
    q = q.ilike('title', `%${filters.search}%`);
  }

  if (filters?.style) {
    q = q.ilike('style', `%${filters.style}%`);
  }

  if (filters?.vibe) {
    q = q.ilike('vibe', `%${filters.vibe}%`);
  }

  if (filters?.genre) {
    q = q.ilike('genre', `%${filters.genre}%`);
  }

  if (filters?.type) {
    q = q.ilike('type', `%${filters.type}%`);
  }

  return q;
}

export async function uploadFileToSupabase(file: File, folder: string) {
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');

  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from('bananaz-media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('bananaz-media').getPublicUrl(path);

  return data.publicUrl;
}

export async function getAllBeats(filters?: BeatRoomFilter) {
  let query = supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  query = applyBeatFilters(query, filters);

  const { data, error } = await query;

  if (error) throw error;

  return ((data || []) as Beat[]).filter((beat) => isBeatVisibleToBuyer(beat));
}

export async function getPaidBeats(filters?: BeatRoomFilter) {
  let query = supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  query = applyBeatFilters(query, filters);

  const { data, error } = await query;

  if (error) throw error;

  return ((data || []) as Beat[]).filter((beat) => isBeatInBeatLab(beat) && !isBeatFree(beat));
}

export async function getFreeBeats(filters?: BeatRoomFilter) {
  let query = supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  query = applyBeatFilters(query, filters);

  const { data, error } = await query;

  if (error) throw error;

  return ((data || []) as Beat[]).filter((beat) => isBeatInFreeDLs(beat));
}

export async function getExclusiveBeats(filters?: BeatRoomFilter) {
  let query = supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  query = applyBeatFilters(query, filters);

  const { data, error } = await query;

  if (error) throw error;

  return ((data || []) as Beat[]).filter((beat) => isBeatExclusive(beat));
}

export async function getBeatById(id: string) {
  const { data, error } = await supabase
    .from('beats')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data as Beat;
}

export async function createBeat(payload: BeatPayload) {
  const insertData = {
    title: payload.title,
    cover_art_url: payload.cover_art_url || null,
    audio_file_url: payload.audio_file_url || null,
    price: payload.price ?? DEFAULT_BEAT_PRICE,
    is_free: payload.is_free ?? false,
    sold: payload.sold ?? false,
    release_download: payload.release_download ?? false,
    exclusive: payload.exclusive ?? false,
    bananaz_exclusive: payload.bananaz_exclusive ?? false,
    no_sharing: payload.no_sharing ?? false,
    hidden: payload.hidden ?? false,
    style: cleanListValue(payload.style),
    vibe: cleanListValue(payload.vibe),
    genre: cleanListValue(payload.genre),
    type: cleanListValue(payload.type),
    mood: payload.mood || null,
    artist_suggestion: payload.artist_suggestion || null,
    description: payload.description || null,
    terms: payload.terms || DEFAULT_TERMS,
  };

  const { data, error } = await supabase
    .from('beats')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  return data as Beat;
}

export async function updateBeat(id: string, payload: Partial<Beat>) {
  const updateData = {
    ...payload,
    style: cleanListValue(payload.style),
    vibe: cleanListValue(payload.vibe),
    genre: cleanListValue(payload.genre),
    type: cleanListValue(payload.type),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('beats')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Beat;
}

export async function deleteBeat(id: string) {
  const { error } = await supabase.from('beats').delete().eq('id', id);

  if (error) throw error;

  return true;
}

export async function toggleBeatHidden(id: string, hidden: boolean) {
  return updateBeat(id, { hidden });
}

export async function toggleBeatFree(id: string, is_free: boolean, price = DEFAULT_BEAT_PRICE) {
  return updateBeat(id, {
    is_free,
    price: is_free ? 0 : price,
  });
}

export async function toggleBeatExclusive(id: string, exclusive: boolean) {
  return updateBeat(id, { exclusive });
}

export async function toggleBeatDownloadRelease(
  id: string,
  release_download: boolean
) {
  return updateBeat(id, { release_download });
}

export async function getBeatTapes() {
  const { data, error } = await supabase
    .from('beat_tapes')
    .select('*, tracks:beat_tape_tracks(*)')
    .eq('hidden', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []) as BeatTape[];
}

export async function createBeatTape(payload: BeatTapePayload) {
  const { tracks = [], ...tapeData } = payload;

  const { data: tape, error } = await supabase
    .from('beat_tapes')
    .insert({
      title: tapeData.title,
      cover_art_url: tapeData.cover_art_url || null,
      price: tapeData.price ?? 0,
      is_free: tapeData.is_free ?? false,
      colab_usable: tapeData.colab_usable ?? false,
      hidden: tapeData.hidden ?? false,
      description: tapeData.description || null,
    })
    .select()
    .single();

  if (error) throw error;

  if (tracks.length > 0) {
    const trackRows = tracks.map((track, index) => ({
      tape_id: tape.id,
      title: track.title || `Track ${index + 1}`,
      audio_file_url: track.audio_file_url || null,
      track_order: track.track_order ?? index + 1,
    }));

    const { error: trackError } = await supabase
      .from('beat_tape_tracks')
      .insert(trackRows);

    if (trackError) throw trackError;
  }

  return tape as BeatTape;
}

export async function updateBeatTape(id: string, payload: Partial<BeatTape>) {
  const { data, error } = await supabase
    .from('beat_tapes')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as BeatTape;
}

export async function deleteBeatTape(id: string) {
  const { error } = await supabase.from('beat_tapes').delete().eq('id', id);

  if (error) throw error;

  return true;
}

export async function getProducedBySongs() {
  const { data, error } = await supabase
    .from('prod_by_songs')
    .select('*')
    .eq('hidden', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []) as ProdBySong[];
}

export async function createProducedBySong(payload: ProdByPayload) {
  const { data, error } = await supabase
    .from('prod_by_songs')
    .insert({
      title: payload.title,
      artist_name: payload.artist_name || null,
      audio_file_url: payload.audio_file_url || null,
      cover_art_url: payload.cover_art_url || null,
      description: payload.description || null,
      rights_text:
        payload.rights_text ||
        'Produced, written, arranged, or co-created by ThisBeatIzBananaz.',
      hidden: payload.hidden ?? false,
    })
    .select()
    .single();

  if (error) throw error;

  return data as ProdBySong;
}

export async function updateProducedBySong(
  id: string,
  payload: Partial<ProdBySong>
) {
  const { data, error } = await supabase
    .from('prod_by_songs')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as ProdBySong;
}

export async function deleteProducedBySong(id: string) {
  const { error } = await supabase.from('prod_by_songs').delete().eq('id', id);

  if (error) throw error;

  return true;
}

export async function getRoomCounts() {
  const [
    allBeats,
    paidBeats,
    freeBeats,
    exclusiveBeats,
    beatTapes,
    prodBySongs,
  ] = await Promise.all([
    getAllBeats(),
    getPaidBeats(),
    getFreeBeats(),
    getExclusiveBeats(),
    getBeatTapes(),
    getProducedBySongs(),
  ]);

  return {
    total: allBeats.length,
    beatlab: paidBeats.length,
    freedls: freeBeats.length,
    beattapes: beatTapes.length,
    prodby: prodBySongs.length,
    exclusives: exclusiveBeats.length,
    thelab: 0,
    submission: 0,
    profile: 0,
    beatbayngr: 0,
  };
}

export function getRoomForBeat(beat: Beat): Room {
  if (isBeatFree(beat)) return 'freedls';
  if (isBeatExclusive(beat)) return 'exclusives';
  return 'beatlab';
}

export function canDownloadBeat(beat: Beat) {
  return canAccessBeatDownload(beat);
}

export function canPurchaseBeat(beat: Beat) {
  return canBuyBeat(beat);
}

export function canShareBeat(beat: Beat) {
  return !beat.no_sharing && !beat.hidden;
}
