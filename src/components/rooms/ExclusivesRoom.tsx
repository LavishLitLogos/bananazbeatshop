import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Lock,
  Pause,
  Play,
  Plus,
  Share2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { ProdBySong } from '../../types';
import { BRAND_NAME, EXCLUSIVE_INFO_DEFAULT, EXCLUSIVE_STEMS_NOTE, PRODUCED_BY_DISPLAY_DEFAULT } from '../../utils/branding';
import { getBeatPriceLabel } from '../../utils/beatAccess';
import { isExclusiveSong } from '../../utils/exclusiveSongs';
import { SongUploadModal } from './ProdByRoom';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';

interface ExclusiveSong extends ProdBySong {
  price?: number;
  is_free?: boolean;
  release_download?: boolean;
  no_sharing?: boolean;
  sold?: boolean;
  exclusive?: boolean;
}

function getCover(song: ExclusiveSong) {
  return song.cover_art_url || MAIN_LOGO;
}

function getSongUrl(song: ExclusiveSong) {
  return `${window.location.origin}${window.location.pathname}#exclusive-${song.id}`;
}

export function ExclusivesRoom() {
  const { goBack, addToast, isAdmin } = useApp();
  const audio = useAudio();

  const [songs, setSongs] = useState<ExclusiveSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<ExclusiveSong | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const fetchSongs = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('prod_by_songs')
      .select('*')
      .eq('hidden', false)
      .eq('admin_approved', true)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Exclusives failed to load.', 'error');
      setSongs([]);
    } else {
      setSongs(((data || []) as ExclusiveSong[]).filter((song) => isExclusiveSong(song)));
    }

    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    fetchSongs();

    const channel = supabase
      .channel('exclusives-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prod_by_songs' },
        fetchSongs
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  const visibleSongs = useMemo(
    () => songs.filter((song) => !song.hidden && song.admin_approved !== false),
    [songs]
  );

  const handlePlay = (song: ExclusiveSong) => {
    if (!song.audio_file_url) {
      addToast('No audio available for this exclusive.', 'info');
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

    const playableSongs = visibleSongs.filter((item) => item.audio_file_url);
    const index = playableSongs.findIndex((item) => item.id === song.id);

    if (index >= 0) {
      audio.playQueue(playableSongs, index, false);
      return;
    }

    audio.play(song, false);
  };

  const handleShare = async (song?: ExclusiveSong) => {
    const url = song ? getSongUrl(song) : window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: song ? song.title : `${BRAND_NAME} Exclusives`,
          text: song
            ? `Listen to "${song.title}" - written, arranged, and produced by ${BRAND_NAME}.`
            : `Exclusive songs written, arranged, and produced by ${BRAND_NAME}.`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast(song ? 'Exclusive link copied.' : 'Exclusives link copied.', 'success');
    } catch {
      addToast('Share failed.', 'error');
    }
  };

  const handleRequest = async (song: ExclusiveSong) => {
    const buyerName = window.prompt('Name for the request:');
    if (!buyerName?.trim()) return;

    const buyerEmail = window.prompt('Email/contact for delivery:');
    if (!buyerEmail?.trim()) return;

    const { error } = await supabase.from('orders').insert({
      beat_id: song.id,
      beat_name: song.title,
      beat_thumbnail: song.cover_art_url,
      buyer_name: buyerName.trim(),
      buyer_email: buyerEmail.trim(),
      payment_method: 'Exclusive Song Request',
      amount: Number(song.price || 0),
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      payment_received: false,
    });

    if (error) {
      addToast('Exclusive request failed.', 'error');
      return;
    }

    addToast('Exclusive request sent. Download stays locked until verified.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white industrial-room-surface">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe cracked-shell-panel console-panel mx-3 mt-3 rounded-[1.6rem]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={goBack}
              className="hardware-button p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors flex-shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-800 text-2xl tracking-[0.02em] text-white leading-none">
                Exclusives
              </h1>
              <p className="text-sm text-[#777] mt-1 truncate">
                Songs written, arranged, and produced by {BRAND_NAME}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShare()}
              className="hardware-button p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#f5c518]"
              aria-label="Share exclusives"
            >
              <Share2 size={16} />
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowUpload(true)}
                className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                + Upload
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-32 space-y-5">
        <div className="rounded-3xl border border-[#1e1e1e] bg-[#101010] p-5 text-center cracked-shell-panel console-panel neon-frame glow-yellow cut-corner-card">
          <img src={MAIN_LOGO} alt="" className="w-20 h-20 object-contain mx-auto mb-3 opacity-80" />

          <div className="font-display font-800 text-2xl text-[#f5c518]">
            Exclusive Songs
          </div>

          <p className="text-base text-[#bdbdbd] mt-3 leading-relaxed max-w-md mx-auto">
            Full records built from the beat up, written, arranged, produced, and curated in-house.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-2xl bg-[#111] border border-[#1e1e1e] animate-pulse cracked-shell-panel console-panel"
              />
            ))}
          </div>
        ) : visibleSongs.length === 0 ? (
          <div className="rounded-3xl border border-[#1e1e1e] bg-[#101010] p-6 text-center cracked-shell-panel console-panel cut-corner-card">
            <div className="font-display font-800 text-xl text-white">
              No Exclusives Yet
            </div>
            <p className="text-sm text-[#777] mt-2">
              Exclusive songs will appear here once they are marked exclusive in Produced By.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {visibleSongs.map((song) => {
              const isCurrent = audio.currentBeat?.id === song.id;
              const isPlaying = isCurrent && audio.isPlaying;

              return (
                <button
                  key={song.id}
                  id={`exclusive-${song.id}`}
                  onClick={() => setSelectedSong(song)}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-[#1e1e1e] bg-[#111] text-left hover:border-[#f5c518]/40 transition-all cracked-shell-panel console-panel cut-corner-card"
                >
                  <img
                    src={getCover(song)}
                    alt={song.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                  <span className="absolute top-2 left-2 rounded-full bg-[#f5c518] text-black px-1.5 py-0.5 text-[9px] font-black tracking-[0.04em]">
                    Exclusive
                  </span>

                  <div className="absolute inset-x-2 bottom-2">
                    <div className="font-display font-800 text-[11px] text-white leading-tight line-clamp-2">
                      {song.title}
                    </div>

                    <div className="text-[10px] text-[#f5c518] truncate mt-0.5">
                      {song.artist_name || PRODUCED_BY_DISPLAY_DEFAULT}
                    </div>

                    <div className="text-[10px] text-white/80 truncate mt-0.5">
                      {getBeatPriceLabel(song)}
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePlay(song);
                        }}
                        className="w-7 h-7 rounded-full bg-[#f5c518] text-black flex items-center justify-center"
                        aria-label={isPlaying ? 'Pause exclusive' : 'Play exclusive'}
                      >
                        {isPlaying ? (
                          <Pause size={13} fill="black" />
                        ) : (
                          <Play size={13} fill="black" className="ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRequest(song);
                        }}
                        className="w-7 h-7 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center"
                        aria-label="Request exclusive"
                      >
                        <ShoppingBag size={12} />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleShare(song);
                        }}
                        disabled={Boolean(song.no_sharing)}
                        className="w-7 h-7 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center disabled:opacity-40"
                        aria-label="Share exclusive"
                      >
                        <Share2 size={12} />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSong && (
        <div
          className="modal-backdrop"
          onClick={(event) => event.target === event.currentTarget && setSelectedSong(null)}
        >
          <div
            className="modal-box cracked-shell-panel console-panel neon-frame glow-yellow cut-corner-card max-w-md w-full p-5 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display font-900 text-2xl text-white leading-none">
                  {selectedSong.title}
                </div>
                <div className="text-sm text-[#f5c518] mt-1">
                  {selectedSong.artist_name || PRODUCED_BY_DISPLAY_DEFAULT}
                </div>
                <div className="text-xs text-white/75 mt-1">
                  {getBeatPriceLabel(selectedSong)}
                </div>
              </div>

              <button
                onClick={() => setSelectedSong(null)}
                className="hardware-button p-2 rounded-xl bg-white/5 text-[#888] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="aspect-square rounded-3xl overflow-hidden bg-black border border-[#222]">
              <img
                src={getCover(selectedSong)}
                alt={selectedSong.title}
                className="w-full h-full object-cover"
              />
            </div>

            {selectedSong.description && (
              <p className="text-sm text-[#aaa] leading-relaxed">
                {selectedSong.description}
              </p>
            )}

            <div className="rounded-2xl border border-[#222] bg-[#0d0d0d] p-3">
              <div className="text-[10px] text-[#555] uppercase tracking-[0.18em]">
                Exclusive Song
              </div>
              <div className="text-sm text-white mt-1">
                {EXCLUSIVE_INFO_DEFAULT}
              </div>
              <div className="text-xs text-[#666] mt-1">
                {EXCLUSIVE_STEMS_NOTE}
              </div>
              <div className="text-xs text-[#666] mt-1 flex items-center gap-1">
                <Lock size={12} />
                Downloads stay locked until payment is verified and release is approved.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePlay(selectedSong)}
                className="btn-gold py-3 rounded-2xl text-sm flex items-center justify-center gap-2"
              >
                {audio.currentBeat?.id === selectedSong.id && audio.isPlaying ? (
                  <Pause size={15} fill="black" />
                ) : (
                  <Play size={15} fill="black" />
                )}
              </button>

              <button
                onClick={() => handleRequest(selectedSong)}
                className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag size={15} />
                Request
              </button>

              <button
                onClick={() => handleShare(selectedSong)}
                disabled={Boolean(selectedSong.no_sharing)}
                className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Share2 size={15} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <SongUploadModal
          song={null}
          onClose={() => setShowUpload(false)}
          onSave={async () => {
            setShowUpload(false);
            await fetchSongs();
          }}
        />
      )}
    </div>
  );
}


