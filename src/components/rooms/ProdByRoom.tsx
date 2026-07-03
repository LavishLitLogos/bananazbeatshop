import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Edit3,
  Lock,
  Pause,
  Play,
  Plus,
  Share2,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { ProdBySong } from '../../types';
import { BRAND_NAME, EXCLUSIVE_INFO_DEFAULT, EXCLUSIVE_STEMS_NOTE, PRODUCED_BY_INFO_DEFAULT } from '../../utils/branding';
import { getBeatPriceLabel, isBeatFree } from '../../utils/beatAccess';
import { ShareButton } from '../ui/ShareButton';
import { uploadAudio, uploadCoverArt } from '../../services/uploadService';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const PROD_BY_ICON = '/assets/icons/skip-icon.png';

// ProdBySong now has all required fields on the base interface â€” no local extension needed
type ProducedSong = ProdBySong;

function getSongCover(song: ProducedSong) {
  return song.cover_art_url || MAIN_LOGO;
}

function getSongUrl(song: ProducedSong) {
  return `${window.location.origin}${window.location.pathname}#song-${song.id}`;
}

function getSongRights(song: ProducedSong) {
  return (
    song.rights_text ||
    PRODUCED_BY_INFO_DEFAULT
  );
}

export function ProdByRoom() {
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

  const [songs, setSongs] = useState<ProducedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [editingSong, setEditingSong] = useState<ProducedSong | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSongs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('prod_by_songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('admin_approved', true).eq('hidden', false);
    }

    const { data, error } = await query;

    if (error) {
      addToast('Could not load Produced By songs.', 'error');
      setLoading(false);
      return;
    }

    setSongs((data || []) as ProducedSong[]);
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('produced-by-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prod_by_songs' },
        () => {
          fetchSongs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  const visibleSongs = useMemo(() => {
    return songs.filter((song) => isAdmin || (!song.hidden && song.admin_approved));
  }, [isAdmin, songs]);

  const handlePlaySong = (song: ProducedSong) => {
    if (!song.audio_file_url) {
      addToast('No audio available for this song.', 'info');
      return;
    }

    audio.play(song, false);
  };

  const handlePlayQueueFromSong = (song: ProducedSong) => {
    const playableSongs = visibleSongs.filter((item) => item.audio_file_url);
    const index = playableSongs.findIndex((item) => item.id === song.id);

    if (index < 0) {
      handlePlaySong(song);
      return;
    }

    audio.playQueue(playableSongs, index, false);
  };

  const handleShareSong = async (song: ProducedSong) => {
    const url = getSongUrl(song);

    const shareData = {
      title: song.title,
      text: `Listen to "${song.title}" produced by ${BRAND_NAME}.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Song link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast('Song link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  const handlePurchaseSong = async (song: ProducedSong) => {
    const buyerName = window.prompt('Name for the order:');
    if (!buyerName?.trim()) return;

    const buyerEmail = window.prompt('Email for release/download delivery:');
    if (!buyerEmail?.trim()) return;

    const { error } = await supabase.from('orders').insert({
      beat_id: song.id,
      beat_name: song.title,
      beat_thumbnail: song.cover_art_url,
      buyer_name: buyerName.trim(),
      buyer_email: buyerEmail.trim(),
      payment_method: song.is_free ? 'Free Song Request' : 'Manual Song Purchase Request',
      amount: song.is_free ? 0 : Number(song.price || 0),
      status: 'Pending Verification',
      release_download: false,
      sold: false,
      payment_received: false,
    });

    if (error) {
      addToast('Song order request failed.', 'error');
      return;
    }

    addToast('Song order request sent. Download stays locked until release.', 'success');
  };

  const handleDownloadSong = (song: ProducedSong) => {
    const releaseAllowed = Boolean(song.release_download) || Boolean(song.is_free) || isAdmin;

    if (!releaseAllowed) {
      addToast('Song download locked until release is approved.', 'info');
      return;
    }

    if (!song.audio_file_url) {
      addToast('No downloadable audio available.', 'error');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = song.audio_file_url;
    anchor.download = `${song.title || 'thisbeatizbananaz-song'}.mp3`;
    anchor.rel = 'noopener';
    anchor.click();

    addToast('Song download started.', 'success');
  };

  const handleEditSong = (song: ProducedSong) => {
    if (!isAdmin) return;

    setEditingSong(song);
    setShowUpload(true);
  };

  const handleDeleteSong = async (song: ProducedSong) => {
    if (!isAdmin || !adminEditMode) return;

    const confirmed = window.confirm(
      `Delete "${song.title}" from Produced By? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(song.id);

    const { error } = await supabase
      .from('prod_by_songs')
      .delete()
      .eq('id', song.id);

    setDeletingId(null);

    if (error) {
      addToast('Song delete failed.', 'error');
      return;
    }

    addToast('Song deleted.', 'success');
    await fetchSongs();
  };

  const closeUpload = () => {
    setShowUpload(false);
    setEditingSong(null);
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
                <img src={PROD_BY_ICON} alt="" className="w-6 h-6 object-contain" />
                Produced By
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {visibleSongs.length} songs - Complete records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title={`Produced By ${BRAND_NAME}`}
              text={`Listen to complete songs produced by ${BRAND_NAME}.`}
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
                    setEditingSong(null);
                    setShowUpload(true);
                  }}
                  className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Song
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-4 space-y-3 pb-32">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-3xl animate-pulse bg-[#111] border border-[#1e1e1e]"
            />
          ))
        ) : visibleSongs.length === 0 ? (
          <div className="text-center py-16 text-[#444]">
            <img
              src={PROD_BY_ICON}
              alt=""
              className="w-16 h-16 object-contain mx-auto mb-3 opacity-20"
            />

            <div className="font-display text-xl text-[#333]">
              No songs yet
            </div>

            <div className="text-xs text-[#555] mt-1">
              Complete songs produced by {BRAND_NAME} will appear here.
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingSong(null);
                  setShowUpload(true);
                }}
                className="btn-gold mt-4 px-6 py-3 rounded-xl text-sm"
              >
                Add Song
              </button>
            )}
          </div>
        ) : (
          visibleSongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isCurrentSong={audio.currentBeat?.id === song.id}
              isPlaying={audio.currentBeat?.id === song.id && audio.isPlaying}
              isAdmin={isAdmin}
              adminEditMode={adminEditMode}
              deleting={deletingId === song.id}
              onPlay={() => handlePlaySong(song)}
              onQueue={() => handlePlayQueueFromSong(song)}
              onShare={() => handleShareSong(song)}
              onPurchase={() => handlePurchaseSong(song)}
              onDownload={() => handleDownloadSong(song)}
              onEdit={() => handleEditSong(song)}
              onDelete={() => handleDeleteSong(song)}
            />
          ))
        )}
      </div>

      {showUpload && (
        <SongUploadModal
          song={editingSong}
          onClose={closeUpload}
          onSave={async () => {
            closeUpload();
            await fetchSongs();
          }}
        />
      )}
    </div>
  );
}

function SongCard({
  song,
  isCurrentSong,
  isPlaying,
  isAdmin,
  adminEditMode,
  deleting,
  onPlay,
  onQueue,
  onShare,
  onPurchase,
  onDownload,
  onEdit,
  onDelete,
}: {
  song: ProducedSong;
  isCurrentSong: boolean;
  isPlaying: boolean;
  isAdmin: boolean;
  adminEditMode: boolean;
  deleting: boolean;
  onPlay: () => void;
  onQueue: () => void;
  onShare: () => void;
  onPurchase: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const releaseAllowed = Boolean(song.release_download) || isBeatFree(song) || isAdmin;
  const priceLabel = getBeatPriceLabel(song);

  return (
    <div
      id={`song-${song.id}`}
      className={`beat-card overflow-hidden rounded-3xl border ${
        isCurrentSong
          ? 'border-[#f5c518]/60 shadow-[0_0_24px_rgba(245,197,24,0.14)]'
          : 'border-[#1e1e1e]'
      } ${song.hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3 p-3">
        <button
          onClick={onPlay}
          className="relative w-24 h-24 rounded-2xl overflow-hidden bg-black border border-white/10 flex-shrink-0"
          aria-label={`Play ${song.title}`}
        >
          <img
            src={getSongCover(song)}
            alt={song.title}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#f5c518] text-black flex items-center justify-center shadow-xl">
              {isPlaying ? (
                <Pause size={17} fill="black" />
              ) : (
                <Play size={17} fill="black" className="ml-0.5" />
              )}
            </div>
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display font-900 text-white uppercase truncate leading-tight">
                {song.title}
              </div>

              <div className="text-[11px] text-[#f5c518] mt-1 truncate">
                {song.artist_name || 'Artist TBA'}
              </div>

              <div className="text-[10px] text-[#777] mt-1">
                Song · Produced by {BRAND_NAME} · {priceLabel}
              </div>
            </div>

            <button
              onClick={onShare}
              disabled={Boolean(song.no_sharing)}
              className="w-8 h-8 rounded-xl bg-[#111] border border-[#222] text-[#888] hover:text-[#f5c518] disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              title="Share"
            >
              <Share2 size={14} />
            </button>
          </div>

          {song.description && (
            <p className="text-xs text-[#777] mt-2 line-clamp-2">
              {song.description}
            </p>
          )}

          <div className="text-[10px] text-[#555] mt-2 line-clamp-1">
            {getSongRights(song)}
          </div>

          {isPlaying && (
            <div className="flex items-end gap-[2px] h-4 mt-2">
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

          <div className="grid grid-cols-5 gap-1.5 mt-3">
            <button
              onClick={onPlay}
              className="py-2 rounded-xl bg-[#f5c518] text-black flex items-center justify-center"
              title="Play song"
            >
              {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" />}
            </button>

            <button
              onClick={onQueue}
              className="py-2 rounded-xl bg-[#151515] border border-[#222] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
              title="Play queue from this song"
            >
              <Play size={14} />
            </button>

            <button
              onClick={onPurchase}
              className="py-2 rounded-xl bg-[#151515] border border-[#222] text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
              title="Purchase song"
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
              title={releaseAllowed ? 'Download song' : 'Download locked'}
            >
              {releaseAllowed ? <Download size={14} /> : <Lock size={14} />}
            </button>

            <button
              onClick={onShare}
              disabled={Boolean(song.no_sharing)}
              className="py-2 rounded-xl bg-[#151515] border border-[#222] text-[#888] hover:text-[#f5c518] disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              title="Share song"
            >
              <Share2 size={14} />
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

              {song.hidden && (
                <span className="px-2 py-1 rounded-lg bg-[#222] text-[#777] text-[10px] uppercase">
                  Hidden
                </span>
              )}

              {song.exclusive && (
                <span className="px-2 py-1 rounded-lg bg-[#f5c518]/10 border border-[#f5c518]/20 text-[#f5c518] text-[10px] uppercase">
                  Exclusive
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SongUploadModal({
  song,
  onClose,
  onSave,
}: {
  song: ProducedSong | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const { addToast } = useApp();

  const [title, setTitle] = useState(song?.title || '');
  const [artistName, setArtistName] = useState(song?.artist_name || '');
  const [description, setDescription] = useState(song?.description || '');
  const [rightsText, setRightsText] = useState(
    song?.rights_text || PRODUCED_BY_INFO_DEFAULT
  );
  const [audioUrl, setAudioUrl] = useState(song?.audio_file_url || '');
  const [coverUrl, setCoverUrl] = useState(song?.cover_art_url || '');
  const [price, setPrice] = useState(Number(song?.price || 250));
  const [isFree, setIsFree] = useState(song?.exclusive ? false : true);
  const [released, setReleased] = useState(Boolean(song?.release_download));
  const [exclusive, setExclusive] = useState(Boolean(song?.exclusive));
  const [noSharing, setNoSharing] = useState(Boolean(song?.no_sharing));
  const [hidden, setHidden] = useState(Boolean(song?.hidden));
  const [saving, setSaving] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAudioFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioUploading(true);

    try {
      const result = await uploadAudio(file);
      setAudioUrl(result.url);
      addToast('Song audio uploaded.', 'success');
    } catch {
      addToast('Song audio upload failed. Paste a URL instead.', 'error');
    }

    setAudioUploading(false);
  };

  const handleCoverFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverUploading(true);

    try {
      const result = await uploadCoverArt(file);
      setCoverUrl(result.url);
      addToast('Song cover uploaded.', 'success');
    } catch {
      addToast('Song cover upload failed. Paste a URL instead.', 'error');
    }

    setCoverUploading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      addToast('Song title required.', 'error');
      return;
    }

    if (!audioUrl.trim()) {
      addToast('Song audio required.', 'error');
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      artist_name: artistName.trim(),
      description: description.trim(),
      rights_text: rightsText.trim() || (exclusive ? `${EXCLUSIVE_INFO_DEFAULT} ${EXCLUSIVE_STEMS_NOTE}` : PRODUCED_BY_INFO_DEFAULT),
      audio_file_url: audioUrl.trim(),
      cover_art_url: coverUrl.trim(),
      price: exclusive ? Number(price) || 250 : 0,
      is_free: exclusive ? false : true,
      release_download: exclusive ? released : true,
      exclusive,
      no_sharing: noSharing,
      admin_approved: true,
      hidden,
    } as any;

    if (song?.id) {
      const { error } = await supabase
        .from('prod_by_songs')
        .update(payload)
        .eq('id', song.id);

      if (error) {
        addToast('Song update failed.', 'error');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('prod_by_songs').insert(payload);

      if (error) {
        addToast('Song creation failed.', 'error');
        setSaving(false);
        return;
      }
    }

    addToast(song ? 'Song updated.' : 'Song created.', 'success');
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/86 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0d0d0d] border border-[#f5c518]/20 shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-[#1a1a1a] flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-display font-900 text-white uppercase tracking-wide">
              {song ? 'Edit Song' : 'New Song'}
            </div>
            <div className="text-[10px] text-[#666]">
              Produced By room uses Song language only.
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close song editor"
            aria-label="Close song editor"
            className="w-9 h-9 rounded-full bg-white/5 text-[#888] hover:text-white flex items-center justify-center"
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
                placeholder="Song title"
                className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
              />

              <input
                value={artistName}
                onChange={(event) => setArtistName(event.target.value)}
                placeholder="Artist name"
                className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
              />

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Song description"
                className="w-full min-h-[88px] bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45 resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder="Song audio URL"
                className="bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
              />

              <button
                onClick={() => audioInputRef.current?.click()}
                disabled={audioUploading}
                className="px-4 py-3 rounded-2xl bg-[#111] border border-[#222] text-[#aaa] hover:text-[#f5c518] text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-50"
              >
                <Upload size={14} />
                {audioUploading ? 'Uploading' : 'Audio'}
              </button>
            </div>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioFile}
            />
          </div>

          <input
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder="Song cover URL"
            className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
          />

          <input
            value={rightsText}
            onChange={(event) => setRightsText(event.target.value)}
            placeholder="Rights text"
            className="w-full bg-black border border-[#222] rounded-2xl px-4 py-3 text-white outline-none focus:border-[#f5c518]/45"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="space-y-1 col-span-2 sm:col-span-1">
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
            <ToggleBox label="Release DL" active={released} onClick={() => setReleased(!released)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ToggleBox
              label="Exclusive"
              active={exclusive}
              onClick={() => setExclusive(!exclusive)}
            />
            <ToggleBox
              label="No Sharing"
              active={noSharing}
              onClick={() => setNoSharing(!noSharing)}
            />
            <ToggleBox
              label="Hidden"
              active={hidden}
              onClick={() => setHidden(!hidden)}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold w-full py-3 rounded-2xl disabled:opacity-50"
          >
            {saving ? 'Saving...' : song ? 'Save Song' : 'Create Song'}
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



