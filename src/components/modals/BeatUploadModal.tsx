import { Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { uploadAudio, uploadCoverArt } from '../../services/uploadService';
import type { Beat } from '../../types';
import { BEAT_INFO_DEFAULT } from '../../utils/branding';
import { DEFAULT_BEAT_PRICE, getBeatPriceValue, isBeatFree } from '../../utils/beatAccess';

interface BeatUploadModalProps {
  beat?: Beat | null;
  onClose: () => void;
  onSave: () => void;
}

interface BeatUploadFormState {
  title: string;
  price: string;
  genre: string;
  style: string;
  type: string;
  vibe: string;
  mood: string;
  artist_suggestion: string;
  description: string;
  terms: string;
  cover_art_url: string;
  audio_file_url: string;
  is_free: boolean;
  exclusive: boolean;
  bananaz_exclusive: boolean;
  no_sharing: boolean;
  hidden: boolean;
  sold: boolean;
  release_download: boolean;
  admin_approved: boolean;
}

const BEAT_UPLOAD_DEFAULT_TERMS = BEAT_INFO_DEFAULT;

function createBeatUploadForm(beat?: Beat | null): BeatUploadFormState {
  const freeBeat = beat ? isBeatFree(beat) : false;

  return {
    title: beat?.title || '',
    price: String(freeBeat ? 0 : beat ? getBeatPriceValue(beat) : DEFAULT_BEAT_PRICE),
    genre: beat?.genre || '',
    style: beat?.style || '',
    type: beat?.type || '',
    vibe: beat?.vibe || '',
    mood: beat?.mood || '',
    artist_suggestion: beat?.artist_suggestion || '',
    description: beat?.description || '',
    terms: beat?.terms || BEAT_UPLOAD_DEFAULT_TERMS,
    cover_art_url: beat?.cover_art_url || '',
    audio_file_url: beat?.audio_file_url || '',
    is_free: freeBeat,
    exclusive: Boolean(beat?.exclusive),
    bananaz_exclusive: Boolean(beat?.bananaz_exclusive),
    no_sharing: Boolean(beat?.no_sharing),
    hidden: Boolean(beat?.hidden),
    sold: Boolean(beat?.sold),
    release_download: Boolean(beat?.release_download),
    admin_approved: beat?.admin_approved !== false,
  };
}

export function BeatUploadModal({ beat, onClose, onSave }: BeatUploadModalProps) {
  const { addToast } = useApp();
  const [form, setForm] = useState<BeatUploadFormState>(() => createBeatUploadForm(beat));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [savingUpload, setSavingUpload] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');

  const editingBeat = Boolean(beat?.id);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [audioFile]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [coverFile]);

  const updateUploadForm = <Key extends keyof BeatUploadFormState>(
    key: Key,
    value: BeatUploadFormState[Key]
  ) => {
    setForm((currentForm) => {
      const nextForm = { ...currentForm, [key]: value };

      if (key === 'is_free') {
        const isFree = Boolean(value);
        nextForm.price = isFree ? '0' : String(DEFAULT_BEAT_PRICE);
        nextForm.release_download = isFree ? true : nextForm.release_download;
      }

      return nextForm;
    });
  };

  const saveUploadBeat = async () => {
    if (savingUpload) return;

    const cleanTitle = form.title.trim();

    if (!cleanTitle) {
      addToast('Beat title is required.', 'error');
      return;
    }

    setSavingUpload(true);

    try {
      let audioUrl = form.audio_file_url.trim();
      let coverUrl = form.cover_art_url.trim();

      const [audioResult, coverResult] = await Promise.all([
        audioFile ? uploadAudio(audioFile) : Promise.resolve(null),
        coverFile ? uploadCoverArt(coverFile) : Promise.resolve(null),
      ]);

      if (audioResult?.publicUrl) {
        audioUrl = audioResult.publicUrl;
      }

      if (coverResult?.publicUrl) {
        coverUrl = coverResult.publicUrl;
      }

      const isFree = Boolean(form.is_free);
      const price = getBeatPriceValue({ is_free: false, price: form.price });
      const now = new Date().toISOString();
      const payload: Partial<Beat> = {
        title: cleanTitle,
        price: isFree ? 0 : price,
        genre: form.genre.trim(),
        style: form.style.trim(),
        type: form.type.trim(),
        vibe: form.vibe.trim(),
        mood: form.mood.trim(),
        artist_suggestion: form.artist_suggestion.trim(),
        description: form.description.trim(),
        terms: form.terms.trim(),
        cover_art_url: coverUrl || undefined,
        audio_file_url: audioUrl || undefined,
        is_free: isFree,
        exclusive: form.exclusive,
        bananaz_exclusive: form.bananaz_exclusive,
        no_sharing: form.no_sharing,
        hidden: form.hidden,
        sold: form.sold,
        release_download: isFree ? true : form.release_download,
        admin_approved: form.admin_approved,
        updated_at: now,
      };

      if (editingBeat && beat?.id) {
        const { error } = await supabase.from('beats').update(payload).eq('id', beat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('beats')
          .insert({ ...payload, created_at: now, updated_at: now });
        if (error) throw error;
      }

      addToast(editingBeat ? 'Beat updated.' : 'Beat uploaded.', 'success');
      onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Beat save failed.';
      addToast(message, 'error');
    } finally {
      setSavingUpload(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box max-w-lg w-full p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display font-900 text-xl uppercase text-white">
              {editingBeat ? 'Edit Beat' : 'Upload Beat'}
            </div>
            <div className="text-xs text-[#666] mt-1">
              Paid beats default to $40. Free beats save as Free with no dollar amount.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
            aria-label="Close upload modal"
          >
            <X size={18} />
          </button>
        </div>

        <input
          className="input-dark w-full px-4 py-3 text-sm"
          value={form.title}
          onChange={(event) => updateUploadForm('title', event.target.value)}
          placeholder="Beat title"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3 cursor-pointer hover:border-[#f5c518]/35">
            <div className="text-sm text-white">Audio File</div>
            <div className="text-[11px] text-[#666] mt-1 truncate">
              {audioFile?.name || form.audio_file_url || 'Choose MP3, WAV, or FLAC'}
            </div>
            <input
              className="hidden"
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,.mp3,.wav,.flac"
              onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
            />
          </label>
          <label className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3 cursor-pointer hover:border-[#f5c518]/35">
            <div className="text-sm text-white">Cover Art</div>
            <div className="text-[11px] text-[#666] mt-1 truncate">
              {coverFile?.name || form.cover_art_url || 'Choose image'}
            </div>
            <input
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <input
          className="input-dark w-full px-4 py-3 text-sm"
          value={form.audio_file_url}
          onChange={(event) => updateUploadForm('audio_file_url', event.target.value)}
          placeholder="Audio file URL"
        />

        <input
          className="input-dark w-full px-4 py-3 text-sm"
          value={form.cover_art_url}
          onChange={(event) => updateUploadForm('cover_art_url', event.target.value)}
          placeholder="Cover art URL"
        />

        {(audioFile || form.audio_file_url) && (
          <div className="rounded-2xl border border-[#222] bg-[#0d0d0d] p-3">
            <div className="text-sm text-white">Audio Preview</div>
            <audio
              controls
              className="mt-3 w-full"
              src={audioPreviewUrl || form.audio_file_url}
            />
          </div>
        )}

        {(coverFile || form.cover_art_url) && (
          <div className="rounded-2xl border border-[#222] bg-[#0d0d0d] p-3">
            <div className="text-sm text-white">Cover Preview</div>
            <div className="mt-3 overflow-hidden rounded-xl border border-[#1e1e1e] bg-black">
              <img
                src={coverPreviewUrl || form.cover_art_url}
                alt="Cover preview"
                className="w-full max-h-64 object-contain"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <input
            className="input-dark w-full px-4 py-3 text-sm"
            value={form.is_free ? '0' : form.price}
            disabled={form.is_free}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) => updateUploadForm('price', event.target.value)}
            placeholder="Price (default $40)"
          />
          <button
            type="button"
            onClick={() => updateUploadForm('is_free', !form.is_free)}
            className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase ${
              form.is_free
                ? 'bg-green-900/25 text-green-300 border-green-700/40'
                : 'bg-[#111] text-[#888] border-[#222]'
            }`}
          >
            {form.is_free ? 'Free Beat' : 'Paid Beat'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className="input-dark w-full px-3 py-2.5 text-xs" value={form.genre} onChange={(event) => updateUploadForm('genre', event.target.value)} placeholder="Genre tags" />
          <input className="input-dark w-full px-3 py-2.5 text-xs" value={form.style} onChange={(event) => updateUploadForm('style', event.target.value)} placeholder="Style tags" />
          <input className="input-dark w-full px-3 py-2.5 text-xs" value={form.type} onChange={(event) => updateUploadForm('type', event.target.value)} placeholder="Type tags" />
          <input className="input-dark w-full px-3 py-2.5 text-xs" value={form.vibe} onChange={(event) => updateUploadForm('vibe', event.target.value)} placeholder="Vibe tags" />
        </div>

        <input
          className="input-dark w-full px-4 py-3 text-sm"
          value={form.mood}
          onChange={(event) => updateUploadForm('mood', event.target.value)}
          placeholder="Mood tags"
        />

        <input
          className="input-dark w-full px-4 py-3 text-sm"
          value={form.artist_suggestion}
          onChange={(event) => updateUploadForm('artist_suggestion', event.target.value)}
          placeholder="Artist suggestion"
        />

        <textarea
          className="input-dark w-full px-4 py-3 text-sm min-h-[90px] resize-y"
          value={form.description}
          onChange={(event) => updateUploadForm('description', event.target.value)}
          placeholder="Description"
        />

        <textarea
          className="input-dark w-full px-4 py-3 text-sm min-h-[70px] resize-y"
          value={form.terms}
          onChange={(event) => updateUploadForm('terms', event.target.value)}
          placeholder="Terms"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <BeatUploadFlag label="Exclusive" active={form.exclusive} onClick={() => updateUploadForm('exclusive', !form.exclusive)} />
          <BeatUploadFlag label="Bananaz Exclusive" active={form.bananaz_exclusive} onClick={() => updateUploadForm('bananaz_exclusive', !form.bananaz_exclusive)} />
          <BeatUploadFlag label="No Sharing" active={form.no_sharing} onClick={() => updateUploadForm('no_sharing', !form.no_sharing)} />
          <BeatUploadFlag label="Hidden" active={form.hidden} onClick={() => updateUploadForm('hidden', !form.hidden)} />
          <BeatUploadFlag label="Sold" active={form.sold} onClick={() => updateUploadForm('sold', !form.sold)} />
          <BeatUploadFlag label="Release DL" active={form.release_download} onClick={() => updateUploadForm('release_download', !form.release_download)} />
          <BeatUploadFlag label="Approved" active={form.admin_approved} onClick={() => updateUploadForm('admin_approved', !form.admin_approved)} />
        </div>

        <button
          type="button"
          onClick={saveUploadBeat}
          disabled={savingUpload}
          className="btn-gold w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Save size={15} />
          {savingUpload ? 'Saving...' : editingBeat ? 'Save Beat' : 'Upload Beat'}
        </button>
      </div>
    </div>
  );
}

function BeatUploadFlag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
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
