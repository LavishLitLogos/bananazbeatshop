import type { ProdBySong } from '../types';

const EXCLUSIVE_TEXT_MARKERS = ['single', 'demo', 'song concept', 'concept song'];

function normalizeText(value?: string | null) {
  return String(value || '').toLowerCase();
}

export function isSongMarkedExclusiveByText(song: Partial<ProdBySong>) {
  const haystack = [
    normalizeText(song.title),
    normalizeText(song.artist_name),
    normalizeText(song.description),
    normalizeText(song.rights_text),
  ].join(' ');

  return EXCLUSIVE_TEXT_MARKERS.some((marker) => haystack.includes(marker));
}

export function isExclusiveSong(song: Partial<ProdBySong>) {
  return Boolean(song.exclusive) || isSongMarkedExclusiveByText(song);
}
