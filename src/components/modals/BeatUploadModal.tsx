import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader, Music, Upload, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { uploadAudio, uploadCoverArt } from '../../services/uploadService';
import type { Beat } from '../../types';

const DEFAULT_TERMS = 'USABLE FOR ALL PURPOSES. Credit: prod. by ThisBeatIzBananaz 🔥';

type UploadKind = 'audio' | 'cover';
type ToggleField = 'hidden' | 'admin_approved' | 'sold' | 'release_download';
type RoomMode = 'beat' | 'free' | 'exclusive' | 'prodby';

type FormState = {
  title: string;
  cover_art_url: string;
  audio_file_url: string;
  price: string;
  room_mode: RoomMode;
  sold: boolean;
  release_download: boolean;
  hidden: boolean;
  admin_approved: boolean;
  genre: string;
  style: string;
  vibe: string;
  description: string;
  terms: string;
};

interface BeatUploadModalProps {
  beat?: Beat | null;
  onClose: () => void;
  onSave: () => void;
}

const normalizeCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

const getInitialRoomMode = (beat?: Beat | null): RoomMode => {
  if (beat?.exclusive) return 'exclusive';
  if (beat?.is_free) return 'free';
  return 'beat';
};

const getInitialForm = (beat?: Beat | null): FormState => ({
  title: beat?.title ?? '',
  cover_art_url: beat?.cover_art_url ?? '',
  audio_file_url: beat?.audio_file_url ?? '',
  price: String(beat?.price ?? 30),
  room_mode: getInitialRoomMode(beat),
  sold: Boolean(beat?.sold),
  release_download: Boolean(beat?.release_download),
  hidden: Boolean(beat?.hidden),
  admin_approved: beat?.admin_approved ?? true,
  genre: beat?.genre ?? '',
  style: beat?.style ?? '',
  vibe: beat?.vibe ?? '',
  description: beat?.description ?? '',
  terms: beat?.terms ?? DEFAULT_TERMS,
});

function buildBeatPayload(form: FormState) {
  const isFree = form.room_mode === 'free';
  const isExclusive = form.room_mode === 'exclusive';
  const price = isFree ? 0 : Number.parseFloat(form.price || '0') || 0;

  return {
    title: form.title.trim(),
    cover_art_url: form.cover_art_url.trim() || null,
    audio_file_url: form.audio_file_url.trim() || null,
    price,
    is_free: isFree,
    sold: form.sold,
    release_download: form.release_download,
    exclusive: isExclusive,
    bananaz_exclusive: isExclusive,
    no_sharing: false,
    hidden: form.hidden,
    admin_approved: form.admin_approved,
    genre: normalizeCsv(form.genre),
    style: normalizeCsv(form.style),
    type: '',
    vibe: normalizeCsv(form.vibe),
    mood: '',
    artist_suggestion: '',
    description: form.description.trim(),
    terms: form.terms.trim() || DEFAULT_TERMS,
    updated_at: new Date().toISOString(),
  };
}

function buildProdByPayload(form: FormState) {
  return {
    title: form.title.trim(),
    artist_name: '',
    cover_art_url: form.cover_art_url.trim() || null,
    audio_file_url: form.audio_file_url.trim() || null,
    description: form.description.trim(),
    rights_text: form.terms.trim() || DEFAULT_TERMS,
    hidden: form.hidden,
    admin_approved: form.admin_approved,
    exclusive: false,
    price: Number.parseFloat(form.price || '0') || 0,
    is_free: false,
    release_download: form.release_download,
    no_sharing: false,
    sold: form.sold,
    updated_at: new Date().toISOString(),
  };
}

function ProgressBar({ value }: { value: number }) {
  if (value <= 0) return null;

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40 border border-[#2a2a2a]">
      <div
        className="h-full rounded-full bg-[#f5c518] transition-all duration-200"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

interface UploadFieldProps {
  label: string;
  kind: UploadKind;
  accept: string;
  currentUrl: string;
  progress: number;
  disabled: boolean;
  onUpload: (file: File, kind: UploadKind) => void;
  onUrlChange: (url: string) => void;
  onClear: () => void;
}

function UploadField({
  label,
  kind,
  accept,
  currentUrl,
  progress,
  disabled,
  onUpload,
  onUrlChange,
  onClear,
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = progress > 0 && progress < 100;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) onUpload(file, kind);
  };

  return (
    <div className="rounded-2xl border border-[#242424] bg-[#101010] p-3 w-full overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs uppercase tracking-[0.22em] text-[#777]">{label}</label>

        {currentUrl && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[11px] uppercase tracking-wider text-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#333] bg-black px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#f5c518] transition hover:border-[#f5c518]/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? 'Uploading' : 'Upload File'}
        </button>

        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

        <input
          value={currentUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={disabled || isUploading}
          placeholder="Paste URL or upload file"
          className="input-dark w-full px-3 py-3 text-sm"
        />
      </div>

      <ProgressBar value={progress} />

      {currentUrl && kind === 'cover' && (
        <img
          src={currentUrl}
          alt="Artwork preview"
          className="mt-3 aspect-square w-full max-w-[180px] rounded-xl border border-[#2b2b2b] object-cover"
        />
      )}

      {currentUrl && kind === 'audio' && (
        <audio src={currentUrl} controls className="mt-3 w-full" preload="metadata" />
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}

function ToggleRow({ label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 border-b border-[#1f1f1f] py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="block text-xs leading-relaxed text-[#777]">{description}</span>
      </span>

      <span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${checked ? 'bg-[#f5c518]' : 'bg-[#2b2b2b]'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function RoomModeButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-center text-xs font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-[#f5c518] bg-[#f5c518]/10 text-[#f5c518]'
          : 'border-[#2b2b2b] bg-black/30 text-[#777] hover:border-[#f5c518]/40 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

export function BeatUploadModal({ beat, onClose, onSave }: BeatUploadModalProps) {
  const { isAdmin } = useAdmin();
  const { addToast, refreshContent } = useApp();

  const [form, setForm] = useState<FormState>(() => getInitialForm(beat));
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<UploadKind, number>>({ audio: 0, cover: 0 });

  const isEdit = Boolean(beat?.id);
  const modalTitle = useMemo(() => (isEdit ? 'Edit Beat' : 'Upload Beat'), [isEdit]);
  const locked = saving || uploadProgress.audio > 0 || uploadProgress.cover > 0;

  useEffect(() => {
    setForm(getInitialForm(beat));
  }, [beat]);

  const updateField = <Key extends keyof FormState>(field: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setRoomMode = (mode: RoomMode) => {
    setForm((current) => ({
      ...current,
      room_mode: mode,
      price: mode === 'free' ? '0' : current.price === '0' ? '30' : current.price,
      release_download: mode === 'free' ? true : current.release_download,
    }));
  };

  const toggleField = (field: ToggleField) => {
    setForm((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleUpload = async (file: File, kind: UploadKind) => {
    setUploadProgress((current) => ({ ...current, [kind]: 10 }));

    try {
      const result = kind === 'audio' ? await uploadAudio(file) : await uploadCoverArt(file);

      if (kind === 'audio') {
        updateField('audio_file_url', result.url);
      } else {
        updateField('cover_art_url', result.url);
      }

      setUploadProgress((current) => ({ ...current, [kind]: 100 }));
      addToast(`${kind === 'audio' ? 'Audio' : 'Artwork'} uploaded.`, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Upload failed.', 'error');
    } finally {
      window.setTimeout(() => {
        setUploadProgress((current) => ({ ...current, [kind]: 0 }));
      }, 450);
    }
  };

  const validate = () => {
    if (!isAdmin) return 'Admin access is required.';
    if (!form.title.trim()) return 'Beat title is required.';
    if (!form.audio_file_url.trim()) return 'Audio upload or audio URL is required.';
    if (!form.cover_art_url.trim()) return 'Cover upload or cover URL is required.';
    if (form.room_mode !== 'free' && Number.parseFloat(form.price || '0') <= 0) {
      return 'Paid uploads need a price above $0.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();

    if (validationError) {
      addToast(validationError, 'error');
      return;
    }

    setSaving(true);

    try {
      if (form.room_mode === 'prodby' && !isEdit) {
        const { error } = await supabase.from('prod_by_songs').insert(buildProdByPayload(form));

        if (error) throw error;

        addToast('Produced By song uploaded.', 'success');
      } else {
        const payload = buildBeatPayload(form);

        const { error } = isEdit
          ? await supabase.from('beats').update(payload).eq('id', beat?.id)
          : await supabase.from('beats').insert({
              ...payload,
              created_at: new Date().toISOString(),
            });

        if (error) throw error;

        addToast(isEdit ? 'Beat updated.' : 'Beat uploaded.', 'success');
      }

      refreshContent();
      onSave();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Beat save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!beat?.id || !window.confirm('Delete this beat?')) return;

    setSaving(true);

    try {
      const { error } = await supabase.from('beats').delete().eq('id', beat.id);

      if (error) throw error;

      addToast('Beat deleted.', 'info');
      refreshContent();
      onSave();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Delete failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="modal-backdrop overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="modal-box w-[calc(100vw-24px)] max-w-md p-6 text-center overflow-x-hidden">
          <X className="mx-auto mb-3 text-red-300" size={28} />
          <h2 className="font-display text-xl font-black uppercase text-white">Admin Only</h2>
          <p className="mt-2 text-sm text-[#999]">Beat uploads and edits are locked to the owner panel.</p>
          <button type="button" onClick={onClose} className="btn-gold mt-5 rounded-xl px-5 py-3 text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop overflow-hidden"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div
        className="modal-box w-[calc(100vw-24px)] max-w-xl max-h-[88vh] overflow-y-auto overflow-x-hidden"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#f5c518]">Admin Beat Lab</p>
            <h2 className="font-display text-xl font-black uppercase tracking-wider text-white">{modalTitle}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="flex-shrink-0 rounded-xl p-2 text-[#777] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close upload modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4 w-full overflow-x-hidden">
          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Beat Title *</label>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              disabled={locked}
              placeholder="Name the beat"
              className="input-dark mt-1 w-full px-3 py-3 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-[#242424] bg-[#101010] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-white">Image Preview</h3>

            <div className="aspect-square w-full overflow-hidden rounded-2xl border border-[#2c2c2c] bg-black">
              {form.cover_art_url ? (
                <img src={form.cover_art_url} alt="Beat artwork preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-wider text-[#555]">
                  Upload cover art
                </div>
              )}
            </div>
          </div>

          <UploadField
            label="Audio Upload"
            kind="audio"
            accept="audio/*,.mp3,.wav,.flac,.aiff,.aif,.m4a,.ogg"
            currentUrl={form.audio_file_url}
            progress={uploadProgress.audio}
            disabled={saving}
            onUpload={handleUpload}
            onUrlChange={(url) => updateField('audio_file_url', url)}
            onClear={() => updateField('audio_file_url', '')}
          />

          <UploadField
            label="Cover Upload"
            kind="cover"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
            currentUrl={form.cover_art_url}
            progress={uploadProgress.cover}
            disabled={saving}
            onUpload={handleUpload}
            onUrlChange={(url) => updateField('cover_art_url', url)}
            onClear={() => updateField('cover_art_url', '')}
          />

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.room_mode === 'free' ? '0' : form.price}
              onChange={(event) => updateField('price', event.target.value)}
              disabled={locked || form.room_mode === 'free'}
              className="input-dark mt-1 w-full px-3 py-3 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-[#242424] bg-[#101010] p-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
              <Music size={16} className="text-[#f5c518]" />
              Room
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <RoomModeButton active={form.room_mode === 'beat'} label="Beat" onClick={() => setRoomMode('beat')} disabled={locked} />
              <RoomModeButton active={form.room_mode === 'free'} label="Free" onClick={() => setRoomMode('free')} disabled={locked} />
              <RoomModeButton active={form.room_mode === 'exclusive'} label="Exclusive" onClick={() => setRoomMode('exclusive')} disabled={locked} />
              <RoomModeButton active={form.room_mode === 'prodby'} label="Produced By" onClick={() => setRoomMode('prodby')} disabled={locked || isEdit} />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Genre</label>
            <input
              value={form.genre}
              onChange={(event) => updateField('genre', event.target.value)}
              disabled={locked}
              placeholder="Hip Hop, R&B"
              className="input-dark mt-1 w-full px-3 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Style</label>
            <input
              value={form.style}
              onChange={(event) => updateField('style', event.target.value)}
              disabled={locked}
              placeholder="Boom Bap, Trap Soul"
              className="input-dark mt-1 w-full px-3 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Vibe</label>
            <input
              value={form.vibe}
              onChange={(event) => updateField('vibe', event.target.value)}
              disabled={locked}
              placeholder="Dark, Motivational"
              className="input-dark mt-1 w-full px-3 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              disabled={locked}
              rows={4}
              placeholder="Describe the beat for buyers."
              className="input-dark mt-1 w-full resize-none px-3 py-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Terms</label>
            <textarea
              value={form.terms}
              onChange={(event) => updateField('terms', event.target.value)}
              disabled={locked}
              rows={3}
              className="input-dark mt-1 w-full resize-none px-3 py-3 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-[#242424] bg-[#101010] p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
              <CheckCircle2 size={16} className="text-[#f5c518]" />
              Status Toggles
            </div>

            <ToggleRow label="Approved" description="Visible as approved content." checked={form.admin_approved} disabled={locked} onChange={() => toggleField('admin_approved')} />
            <ToggleRow label="Hidden" description="Hide from buyer-facing rooms." checked={form.hidden} disabled={locked} onChange={() => toggleField('hidden')} />
            <ToggleRow label="Sold" description="Mark as no longer available." checked={form.sold} disabled={locked} onChange={() => toggleField('sold')} />
            <ToggleRow label="Release Download" description="Admin unlock flag for download access." checked={form.release_download} disabled={locked} onChange={() => toggleField('release_download')} />
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 mt-5 flex flex-col gap-3 border-t border-[#222] bg-[#0b0b0b]/95 px-4 pt-4 pb-1 backdrop-blur-xl">
            <button
              type="button"
              onClick={handleSave}
              disabled={locked}
              className="btn-gold rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Beat Changes' : form.room_mode === 'prodby' ? 'Upload Produced By' : 'Upload Beat'}
            </button>

            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={locked}
                className="rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-3 text-sm font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}