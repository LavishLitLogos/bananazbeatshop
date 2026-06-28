import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader, Music, Upload, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useApp } from '../../context/AppContext';
import { uploadAudio, uploadCoverArt } from '../../services/uploadService';
import type { Beat } from '../../types';

const ADMIN_PASSCODE = 'rwmg25';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const DEFAULT_TERMS = 'USABLE FOR ALL PURPOSES. Credit: prod. by ThisBeatIzBananaz 🔥';

type UploadKind = 'audio' | 'cover';
type AdminAction = 'create' | 'update' | 'delete';
type ToggleField =
  | 'hidden'
  | 'admin_approved'
  | 'sold'
  | 'is_free'
  | 'release_download'
  | 'exclusive';

type FormState = {
  title: string;
  cover_art_url: string;
  audio_file_url: string;
  price: string;
  is_free: boolean;
  sold: boolean;
  release_download: boolean;
  exclusive: boolean;
  hidden: boolean;
  admin_approved: boolean;
  genre: string;
  style: string;
  type: string;
  vibe: string;
  mood: string;
  artist_suggestion: string;
  description: string;
  terms: string;
};

interface BeatUploadModalProps {
  beat?: Beat | null;
  onClose: () => void;
  onSave: () => void;
}

interface AdminResponse<T = unknown> {
  data?: T;
  error?: string;
}

const normalizeCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

const getInitialForm = (beat?: Beat | null): FormState => ({
  title: beat?.title ?? '',
  cover_art_url: beat?.cover_art_url ?? '',
  audio_file_url: beat?.audio_file_url ?? '',
  price: String(beat?.price ?? 30),
  is_free: Boolean(beat?.is_free),
  sold: Boolean(beat?.sold),
  release_download: Boolean(beat?.release_download),
  exclusive: Boolean(beat?.exclusive),
  hidden: Boolean(beat?.hidden),
  admin_approved: beat?.admin_approved ?? true,
  genre: beat?.genre ?? '',
  style: beat?.style ?? '',
  type: beat?.type ?? '',
  vibe: beat?.vibe ?? '',
  mood: beat?.mood ?? '',
  artist_suggestion: beat?.artist_suggestion ?? '',
  description: beat?.description ?? '',
  terms: beat?.terms ?? DEFAULT_TERMS,
});

async function adminApi<T>(action: AdminAction, payload: Record<string, unknown>): Promise<AdminResponse<T>> {
  if (!SUPABASE_URL) {
    return { error: 'Supabase URL is not configured.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-beats/beats?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_PASSCODE,
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { error: json.error || `Admin request failed with status ${response.status}.` };
    }

    return { data: json as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Admin request failed.' };
  }
}

function buildBeatPayload(form: FormState) {
  const freeBeat = form.is_free;
  const price = freeBeat ? 0 : Number.parseFloat(form.price || '0') || 0;

  return {
    title: form.title.trim(),
    cover_art_url: form.cover_art_url.trim() || null,
    audio_file_url: form.audio_file_url.trim() || null,
    price,
    is_free: freeBeat,
    sold: form.sold,
    release_download: form.release_download,
    exclusive: form.exclusive,
    bananaz_exclusive: form.exclusive,
    no_sharing: false,
    hidden: form.hidden,
    admin_approved: form.admin_approved,
    genre: normalizeCsv(form.genre),
    style: normalizeCsv(form.style),
    type: normalizeCsv(form.type),
    vibe: normalizeCsv(form.vibe),
    mood: normalizeCsv(form.mood),
    artist_suggestion: form.artist_suggestion.trim(),
    description: form.description.trim(),
    terms: form.terms.trim() || DEFAULT_TERMS,
  };
}

function ProgressBar({ value }: { value: number }) {
  if (value <= 0) return null;

  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40 border border-[#2a2a2a]">
      <div
        className="h-full rounded-full bg-[#f5c518] transition-all duration-300"
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

    if (file) {
      onUpload(file, kind);
    }
  };

  return (
    <div className="rounded-2xl border border-[#242424] bg-[#101010] p-3 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <label className="text-xs uppercase tracking-[0.22em] text-[#777] truncate">{label}</label>

        {currentUrl && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[11px] uppercase tracking-wider text-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#333] bg-black px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#f5c518] transition hover:border-[#f5c518]/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? 'Uploading' : 'Upload'}
        </button>

        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

        <input
          value={currentUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={disabled || isUploading}
          placeholder="Paste URL or upload file"
          className="input-dark min-w-0 w-full px-3 py-2 text-xs"
        />
      </div>

      <ProgressBar value={progress} />

      {currentUrl && kind === 'cover' && (
        <img
          src={currentUrl}
          alt="Artwork preview"
          className="mt-3 h-28 w-28 rounded-xl border border-[#2b2b2b] object-cover"
        />
      )}

      {currentUrl && kind === 'audio' && (
        <audio src={currentUrl} controls className="mt-3 w-full max-w-full" preload="metadata" />
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
        <span className="block text-xs text-[#777] leading-relaxed">{description}</span>
      </span>

      <span className={`relative h-6 w-11 rounded-full transition flex-shrink-0 ${checked ? 'bg-[#f5c518]' : 'bg-[#2b2b2b]'}`}>
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
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

  const toggleField = (field: ToggleField) => {
    setForm((current) => {
      const nextValue = !current[field];

      if (field === 'is_free') {
        return {
          ...current,
          is_free: nextValue,
          price: nextValue ? '0' : current.price === '0' ? '30' : current.price,
        };
      }

      if (field === 'exclusive') {
        return {
          ...current,
          exclusive: nextValue,
          is_free: nextValue ? false : current.is_free,
          price: nextValue && current.price === '0' ? '30' : current.price,
        };
      }

      return { ...current, [field]: nextValue };
    });
  };

  const handleUpload = async (file: File, kind: UploadKind) => {
    setUploadProgress((current) => ({ ...current, [kind]: 12 }));

    try {
      setUploadProgress((current) => ({ ...current, [kind]: 35 }));
      const result = kind === 'audio' ? await uploadAudio(file) : await uploadCoverArt(file);
      setUploadProgress((current) => ({ ...current, [kind]: 90 }));

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
      }, 600);
    }
  };

  const validate = () => {
    if (!isAdmin) return 'Admin access is required.';
    if (!form.title.trim()) return 'Beat title is required.';
    if (!form.audio_file_url.trim()) return 'Audio upload or audio URL is required.';
    if (!form.cover_art_url.trim()) return 'Cover upload or cover URL is required.';
    if (!form.is_free && Number.parseFloat(form.price || '0') <= 0) return 'Paid beats need a price above $0.';
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
      const payload = buildBeatPayload(form);
      const response = isEdit
        ? await adminApi<Beat>('update', { id: beat?.id, ...payload })
        : await adminApi<Beat>('create', payload);

      if (response.error) {
        throw new Error(response.error);
      }

      addToast(isEdit ? 'Beat updated.' : 'Beat uploaded.', 'success');
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
      const response = await adminApi<{ success: boolean }>('delete', { id: beat.id });

      if (response.error) {
        throw new Error(response.error);
      }

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
      <div
        className="modal-backdrop overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div
          className="modal-box w-[calc(100vw-24px)] max-w-md max-h-[88vh] overflow-y-auto overflow-x-hidden p-6 text-center"
          onClick={(event) => event.stopPropagation()}
        >
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
        className="modal-box w-[calc(100vw-24px)] max-w-3xl max-h-[88vh] overflow-y-auto overflow-x-hidden"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#f5c518]">Admin Beat Lab</p>
            <h2 className="font-display text-xl font-black uppercase tracking-wider text-white">{modalTitle}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="rounded-xl p-2 text-[#777] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 w-full max-w-full overflow-x-hidden">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-4 min-w-0">
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

              <div className="rounded-2xl border border-[#242424] bg-[#101010] p-3 w-full max-w-full overflow-x-hidden">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                  <Music size={16} className="text-[#f5c518] flex-shrink-0" />
                  Room Logic
                </div>

                <p className="mt-1 text-xs leading-relaxed text-[#777]">
                  New uploads default to Beat Lab. Free Download moves it to Free DLs. Exclusive only appears in the exclusive room when the exclusive toggle is enabled.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <span className={`rounded-xl border px-3 py-2 text-center text-xs font-bold uppercase ${!form.is_free && !form.exclusive ? 'border-[#f5c518] text-[#f5c518]' : 'border-[#2b2b2b] text-[#777]'}`}>
                    Beat Lab
                  </span>
                  <span className={`rounded-xl border px-3 py-2 text-center text-xs font-bold uppercase ${form.is_free ? 'border-[#f5c518] text-[#f5c518]' : 'border-[#2b2b2b] text-[#777]'}`}>
                    Free DLs
                  </span>
                  <span className={`rounded-xl border px-3 py-2 text-center text-xs font-bold uppercase ${form.exclusive ? 'border-[#f5c518] text-[#f5c518]' : 'border-[#2b2b2b] text-[#777]'}`}>
                    Exclusives
                  </span>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.is_free ? '0' : form.price}
                    onChange={(event) => updateField('price', event.target.value)}
                    disabled={locked || form.is_free}
                    className="input-dark mt-1 w-full px-3 py-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-[#777]">Artist Suggestion</label>
                  <input
                    value={form.artist_suggestion}
                    onChange={(event) => updateField('artist_suggestion', event.target.value)}
                    disabled={locked}
                    placeholder="ex. Jadakiss, Future, SZA"
                    className="input-dark mt-1 w-full px-3 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    ['genre', 'Genre', 'Hip Hop, R&B'],
                    ['style', 'Style', 'Boom Bap, Trap Soul'],
                    ['type', 'Type', 'Freestyle, Hook Ready'],
                    ['vibe', 'Vibe', 'Dark, Motivational'],
                    ['mood', 'Mood', 'Pain, Victory'],
                  ] as const
                ).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs uppercase tracking-[0.22em] text-[#777]">{label}</label>
                    <input
                      value={form[field]}
                      onChange={(event) => updateField(field, event.target.value)}
                      disabled={locked}
                      placeholder={placeholder}
                      className="input-dark mt-1 w-full px-3 py-3 text-sm"
                    />
                  </div>
                ))}
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
            </div>

            <aside className="space-y-4 min-w-0">
              <div className="rounded-2xl border border-[#242424] bg-[#101010] p-4 w-full max-w-full overflow-hidden">
                <h3 className="mb-1 text-sm font-black uppercase tracking-wider text-white">Artwork Preview</h3>

                <div className="mt-3 aspect-square overflow-hidden rounded-2xl border border-[#2c2c2c] bg-black">
                  {form.cover_art_url ? (
                    <img src={form.cover_art_url} alt="Beat artwork preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-wider text-[#555]">
                      Upload cover art
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#242424] bg-[#101010] p-4 w-full max-w-full overflow-x-hidden">
                <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                  <CheckCircle2 size={16} className="text-[#f5c518] flex-shrink-0" />
                  Status Toggles
                </div>

                <ToggleRow label="Approved" description="Visible as approved content." checked={form.admin_approved} disabled={locked} onChange={() => toggleField('admin_approved')} />
                <ToggleRow label="Hidden" description="Hide from buyer-facing rooms." checked={form.hidden} disabled={locked} onChange={() => toggleField('hidden')} />
                <ToggleRow label="Sold" description="Mark as no longer available." checked={form.sold} disabled={locked} onChange={() => toggleField('sold')} />
                <ToggleRow label="Free" description="Move to Free DLs and force price to $0." checked={form.is_free} disabled={locked} onChange={() => toggleField('is_free')} />
                <ToggleRow label="Release Download" description="Admin unlock flag for download access." checked={form.release_download} disabled={locked} onChange={() => toggleField('release_download')} />
                <ToggleRow label="Exclusive" description="Only then appears in Exclusives." checked={form.exclusive} disabled={locked} onChange={() => toggleField('exclusive')} />
              </div>
            </aside>
          </div>

          <div className="sticky bottom-0 z-20 mt-5 flex flex-col gap-3 border-t border-[#222] bg-[#0b0b0b]/95 backdrop-blur-xl pt-4 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={locked}
              className="btn-gold flex-1 rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Beat Changes' : 'Upload Beat'}
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