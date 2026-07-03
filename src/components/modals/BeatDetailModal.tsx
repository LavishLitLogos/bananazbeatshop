import {
  Download,
  Eye,
  EyeOff,
  Lock,
  Pause,
  Play,
  Save,
  ShoppingBag,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useApp, useAudio } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { Beat } from '../../types';
import { BEAT_INFO_DEFAULT, BRAND_NAME } from '../../utils/branding';
import { canBuyBeat, canDownloadBeat, DEFAULT_BEAT_PRICE, getBeatPriceLabel, getBeatPriceValue, isBeatFree, triggerBeatDownload } from '../../utils/beatAccess';
import { ShareButton } from '../ui/ShareButton';

interface BeatDetailModalProps {
  beat: Beat;
  onClose: () => void;
  onBuy: () => void;
  allBeats?: Beat[];
}

interface AdminForm {
  title: string;
  price: string;
  genre: string;
  style: string;
  type: string;
  vibe: string;
  mood: string;
  description: string;
  terms: string;
  hidden: boolean;
  is_free: boolean;
  exclusive: boolean;
  sold: boolean;
  release_download: boolean;
  admin_approved: boolean;
}

function splitTags(value?: string) {
  return (value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createAdminForm(beat: Beat): AdminForm {
  return {
    title: beat.title || '',
    price: String(isBeatFree(beat) ? 0 : getBeatPriceValue(beat)),
    genre: beat.genre || '',
    style: beat.style || '',
    type: beat.type || '',
    vibe: beat.vibe || '',
    mood: beat.mood || '',
    description: beat.description || '',
    terms: beat.terms || BEAT_INFO_DEFAULT,
    hidden: Boolean(beat.hidden),
    is_free: isBeatFree(beat),
    exclusive: Boolean(beat.exclusive),
    sold: Boolean(beat.sold),
    release_download: Boolean(beat.release_download),
    admin_approved: beat.admin_approved !== false,
  };
}

export function BeatDetailModal({ beat, onClose, onBuy, allBeats = [] }: BeatDetailModalProps) {
  const { addToast, addToCart, isAdmin, adminEditMode, refreshContent, setCartOpen } = useApp();
  const audio = useAudio();
  const [adminForm, setAdminForm] = useState<AdminForm>(() => createAdminForm(beat));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentIndex = allBeats.findIndex((item) => item.id === beat.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allBeats.length - 1;
  const isCurrentBeat = audio.currentBeat?.id === beat.id;
  const isCurrentPlaying = isCurrentBeat && audio.isPlaying;
  const downloadUnlocked = canDownloadBeat(beat, isAdmin);
  const purchaseAvailable = canBuyBeat(beat);
  const showAdminControls = isAdmin && adminEditMode;

  const tagGroups = [
    ...splitTags(beat.genre),
    ...splitTags(beat.style),
    ...splitTags(beat.type),
    ...splitTags(beat.vibe),
    ...splitTags(beat.mood),
  ];

  const updateAdminForm = <Key extends keyof AdminForm>(key: Key, value: AdminForm[Key]) => {
    setAdminForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handlePlay = () => {
    if (!beat.audio_file_url) {
      addToast('No audio available for this beat.', 'info');
      return;
    }

    if (isCurrentBeat) {
      if (audio.isPlaying) {
        audio.pause();
      } else {
        audio.resume();
      }
      return;
    }

    if (allBeats.length > 0 && currentIndex >= 0) {
      audio.playQueue(allBeats, currentIndex, false);
      return;
    }

    audio.play(beat, false);
  };

  const handlePrev = () => {
    if (!hasPrev) return;

    if (isCurrentBeat && audio.hasPrev) {
      audio.prev();
      return;
    }

    const prevBeat = allBeats[currentIndex - 1];
    if (!prevBeat?.audio_file_url) return;

    audio.playQueue(allBeats, currentIndex - 1, false);
  };

  const handleNext = () => {
    if (!hasNext) return;

    if (isCurrentBeat && audio.hasNext) {
      audio.next();
      return;
    }

    const nextBeat = allBeats[currentIndex + 1];
    if (!nextBeat?.audio_file_url) return;

    audio.playQueue(allBeats, currentIndex + 1, false);
  };

  const handleDownload = () => {
    if (!beat.audio_file_url) {
      addToast('No download file is available.', 'error');
      return;
    }

    if (!downloadUnlocked) {
      addToast('Download is locked until admin releases it.', 'info');
      return;
    }

    if (!triggerBeatDownload(beat, isAdmin)) {
      addToast('Download is locked until admin releases it.', 'info');
      return;
    }

    addToast('Download started.', 'success');
  };

  const handleAddToBeatBox = () => {
    if (!purchaseAvailable) {
      addToast(isBeatFree(beat) ? 'Free beats do not need Beat Box.' : 'This beat is not available for Beat Box.', 'info');
      return;
    }

    addToCart(beat);
    setCartOpen(true);
    addToast(`${beat.title} added to Beat Box.`, 'success');
  };

  const saveAdminChanges = async () => {
    if (!isAdmin || saving) return;

    const cleanTitle = adminForm.title.trim();

    if (!cleanTitle) {
      addToast('Beat title is required.', 'error');
      return;
    }

    setSaving(true);

    const updates: Partial<Beat> = {
      title: cleanTitle,
      price: adminForm.is_free ? 0 : Number(adminForm.price || DEFAULT_BEAT_PRICE),
      genre: adminForm.genre.trim(),
      style: adminForm.style.trim(),
      type: adminForm.type.trim(),
      vibe: adminForm.vibe.trim(),
      mood: adminForm.mood.trim(),
      description: adminForm.description.trim(),
      terms: adminForm.terms.trim(),
      hidden: adminForm.hidden,
      is_free: adminForm.is_free,
      exclusive: adminForm.exclusive,
      sold: adminForm.sold,
      release_download: adminForm.is_free ? true : adminForm.release_download,
      admin_approved: adminForm.admin_approved,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('beats').update(updates).eq('id', beat.id);

    if (error) {
      addToast('Beat update failed.', 'error');
    } else {
      addToast('Beat updated.', 'success');
      refreshContent();
    }

    setSaving(false);
  };

  const deleteBeat = async () => {
    if (!isAdmin || deleting) return;

    const confirmed = window.confirm(`Delete "${beat.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase.from('beats').delete().eq('id', beat.id);

    if (error) {
      addToast('Beat delete failed.', 'error');
      setDeleting(false);
      return;
    }

    addToast('Beat deleted.', 'success');
    refreshContent();
    setDeleting(false);
    onClose();
  };

  const toggleQuickAdmin = async (updates: Partial<Beat>) => {
    if (!isAdmin || saving) return;

    setSaving(true);

    const { error } = await supabase
      .from('beats')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', beat.id);

    if (error) {
      addToast('Admin toggle failed.', 'error');
    } else {
      Object.entries(updates).forEach(([key, value]) => {
        if (key in adminForm) {
          updateAdminForm(key as keyof AdminForm, value as never);
        }
      });

      addToast('Beat setting updated.', 'success');
      refreshContent();
    }

    setSaving(false);
  };

  return (
    <div
      className="modal-backdrop beat-detail-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="modal-box beat-detail-modal w-[calc(100vw-24px)] max-w-md overflow-y-auto overflow-x-hidden"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative w-full overflow-hidden">
          {/* X CLOSE BUTTON — always visible, always functional */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full hover:bg-white/10 bg-black/70 border border-white/10 text-white transition-colors flex items-center justify-center"
            aria-label="Close beat detail"
          >
            <X size={18} />
          </button>

          <div className="aspect-square bg-[#111] rounded-t-[22px] overflow-hidden">
            {beat.cover_art_url ? (
              <img src={beat.cover_art_url} alt={beat.title} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#333]">
                <MusicIcon />
              </div>
            )}
          </div>

          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
            aria-label={isCurrentPlaying ? 'Pause beat' : 'Play beat'}
          >
            <span className="w-16 h-16 rounded-full bg-[#f5c518] flex items-center justify-center shadow-xl shadow-[#f5c518]/20">
              {isCurrentPlaying ? <Pause size={28} className="text-black" /> : <Play size={28} className="text-black ml-1" />}
            </span>
          </button>

          {beat.sold && (
            <div className="absolute left-3 top-3 px-2 py-1 rounded-lg bg-red-950/80 border border-red-700/40 text-red-300 text-[10px] font-bold uppercase tracking-[0.15em]">
              Sold
            </div>
          )}

          {beat.exclusive && (
            <div className="absolute left-3 bottom-3 px-2 py-1 rounded-lg bg-[#f5c518]/90 text-black text-[10px] font-bold uppercase tracking-[0.15em]">
              Exclusive
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-5 w-full max-w-full overflow-x-hidden">
          <div className="flex justify-between items-start gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-800 text-xl tracking-[0.02em] text-white leading-tight break-words">
                {beat.title}
              </h2>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isBeatFree(beat) && (
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-green-900/25 text-green-400 border border-green-800/30">
                    Free DL
                  </span>
                )}

                {downloadUnlocked ? (
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20">
                    Download Ready
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-[#111] text-[#666] border border-[#222] flex items-center gap-1">
                    <Lock size={10} />
                    Locked
                  </span>
                )}
              </div>
            </div>

            {/* PRICE DISPLAY — FREE beats never show a dollar amount, ever */}
            <div className="text-right flex-shrink-0">
              <div className={`font-display text-[2rem] font-900 leading-none ${isBeatFree(beat) ? 'text-green-400' : 'text-[#f5c518]'}`}>
                {getBeatPriceLabel(beat)}
              </div>
            </div>
          </div>

          {tagGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagGroups.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-xl bg-[#171717] border border-white/5 text-[#9a9a9a] text-xs break-words">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {beat.description && <p className="text-[15px] text-[#9a9a9a] leading-relaxed break-words">{beat.description}</p>}

          {beat.terms && (
            <div className="text-xs text-[#666] border-t border-[#1a1a1a] pt-3 leading-relaxed break-words">
              <span className="text-[#888] uppercase tracking-wider">Terms:</span> {beat.terms}
            </div>
          )}

          <div className="flex items-center justify-center gap-4 rounded-[1.4rem] border border-white/5 bg-[#101010] p-3">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className="w-11 h-11 rounded-2xl bg-[#171717] text-[#888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="Previous beat"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={handlePlay}
              className="w-14 h-14 rounded-full bg-[#f5c518] flex items-center justify-center text-black hover:bg-[#f5c518]/90 transition-colors shadow-[0_0_30px_rgba(245,197,24,0.22)]"
              aria-label={isCurrentPlaying ? 'Pause beat' : 'Play beat'}
            >
              {isCurrentPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              disabled={!hasNext}
              className="w-11 h-11 rounded-2xl bg-[#171717] text-[#888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="Next beat"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex gap-2.5 pt-1 flex-wrap">
            {purchaseAvailable && (
              <button onClick={onBuy} className="btn-gold flex-1 min-w-[130px] py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <ShoppingBag size={16} />
                Buy
              </button>
            )}

            {purchaseAvailable && (
              <button
                onClick={handleAddToBeatBox}
                className="btn-dark flex-1 min-w-[130px] py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag size={16} />
                Beat Box
              </button>
            )}

            {downloadUnlocked && (
              <button
                onClick={handleDownload}
                className="btn-gold flex-1 min-w-[130px] py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Download
              </button>
            )}

            {!downloadUnlocked && (
              <button
                onClick={handleDownload}
                className="flex-1 min-w-[130px] py-3 rounded-xl text-sm flex items-center justify-center gap-2 bg-[#111] border border-[#222] text-[#666]"
              >
                <Lock size={16} />
                Locked
              </button>
            )}

            <ShareButton
              title={beat.title}
              text={`Check out "${beat.title}" by ${BRAND_NAME}`}
              url={window.location.href}
              className="px-4 py-3 rounded-xl bg-[#171717] border border-white/5 text-[#888] hover:text-white flex-shrink-0"
            />
          </div>

          {/* ADMIN CONTROLS — always accessible when admin is logged in */}
          {isAdmin && (
            <div className="border-t border-[#1a1a1a] pt-4 space-y-3 w-full max-w-full overflow-x-hidden">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => toggleQuickAdmin({ hidden: !adminForm.hidden })}
                  disabled={saving}
                  className="btn-dark py-2 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {adminForm.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  {adminForm.hidden ? 'Show' : 'Hide'}
                </button>

                <button
                  onClick={() => toggleQuickAdmin({ release_download: !adminForm.release_download })}
                  disabled={saving}
                  className="btn-dark py-2 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Download size={13} />
                  {adminForm.release_download ? 'Lock DL' : 'Release DL'}
                </button>
              </div>

              {showAdminControls && (
                <div className="space-y-3 w-full max-w-full overflow-x-hidden">
                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.title}
                    onChange={(event) => updateAdminForm('title', event.target.value)}
                    placeholder="Title"
                  />

                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.is_free ? '0' : adminForm.price}
                    disabled={adminForm.is_free}
                    onChange={(event) => updateAdminForm('price', event.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price (default $40)"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className="input-dark w-full px-3 py-2 text-xs" value={adminForm.genre} onChange={(event) => updateAdminForm('genre', event.target.value)} placeholder="Genre tags" />
                    <input className="input-dark w-full px-3 py-2 text-xs" value={adminForm.style} onChange={(event) => updateAdminForm('style', event.target.value)} placeholder="Style tags" />
                    <input className="input-dark w-full px-3 py-2 text-xs" value={adminForm.type} onChange={(event) => updateAdminForm('type', event.target.value)} placeholder="Type tags" />
                    <input className="input-dark w-full px-3 py-2 text-xs" value={adminForm.vibe} onChange={(event) => updateAdminForm('vibe', event.target.value)} placeholder="Vibe tags" />
                  </div>

                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.mood}
                    onChange={(event) => updateAdminForm('mood', event.target.value)}
                    placeholder="Mood tags"
                  />

                  <textarea className="input-dark w-full px-4 py-3 text-sm min-h-[90px] resize-none" value={adminForm.description} onChange={(event) => updateAdminForm('description', event.target.value)} placeholder="Description" />

                  <textarea className="input-dark w-full px-4 py-3 text-sm min-h-[70px] resize-none" value={adminForm.terms} onChange={(event) => updateAdminForm('terms', event.target.value)} placeholder="Terms" />

                  <div className="grid grid-cols-2 gap-2">
                    <AdminToggle label="Free" active={adminForm.is_free} onClick={() => updateAdminForm('is_free', !adminForm.is_free)} />
                    <AdminToggle label="Exclusive" active={adminForm.exclusive} onClick={() => updateAdminForm('exclusive', !adminForm.exclusive)} />
                    <AdminToggle label="Sold" active={adminForm.sold} onClick={() => updateAdminForm('sold', !adminForm.sold)} />
                    <AdminToggle label="Approved" active={adminForm.admin_approved} onClick={() => updateAdminForm('admin_approved', !adminForm.admin_approved)} />
                    <AdminToggle label="Hidden" active={adminForm.hidden} onClick={() => updateAdminForm('hidden', !adminForm.hidden)} />
                    <AdminToggle label="Release DL" active={adminForm.release_download} onClick={() => updateAdminForm('release_download', !adminForm.release_download)} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={saveAdminChanges} disabled={saving} className="btn-gold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                      <Save size={14} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>

                    <button onClick={deleteBeat} disabled={deleting} className="bg-red-950/25 border border-red-900/40 text-red-400 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                      <Trash2 size={14} />
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs border transition-all ${
        active
          ? 'bg-[#f5c518]/10 text-[#f5c518] border-[#f5c518]/25'
          : 'bg-[#111] text-[#666] border-[#222]'
      }`}
    >
      {label}
    </button>
  );
}

function MusicIcon() {
  return (
    <img
      src="https://pub-e227770267fa4d06ad83201dcfde8d6b.r2.dev/play-icon.png"
      alt=""
      className="w-20 h-20 object-contain opacity-40 select-none pointer-events-none"
      draggable={false}
    />
  );
}

