import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  Lock,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
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
const PLAY_ICON = '/assets/icons/play-icon.png';

type FilterKey = 'genre' | 'style' | 'type' | 'vibe';

type TagMap = Record<FilterKey, string[]>;

const EMPTY_TAGS: TagMap = {
  genre: [],
  style: [],
  type: [],
  vibe: [],
};

const FILTER_LABELS: Record<FilterKey, string> = {
  genre: 'Genre',
  style: 'Style',
  type: 'Type',
  vibe: 'Vibe',
};

function splitTags(value?: string | null) {
  if (!value) return [];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function getBeatUrl(beat: Beat) {
  return `${window.location.origin}${window.location.pathname}#beat-${beat.id}`;
}

function getCover(beat: Beat) {
  return beat.cover_art_url || MAIN_LOGO;
}

function getPlayText(beat: Beat) {
  return (
    beat.description ||
    beat.artist_suggestion ||
    beat.mood ||
    beat.vibe ||
    'Tap in and hear this cookup.'
  );
}

function buildTagMap(beats: Beat[]) {
  const nextTags: TagMap = {
    genre: [],
    style: [],
    type: [],
    vibe: [],
  };

  beats.forEach((beat) => {
    (Object.keys(nextTags) as FilterKey[]).forEach((key) => {
      splitTags((beat as any)[key]).forEach((tag) => {
        const exists = nextTags[key].some(
          (item) => normalizeTag(item) === normalizeTag(tag)
        );

        if (!exists) {
          nextTags[key].push(tag);
        }
      });
    });
  });

  (Object.keys(nextTags) as FilterKey[]).forEach((key) => {
    nextTags[key].sort((a, b) => a.localeCompare(b));
  });

  return nextTags;
}

export function BeatLabRoom() {
  const {
    goBack,
    isAdmin,
    addToCart,
    addToast,
    adminEditMode,
    setAdminEditMode,
    reorderMode,
    setReorderMode,
    refreshContent,
    refreshKey,
  } = useApp();

  const audio = useAudio();

  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allTags, setAllTags] = useState<TagMap>(EMPTY_TAGS);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBeats = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('beats')
      .select('*')
      .eq('is_free', false)
      .eq('exclusive', false)
      .eq('bananaz_exclusive', false)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query
        .eq('admin_approved', true)
        .eq('hidden', false);
    }

    const { data, error } = await query;

    if (error) {
      addToast('Could not load Beats Lab.', 'error');
      setLoading(false);
      return;
    }

    const loadedBeats = (data || []) as Beat[];

    setBeats(loadedBeats);
    setAllTags(buildTagMap(loadedBeats));
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('beatlab-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beats' },
        () => {
          fetchBeats();
          refreshContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBeats, refreshContent]);

  const filteredBeats = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return beats.filter((beat) => {
      const haystack = [
        beat.title,
        beat.genre,
        beat.style,
        beat.type,
        beat.vibe,
        beat.mood,
        beat.description,
        beat.artist_suggestion,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (search && !haystack.includes(search)) return false;

      return (Object.entries(activeFilters) as [FilterKey, string][]).every(
        ([key, value]) =>
          splitTags((beat as any)[key]).some(
            (tag) => normalizeTag(tag) === normalizeTag(value)
          )
      );
    });
  }, [activeFilters, beats, searchTerm]);

  const toggleFilter = (key: FilterKey, value: string) => {
    setActiveFilters((currentFilters) => {
      if (currentFilters[key] === value) {
        const nextFilters = { ...currentFilters };
        delete nextFilters[key];
        return nextFilters;
      }

      return {
        ...currentFilters,
        [key]: value,
      };
    });
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
  };

  const handlePlay = (beat: Beat) => {
    if (!beat.audio_file_url) {
      addToast('No audio available for this beat.', 'info');
      return;
    }

    audio.play(beat, false);
  };

  const handleQueueFromBeat = (beat: Beat) => {
    const playableBeats = filteredBeats.filter((item) => item.audio_file_url);
    const index = playableBeats.findIndex((item) => item.id === beat.id);

    if (index < 0) {
      handlePlay(beat);
      return;
    }

    audio.playQueue(playableBeats, index, false);
  };

  const handleBuy = (beat: Beat) => {
    setSelectedBeat(beat);
    setShowBuy(true);
  };

  const handleAddToBox = (beat: Beat) => {
    addToCart(beat);
    addToast(`${beat.title} added to Beat Box.`, 'success');
  };

  const handleShare = async (beat: Beat) => {
    const url = getBeatUrl(beat);

    const shareData = {
      title: beat.title,
      text: `Check out "${beat.title}" on ThisBeatIzBananaz.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Beat link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast('Beat link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  const handlePopOut = (beat: Beat) => {
    setSelectedBeat(beat);
    setShowDetail(true);
  };

  const handleFreeDL = (beat: Beat) => {
    if (!beat.audio_file_url) {
      addToast('No audio available.', 'error');
      return;
    }

    if (!beat.release_download && !beat.is_free && !isAdmin) {
      addToast('Download locked until release is approved.', 'info');
      return;
    }

    const confirmed = window.confirm(
      "I wanna hear the cookup when it's ready fam! Let me know when you drop it, and I'll help promote it. We All We Got!"
    );

    if (!confirmed) return;

    const anchor = document.createElement('a');
    anchor.href = beat.audio_file_url;
    anchor.download = `${beat.title || 'thisbeatizbananaz-beat'}.mp3`;
    anchor.rel = 'noopener';
    anchor.click();

    addToast('Download started.', 'success');
  };

  const handleEdit = (beat: Beat) => {
    if (!isAdmin) return;

    setSelectedBeat(beat);
    setShowUpload(true);
  };

  const handleDelete = async (beat: Beat) => {
    if (!isAdmin || !adminEditMode) return;

    const confirmed = window.confirm(
      `Delete "${beat.title}" from Beats Lab? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(beat.id);

    const { error } = await supabase.from('beats').delete().eq('id', beat.id);

    setDeletingId(null);

    if (error) {
      addToast('Delete failed.', 'error');
      return;
    }

    addToast('Beat deleted.', 'success');
    await fetchBeats();
    refreshContent();
  };

  const clearUploadState = () => {
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
              onClick={() => window.location.hash = ''}
              className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
              aria-label="Home favicon"
            >
              <img src={MAIN_LOGO} alt="Home" className="w-full h-full object-contain" />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-lg uppercase tracking-wide text-white leading-none truncate">
                Beats Lab
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {filteredBeats.length} beats · Database live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title="ThisBeatIzBananaz Beats Lab"
              text="Browse fresh cookups from ThisBeatIzBananaz."
            />

            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`p-2 rounded-xl border transition-all ${
                showFilters
                  ? 'bg-[var(--bananaz-glow-soft)] border-[var(--bananaz-accent)] text-[var(--bananaz-accent)]'
                  : 'bg-[#111] border-[#1e1e1e] text-[#888]'
              }`}
              aria-label="Filters"
            >
              <Filter size={15} />
            </button>

            {isAdmin && (
              <>
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

                <button
                  onClick={() => setReorderMode(!reorderMode)}
                  className={`p-2 rounded-xl border transition-all ${
                    reorderMode
                      ? 'bg-[#f5c518] border-[#f5c518] text-black'
                      : 'bg-[#111] border-[#1e1e1e] text-[#888]'
                  }`}
                  title="Reorder mode"
                >
                  <SlidersHorizontal size={15} />
                </button>

                <button
                  onClick={() => {
                    setSelectedBeat(null);
                    setShowUpload(true);
                  }}
                  className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Upload
                </button>
              </>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="px-3 pb-3 space-y-3 border-t border-[#1a1a1a] pt-3">
            <div className="flex items-center gap-2 rounded-2xl bg-[#111] border border-[#1e1e1e] px-3 py-2">
              <Search size={14} className="text-[#555]" />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search beats, genre, style, type, vibe..."
                className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-[#444]"
              />
            </div>

            {(Object.keys(allTags) as FilterKey[]).map((key) =>
              allTags[key].length > 0 ? (
                <div key={key} className="space-y-1.5">
                  <div className="text-[10px] text-[#555] uppercase tracking-[0.22em]">
                    {FILTER_LABELS[key]}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {allTags[key].map((tag) => (
                      <button
                        key={`${key}-${tag}`}
                        onClick={() => toggleFilter(key, tag)}
                        className={`tag-chip ${activeFilters[key] === tag ? 'active' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            )}

            {(Object.keys(activeFilters).length > 0 || searchTerm) && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <X size={12} />
                Clear filters
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2 rounded-xl bg-[#101010] border border-[#1e1e1e] px-3 py-2 text-[10px] text-[#777]">
                <SlidersHorizontal size={13} className="text-[#f5c518]" />
                Admin tools stay hidden from buyers. Edit mode exposes delete controls.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-2.5 py-4 grid grid-cols-4 gap-2.5 pb-32 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 16 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square rounded-2xl animate-pulse bg-[#111] border border-[#1e1e1e]"
            />
          ))
        ) : filteredBeats.length === 0 ? (
          <div className="col-span-4 md:col-span-5 lg:col-span-6 text-center py-16 text-[#444]">
            <img
              src={PLAY_ICON}
              alt=""
              className="w-16 h-16 object-contain mx-auto mb-3 opacity-20"
            />

            <div className="font-display text-xl text-[#333]">
              No beats found
            </div>

            <div className="text-xs text-[#555] mt-1">
              Change filters or upload a new cookup.
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedBeat(null);
                  setShowUpload(true);
                }}
                className="btn-gold mt-4 px-6 py-3 rounded-xl text-sm"
              >
                Upload Beat
              </button>
            )}
          </div>
        ) : (
          filteredBeats.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              isCurrentlyPlaying={audio.currentBeat?.id === beat.id && audio.isPlaying}
              isCurrentBeat={audio.currentBeat?.id === beat.id}
              onPlay={() => handlePlay(beat)}
              onQueue={() => handleQueueFromBeat(beat)}
              onBuy={() => handleBuy(beat)}
              onAddToBox={() => handleAddToBox(beat)}
              onFreeDL={() => handleFreeDL(beat)}
              onShare={() => handleShare(beat)}
              onPopOut={() => handlePopOut(beat)}
              isAdmin={isAdmin}
              adminEditMode={adminEditMode}
              deleting={deletingId === beat.id}
              onEdit={() => handleEdit(beat)}
              onDelete={() => handleDelete(beat)}
              onClick={() => handlePopOut(beat)}
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
          allBeats={filteredBeats}
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

      {showUpload && (
        <BeatUploadModal
          beat={selectedBeat}
          onClose={clearUploadState}
          onSave={async () => {
            clearUploadState();
            await fetchBeats();
            refreshContent();
          }}
        />
      )}
    </div>
  );
}

function BeatCard({
  beat,
  isCurrentlyPlaying,
  isCurrentBeat,
  onPlay,
  onQueue,
  onBuy,
  onAddToBox,
  onFreeDL,
  onShare,
  onPopOut,
  isAdmin,
  adminEditMode,
  deleting,
  onEdit,
  onDelete,
  onClick,
}: {
  beat: Beat;
  isCurrentlyPlaying: boolean;
  isCurrentBeat: boolean;
  onPlay: () => void;
  onQueue: () => void;
  onBuy: () => void;
  onAddToBox: () => void;
  onFreeDL: () => void;
  onShare: () => void;
  onPopOut: () => void;
  isAdmin: boolean;
  adminEditMode: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const downloadEnabled = beat.is_free || beat.release_download || isAdmin;
  const primaryTag =
    splitTags(beat.genre)[0] ||
    splitTags(beat.style)[0] ||
    splitTags(beat.type)[0] ||
    'Beat';
  const secondaryTags = [
    ...splitTags(beat.style),
    ...splitTags(beat.type),
    ...splitTags(beat.vibe),
  ].slice(0, 3);

  return (
    <div
      className={`beat-card group relative overflow-hidden cursor-pointer rounded-2xl border transition-all ${
        isCurrentBeat
          ? 'border-[#f5c518]/60 shadow-[0_0_22px_rgba(245,197,24,0.18)]'
          : 'border-[#1e1e1e] hover:border-[#f5c518]/30'
      } ${beat.hidden ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-[#0d0d0d]">
        <img
          src={getCover(beat)}
          alt={beat.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />

        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#f5c518] text-black uppercase tracking-wide">
            {primaryTag}
          </span>

          {beat.sold && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-600 text-white uppercase tracking-wide flex items-center gap-0.5">
              <Lock size={7} />
              SOLD
            </span>
          )}

          {beat.release_download && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-500 text-black uppercase tracking-wide">
              DL
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
          title={isCurrentlyPlaying ? 'Pause' : 'Play'}
        >
          <div className="w-11 h-11 rounded-full bg-[#f5c518] flex items-center justify-center shadow-xl">
            {isCurrentlyPlaying ? (
              <Pause size={18} fill="black" />
            ) : (
              <Play size={18} fill="black" className="ml-0.5" />
            )}
          </div>
        </button>

        {isCurrentlyPlaying && (
          <div className="absolute bottom-1.5 left-1.5 flex items-end gap-[2px] h-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="waveform-bar w-[2px]"
                style={{
                  animationDelay: `${index * 0.13}s`,
                  height: '100%',
                }}
              />
            ))}
          </div>
        )}

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
          {getPlayText(beat)}
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
            <Star size={12} />
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
          {downloadEnabled ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onFreeDL();
              }}
              className="p-1.5 rounded-lg bg-green-900/40 border border-green-700/30 text-green-400 hover:bg-green-900/60 transition-all flex items-center justify-center"
              title="Download"
            >
              <Download size={12} />
            </button>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onFreeDL();
              }}
              className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] text-[#555] hover:text-[#888] transition-all flex items-center justify-center"
              title="Download locked"
            >
              <Lock size={12} />
            </button>
          )}

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