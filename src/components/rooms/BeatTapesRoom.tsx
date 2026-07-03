import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  Edit3,
  Lock,
  Pause,
  Play,
  Plus,
  Share2,
  ShoppingBag,
  SkipForward,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { BeatTape, BeatTapeTrack } from '../../types';
import { BRAND_NAME } from '../../utils/branding';
import { ShareButton } from '../ui/ShareButton';
import { uploadAudio, uploadCoverArt } from '../../services/uploadService';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const BEAT_TAPES_ICON = '/assets/icons/beattapes.png';
const MIN_TRACKS = 3;
const MAX_TRACKS = 6;
const PREVIEW_SECONDS = 45;

interface TapeWithTracks extends BeatTape {
  tracks: BeatTapeTrack[];
  release_download?: boolean;
  tape_type?: 'single' | 'album' | 'compilation';
}

interface TapeDraftTrack {
  title: string;
  url: string;
  uploading: boolean;
}

function getTapeCover(tape: TapeWithTracks) {
  return tape.cover_art_url || MAIN_LOGO;
}

function getTapeUrl(tape: TapeWithTracks) {
  return `${window.location.origin}${window.location.pathname}#tape-${tape.id}`;
}

function getTapeType(tape: TapeWithTracks | null) {
  if (!tape) return 'single';

  const trackCount = tape.tracks?.length || 0;
  const explicitType = (tape as any).tape_type;

  if (explicitType) return explicitType;
  if (trackCount <= 1) return 'single';
  if (trackCount >= 8) return 'album';

  return 'compilation';
}

function sortTracks(tracks: BeatTapeTrack[]) {
  return [...tracks].sort((a, b) => {
    const orderA = a.track_order || 0;
    const orderB = b.track_order || 0;

    if (orderA !== orderB) return orderA - orderB;

    return a.title.localeCompare(b.title);
  });
}

function makePlayableTrack(tape: TapeWithTracks, track: BeatTapeTrack) {
  return {
    ...track,
    cover_art_url: tape.cover_art_url,
    artist_name: BRAND_NAME,
    description: tape.description,
  };
}

export function BeatTapesRoom() {
  const {
    goBack,
    setCurrentRoom,
    isAdmin,
    addToast,
    adminEditMode,
    setAdminEditMode,
    refreshKey,
  } = useApp();

  const audio = useAudio();

  const [tapes, setTapes] = useState<TapeWithTracks[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTape, setExpandedTape] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingTape, setEditingTape] = useState<TapeWithTracks | null>(null);
  const [activeTape, setActiveTape] = useState<TapeWithTracks | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTapes = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('beat_tapes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('admin_approved', true).eq('hidden', false);
    }

    const { data: tapesData, error } = await query;

    if (error) {
      addToast('Could not load Beat Tapes.', 'error');
      setLoading(false);
      return;
    }

    const loadedTapes = await Promise.all(
      (tapesData || []).map(async (tape) => {
        const { data: tracks } = await supabase
          .from('beat_tape_tracks')
          .select('*')
          .eq('tape_id', tape.id)
          .order('track_order', { ascending: true });

        return {
          ...(tape as TapeWithTracks),
          tracks: sortTracks((tracks || []) as BeatTapeTrack[]),
        };
      })
    );

    setTapes(loadedTapes);
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchTapes();
  }, [fetchTapes, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('beat-tapes-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beat_tapes' },
        () => {
          fetchTapes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beat_tape_tracks' },
        () => {
          fetchTapes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTapes]);

  const visibleTapes = useMemo(() => {
    return tapes.filter((tape) => isAdmin || (!tape.hidden && tape.admin_approved));
  }, [isAdmin, tapes]);

  const handlePlayTape = (tape: TapeWithTracks, startIndex = 0) => {
    const playableTracks = sortTracks(tape.tracks || [])
      .filter((track) => track.audio_file_url)
      .map((track) => makePlayableTrack(tape, track));

    if (playableTracks.length === 0) {
      addToast('No playable tracks on this tape.', 'info');
      return;
    }

    const safeIndex = Math.max(0, Math.min(startIndex, playableTracks.length - 1));

    setActiveTape(tape);
    setExpandedTape(tape.id);
    audio.playQueue(playableTracks, safeIndex, true, PREVIEW_SECONDS);
  };

  const handleTrackPlay = (tape: TapeWithTracks, track: BeatTapeTrack, index: number) => {
    if (!track.audio_file_url) {
      addToast('No audio for this track.', 'info');
      return;
    }

    handlePlayTape(tape, index);
  };

  const handleShareTape = async (tape: TapeWithTracks) => {
    const url = getTapeUrl(tape);

    const shareData = {
      title: tape.title,
      text: `Preview "${tape.title}" on ${BRAND_NAME} Beat Tapes.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Tape link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast('Tape link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  const handlePurchaseTape = async (tape: TapeWithTracks) => {
    const buyerName = window.prompt('Name for the order:');
    if (!buyerName?.trim()) return;

    const buyerEmail = window.prompt('Email for release/download delivery:');
    if (!buyerEmail?.trim()) return;

    const { error } = await supabase.from('orders').insert({
      beat_id: tape.id,
      beat_name: tape.title,
      beat_thumbnail: tape.cover_art_url,
      buyer_name: buyerName.trim(),
      buyer_email: buyerEmail.trim(),
      payment_method: tape.is_free ? 'Free Tape Request' : 'Manual Tape Purchase Request',
      amount: tape.is_free ? 0 : tape.price,
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      payment_received: false,
    });

    if (error) {
      addToast('Order request failed.', 'error');
      return;
    }

    addToast('Order request sent. Download stays locked until release.', 'success');
  };

  const handleDownloadTape = (tape: TapeWithTracks) => {
    const releaseAllowed = Boolean((tape as any).release_download) || tape.is_free || isAdmin;

    if (!releaseAllowed) {
      addToast('Tape download locked until release is approved.', 'info');
      return;
    }

    const firstTrack = sortTracks(tape.tracks || []).find((track) => track.audio_file_url);

    if (!firstTrack?.audio_file_url) {
      addToast('No downloadable track available.', 'error');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = firstTrack.audio_file_url;
    anchor.download = `${tape.title || 'thisbeatizbanaz-tape'}.mp3`;
    anchor.rel = 'noopener';
    anchor.click();

    addToast('Download started.', 'success');
  };

  const handleEditTape = (tape: TapeWithTracks) => {
    if (!isAdmin) return;

    setEditingTape(tape);
    setShowUpload(true);
  };

  const handleDeleteTape = async (tape: TapeWithTracks) => {
    if (!isAdmin || !adminEditMode) return;

    const confirmed = window.confirm(
      `Delete "${tape.title}" and its tracklist? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(tape.id);

    await supabase.from('beat_tape_tracks').delete().eq('tape_id', tape.id);
    const { error } = await supabase.from('beat_tapes').delete().eq('id', tape.id);

    setDeletingId(null);

    if (error) {
      addToast('Delete failed.', 'error');
      return;
    }

    addToast('Beat tape deleted.', 'success');
    await fetchTapes();
  };

  const closeUpload = () => {
    setShowUpload(false);
    setEditingTape(null);
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
                <img src={BEAT_TAPES_ICON} alt="" className="w-6 h-6 object-contain" />
                Beat Tapes
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {visibleTapes.length} tapes - singles, albums, compilations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title={`${BRAND_NAME} Beat Tapes`}
              text={`Preview beat tapes from ${BRAND_NAME}.`}
            />

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
                  onClick={() => {
                    setEditingTape(null);
                    setShowUpload(true);
                  }}
                  className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  New
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-4 space-y-3 pb-32">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-3xl animate-pulse bg-[#111] border border-[#1e1e1e]"
            />
          ))
        ) : visibleTapes.length === 0 ? (
          <div className="text-center py-16 text-[#444]">
            <img
              src={BEAT_TAPES_ICON}
              alt=""
              className="w-16 h-16 object-contain mx-auto mb-3 opacity-20"
            />

            <div className="font-display text-xl text-[#333]">
              No Beat Tapes yet
            </div>

            <div className="text-xs text-[#555] mt-1">
              Curated tape drops will land here.
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingTape(null);
                  setShowUpload(true);
                }}
                className="btn-gold mt-4 px-6 py-3 rounded-xl text-sm"
              >
                Create Beat Tape
              </button>
            )}
          </div>
        ) : (
          visibleTapes.map((tape) => (
            <TapeCard
              key={tape.id}
              tape={tape}
              expanded={expandedTape === tape.id}
              activeTapeId={activeTape?.id || null}
              currentTrackId={audio.currentBeat?.id || null}
              isPlaying={audio.isPlaying}
              isAdmin={isAdmin}
              adminEditMode={adminEditMode}
              deleting={deletingId === tape.id}
              onExpand={() => setExpandedTape(expandedTape === tape.id ? null : tape.id)}
              onPlayTape={() => handlePlayTape(tape, 0)}
              onTrackPlay={(track, index) => handleTrackPlay(tape, track, index)}
              onShare={() => handleShareTape(tape)}
              onPurchase={() => handlePurchaseTape(tape)}
              onDownload={() => handleDownloadTape(tape)}
              onEdit={() => handleEditTape(tape)}
              onDelete={() => handleDeleteTape(tape)}
            />
          ))
        )}
      </div>

      {showUpload && (
        <TapeUploadModal
          tape={editingTape}
          onClose={closeUpload}
          onSave={async () => {
            closeUpload();
            await fetchTapes();
          }}
        />
      )}
    </div>
  );
}

function TapeCard({
  tape,
  expanded,
  activeTapeId,
  currentTrackId,
  isPlaying,
  isAdmin,
  adminEditMode,
  deleting,
  onExpand,
  onPlayTape,
  onTrackPlay,
  onShare,
  onPurchase,
  onDownload,
  onEdit,
  onDelete,
}: {
  tape: TapeWithTracks;
  expanded: boolean;
  activeTapeId: string | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  isAdmin: boolean;
  adminEditMode: boolean;
  deleting: boolean;
  onExpand: () => void;
  onPlayTape: () => void;
  onTrackPlay: (track: BeatTapeTrack, index: number) => void;
  onShare: () => void;
  onPurchase: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sortedTracks = sortTracks(tape.tracks || []);
  const type = getTapeType(tape);
  const releaseAllowed = Boolean((tape as any).release_download) || tape.is_free || isAdmin;

  return (
    <div
      id={`tape-${tape.id}`}
      className={`beat-card overflow-hidden rounded-3xl border ${
        activeTapeId === tape.id
          ? 'border-[#f5c518]/60 shadow-[0_0_24px_rgba(245,197,24,0.14)]'
          : 'border-[#1e1e1e]'
      } ${tape.hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3 p-3">
        <button
          onClick={onPlayTape}
          className="relative w-24 h-24 rounded-2xl overflow-hidden bg-black border border-white/10 flex-shrink-0"
          aria-label={`Play ${tape.title}`}
        >
          <img
            src={getTapeCover(tape)}
            alt={tape.title}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#f5c518] text-black flex items-center justify-center shadow-xl">
              <Play size={17} fill="black" className="ml-0.5" />
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display font-800 text-white truncate leading-tight">
                {tape.title}
              </div>

              <div className="text-[10px] text-[#777] mt-1 flex flex-wrap gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-[#f5c518] text-black font-bold tracking-[0.04em]">
                  {type}
                </span>

                <span>{sortedTracks.length} tracks</span>

                <span>{tape.is_free ? 'Free' : `$${tape.price || 20}`}</span>

                {tape.colab_usable && <span>Co-Lab OK</span>}

                {isAdmin && tape.hidden && <span>Hidden</span>}
              </div>
            </div>

            <button
              onClick={onShare}
              className="w-8 h-8 rounded-xl bg-[#111] border border-[#222] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
              title="Share"
            >
              <Share2 size={14} />
            </button>
          </div>

          {tape.description && (
            <p className="text-xs text-[#777] mt-2 line-clamp-2">
              {tape.description}
            </p>
          )}

          <div className="grid grid-cols-4 gap-1.5 mt-3">
            <button
              onClick={onPlayTape}
              className="py-2 rounded-xl bg-[#f5c518] text-black flex items-center justify-center"
              title="Preview tape"
            >
              <Play size={14} fill="black" />
            </button>

            <button
              onClick={onExpand}
              className="py-2 rounded-xl bg-[#151515] border border-[#222] text-[#888] hover:text-white transition-all flex items-center justify-center"
              title="Tracklist"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              onClick={onPurchase}
              className="py-2 rounded-xl bg-[#151515] border border-[#222] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
              title="Purchase tape"
            >
              <ShoppingBag size={14} />
            </button>

            <button
              onClick={onDownload}
              className={`py-2 rounded-xl border transition-all flex items-center justify-center ${
                releaseAllowed
                  ? 'bg-green-900/35 border-green-700/25 text-green-400'
                  : 'bg-[#151515] border-[#222] text-[#555]'
              }`}
              title={releaseAllowed ? 'Download' : 'Download locked'}
            >
              {releaseAllowed ? <Download size={14} /> : <Lock size={14} />}
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={onEdit}
                className="px-3 py-1.5 rounded-xl bg-[#111] border border-[#222] text-[#f5c518] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
              >
                <Edit3 size={12} />
                Edit
              </button>

              {adminEditMode && (
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-500/30 text-red-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1a1a1a] bg-black/20">
          {sortedTracks.length === 0 ? (
            <div className="px-4 py-4 text-xs text-[#555]">
              No tracks assigned yet.
            </div>
          ) : (
            sortedTracks.map((track, index) => {
              const isCurrentTrack =
                activeTapeId === tape.id && currentTrackId === track.id;

              return (
                <button
                  key={track.id}
                  onClick={() => onTrackPlay(track, index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-all text-left ${
                    isCurrentTrack ? 'bg-[#f5c518]/8' : ''
                  }`}
                >
                  <span
                    className={`w-7 text-center text-xs font-mono flex-shrink-0 ${
                      isCurrentTrack ? 'text-[#f5c518]' : 'text-[#555]'
                    }`}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <span className="flex justify-center gap-[1px] items-end h-3">
                        {[0, 1, 2].map((barIndex) => (
                          <span
                            key={barIndex}
                            className="waveform-bar w-[2px]"
                            style={{
                              animationDelay: `${barIndex * 0.15}s`,
                              height: '100%',
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>

                  <span
                    className={`flex-1 text-sm truncate ${
                      isCurrentTrack ? 'text-[#f5c518]' : 'text-[#aaa]'
                    }`}
                  >
                    {track.title}
                  </span>

                  {isCurrentTrack && isPlaying ? (
                    <Pause size={13} className="text-[#f5c518]" />
                  ) : (
                    <Play size={13} className="text-[#444]" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function TapeUploadModal({
  tape,
  onClose,
  onSave,
}: {
  tape: TapeWithTracks | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const { addToast } = useApp();

  const [title, setTitle] = useState(tape?.title || '');
  const [description, setDescription] = useState(tape?.description || '');
  const [coverUrl, setCoverUrl] = useState(tape?.cover_art_url || '');
  const [price, setPrice] = useState(tape?.price || 20);
  const [isFree, setIsFree] = useState(Boolean(tape?.is_free));
  const [colabUsable, setColabUsable] = useState(Boolean(tape?.colab_usable));
  const [released, setReleased] = useState(Boolean((tape as any)?.release_download));
  const [hidden, setHidden] = useState(Boolean(tape?.hidden));
  const [tapeType, setTapeType] = useState<string>((tape as any)?.tape_type || getTapeType(tape));
  const [tracks, setTracks] = useState<TapeDraftTrack[]>(
    tape?.tracks?.length
      ? sortTracks(tape.tracks).map((track) => ({
          title: track.title,
          url: track.audio_file_url || '',
          uploading: false,
        }))
      : [{ title: '', url: '', uploading: false }]
  );
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverUploading(true);

    try {
      const result = await uploadCoverArt(file);
      setCoverUrl(result.url);
      addToast('Cover uploaded.', 'success');
    } catch {
      addToast('Cover upload failed. Paste a URL instead.', 'error');
    }

    setCoverUploading(false);
  };

  const handleTrackFile = async (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTracks((currentTracks) =>
      currentTracks.map((track, trackIndex) =>
        trackIndex === index ? { ...track, uploading: true } : track
      )
    );

    try {
      const result = await uploadAudio(file);

      setTracks((currentTracks) =>
        currentTracks.map((track, trackIndex) =>
          trackIndex === index
            ? {
                ...track,
                title: track.title || file.name.replace(/\.[^/.]+$/, ''),
                url: result.url,
                uploading: false,
              }
            : track
        )
      );

      addToast('Track uploaded.', 'success');
    } catch {
      setTracks((currentTracks) =>
        currentTracks.map((track, trackIndex) =>
          trackIndex === index ? { ...track, uploading: false } : track
        )
      );

      addToast('Track upload failed. Paste a URL instead.', 'error');
    }
  };

  const addTrack = () => {
    if (tracks.length >= MAX_TRACKS) {
      addToast(`Batch upload max is ${MAX_TRACKS} tracks.`, 'info');
      return;
    }

    setTracks((currentTracks) => [
      ...currentTracks,
      { title: '', url: '', uploading: false },
    ]);
  };

  const updateTrack = (index: number, field: 'title' | 'url', value: string) => {
    setTracks((currentTracks) =>
      currentTracks.map((track, trackIndex) =>
        trackIndex === index ? { ...track, [field]: value } : track
      )
    );
  };

  const removeTrack = (index: number) => {
    setTracks((currentTracks) =>
      currentTracks.filter((_, trackIndex) => trackIndex !== index)
    );
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= tracks.length) return;

    setTracks((currentTracks) => {
      const nextTracks = [...currentTracks];
      const movingTrack = nextTracks[index];

      nextTracks[index] = nextTracks[nextIndex];
      nextTracks[nextIndex] = movingTrack;

      return nextTracks;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      addToast('Tape title required.', 'error');
      return;
    }

    const readyTracks = tracks.filter(
      (track) => track.title.trim() && track.url.trim()
    );

    if (readyTracks.length < MIN_TRACKS) {
      addToast(`Add at least ${MIN_TRACKS} tracks.`, 'error');
      return;
    }

    if (readyTracks.length > MAX_TRACKS) {
      addToast(`Beat tapes hold ${MIN_TRACKS} to ${MAX_TRACKS} tracks.`, 'error');
      return;
    }

    setSaving(true);

    const tapePayload = {
      title: title.trim(),
      description: description.trim(),
      cover_art_url: coverUrl.trim(),
      price: isFree ? 0 : Number(price) || 0,
      is_free: isFree,
      colab_usable: colabUsable,
      admin_approved: true,
      hidden,
      release_download: released,
      tape_type: tapeType,
    } as any;

    let tapeId = tape?.id;

    if (tapeId) {
      const { error } = await supabase
        .from('beat_tapes')
        .update(tapePayload)
        .eq('id', tapeId);

      if (error) {
        addToast('Tape update failed.', 'error');
        setSaving(false);
        return;
      }

      await supabase.from('beat_tape_tracks').delete().eq('tape_id', tapeId);
    } else {
      const { data, error } = await supabase
        .from('beat_tapes')
        .insert(tapePayload)
        .select()
        .single();

      if (error || !data) {
        addToast('Tape creation failed.', 'error');
        setSaving(false);
        return;
      }

      tapeId = data.id;
    }

    const trackPayloads = readyTracks.slice(0, MAX_TRACKS).map((track, index) => ({
      tape_id: tapeId,
      title: track.title.trim(),
      audio_file_url: track.url.trim(),
      track_order: index + 1,
    }));

    const { error: tracksError } = await supabase
      .from('beat_tape_tracks')
      .insert(trackPayloads);

    if (tracksError) {
      addToast('Track save failed.', 'error');
      setSaving(false);
      return;
    }

    addToast(tape ? 'Beat tape updated.' : 'Beat tape created.', 'success');
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/86 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0d0d0d] border border-[#f5c518]/20 shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-[#1a1a1a] flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-display font-900 text-white uppercase tracking-wide">
              {tape ? 'Edit Beat Tape' : 'New Beat Tape'}
            </div>
            <div className="text-[10px] text-[#666]">
              {MIN_TRACKS}-{MAX_TRACKS} tracks · users get 45-second previews
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close beat tape editor"
            aria-label="Close beat tape editor"
            className="w-9 h-9 rounded-full bg-white/5 text-[#888] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4">
            <div>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="aspect-square w-full rounded-2xl bg-black border border-[#222] overflow-hidden flex items-center justify-center"
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-[#555]">
                    <Upload size={24} className="mx-auto mb-2" />
                    <div className="text-xs">Cover</div>
                  </div>
                )}
              </button>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFile}
              />

              {coverUploading && (
                <div className="text-[10px] text-[#f5c518] mt-2">
                  Uploading cover...
                </div>
              )}
            </div>

            <div className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tape title"
                className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
              />

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                className="w-full min-h-[92px] bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45 resize-none"
              />

              <input
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="Cover URL"
                className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-[#666] uppercase tracking-widest">
                Type
              </span>
              <select
                value={tapeType}
                onChange={(event) => setTapeType(event.target.value)}
                className="w-full bg-black border border-[#222] rounded-2xl px-3 py-3 text-white outline-none"
              >
                <option value="single">Single</option>
                <option value="album">Album</option>
                <option value="compilation">Compilation</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-[#666] uppercase tracking-widest">
                Price
              </span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                className="w-full bg-black border border-[#222] rounded-2xl px-3 py-3 text-white outline-none"
              />
            </label>

            <ToggleBox label="Free" active={isFree} onClick={() => setIsFree(!isFree)} />
            <ToggleBox label="Co-Lab" active={colabUsable} onClick={() => setColabUsable(!colabUsable)} />
            <ToggleBox label="Release" active={released} onClick={() => setReleased(!released)} />
            <ToggleBox label="Hidden" active={hidden} onClick={() => setHidden(!hidden)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-900 text-white uppercase tracking-wide text-sm">
                  Tracks
                </div>
                <div className="text-[10px] text-[#666]">
                  Set order manually. Batch max {MAX_TRACKS}.
                </div>
              </div>

              <button
                onClick={addTrack}
                className="px-3 py-2 rounded-xl bg-[#f5c518] text-black text-xs font-bold uppercase flex items-center gap-1"
              >
                <Plus size={13} />
                Track
              </button>
            </div>

            <div className="space-y-2">
              {tracks.map((track, index) => (
                <div
                  key={`${index}-${track.url}`}
                  className="rounded-2xl bg-black/45 border border-[#222] p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#111] border border-[#222] text-[#f5c518] text-xs font-mono flex items-center justify-center">
                      {index + 1}
                    </div>

                    <input
                      value={track.title}
                      onChange={(event) => updateTrack(index, 'title', event.target.value)}
                      placeholder="Track title"
                      className="flex-1 bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f5c518]/45"
                    />

                    <button
                      onClick={() => moveTrack(index, -1)}
                      disabled={index === 0}
                      className="w-8 h-8 rounded-lg bg-[#111] border border-[#222] text-[#888] disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronUp size={14} />
                    </button>

                    <button
                      onClick={() => moveTrack(index, 1)}
                      disabled={index === tracks.length - 1}
                      className="w-8 h-8 rounded-lg bg-[#111] border border-[#222] text-[#888] disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronDown size={14} />
                    </button>

                    <button
                      onClick={() => removeTrack(index)}
                      disabled={tracks.length === 1}
                      className="w-8 h-8 rounded-lg bg-red-950/50 border border-red-500/20 text-red-300 disabled:opacity-30 flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      value={track.url}
                      onChange={(event) => updateTrack(index, 'url', event.target.value)}
                      placeholder="Audio URL"
                      className="bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f5c518]/45"
                    />

                    <label className="px-3 py-2 rounded-xl bg-[#111] border border-[#222] text-[#aaa] hover:text-[#f5c518] text-xs font-bold uppercase cursor-pointer flex items-center gap-1.5">
                      {track.uploading ? (
                        <>
                          <SkipForward size={13} />
                          Loading
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          Upload
                        </>
                      )}

                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(event) => handleTrackFile(index, event)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <label className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2a2a2a] bg-black/25 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#aaa] hover:text-[#f5c518] cursor-pointer">
              <Upload size={14} />
              Batch Upload Tracks
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={async (event) => {
                  const files = Array.from(event.target.files || []).slice(0, MAX_TRACKS);
                  if (files.length === 0) return;

                  setTracks(
                    files.map((file) => ({
                      title: file.name.replace(/\.[^/.]+$/, ''),
                      url: '',
                      uploading: true,
                    }))
                  );

                  try {
                    const uploadResults = await Promise.all(files.map((file) => uploadAudio(file)));
                    setTracks(
                      files.map((file, index) => ({
                        title: file.name.replace(/\.[^/.]+$/, ''),
                        url: uploadResults[index]?.url || '',
                        uploading: false,
                      }))
                    );
                    addToast('Batch track upload finished.', 'success');
                  } catch {
                    addToast('Batch track upload failed.', 'error');
                    setTracks((currentTracks) =>
                      currentTracks.map((track) => ({ ...track, uploading: false }))
                    );
                  }
                }}
              />
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold w-full py-3 rounded-2xl disabled:opacity-50"
          >
            {saving ? 'Saving...' : tape ? 'Save Tape' : 'Create Tape'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleBox({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-xs font-display font-900 uppercase tracking-widest transition-all ${
        active
          ? 'bg-[#f5c518] border-[#f5c518] text-black'
          : 'bg-black border-[#222] text-[#777]'
      }`}
    >
      {label}
    </button>
  );
}


