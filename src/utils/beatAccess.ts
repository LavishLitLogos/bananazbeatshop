import type { Beat } from '../types';

export const DEFAULT_BEAT_PRICE = 40;

type PriceableMedia = {
  is_free?: boolean | string | null;
  price?: number | string | null;
  release_download?: boolean | string | null;
  section?: string | null;
  license_type?: string | null;
  free?: boolean | string | null;
};

type BeatPricing = PriceableMedia;

type BeatDownload = Pick<Beat, 'title' | 'audio_file_url' | 'sold'> &
  PriceableMedia;

type BeatFlags = PriceableMedia &
  Partial<
    Pick<
      Beat,
      'hidden' | 'admin_approved' | 'exclusive' | 'bananaz_exclusive' | 'sold'
    >
  >;

function flagIsTrue(value: unknown) {
  const cleanValue = String(value).trim().toLowerCase();
  return value === true || value === 1 || cleanValue === 'true' || cleanValue === '1' || cleanValue === 'yes' || cleanValue === 'free';
}

export function isBeatFree(beat: PriceableMedia) {
  if (flagIsTrue(beat.is_free) || flagIsTrue((beat as any).free)) return true;
  if (String(beat.section || '').toLowerCase() === 'free') return true;
  if (String(beat.license_type || '').toLowerCase() === 'free') return true;

  const price = Number(beat.price);
  return Number.isFinite(price) && price <= 0;
}

export function isBeatExclusive(beat: Partial<Pick<Beat, 'exclusive' | 'bananaz_exclusive'>>) {
  return flagIsTrue(beat.exclusive) || flagIsTrue(beat.bananaz_exclusive);
}

export function isBeatVisibleToBuyer(beat: Partial<Pick<Beat, 'hidden' | 'admin_approved'>>) {
  return !flagIsTrue(beat.hidden) && beat.admin_approved !== false && String(beat.admin_approved).toLowerCase() !== 'false';
}

export function isBeatInBeatLab(beat: BeatFlags, isAdmin = false) {
  if (!isAdmin && !isBeatVisibleToBuyer(beat)) return false;
  return !isBeatExclusive(beat);
}

export function isBeatInFreeDLs(beat: BeatFlags, isAdmin = false) {
  if (!isAdmin && !isBeatVisibleToBuyer(beat)) return false;
  return isBeatFree(beat) && !isBeatExclusive(beat);
}

export function canBuyBeat(beat: BeatFlags) {
  return !isBeatFree(beat) && !flagIsTrue(beat.sold) && getBeatPriceValue(beat) > 0;
}

export function getBeatPriceValue(beat: BeatPricing) {
  if (isBeatFree(beat)) return 0;

  const price = Number(beat.price);
  if (!Number.isFinite(price) || price <= 0) return DEFAULT_BEAT_PRICE;

  return price;
}

export function getBeatPriceLabel(beat: BeatPricing) {
  if (isBeatFree(beat)) return 'Free';

  const price = getBeatPriceValue(beat);
  return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
}

export function canDownloadBeat(beat: BeatDownload, isAdmin = false) {
  if (!beat.audio_file_url) return false;
  if (beat.sold && !isAdmin) return false;
  if (isAdmin) return true;
  if (isBeatFree(beat)) return true;
  return Boolean(beat.release_download);
}

export function getBeatDownloadFileName(beat: Pick<Beat, 'title' | 'audio_file_url'>) {
  const cleanTitle =
    (beat.title || 'thisbeatizbananaz-beat')
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim() || 'thisbeatizbananaz-beat';
  const urlPath = beat.audio_file_url?.split('?')[0]?.split('#')[0] || '';
  const extension = urlPath.split('/').pop()?.split('.').pop();

  return extension ? `${cleanTitle}.${extension}` : cleanTitle;
}

export function triggerBeatDownload(beat: BeatDownload, isAdmin = false) {
  if (!canDownloadBeat(beat, isAdmin) || !beat.audio_file_url) return false;

  const anchor = document.createElement('a');
  anchor.href = beat.audio_file_url;
  anchor.download = getBeatDownloadFileName(beat);
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return true;
}
