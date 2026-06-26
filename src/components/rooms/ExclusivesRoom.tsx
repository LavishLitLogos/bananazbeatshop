import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Edit3,
  ExternalLink,
  Flame,
  Lock,
  Pause,
  Play,
  Share2,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { Beat } from '../../types';
import { BeatDetailModal } from '../modals/BeatDetailModal';
import { BeatUploadModal } from '../modals/BeatUploadModal';
import { BuyModal } from '../modals/BuyModal';
import { ShareButton } from '../ui/ShareButton';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';

function getCover(beat: Beat) {
  return beat.cover_art_url || MAIN_LOGO;
}

function getExclusiveUrl(beat: Beat) {
  return `${window.location.origin}${window.location.pathname}#exclusive-${beat.id}`;
}

function splitTags(value?: string | null) {
  if (!value) return [];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPreviewText(beat: Beat) {
  return (
    beat.description ||
    beat.artist_suggestion ||
    beat.mood ||
    beat.vibe ||
    'Exclusive heat. Limited access only.'
  );
}

export function ExclusivesRoom() {
  const {
    goBack,
    setCurrentRoom,
    isAdmin,
    addToast,
    addToCart,
    adminEditMode,
    setAdminEditMode,
    refreshContent,
    refreshKey,
  } = useApp();

  const audio = useAudio();

  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExclusives = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('beats')
      .select('*')
      .eq('exclusive', true)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query
        .eq('admin_approved', true)
        .eq('hidden', false);
    }

    const { data, error } = await query;

    if (error) {
      addToast('Could not load Exclusives.', 'error');
      setLoading(false);
      return;
    }

    setBeats((data || []) as Beat[]);
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchExclusives();
  }, [fetchExclusives, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('exclusives-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beats' },
        () => {
          fetchExclusives();
          refreshContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExclusives, refreshContent]);

  const visibleBeats = useMemo(() => {
    return beats.filter((beat) => {
      if (!beat.exclusive) return false;
      if (isAdmin) return true;

      return !beat.hidden && beat.admin_approved;
    });
  }, [beats, isAdmin]);

  const handlePlay = (beat: Beat) => {
    if (!beat.audio_file_url) {
      addToast('No audio available for this exclusive.', 'info');
      return;
    }

    audio.play(beat, true, 45);
  };

  const handleQueueFromBeat = (beat: Beat) => {
    const playableBeats = visibleBeats.filter((item) => item.audio_file_url);
    const index = playableBeats.findIndex((item) => item.id === beat.id);

    if (index < 0) {
      handlePlay(beat);
      return;
    }

    audio.playQueue(playableBeats, index, true, 45);
  };

  const handleShare = async (beat: Beat) => {
    if (beat.no_sharing) {
      addToast('Sharing is disabled for this exclusive.', 'info');
      return;
    }

    const url = getExclusiveUrl(beat);

    const shareData = {
      title: beat.title,
      text: `Exclusive drop: "${beat.title}" on ThisBeatIzBananaz.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Exclusive link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast('Exclusive link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  const handleBuy = (beat: Beat) => {
    setSelectedBeat(beat);
    setShowBuy(true);
  };

  const handleAddToBox = (beat: Beat) => {
    addToCart(beat);
    addToast(`${beat.title} added to Beat Box.`, 'success');
  };

  const handleDownload = (beat: Beat) => {
    const releaseAllowed = Boolean(beat.release_download) || Boolean(beat.is_free) || isAdmin;

    if (!releaseAllowed) {
      addToast('Exclusive download locked until release is approved.', 'info');
      return;
    }

    if (!beat.audio_file_url) {
      addToast('No downloadable audio available.', 'error');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = beat.audio_file_url;
    anchor.download = `${beat.title || 'thisbeatizbananaz-exclusive'}.mp3`;
    anchor.rel = 'noopener';
    anchor.click();

    addToast('Download started.', 'success');
  };

  const handlePopOut = (beat: Beat) => {
    setSelectedBeat(beat);
    setShowDetail(true);
  };

  const handleEdit = (beat: Beat) => {
    if (!isAdmin) return;

    setSelectedBeat(beat);
    setShowUpload(true);
  };

  const handleDelete = async (beat: Beat) => {
    if (!isAdmin || !adminEditMode) return;

    const confirmed = window.confirm(
      `Delete "${beat.title}" from Exclusives? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(beat.id);

    const { error } = await supabase.from('beats').delete().eq('id', beat.id);

    setDeletingId(null);

    if (error) {
      addToast('Delete failed.', 'error');
      return;
    }

    addToast('Exclusive deleted.', 'success');
    await fetchExclusives();
    refreshContent();
  };

  const closeUpload = () => {
    setShowUpload(false);
    setSelectedBeat(null);
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-[#080808]/92 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-3 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={() => setCurrentRoom('home')}
              className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
              aria-label="Home"
            >
              <img src={MAIN_LOGO} alt="Home" className="w-full h-full object-contain" />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-lg uppercase tracking-wide text-white leading-none flex items-center gap-2 truncate">
                <Flame size={18} className="text-[#f5c518]" />
                Exclusives
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {visibleBeats.length} exclusive drops
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title="ThisBeatIzBananaz Exclusives"
              text="Exclusive drops from ThisBeatIzBananaz."
            />

            {isAdmin && (
              <button
                onClick={() => setAdminEditMode(!adminEditMode)}
                className={`p-2 rounded-xl border transition-all ${
                  adminEditMode
                    ? 'bg-[#f5c518] border-[#f5c518] text-black'
                    : 'bg-[#111] border-[#1e1e1e] text-[#888]'
                }`}
                title="Edit mode"
              >
                <Edit3 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-2.5 py-4 grid grid-cols-4 gap-2.5 pb-32 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square rounded-2xl animate-pulse bg-[#111] border border-[#1e1e1e]"
            />
          ))
        ) : visibleBeats.length === 0 ? (
          <div className="col-span-4 md:col-span-5 lg:col-span-6 text-center py-16 text-[#444]">
            <Flame size={58} className="mx-auto mb-3 text-[#222]" />

            <div className="font-display text-xl text-[#333]">
              No exclusives live
            </div>

            <div className="text-xs text-[#555] mt-1">
              Exclusives only show when the Exclusive toggle is ON.
            </div>
          </div>
        ) : (
          visibleBeats.map((beat) => (
            <ExclusiveCard
              key={beat.id}
              beat={beat}
              isCurrentlyPlaying={audio.currentBeat?.id === beat.id && audio.isPlaying}
              isCurrentBeat={audio.currentBeat?.id === beat.id}
              isAdmin={isAdmin}
              adminEditMode={adminEditMode}
              deleting={deletingId === beat.id}
              onPlay={() => handlePlay(beat)}
              onQueue={() => handleQueueFromBeat(beat)}
              onBuy={() => handleBuy(beat)}
              onAddToBox={() => handleAddToBox(beat)}
              onDownload={() => handleDownload(beat)}
              onShare={() => handleShare(beat)}
              onPopOut={() => handlePopOut(beat)}
              onEdit={() => handleEdit(beat)}
              onDelete={() => handleDelete(beat)}
            />
          ))
        )}
      </div>

      {showBuy && selectedBeat && (
        <BuyModal
          beat={selectedBeat}
          onClose={() => {
            setShowBuy(false);
            setSelectedBeat(null);
          }}
        />
      )}

      {showDetail && selectedBeat && (
        <BeatDetailModal
          beat={selectedBeat}
          allBeats={visibleBeats}
          onClose={() => {
            setShowDetail(false);
            setSelectedBeat(null);
          }}
          onBuy={() => {
            setShowDetail(false);
            setShowBuy(true);
          }}
        />
      )}

      {showUpload && selectedBeat && (
        <BeatUploadModal
          beat={selectedBeat}
          onClose={closeUpload}
          onSave={async () => {
            closeUpload();
            await fetchExclusives();
            refreshContent();
          }}
        />
      )}
    </div>
  );
}

function ExclusiveCard({
  beat,
  isCurrentlyPlaying,
  isCurrentBeat,
  isAdmin,
  adminEditMode,
  deleting,
  onPlay,
  onQueue,
  onBuy,
  onAddToBox,
  onDownload,
  onShare,
  onPopOut,
  onEdit,
  onDelete,
}: {
  beat: Beat;
  isCurrentlyPlaying: boolean;
  isCurrentBeat: boolean;
  isAdmin: boolean;
  adminEditMode: boolean;
  deleting: boolean;
  onPlay: () => void;
  onQueue: () => void;
  onBuy: () => void;
  onAddToBox: () => void;
  onDownload: () => void;
  onShare: () => void;
  onPopOut: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const releaseAllowed = Boolean(beat.release_download) || Boolean(beat.is_free) || isAdmin;
  const primaryTag =
    splitTags(beat.genre)[0] ||
    splitTags(beat.style)[0] ||
    splitTags(beat.type)[0] ||
    'Exclusive';
  const secondaryTags = [
    ...splitTags(beat.style),
    ...splitTags(beat.type),
    ...splitTags(beat.vibe),
  ].slice(0, 3);

  return (
    <div
      id={`exclusive-${beat.id}`}
      className={`beat-card group relative overflow-hidden cursor-pointer rounded-2xl border transition-all ${
        isCurrentBeat
          ? 'border-[#f5c518]/70 shadow-[0_0_26px_rgba(245,197,24,0.22)]'
          : 'border-[#1e1e1e] hover:border-[#f5c518]/35'
      } ${beat.hidden ? 'opacity-60' : ''}`}
      onClick={onPopOut}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-[#0d0d0d]">
        <img
          src={getCover(beat)}
          alt={beat.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#f5c518] text-black uppercase tracking-wide flex items-center gap-0.5">
            <Flame size={8} />
            {primaryTag}
          </span>

          {beat.sold && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-600 text-white uppercase tracking-wide flex items-center gap-0.5">
              <Lock size={7} />
              SOLD
            </span>
          )}

          {isAdmin && beat.hidden && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#333] text-white uppercase tracking-wide">
              HIDDEN
            </span>
          )}
        </div>

        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
          {!beat.no_sharing && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onShare();
              }}
              className="w-7 h-7 rounded-lg bg-black/70 border border-white/10 text-[#ddd] hover:text-[#f5c518] flex items-center justify-center transition-all"
              title="Share"
            >
              <Share2 size={12} />
            </button>
          )}

          <button
            onClick={(event) => {
              event.stopPropagation();
              onPopOut();
            }}
            className="w-7 h-7 rounded-lg bg-black/70 border border-white/10 text-[#ddd] hover:text-[#f5c518] flex items-center justify-center transition-all"
            title="Pop out"
          >
            <ExternalLink size={12} />
          </button>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-100 sm:opacity-0 sm:hover:opacity-100 transition-opacity"
          title={isCurrentlyPlaying ? 'Pause preview' : 'Play preview'}
        >
          <div className="w-11 h-11 rounded-full bg-[#f5c518] flex items-center justify-center shadow-xl">
            {isCurrentlyPlaying ? (
              <Pause size={18} fill="black" />
            ) : (
              <Play size={18} fill="black" className="ml-0.5" />
            )}
          </div>
        </button>

        {isAdmin && (
          <div className="absolute bottom-1.5 right-1.5 flex gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 rounded-lg bg-black/75 border border-white/10 text-[#f5c518] flex items-center justify-center"
              title="Edit"
            >
              <Edit3 size={12} />
            </button>

            {adminEditMode && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                disabled={deleting}
                className="w-7 h-7 rounded-lg bg-red-950/85 border border-red-500/30 text-red-300 flex items-center justify-center disabled:opacity-40"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-2 bg-[#0f0f0f]">
        <div className="font-display font-900 text-[10px] text-white truncate leading-tight uppercase">
          {beat.title}
        </div>

        <div className="text-[8px] text-[#777] mt-1 line-clamp-2 min-h-[22px]">
          {getPreviewText(beat)}
        </div>

        <div className="flex flex-wrap gap-1 mt-1 min-h-[17px]">
          {secondaryTags.map((tag) => (
            <span key={tag} className="tag-chip text-[8px] px-1 py-0">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1 mt-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
            title="Play / Pause"
          >
            {isCurrentlyPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onQueue();
            }}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
            title="Play from here"
          >
            <Flame size={12} />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onShare();
            }}
            disabled={beat.no_sharing}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#f5c518] disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            title="Share"
          >
            <Share2 size={12} />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onPopOut();
            }}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
            title="Pop out"
          >
            <ExternalLink size={12} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
              releaseAllowed
                ? 'bg-green-900/40 border-green-700/30 text-green-400 hover:bg-green-900/60'
                : 'bg-[#1a1a1a] border-[#222] text-[#555] hover:text-[#888]'
            }`}
            title={releaseAllowed ? 'Download' : 'Download locked'}
          >
            {releaseAllowed ? <Download size={12} /> : <Lock size={12} />}
          </button>

          {beat.sold ? (
            <div className="flex-1 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#444] text-[9px] font-bold text-center">
              Sold
            </div>
          ) : (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onBuy();
                }}
                className="flex-1 py-1.5 rounded-lg bg-[#f5c518] text-black text-[9px] font-display font-900 hover:bg-[#ffdb4a] transition-all"
              >
                ${beat.price || 30}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onAddToBox();
                }}
                className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-[#f5c518] transition-all"
                title="Add to Beat Box"
              >
                <ShoppingBag size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}