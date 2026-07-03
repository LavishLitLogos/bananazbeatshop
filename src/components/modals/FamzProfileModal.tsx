import { ExternalLink, ImageIcon, Minus, Plus, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { appStorage } from '../../services/appStorage';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const COUNT_LABEL_KEY = 'bananaz.famz.displayLabel';

type PartnerLink = {
  id: string;
  title: string;
  url: string;
  image_url?: string;
  description?: string;
};

type ProfileMedia = {
  id: string;
  title?: string;
  url: string;
  type: 'image' | 'video';
  download_enabled?: boolean;
};

function safeUrl(url?: string) {
  return url || MAIN_LOGO;
}

export function FamzProfileModal({ onClose }: { onClose: () => void }) {
  const { isAdmin } = useApp();
  const [partners, setPartners] = useState<PartnerLink[]>([]);
  const [media, setMedia] = useState<ProfileMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [countLabel, setCountLabel] = useState<'BANANAZ FAM' | 'FAMNANAZ'>(() => {
    if (typeof window === 'undefined') return 'BANANAZ FAM';
    return window.localStorage.getItem(COUNT_LABEL_KEY) === 'FAMNANAZ' ? 'FAMNANAZ' : 'BANANAZ FAM';
  });
  const [famzCount, setFamzCount] = useState(() => appStorage.getAdminSettings().famzCount);
  const [selectedPartner, setSelectedPartner] = useState<PartnerLink | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<ProfileMedia | null>(null);
  const profile = useMemo(() => appStorage.getProfile(), []);

  useEffect(() => {
    const fetchProfileExtras = async () => {
      setLoading(true);

      const [{ data: partnerData }, { data: mediaData }] = await Promise.all([
        supabase.from('profile_partners').select('*').order('sort_order', { ascending: true }),
        supabase.from('profile_media').select('*').order('created_at', { ascending: false }),
      ]);

      setPartners((partnerData || []) as PartnerLink[]);
      setMedia((mediaData || []) as ProfileMedia[]);
      setLoading(false);
    };

    fetchProfileExtras();
  }, []);

  const updateFamzCount = (change: number) => {
    if (!isAdmin) return;

    const nextSettings = {
      ...appStorage.getAdminSettings(),
      famzCount: Math.max(0, appStorage.getAdminSettings().famzCount + change),
    };

    const saved = appStorage.saveAdminSettings(nextSettings);
    setFamzCount(saved.famzCount);
  };

  const toggleCountLabel = () => {
    if (!isAdmin) return;

    const nextLabel = countLabel === 'BANANAZ FAM' ? 'FAMNANAZ' : 'BANANAZ FAM';
    setCountLabel(nextLabel);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COUNT_LABEL_KEY, nextLabel);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/82 backdrop-blur-xl px-3 py-4 sm:px-6" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[#f5c518]/20 bg-[#0b0b0b] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="font-display text-lg font-900 uppercase tracking-[0.1em] text-white">
              FAMZ
            </div>
            <div className="text-xs text-[#777]">
              Tap in with ThisBeatIzBananaz
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={toggleCountLabel}
                className="rounded-full border border-[#2a2a2a] bg-[#121212] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8d8d8]"
              >
                {countLabel}
              </button>
            ) : (
              <div className="rounded-full border border-[#2a2a2a] bg-[#121212] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8d8d8]">
                {countLabel}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close FAMZ"
              aria-label="Close FAMZ"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#888] transition-colors hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="rounded-[1.8rem] border border-[#1d1d1d] bg-[#101010] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-24 w-24 overflow-hidden rounded-[1.6rem] border border-[#f5c518]/25 bg-black">
                  <img src={MAIN_LOGO} alt={profile.displayName || 'ThisBeatIzBananaz'} className="h-full w-full object-cover" />
                </div>

                <div className="min-w-0">
                  <div className="font-display text-2xl font-900 uppercase leading-tight text-white">
                    {profile.displayName || 'ThisBeatIzBananaz'}
                  </div>
                  {profile.headline && (
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#f5c518]">
                      {profile.headline}
                    </div>
                  )}
                  {profile.sloganQuote && (
                    <div className="mt-3 max-w-xl text-sm leading-relaxed text-[#d2d2d2]">
                      "{profile.sloganQuote}"
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[#f5c518]/20 bg-black/35 px-4 py-3 text-center sm:min-w-[180px]">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#8b8b8b]">
                  {countLabel}
                </div>
                <div className="mt-2 font-display text-3xl font-900 text-[#f5c518]">
                  {famzCount.toLocaleString()}
                </div>

                {isAdmin && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateFamzCount(-1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#d0d0d0]"
                      title="Lower count"
                      aria-label="Lower count"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFamzCount(1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414] text-[#d0d0d0]"
                      title="Raise count"
                      aria-label="Raise count"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(profile.aboutProducer || profile.bio || profile.additionalInfo) && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[profile.aboutProducer, profile.bio, profile.additionalInfo]
                  .filter(Boolean)
                  .map((copy, index) => (
                    <div key={`${index}-${copy}`} className="rounded-2xl border border-[#1d1d1d] bg-black/30 p-3 text-sm leading-relaxed text-[#d0d0d0]">
                      {copy}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.8rem] border border-[#1d1d1d] bg-[#101010] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-900 uppercase tracking-[0.08em] text-white">
                    Partner Links
                  </h2>
                  <p className="text-xs text-[#777]">
                    Tap a tile to view inside the shop.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="aspect-square animate-pulse rounded-2xl border border-[#1d1d1d] bg-[#141414]" />
                  ))}
                </div>
              ) : partners.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {partners.map((partner) => (
                    <button
                      key={partner.id}
                      type="button"
                      onClick={() => setSelectedPartner(partner)}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-[#1d1d1d] bg-black text-left"
                    >
                      <img src={safeUrl(partner.image_url)} alt={partner.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      <div className="absolute inset-x-2 bottom-2">
                        <div className="truncate font-display text-[11px] font-900 uppercase text-white">
                          {partner.title}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#242424] px-4 py-10 text-center text-sm text-[#666]">
                  No partner links live yet.
                </div>
              )}
            </section>

            <section className="rounded-[1.8rem] border border-[#1d1d1d] bg-[#101010] p-4">
              <div className="mb-3">
                <h2 className="font-display text-lg font-900 uppercase tracking-[0.08em] text-white">
                  Media
                </h2>
                <p className="text-xs text-[#777]">
                  Visuals, previews, and moments from the vault.
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="aspect-square animate-pulse rounded-2xl border border-[#1d1d1d] bg-[#141414]" />
                  ))}
                </div>
              ) : media.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {media.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMedia(item)}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-[#1d1d1d] bg-black text-left"
                    >
                      {item.type === 'video' ? (
                        <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        <img src={safeUrl(item.url)} alt={item.title || 'Profile media'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <div className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] text-white">
                        {item.type === 'video' ? <Video size={12} className="inline" /> : <ImageIcon size={12} className="inline" />}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#242424] px-4 py-10 text-center text-sm text-[#666]">
                  No media live yet.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {selectedPartner && (
        <div className="fixed inset-0 z-[10010] bg-black/82 px-3 py-4 backdrop-blur-md" onClick={(event) => event.target === event.currentTarget && setSelectedPartner(null)}>
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[1.8rem] border border-[#f5c518]/20 bg-[#0b0b0b]">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-900 uppercase text-white">
                  {selectedPartner.title}
                </div>
                {selectedPartner.description && (
                  <div className="mt-1 truncate text-xs text-[#777]">
                    {selectedPartner.description}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(selectedPartner.url, '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#121212] px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#f5c518]"
                >
                  <ExternalLink size={13} />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPartner(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#888]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#050505]">
              <iframe src={selectedPartner.url} title={selectedPartner.title} className="h-full w-full" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          </div>
        </div>
      )}

      {selectedMedia && (
        <div className="fixed inset-0 z-[10010] bg-black/82 px-3 py-4 backdrop-blur-md" onClick={(event) => event.target === event.currentTarget && setSelectedMedia(null)}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-[#f5c518]/20 bg-[#0b0b0b]">
            <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-900 uppercase text-white">
                  {selectedMedia.title || 'Media'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-[#888]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center bg-[#050505] p-4">
              {selectedMedia.type === 'video' ? (
                <video src={selectedMedia.url} className="max-h-full max-w-full rounded-2xl" controls autoPlay />
              ) : (
                <img src={safeUrl(selectedMedia.url)} alt={selectedMedia.title || 'Profile media'} className="max-h-full max-w-full rounded-2xl object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
