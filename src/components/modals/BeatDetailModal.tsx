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

function formatPrice(value: number | string | undefined) {
  const numberValue = Number(value || 0);
  return numberValue % 1 === 0 ? String(numberValue) : numberValue.toFixed(2);
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
    price: String(beat.price || 0),
    genre: beat.genre || '',
    style: beat.style || '',
    type: beat.type || '',
    vibe: beat.vibe || '',
    mood: beat.mood || '',
    description: beat.description || '',
    terms: beat.terms || '',
    hidden: Boolean(beat.hidden),
    is_free: Boolean(beat.is_free),
    exclusive: Boolean(beat.exclusive),
    sold: Boolean(beat.sold),
    release_download: Boolean(beat.release_download),
    admin_approved: beat.admin_approved !== false,
  };
}

function canDownloadBeat(beat: Beat, isAdmin: boolean) {
  if (!beat.audio_file_url) return false;
  if (isAdmin) return true;
  if (beat.is_free) return true;
  return Boolean(beat.release_download);
}

export function BeatDetailModal({ beat, onClose, onBuy, allBeats = [] }: BeatDetailModalProps) {
  const { addToast, isAdmin, adminEditMode, refreshContent } = useApp();
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
      audio.playQueue(allBeats, currentIndex, true);
      return;
    }

    audio.play(beat, true);
  };

  const handlePrev = () => {
    if (!hasPrev) return;

    if (isCurrentBeat && audio.hasPrev) {
      audio.prev();
      return;
    }

    const prevBeat = allBeats[currentIndex - 1];
    if (!prevBeat?.audio_file_url) return;

    audio.playQueue(allBeats, currentIndex - 1, true);
  };

  const handleNext = () => {
    if (!hasNext) return;

    if (isCurrentBeat && audio.hasNext) {
      audio.next();
      return;
    }

    const nextBeat = allBeats[currentIndex + 1];
    if (!nextBeat?.audio_file_url) return;

    audio.playQueue(allBeats, currentIndex + 1, true);
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

    const link = document.createElement('a');
    link.href = beat.audio_file_url;
    link.download = `${beat.title || 'thisbeatizbananaz-beat'}.mp3`;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();

    addToast('Download started.', 'success');
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
      price: Number(adminForm.price || 0),
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
      release_download: adminForm.release_download,
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
      className="modal-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="modal-box max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-lg hover:bg-white/10 bg-black/40 text-[#aaa] hover:text-white transition-colors"
            aria-label="Close beat detail"
          >
            <X size={18} />
          </button>

          <div className="aspect-square bg-[#111] rounded-t-xl overflow-hidden">
            {beat.cover_art_url ? (
              <img src={beat.cover_art_url} alt={beat.title} className="w-full h-full object-cover" />
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

        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-900 text-xl uppercase tracking-wider text-white leading-tight">
                {beat.title}
              </h2>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {beat.is_free && (
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

            <div className="text-right">
              <div className="font-display text-2xl font-900 text-[#f5c518]">
                {beat.is_free ? 'FREE' : `$${formatPrice(beat.price)}`}
              </div>
            </div>
          </div>

          {tagGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagGroups.map((tag) => (
                <span key={tag} className="px-2 py-1 rounded-lg bg-[#1a1a1a] text-[#888] text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {beat.description && <p className="text-sm text-[#888] leading-relaxed">{beat.description}</p>}

          {beat.terms && (
            <div className="text-xs text-[#666] border-t border-[#1a1a1a] pt-3 leading-relaxed">
              <span className="text-[#888] uppercase tracking-wider">Terms:</span> {beat.terms}
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className="p-2 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous beat"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={handlePlay}
              className="w-12 h-12 rounded-full bg-[#f5c518] flex items-center justify-center text-black hover:bg-[#f5c518]/90 transition-colors"
              aria-label={isCurrentPlaying ? 'Pause beat' : 'Play beat'}
            >
              {isCurrentPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              disabled={!hasNext}
              className="p-2 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next beat"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            {!beat.is_free && !beat.sold && (
              <button onClick={onBuy} className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <ShoppingBag size={16} />
                Buy / Request
              </button>
            )}

            {(beat.is_free || beat.release_download || isAdmin) && (
              <button
                onClick={handleDownload}
                className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Download
              </button>
            )}

            {!beat.is_free && !beat.release_download && !isAdmin && (
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2 bg-[#111] border border-[#222] text-[#666]"
              >
                <Lock size={16} />
                Locked
              </button>
            )}

            <ShareButton
              title={beat.title}
              text={`Check out "${beat.title}" by ThisBeatIzBananaz™`}
              url={window.location.href}
              className="px-4 py-3 rounded-xl bg-[#1a1a1a] text-[#888] hover:text-white"
            />
          </div>

          {isAdmin && (
            <div className="border-t border-[#1a1a1a] pt-4 space-y-3">
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
                <div className="space-y-3">
                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.title}
                    onChange={(event) => updateAdminForm('title', event.target.value)}
                    placeholder="Title"
                  />

                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.price}
                    onChange={(event) => updateAdminForm('price', event.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input-dark w-full px-3 py-2 text-xs"
                      value={adminForm.genre}
                      onChange={(event) => updateAdminForm('genre', event.target.value)}
                      placeholder="Genre tags"
                    />

                    <input
                      className="input-dark w-full px-3 py-2 text-xs"
                      value={adminForm.style}
                      onChange={(event) => updateAdminForm('style', event.target.value)}
                      placeholder="Style tags"
                    />

                    <input
                      className="input-dark w-full px-3 py-2 text-xs"
                      value={adminForm.type}
                      onChange={(event) => updateAdminForm('type', event.target.value)}
                      placeholder="Type tags"
                    />

                    <input
                      className="input-dark w-full px-3 py-2 text-xs"
                      value={adminForm.vibe}
                      onChange={(event) => updateAdminForm('vibe', event.target.value)}
                      placeholder="Vibe tags"
                    />
                  </div>

                  <input
                    className="input-dark w-full px-4 py-3 text-sm"
                    value={adminForm.mood}
                    onChange={(event) => updateAdminForm('mood', event.target.value)}
                    placeholder="Mood tags"
                  />

                  <textarea
                    className="input-dark w-full px-4 py-3 text-sm min-h-[90px] resize-none"
                    value={adminForm.description}
                    onChange={(event) => updateAdminForm('description', event.target.value)}
                    placeholder="Description"
                  />

                  <textarea
                    className="input-dark w-full px-4 py-3 text-sm min-h-[70px] resize-none"
                    value={adminForm.terms}
                    onChange={(event) => updateAdminForm('terms', event.target.value)}
                    placeholder="Terms"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <AdminToggle label="Free" active={adminForm.is_free} onClick={() => updateAdminForm('is_free', !adminForm.is_free)} />
                    <AdminToggle label="Exclusive" active={adminForm.exclusive} onClick={() => updateAdminForm('exclusive', !adminForm.exclusive)} />
                    <AdminToggle label="Sold" active={adminForm.sold} onClick={() => updateAdminForm('sold', !adminForm.sold)} />
                    <AdminToggle label="Approved" active={adminForm.admin_approved} onClick={() => updateAdminForm('admin_approved', !adminForm.admin_approved)} />
                    <AdminToggle label="Hidden" active={adminForm.hidden} onClick={() => updateAdminForm('hidden', !adminForm.hidden)} />
                    <AdminToggle
                      label="Release DL"
                      active={adminForm.release_download}
                      onClick={() => updateAdminForm('release_download', !adminForm.release_download)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={saveAdminChanges}
                      disabled={saving}
                      className="btn-gold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Save size={14} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>

                    <button
                      onClick={deleteBeat}
                      disabled={deleting}
                      className="bg-red-950/25 border border-red-900/40 text-red-400 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                    >
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
  return <div className="text-6xl">🎵</div>;
}