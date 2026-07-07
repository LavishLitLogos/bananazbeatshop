import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Download,
  ExternalLink,
  Grip,
  Image as ImageIcon,
  Music4,
  Pause,
  Play,
  Plus,
  Save,
  Share2,
  ShoppingBag,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import { uploadBananazRoomFile } from '../../services/uploadService';

type LayoutMode = 'grid-3' | 'grid-4' | 'free';
type MediaKind = 'audio' | 'image' | 'video' | 'file';

type BananazRoomItem = {
  id: string;
  title: string;
  description: string;
  extraInfo: string;
  url: string;
  mediaType: MediaKind;
  previewImage?: string;
  price: number;
  isFree: boolean;
  hidden: boolean;
  approved: boolean;
  sold: boolean;
  releaseDownload: boolean;
  x: number;
  y: number;
  sortOrder: number;
  createdAt: string;
};

type BananazRoomItemRow = {
  id: string;
  title: string;
  description: string | null;
  extra_info: string | null;
  media_url: string;
  media_type: MediaKind;
  preview_image_url: string | null;
  price: number | string | null;
  is_free: boolean | null;
  hidden: boolean | null;
  approved: boolean | null;
  sold: boolean | null;
  release_download: boolean | null;
  position_x: number | string | null;
  position_y: number | string | null;
  sort_order: number | null;
  created_at: string;
};

type UploadDraft = Omit<BananazRoomItem, 'id' | 'x' | 'y' | 'sortOrder' | 'createdAt'>;

const STORAGE_KEY = 'bananaz.room.state.v1';
const FALLBACK_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

function createFallbackState() {
  return {
    layoutMode: 'grid-3' as LayoutMode,
    items: [] as BananazRoomItem[],
  };
}

function readFallbackState() {
  if (typeof window === 'undefined') return createFallbackState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFallbackState();
    const parsed = JSON.parse(raw) as { layoutMode?: LayoutMode; items?: BananazRoomItem[] };

    return {
      layoutMode:
        parsed.layoutMode === 'grid-4' || parsed.layoutMode === 'free' || parsed.layoutMode === 'grid-3'
          ? parsed.layoutMode
          : 'grid-3',
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return createFallbackState();
  }
}

function writeFallbackState(layoutMode: LayoutMode, items: BananazRoomItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ layoutMode, items }));
}

function inferMediaKind(file: File): MediaKind {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function getCover(item: BananazRoomItem) {
  return item.previewImage || FALLBACK_LOGO;
}

function mapItemRow(row: BananazRoomItemRow): BananazRoomItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    extraInfo: row.extra_info || '',
    url: row.media_url,
    mediaType: row.media_type,
    previewImage: row.preview_image_url || undefined,
    price: Number(row.price || 0),
    isFree: Boolean(row.is_free),
    hidden: Boolean(row.hidden),
    approved: row.approved !== false,
    sold: Boolean(row.sold),
    releaseDownload: Boolean(row.release_download),
    x: Number(row.position_x || 0),
    y: Number(row.position_y || 0),
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
  };
}

function mapDraftToInsert(draft: UploadDraft, sortOrder: number, x: number, y: number) {
  return {
    title: draft.title,
    description: draft.description,
    extra_info: draft.extraInfo,
    media_url: draft.url,
    media_type: draft.mediaType,
    preview_image_url: draft.previewImage || '',
    price: draft.isFree ? 0 : draft.price,
    is_free: draft.isFree,
    hidden: draft.hidden,
    approved: draft.approved,
    sold: draft.sold,
    release_download: draft.isFree ? true : draft.releaseDownload,
    position_x: x,
    position_y: y,
    sort_order: sortOrder,
  };
}

export function BananazRoom() {
  const { goBack, isAdmin, addToast } = useApp();
  const audio = useAudio();
  const freeCanvasRef = useRef<HTMLDivElement | null>(null);
  const dragMovedRef = useRef(false);
  const itemsRef = useRef<BananazRoomItem[]>(readFallbackState().items);
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(readFallbackState().layoutMode);
  const [items, setItems] = useState<BananazRoomItem[]>(() => readFallbackState().items);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BananazRoomItem | null>(null);
  const [draggingState, setDraggingState] = useState<{
    itemId: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const syncFallback = useCallback((nextLayoutMode: LayoutMode, nextItems: BananazRoomItem[]) => {
    writeFallbackState(nextLayoutMode, nextItems);
  }, []);

  const loadRoom = useCallback(async () => {
    setLoading(true);

    const fallback = readFallbackState();

    const [settingsRes, itemsRes] = await Promise.all([
      supabase.from('bananaz_room_settings').select('id,layout_mode').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('bananaz_room_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    ]);

    if (itemsRes.error) {
      setUsingFallback(true);
      setLayoutModeState(fallback.layoutMode);
      setItems(fallback.items);
      setLoading(false);
      return;
    }

    const nextLayoutMode = settingsRes.error
      ? fallback.layoutMode
      : settingsRes.data?.layout_mode || fallback.layoutMode;
    const nextItems = ((itemsRes.data || []) as BananazRoomItemRow[]).map(mapItemRow);

    setUsingFallback(false);
    setSettingsId(settingsRes.error ? null : settingsRes.data?.id || null);
    setLayoutModeState(nextLayoutMode);
    setItems(nextItems);
    syncFallback(nextLayoutMode, nextItems);
    setLoading(false);
  }, [syncFallback]);

  useEffect(() => {
    loadRoom();

    const channel = supabase
      .channel('bananaz-room-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bananaz_room_items' }, loadRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bananaz_room_settings' }, loadRoom)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRoom]);

  const visibleItems = useMemo(
    () => items.filter((item) => isAdmin || (!item.hidden && item.approved)),
    [isAdmin, items]
  );

  const persistLayoutMode = async (nextLayoutMode: LayoutMode) => {
    setLayoutModeState(nextLayoutMode);
    syncFallback(nextLayoutMode, items);

    if (usingFallback) return;

    if (settingsId) {
      const { error } = await supabase
        .from('bananaz_room_settings')
        .update({ layout_mode: nextLayoutMode })
        .eq('id', settingsId);

      if (error) {
        addToast('Layout save failed. Keeping your local room setup.', 'error');
        setUsingFallback(true);
      }
      return;
    }

    const { data, error } = await supabase
      .from('bananaz_room_settings')
      .insert({ layout_mode: nextLayoutMode })
      .select('id')
      .single();

    if (error) {
      addToast('Layout save failed. Keeping your local room setup.', 'error');
      setUsingFallback(true);
      return;
    }

    setSettingsId((data as { id: string }).id);
  };

  const handlePlay = (item: BananazRoomItem) => {
    if (item.mediaType !== 'audio') return;

    const playable = visibleItems
      .filter((entry) => entry.mediaType === 'audio')
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        audio_file_url: entry.url,
        cover_art_url: getCover(entry),
        description: entry.description,
        artist_name: 'ThisBeatIzBananaz',
      }));

    const index = playable.findIndex((entry) => entry.id === item.id);

    if (audio.currentBeat?.id === item.id) {
      if (audio.isPlaying) {
        audio.pause();
      } else {
        audio.resume();
      }
      return;
    }

    if (index >= 0) {
      audio.playQueue(playable as any, index, false);
    }
  };

  const handleShare = async (item: BananazRoomItem) => {
    const url = `${window.location.origin}${window.location.pathname}#bananaz-room-${item.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: item.description || 'Check out this drop in Bananaz Room.',
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Room link copied.', 'success');
    } catch {
      addToast('Share failed.', 'error');
    }
  };

  const handleDownload = (item: BananazRoomItem) => {
    if (!item.url) return;

    if (!item.isFree && !item.releaseDownload && !isAdmin) {
      addToast('Download stays locked until release is enabled.', 'info');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.download = item.title || 'bananaz-room-item';
    anchor.rel = 'noopener';
    anchor.click();
  };

  const handlePurchase = async (item: BananazRoomItem) => {
    if (item.isFree || item.price <= 0 || item.sold) return;

    const buyerName = window.prompt('Name for the order:');
    if (!buyerName?.trim()) return;
    const buyerEmail = window.prompt('Email for delivery/release:');
    if (!buyerEmail?.trim()) return;

    const { error } = await supabase.from('orders').insert({
      beat_name: item.title,
      beat_thumbnail: getCover(item),
      buyer_name: buyerName.trim(),
      buyer_email: buyerEmail.trim(),
      payment_method: 'Bananaz Room Request',
      amount: Number(item.price || 0),
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      payment_received: false,
    });

    if (error) {
      addToast('Purchase request failed.', 'error');
      return;
    }

    addToast('Purchase request sent.', 'success');
  };

  const updateItemsState = (nextItems: BananazRoomItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    syncFallback(layoutMode, nextItems);
  };

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, itemId: string) => {
    if (!isAdmin || layoutMode !== 'free') return;

    const item = items.find((entry) => entry.id === itemId);
    const rect = freeCanvasRef.current?.getBoundingClientRect();
    if (!item || !rect) return;

    dragMovedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingState({
      itemId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - item.x,
      offsetY: event.clientY - rect.top - item.y,
    });
  };

  useEffect(() => {
    if (!draggingState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!freeCanvasRef.current || event.pointerId !== draggingState.pointerId) return;

      const rect = freeCanvasRef.current.getBoundingClientRect();
      const x = Math.max(0, event.clientX - rect.left - draggingState.offsetX);
      const y = Math.max(0, event.clientY - rect.top - draggingState.offsetY);
      dragMovedRef.current = true;

      setItems((currentItems) => {
        const nextItems = currentItems.map((item) => (
          item.id === draggingState.itemId ? { ...item, x, y } : item
        ));
        itemsRef.current = nextItems;
        syncFallback(layoutMode, nextItems);
        return nextItems;
      });
    };

    const handlePointerUp = async (event: PointerEvent) => {
      if (event.pointerId !== draggingState.pointerId) return;

      const draggedItem = itemsRef.current.find((item) => item.id === draggingState.itemId);
      setDraggingState(null);

      if (!draggedItem || usingFallback) return;

      const { error } = await supabase
        .from('bananaz_room_items')
        .update({
          position_x: draggedItem.x,
          position_y: draggedItem.y,
        })
        .eq('id', draggedItem.id);

      if (error) {
        addToast('Position save failed. Keeping your local room setup.', 'error');
        setUsingFallback(true);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [addToast, draggingState, layoutMode, syncFallback, usingFallback]);

  const handleSaveUpload = async (draft: UploadDraft) => {
    const x = 24 + items.length * 12;
    const y = 24 + items.length * 12;
    const sortOrder = items.length;

    if (usingFallback) {
      addToast('Bananaz Room is not connected to live storage right now. Fix the live room table/bucket path first.', 'error');
      return;
    }

    const payload = mapDraftToInsert(draft, sortOrder, x, y);
    const { data, error } = await supabase
      .from('bananaz_room_items')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      addToast(error.message || 'Room save failed.', 'error');
      return;
    }

    const inserted = mapItemRow(data as BananazRoomItemRow);
    updateItemsState([inserted, ...items]);
    setShowUpload(false);
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-[#080808]/95 backdrop-blur-xl pt-safe">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-xl uppercase tracking-wide text-white leading-none">
                Bananaz Room
              </h1>
              <p className="text-[10px] text-[#666] mt-1">
                Freeform drops, media, packs, and side missions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => persistLayoutMode('grid-3')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em] border ${layoutMode === 'grid-3' ? 'bg-[#f5c518] text-black border-[#f5c518]' : 'bg-[#111] border-[#1e1e1e] text-[#aaa]'}`}
                >
                  3x3
                </button>
                <button
                  onClick={() => persistLayoutMode('grid-4')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em] border ${layoutMode === 'grid-4' ? 'bg-[#f5c518] text-black border-[#f5c518]' : 'bg-[#111] border-[#1e1e1e] text-[#aaa]'}`}
                >
                  4x4
                </button>
                <button
                  onClick={() => persistLayoutMode('free')}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em] border ${layoutMode === 'free' ? 'bg-[#f5c518] text-black border-[#f5c518]' : 'bg-[#111] border-[#1e1e1e] text-[#aaa]'}`}
                >
                  Free
                </button>
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  + Upload
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-32">
        {loading ? (
          <div className="rounded-[1.8rem] border border-[#1d1d1d] bg-[#101010] px-4 py-16 text-center text-sm text-[#666]">
            Loading Bananaz Room...
          </div>
        ) : layoutMode === 'free' ? (
          <div
            ref={freeCanvasRef}
            className="relative min-h-[72vh] rounded-[2rem] border border-[#1d1d1d] bg-[#0f0f0f] overflow-hidden"
          >
            {visibleItems.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[#666]">
                Nothing live in Bananaz Room yet.
              </div>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.id}
                  id={`bananaz-room-${item.id}`}
                  type="button"
                  onPointerDown={(event) => beginDrag(event, item.id)}
                  onClick={() => {
                    if (dragMovedRef.current) {
                      dragMovedRef.current = false;
                      return;
                    }
                    setSelectedItem(item);
                  }}
                  className="absolute w-40 overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#111] text-left shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
                  style={{ left: item.x, top: item.y }}
                >
                  <RoomTile item={item} isPlaying={audio.currentBeat?.id === item.id && audio.isPlaying} onPlay={handlePlay} onShare={handleShare} draggable={isAdmin && layoutMode === 'free'} />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className={`grid gap-3 ${layoutMode === 'grid-4' ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {visibleItems.length === 0 ? (
              <div className={`rounded-[1.8rem] border border-dashed border-[#242424] px-4 py-16 text-center text-sm text-[#666] ${layoutMode === 'grid-4' ? 'col-span-4' : 'col-span-3'}`}>
                Nothing live in Bananaz Room yet.
              </div>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.id}
                  id={`bananaz-room-${item.id}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#111] text-left"
                >
                  <RoomTile item={item} isPlaying={audio.currentBeat?.id === item.id && audio.isPlaying} onPlay={handlePlay} onShare={handleShare} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {showUpload && (
        <BananazRoomUploadModal
          onClose={() => setShowUpload(false)}
          onSave={handleSaveUpload}
        />
      )}

      {selectedItem && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelectedItem(null)}>
          <div className="modal-box max-w-md w-full p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-900 text-2xl uppercase text-white leading-none">
                  {selectedItem.title}
                </div>
                <div className="text-sm text-[#f5c518] mt-1">
                  {selectedItem.isFree ? 'Free' : `$${selectedItem.price || 0}`}
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl bg-white/5 text-[#888] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="aspect-square rounded-3xl overflow-hidden bg-black border border-[#222] flex items-center justify-center">
              {selectedItem.mediaType === 'image' && <img src={selectedItem.url} alt={selectedItem.title} className="w-full h-full object-cover" />}
              {selectedItem.mediaType === 'video' && <video src={selectedItem.url} className="w-full h-full object-cover" controls />}
              {selectedItem.mediaType === 'audio' && <img src={getCover(selectedItem)} alt={selectedItem.title} className="w-full h-full object-cover" />}
              {selectedItem.mediaType === 'file' && <div className="text-center text-[#d2d2d2] px-6"><Download size={28} className="mx-auto mb-3 text-[#f5c518]" />File drop ready.</div>}
            </div>

            {(selectedItem.description || selectedItem.extraInfo) && (
              <div className="space-y-2">
                {selectedItem.description && <p className="text-sm text-[#aaa] leading-relaxed">{selectedItem.description}</p>}
                {selectedItem.extraInfo && <p className="text-xs text-[#666] leading-relaxed">{selectedItem.extraInfo}</p>}
              </div>
            )}

            <div className={`grid gap-2 ${selectedItem.mediaType === 'audio' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {selectedItem.mediaType === 'audio' && (
                <button onClick={() => handlePlay(selectedItem)} className="btn-gold py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                  {audio.currentBeat?.id === selectedItem.id && audio.isPlaying ? <Pause size={15} fill="black" /> : <Play size={15} fill="black" />}
                </button>
              )}

              <button onClick={() => handleDownload(selectedItem)} className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                <Download size={15} />
                DL
              </button>

              {!selectedItem.isFree && selectedItem.price > 0 && !selectedItem.sold && (
                <button onClick={() => handlePurchase(selectedItem)} className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                  <ShoppingBag size={15} />
                  Buy
                </button>
              )}

              <button onClick={() => handleShare(selectedItem)} className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                <Share2 size={15} />
                Share
              </button>

              {selectedItem.mediaType !== 'audio' && (
                <button onClick={() => window.open(selectedItem.url, '_blank', 'noopener,noreferrer')} className="btn-dark py-3 rounded-2xl text-sm flex items-center justify-center gap-2">
                  <ExternalLink size={15} />
                  Open
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomTile({
  item,
  isPlaying,
  onPlay,
  onShare,
  draggable = false,
}: {
  item: BananazRoomItem;
  isPlaying: boolean;
  onPlay: (item: BananazRoomItem) => void;
  onShare: (item: BananazRoomItem) => void;
  draggable?: boolean;
}) {
  return (
    <>
      <div className="relative aspect-square overflow-hidden bg-black">
        {item.mediaType === 'image' ? (
          <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
        ) : item.mediaType === 'video' ? (
          <video src={item.url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <img src={getCover(item)} alt={item.title} className="w-full h-full object-cover" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />

        {draggable && (
          <div className="absolute top-2 left-2 rounded-full bg-black/70 p-1.5 text-white">
            <Grip size={12} />
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          {item.mediaType === 'audio' && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPlay(item);
              }}
              className="w-8 h-8 rounded-full bg-[#f5c518] text-black flex items-center justify-center"
            >
              {isPlaying ? <Pause size={13} fill="black" /> : <Play size={13} fill="black" className="ml-0.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShare(item);
            }}
            className="w-8 h-8 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center"
          >
            <Share2 size={12} />
          </button>
        </div>

        <div className="absolute left-2 bottom-2 rounded-full bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#f5c518]">
          {item.isFree ? 'Free' : `$${item.price || 0}`}
        </div>
      </div>

      <div className="p-3">
        <div className="font-display text-[12px] font-800 text-white truncate">
          {item.title}
        </div>
        <div className="mt-1 text-[10px] text-[#777] line-clamp-2 min-h-[28px]">
          {item.description || 'Bananaz Room drop.'}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#888]">
          {item.mediaType === 'audio' && <Music4 size={12} />}
          {item.mediaType === 'image' && <ImageIcon size={12} />}
          {item.mediaType === 'video' && <Video size={12} />}
          {item.mediaType === 'file' && <Download size={12} />}
          <span className="truncate">{item.mediaType}</span>
        </div>
      </div>
    </>
  );
}

function BananazRoomUploadModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (draft: UploadDraft) => Promise<void>;
}) {
  const { addToast } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [price, setPrice] = useState('0');
  const [isFree, setIsFree] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [approved, setApproved] = useState(true);
  const [sold, setSold] = useState(false);
  const [releaseDownload, setReleaseDownload] = useState(true);
  const [url, setUrl] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [mediaType, setMediaType] = useState<MediaKind>('file');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      addToast('File is over the 2GB Bananaz Room cap.', 'error');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const kind = inferMediaKind(file);
      setMediaType(kind);

      const uploaded = await uploadBananazRoomFile(file, {
        mediaRole: 'bananaz_room',
        relatedTable: 'bananaz_room_items',
      });
      setUrl(uploaded.url);

      if (kind !== 'audio') {
        setPreviewImage(uploaded.url);
      }

      addToast('Bananaz Room file uploaded.', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Bananaz Room upload failed.';
      setUploadError(message);
      addToast(message, 'error');
    }

    setUploading(false);
  };

  const save = async () => {
    if (!title.trim()) {
      addToast('Title required.', 'error');
      return;
    }

    if (!url.trim()) {
      addToast('Upload a file first.', 'error');
      return;
    }

    setSaving(true);

    await onSave({
      title: title.trim(),
      description: description.trim(),
      extraInfo: extraInfo.trim(),
      url: url.trim(),
      mediaType,
      previewImage: previewImage.trim() || undefined,
      price: isFree ? 0 : Number(price || 0),
      isFree,
      hidden,
      approved,
      sold,
      releaseDownload: isFree ? true : releaseDownload,
    });

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/86 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0d0d0d] border border-[#f5c518]/20 shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-[#1a1a1a] flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-display font-900 text-white uppercase tracking-wide">
              New Bananaz Room Drop
            </div>
            <div className="text-[10px] text-[#666]">
              Media uploads save through secure storage.
            </div>
          </div>

          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 text-[#888] hover:text-white flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#777]">Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none" />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#777]">Price</span>
              <input value={price} onChange={(event) => setPrice(event.target.value)} className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none" />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#777]">Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full min-h-[88px] bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" />
          </label>

          <label className="space-y-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#777]">Extra Info</span>
            <textarea value={extraInfo} onChange={(event) => setExtraInfo(event.target.value)} className="w-full min-h-[72px] bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" />
          </label>

          <div className="rounded-2xl border border-[#1e1e1e] bg-black/30 p-3">
            <label className="btn-dark inline-flex cursor-pointer px-4 py-3 rounded-xl text-sm items-center gap-2">
              <Plus size={14} />
              {uploading ? 'Uploading...' : 'Attach File'}
              <input type="file" className="hidden" onChange={handleFile} />
            </label>

            <div className="mt-3 text-xs text-[#777]">
              {url ? 'File attached and ready.' : 'Attach a file to continue.'}
            </div>

            {uploadError && (
              <div className="mt-3 rounded-xl border border-red-900/35 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                {uploadError}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle label="Free" active={isFree} onClick={() => setIsFree((value) => !value)} />
            <Toggle label="Approved" active={approved} onClick={() => setApproved((value) => !value)} />
            <Toggle label="Hidden" active={hidden} onClick={() => setHidden((value) => !value)} />
            <Toggle label="Sold" active={sold} onClick={() => setSold((value) => !value)} />
            <Toggle label="Release DL" active={releaseDownload} onClick={() => setReleaseDownload((value) => !value)} />
          </div>

          <button onClick={save} disabled={saving || uploading} className="btn-gold w-full py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Drop'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-all ${
        active ? 'border-[#f5c518] bg-[#f5c518]/10 text-[#f5c518]' : 'border-[#1e1e1e] bg-[#111] text-[#888]'
      }`}
    >
      {label}
    </button>
  );
}
