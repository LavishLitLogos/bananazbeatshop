import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Edit3,
  Filter,
  GripVertical,
  Lock,
  Pause,
  Play,
  Plus,
  Search,
  ShoppingBag,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import { requestSignedDownload, triggerBrowserDownload } from '../../services/downloadService';
import type { Beat } from '../../types';
import { BeatDetailModal } from '../modals/BeatDetailModal';
import { BeatUploadModal } from '../modals/BeatUploadModal';
import { BuyModal } from '../modals/BuyModal';
import { ShareButton } from '../ui/ShareButton';
import { canBuyBeat, canDownloadBeat, getBeatPriceLabel, isBeatFree, isBeatInBeatLab } from '../../utils/beatAccess';
import { BRAND_NAME } from '../../utils/branding';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const PLAY_ICON = '/assets/icons/play-icon.png';

type FilterKey = 'genre' | 'style' | 'type' | 'vibe' | 'mood';

type TagMap = Record<FilterKey, string[]>;

const EMPTY_TAGS: TagMap = {
  genre: [],
  style: [],
  type: [],
  vibe: [],
  mood: [],
};

const FILTER_LABELS: Record<FilterKey, string> = {
  genre: 'Genre',
  style: 'Style',
  type: 'Type',
  vibe: 'Vibe',
  mood: 'Mood',
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
    mood: [],
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

type AppSettingsProfileRow = {
  id: string;
  profile?: Record<string, unknown> | null;
};

function getBeatLabOrder(profile?: Record<string, unknown> | null) {
  const rawOrder = profile?.beatlab_order;

  if (!Array.isArray(rawOrder)) return [];

  return rawOrder.filter((value): value is string => typeof value === 'string');
}

function applyBeatLabOrder(beats: Beat[], orderIds: string[]) {
  if (!orderIds.length) return beats;

  const orderMap = new Map(orderIds.map((id, index) => [id, index]));

  return [...beats].sort((leftBeat, rightBeat) => {
    const leftIndex = orderMap.get(leftBeat.id);
    const rightIndex = orderMap.get(rightBeat.id);

    if (leftIndex != null && rightIndex != null) {
      return leftIndex - rightIndex;
    }

    if (leftIndex != null) return -1;
    if (rightIndex != null) return 1;

    return (
      new Date(rightBeat.created_at).getTime() -
      new Date(leftBeat.created_at).getTime()
    );
  });
}

function moveBeatItem(beats: Beat[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return beats;

  const nextBeats = [...beats];
  const sourceIndex = nextBeats.findIndex((beat) => beat.id === sourceId);
  const targetIndex = nextBeats.findIndex((beat) => beat.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) return beats;

  const [movedBeat] = nextBeats.splice(sourceIndex, 1);
  nextBeats.splice(targetIndex, 0, movedBeat);

  return nextBeats;
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
  const [draggedBeatId, setDraggedBeatId] = useState<string | null>(null);
  const [pickedBeatId, setPickedBeatId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchBeats = useCallback(async () => {
    setLoading(true);

    const [{ data, error }, settingsResult] = await Promise.all([
      supabase
        .from('beats')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('app_settings')
        .select('id, profile')
        .order('updated_at', { ascending: false })
        .limit(1),
    ]);

    if (error) {
      addToast('Could not load Beats Lab.', 'error');
      setLoading(false);
      return;
    }

    const settingsRow = (settingsResult.data?.[0] || null) as AppSettingsProfileRow | null;
    const loadedBeats = ((data || []) as Beat[]).filter((beat) =>
      isBeatInBeatLab(beat, isAdmin)
    );
    const orderedBeats = applyBeatLabOrder(
      loadedBeats,
      getBeatLabOrder(settingsRow?.profile)
    );

    setBeats(orderedBeats);
    setAllTags(buildTagMap(orderedBeats));
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats, refreshKey]);

  useEffect(() => {
    if (!reorderMode) {
      setDraggedBeatId(null);
      setPickedBeatId(null);
    }
  }, [reorderMode]);

  const saveBeatOrder = useCallback(
    async (nextBeats: Beat[]) => {
      setSavingOrder(true);

      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('id, profile')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        const settingsRow = (data?.[0] || null) as AppSettingsProfileRow | null;

        if (!settingsRow?.id) {
          throw new Error('Beat Lab settings record is missing.');
        }

        const nextProfile = {
          ...(settingsRow.profile || {}),
          beatlab_order: nextBeats.map((beat) => beat.id),
        };

        const { error: updateError } = await supabase
          .from('app_settings')
          .update({
            profile: nextProfile,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settingsRow.id);

        if (updateError) throw updateError;
      } finally {
        setSavingOrder(false);
      }
    },
    []
  );

  const commitBeatReorder = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!isAdmin || !reorderMode || sourceId === targetId) return;

      const nextBeats = moveBeatItem(beats, sourceId, targetId);

      if (nextBeats === beats) return;

      const previousBeats = beats;
      setBeats(nextBeats);
      setAllTags(buildTagMap(nextBeats));
      setDraggedBeatId(null);
      setPickedBeatId(null);

      try {
        await saveBeatOrder(nextBeats);
        addToast('Beat Lab order saved.', 'success');
      } catch (error) {
        setBeats(previousBeats);
        setAllTags(buildTagMap(previousBeats));
        const message =
          error instanceof Error ? error.message : 'Could not save Beat Lab order.';
        addToast(message, 'error');
      }
    },
    [addToast, beats, isAdmin, reorderMode, saveBeatOrder]
  );

  const handleReorderHandlePress = useCallback(
    async (beatId: string) => {
      if (!isAdmin || !reorderMode) return;

      if (!pickedBeatId) {
        setPickedBeatId(beatId);
        addToast('Beat grabbed. Tap another grip to place it there.', 'info');
        return;
      }

      if (pickedBeatId === beatId) {
        setPickedBeatId(null);
        addToast('Reorder grab canceled.', 'info');
        return;
      }

      await commitBeatReorder(pickedBeatId, beatId);
    },
    [addToast, commitBeatReorder, isAdmin, pickedBeatId, reorderMode]
  );

  useEffect(() => {
    const channel = supabase
      .channel('beatlab-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beats' },
        () => {
          fetchBeats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBeats]);

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
    if (!canBuyBeat(beat)) return;
    setSelectedBeat(beat);
    setShowBuy(true);
  };

  const handleStop = (beat: Beat) => {
    if (audio.currentBeat?.id !== beat.id) return;
    audio.stop();
  };

  const handleAddToBox = (beat: Beat) => {
    if (!canBuyBeat(beat)) return;
    addToCart(beat);
    addToast(`${beat.title} added to Beat Box.`, 'success');
  };

  const handlePopOut = (beat: Beat) => {
    setSelectedBeat(beat);
    setShowDetail(true);
  };

  const handleFreeDL = async (beat: Beat) => {
    if (!beat.audio_file_url) {
      addToast('No audio available.', 'error');
      return;
    }

    if (!beat.release_download && !isBeatFree(beat) && !isAdmin) {
      addToast('Download locked until release is approved.', 'info');
      return;
    }

    try {
      const signed = await requestSignedDownload({
        entityType: 'beat',
        entityId: beat.id,
      });
      triggerBrowserDownload(signed.url, signed.fileName || `${beat.title}.mp3`);
      addToast('Download started.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Download locked until release is approved.', 'info');
    }
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
  };

  const clearUploadState = () => {
    setShowUpload(false);
    setSelectedBeat(null);
  };

  return (
    <div className="min-h-screen industrial-room-surface">
      <div className="sticky top-0 z-40 bg-[#080808]/92 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe cracked-shell-panel console-panel mx-3 mt-3 rounded-[1.6rem]">
        <div className="flex items-center justify-between px-3 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={goBack}
              className="hardware-button p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors flex-shrink-0"
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
              <h1 className="font-display font-800 text-lg tracking-[0.02em] text-white leading-none truncate">
                Beats Lab
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {filteredBeats.length} beats - Database live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title={`${BRAND_NAME} Beats Lab`}
              text={`Browse fresh cookups from ${BRAND_NAME}.`}
            />

            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`hardware-button p-2 rounded-xl border transition-all ${
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
                  className={`hardware-button p-2 rounded-xl border transition-all ${
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
                  className={`hardware-button p-2 rounded-xl border transition-all ${
                    reorderMode
                      ? 'bg-[#f5c518] border-[#f5c518] text-black'
                      : 'bg-[#111] border-[#1e1e1e] text-[#888]'
                  }`}
                  title="Reorder mode"
                >
                  <GripVertical size={15} />
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
            <div className="flex items-center gap-2 rounded-2xl bg-[#111] border border-[#1e1e1e] px-3 py-2 console-inset-panel">
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
              <div key={key} className="space-y-1.5 console-filter-group rounded-2xl px-2 py-1.5">
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
                className="hardware-button text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 px-3 py-2 rounded-xl bg-[#111] border border-red-900/30"
              >
                <X size={12} />
                Clear filters
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2 rounded-xl bg-[#101010] border border-[#1e1e1e] px-3 py-2 text-[10px] text-[#777] console-inset-panel">
                <GripVertical size={13} className="text-[#f5c518]" />
                Reorder with the grip. Drag on desktop, or tap one grip then another on mobile.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-4 grid grid-cols-2 gap-3 pb-32 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 16 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square rounded-2xl animate-pulse bg-[#111] border border-[#1e1e1e]"
            />
          ))
        ) : filteredBeats.length === 0 ? (
          <div className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5 2xl:col-span-6 text-center py-16 text-[#444]">
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
                Upload
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
              onQueue={() => handleQueueFromBeat(beat)}
              onStop={() => handleStop(beat)}
              onBuy={() => handleBuy(beat)}
              onAddToBox={() => handleAddToBox(beat)}
              onFreeDL={() => handleFreeDL(beat)}
              isAdmin={isAdmin}
              adminEditMode={adminEditMode}
              deleting={deletingId === beat.id}
              onEdit={() => handleEdit(beat)}
              onDelete={() => handleDelete(beat)}
              onClick={() => {
                if (reorderMode) return;
                handlePopOut(beat);
              }}
              reorderMode={reorderMode}
              reorderPicked={pickedBeatId === beat.id}
              reorderDragging={draggedBeatId === beat.id}
              reorderSaving={savingOrder}
              onReorderHandlePress={() => handleReorderHandlePress(beat.id)}
              onReorderDrop={(sourceId) => commitBeatReorder(sourceId, beat.id)}
              onDragStart={() => setDraggedBeatId(beat.id)}
              onDragEnd={() => setDraggedBeatId(null)}
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
  onQueue,
  onStop,
  onBuy,
  onAddToBox,
  onFreeDL,
  isAdmin,
  adminEditMode,
  deleting,
  onEdit,
  onDelete,
  onClick,
  reorderMode,
  reorderPicked,
  reorderDragging,
  reorderSaving,
  onReorderHandlePress,
  onReorderDrop,
  onDragStart,
  onDragEnd,
}: {
  beat: Beat;
  isCurrentlyPlaying: boolean;
  isCurrentBeat: boolean;
  onQueue: () => void;
  onStop: () => void;
  onBuy: () => void;
  onAddToBox: () => void;
  onFreeDL: () => void;
  isAdmin: boolean;
  adminEditMode: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  reorderMode: boolean;
  reorderPicked: boolean;
  reorderDragging: boolean;
  reorderSaving: boolean;
  onReorderHandlePress: () => void;
  onReorderDrop: (sourceId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const downloadEnabled = canDownloadBeat(beat, isAdmin);
  const primaryTag =
    splitTags(beat.genre)[0] ||
    splitTags(beat.style)[0] ||
    splitTags(beat.type)[0] ||
    'Beat';
  const secondaryTags = [
    ...splitTags(beat.style),
    ...splitTags(beat.type),
    ...splitTags(beat.vibe),
    ...splitTags(beat.mood),
  ].slice(0, 3);

  return (
    <div
      className={`beat-card group relative overflow-hidden cursor-pointer rounded-2xl border transition-all ${
        isCurrentBeat
          ? 'border-[#f5c518]/60 shadow-[0_0_22px_rgba(245,197,24,0.18)]'
          : 'border-[#1e1e1e] hover:border-[#f5c518]/30'
      } ${beat.hidden ? 'opacity-60' : ''} ${
        reorderPicked ? 'ring-2 ring-[#f5c518] ring-offset-2 ring-offset-black' : ''
      } ${reorderDragging ? 'opacity-75 scale-[0.98]' : ''} ${
        reorderMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      onClick={onClick}
      draggable={reorderMode}
      onDragStart={(event) => {
        if (!reorderMode) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', beat.id);
        onDragStart();
      }}
      onDragOver={(event) => {
        if (!reorderMode) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        if (!reorderMode) return;
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/plain');
        if (sourceId) {
          onReorderDrop(sourceId);
        }
      }}
      onDragEnd={() => {
        if (!reorderMode) return;
        onDragEnd();
      }}
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-[#0d0d0d]">
        <img
          src={getCover(beat)}
          alt={beat.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/35" />

        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#f5c518] text-black tracking-[0.04em]">
            {primaryTag}
          </span>

          {beat.sold && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-600 text-white tracking-[0.04em] flex items-center gap-0.5">
              <Lock size={7} />
              Sold
            </span>
          )}

          {downloadEnabled && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-500 text-black tracking-[0.04em]">
              Dl
            </span>
          )}

          {isAdmin && beat.hidden && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#333] text-white tracking-[0.04em]">
              Hidden
            </span>
          )}
        </div>

        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
          {isAdmin && reorderMode && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                void onReorderHandlePress();
              }}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                reorderPicked
                  ? 'bg-[#f5c518] border-[#f5c518] text-black'
                  : 'bg-black/78 border-white/10 text-[#f5c518] hover:border-[#f5c518]/50'
              }`}
              title={reorderSaving ? 'Saving order...' : 'Grab to reorder'}
              aria-label={reorderSaving ? 'Saving beat order' : 'Grab beat to reorder'}
            >
              <GripVertical size={12} />
            </button>
          )}

          <ShareButton
            small
            title={beat.title}
            text={`Check out "${beat.title}" by ${BRAND_NAME}`}
            className="bg-black/70 border border-white/10 text-[#ddd] hover:text-[#f5c518]"
          />
        </div>

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
        <div className="font-display font-800 text-[13px] text-white truncate leading-tight tracking-[0.01em]">
          {beat.title}
        </div>

        <div className="text-[10px] text-[#909090] mt-1.5 line-clamp-2 min-h-[30px] leading-relaxed">
          {getPlayText(beat)}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2 min-h-[22px]">
          {secondaryTags.map((tag) => (
            <span key={tag} className="tag-chip text-[9px] px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onQueue();
            }}
            className="h-10 px-2 rounded-xl bg-[#171717] border border-white/5 text-[#9a9a9a] hover:text-[#f5c518] hover:border-[#f5c518]/20 transition-all flex items-center justify-center"
            title="Play / Pause"
          >
            {isCurrentlyPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onStop();
            }}
            disabled={!isCurrentBeat}
            className="h-10 px-2 rounded-xl bg-[#171717] border border-white/5 text-[#9a9a9a] hover:text-[#f5c518] hover:border-[#f5c518]/20 disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            title="Stop"
          >
            <Square size={12} fill="currentColor" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2.5 gap-1.5">
          {downloadEnabled ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onFreeDL();
              }}
              className="w-9 h-9 rounded-xl bg-green-900/30 border border-green-700/30 text-green-400 hover:bg-green-900/50 transition-all flex items-center justify-center"
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
              className="w-9 h-9 rounded-xl bg-[#171717] border border-[#222] text-[#555] hover:text-[#888] transition-all flex items-center justify-center"
              title="Download locked"
            >
              <Lock size={12} />
            </button>
          )}

          {beat.sold ? (
            <div className="flex-1 h-9 rounded-xl bg-[#171717] border border-[#222] text-[#444] text-[10px] font-bold text-center flex items-center justify-center tracking-[0.04em]">
              Sold
            </div>
          ) : isBeatFree(beat) ? (
            <div className="flex-1 h-9 rounded-xl bg-green-900/20 border border-green-700/30 text-green-400 text-[10px] font-bold text-center flex items-center justify-center tracking-[0.04em]">
              {getBeatPriceLabel(beat)}
            </div>
          ) : (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onBuy();
                }}
                className="flex-1 h-9 rounded-xl bg-[#f5c518] text-black text-[11px] font-display font-900 hover:bg-[#ffdb4a] transition-all tracking-[0.02em]"
              >
                {getBeatPriceLabel(beat)}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onAddToBox();
                }}
                className="w-9 h-9 rounded-xl bg-[#171717] border border-white/5 text-[#888] hover:text-[#f5c518] hover:border-[#f5c518]/20 transition-all flex items-center justify-center"
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


