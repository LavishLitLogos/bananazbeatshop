import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Pause,
  Play,
  Share2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { ProdBySong } from '../../types';
import { BRAND_NAME, PRODUCED_BY_INFO_DEFAULT } from '../../utils/branding';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';

type CreditSong = ProdBySong & {
  no_sharing?: boolean;
  release_download?: boolean;
};

function getCover(song: CreditSong) {
  return song.cover_art_url || MAIN_LOGO;
}

function getCreditUrl(song: CreditSong) {
  return `${window.location.origin}${window.location.pathname}#credit-${song.id}`;
}

export function CreditsRoom() {
  const { goBack, addToast } = useApp();
  const audio = useAudio();

  const [credits, setCredits] = useState<CreditSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState<CreditSong | null>(null);

  const fetchCredits = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('prod_by_songs')
      .select('*')
      .eq('hidden', false)
      .eq('admin_approved', true)
      .eq('exclusive', false)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Credits failed to load.', 'error');
      setCredits([]);
    } else {
      setCredits((data || []) as CreditSong[]);
    }

    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const visibleCredits = useMemo(() => credits.filter((song) => !song.hidden), [credits]);

  const handlePlay = (song: CreditSong) => {
    if (!song.audio_file_url) {
      addToast('No audio available for this credit.', 'info');
      return;
    }

    if (audio.currentBeat?.id === song.id) {
      if (audio.isPlaying) {
        audio.pause();
      } else {
        audio.resume();
      }
      return;
    }

    audio.play(song, false);
  };

  const handleShare = async (song?: CreditSong) => {
    const url = song ? getCreditUrl(song) : window.location.href;
    const title = song ? `${song.title} · Produced by ${BRAND_NAME}` : `${BRAND_NAME} Credits`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: song
            ? `Listen to "${song.title}" by ${song.artist_name || 'Artist TBA'} - produced by ${BRAND_NAME}.`
            : `Production credits and artist showcases from ${BRAND_NAME}.`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast(song ? 'Credit link copied.' : 'Credits room link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast(song ? 'Credit link copied.' : 'Credits room link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors flex-shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-2xl uppercase tracking-wide text-white leading-none">
                Credits
              </h1>
              <p className="text-sm text-[#777] mt-1 truncate">
                Production credits, placements, and artist showcases.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleShare()}
            className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#f5c518] flex-shrink-0"
            aria-label="Share credits room"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 pb-32 space-y-5">
        <div className="rounded-3xl border border-[#1e1e1e] bg-[#101010] p-5 text-center">
          <img
            src={MAIN_LOGO}
            alt=""
            className="w-20 h-20 object-contain mx-auto mb-3 opacity-80"
          />

          <div className="font-display font-900 text-2xl uppercase text-[#f5c518]">
            Production Credits
          </div>

          <p className="text-base text-[#bdbdbd] mt-3 leading-relaxed max-w-md mx-auto">
            Songs produced by {BRAND_NAME} for artists around the world.
          </p>

          <p className="text-sm text-[#777] mt-2 max-w-sm mx-auto">
            Tap any record to hear it, learn about the artist, and share their music.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-2xl bg-[#111] border border-[#1e1e1e] animate-pulse"
              />
            ))}
          </div>
        ) : visibleCredits.length === 0 ? (
          <div className="rounded-3xl border border-[#1e1e1e] bg-[#101010] p-6 text-center">
            <div className="font-display font-900 text-xl uppercase text-white">
              No Credits Yet
            </div>
            <p className="text-sm text-[#777] mt-2">
              Produced records will appear here once they are added and approved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {visibleCredits.map((song) => {
              const isCurrent = audio.currentBeat?.id === song.id;
              const isPlaying = isCurrent && audio.isPlaying;

              return (
                <button
                  key={song.id}
                  id={`credit-${song.id}`}
                  onClick={() => setSelectedCredit(song)}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-[#1e1e1e] bg-[#111] text-left hover:border-[#f5c518]/40 transition-all"
                >
                  <img
                    src={getCover(song)}
                    alt={song.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="rounded-full bg-black/70 border border-white/10 px-1.5 py-0.5 text-[9px] text-[#f5c518] font-bold uppercase">
                      Credit
                    </span>
                  </div>

                  <div className="absolute inset-x-2 bottom-2">
                    <div className="font-display font-900 text-[11px] text-white uppercase leading-tight line-clamp-2">
                      {song.title}
                    </div>

                    <div className="text-[10px] text-[#f5c518] truncate mt-0.5">
                      {song.artist_name || 'Artist TBA'}
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePlay(song);
                        }}
                        className="w-7 h-7 rounded-full bg-[#f5c518] text-black flex items-center justify-center"
                      >
                        {isPlaying ? (
                          <Pause size={13} fill="black" />
                        ) : (
                          <Play size={13} fill="black" className="ml-0.5" />
                        )}
                      </span>

                      {!song.no_sharing && (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            handleShare(song);
                          }}
                          className="w-7 h-7 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center"
                        >
                          <Share2 size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCredit && (
        <div
          className="modal-backdrop"
          onClick={(event) => event.target === event.currentTarget && setSelectedCredit(null)}
        >
          <div
            className="modal-box max-w-md w-full p-5 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display font-900 text-2xl uppercase text-white leading-none">
                  {selectedCredit.title}
                </div>
                <div className="text-sm text-[#f5c518] mt-1">
                  {selectedCredit.artist_name || 'Artist TBA'}
                </div>
              </div>

              <button
                onClick={() => setSelectedCredit(null)}
                className="p-2 rounded-xl bg-white/5 text-[#888] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="aspect-square rounded-3xl overflow-hidden bg-black border border-[#222]">
              <img
                src={getCover(selectedCredit)}
                alt={selectedCredit.title}
                className="w-full h-full object-cover"
              />
            </div>

            {selectedCredit.description && (
              <p className="text-sm text-[#aaa] leading-relaxed">
                {selectedCredit.description}
              </p>
            )}

            <div className="rounded-2xl border border-[#222] bg-[#0d0d0d] p-3">
              <div className="text-[10px] text-[#555] uppercase tracking-[0.18em]">
                Credit
              </div>
              <div className="text-sm text-white mt-1">
                {PRODUCED_BY_INFO_DEFAULT}
              </div>
              {selectedCredit.rights_text && (
                <div className="text-xs text-[#666] mt-1">
                  {selectedCredit.rights_text}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handlePlay(selectedCredit)}
                className="btn-gold py-3 rounded-2xl text-sm flex items-center justify-center gap-2"
              >
                {audio.currentBeat?.id === selectedCredit.id && audio.isPlaying ? (
                  <>
                    <Pause size={15} fill="black" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={15} fill="black" />
                    Play
                  </>
                )}
              </button>

              <button
                onClick={() => handleShare(selectedCredit)}
                disabled={Boolean(selectedCredit.no_sharing)}
                className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Share2 size={15} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


