import type { Room } from '../types';

export function appShareUrl(hash = '') {
  const cleanHash = hash ? `#${hash.replace(/^#/, '')}` : '';
  return `${window.location.origin}${window.location.pathname}${cleanHash}`;
}

export function roomFromShareHash(hashValue = window.location.hash): Room | null {
  const hash = hashValue.replace(/^#/, '');

  if (!hash) return null;
  if (hash.startsWith('beat-')) return 'beatlab';
  if (hash.startsWith('freebeat-')) return 'freedls';
  if (hash.startsWith('song-')) return 'prodby';
  if (hash.startsWith('credit-')) return 'credits';
  if (hash.startsWith('tape-')) return 'beattapes';
  if (hash.startsWith('exclusive-')) return 'exclusives';
  if (hash.startsWith('bananaz-room-')) return 'bananazroom';

  if (hash === 'beatlab') return 'beatlab';
  if (hash === 'freedls') return 'freedls';
  if (hash === 'prodby') return 'prodby';
  if (hash === 'credits') return 'credits';
  if (hash === 'beattapes') return 'beattapes';
  if (hash === 'exclusives') return 'exclusives';
  if (hash === 'bananazroom') return 'bananazroom';
  if (hash === 'profile') return 'profile';

  return null;
}
