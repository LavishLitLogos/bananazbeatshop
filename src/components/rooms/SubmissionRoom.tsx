import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileAudio,
  Loader2,
  Mail,
  Music,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { uploadSubmissionFile } from '../../services/uploadService';
import type { Submission } from '../../types';

type SubmissionView = 'form' | 'success';

type SubmissionForm = {
  buyer_name: string;
  buyer_email: string;
  purchased_beat: string;
  song_title: string;
  notes: string;
  file: File | null;
};

const emptyForm: SubmissionForm = {
  buyer_name: '',
  buyer_email: '',
  purchased_beat: '',
  song_title: '',
  notes: '',
  file: null,
};

function formatDate(value?: string) {
  if (!value) return 'Unknown date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function submissionStatusClasses(status: Submission['status']) {
  if (status === 'Accepted') return 'bg-green-900/30 text-green-400 border-green-800/40';
  if (status === 'Rejected') return 'bg-red-900/30 text-red-400 border-red-800/40';

  return 'bg-[#f5c518]/10 text-[#f5c518] border-[#f5c518]/20';
}

function getSubmissionFileName(url?: string) {
  if (!url) return 'No file attached';

  try {
    const parsed = new URL(url);
    const fileName = parsed.pathname.split('/').pop();
    return fileName ? decodeURIComponent(fileName) : 'Submission file';
  } catch {
    return 'Submission file';
  }
}

export function SubmissionRoom() {
  const { goBack, isAdmin, addToast } = useApp();
  const [view, setView] = useState<SubmissionView>('form');
  const [form, setForm] = useState<SubmissionForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [adminSubs, setAdminSubs] = useState<Submission[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [busySubId, setBusySubId] = useState<string | null>(null);

  const hasAdminAccess = Boolean(isAdmin);

  const selectedFileLabel = useMemo(() => {
    if (!form.file) return 'Choose audio/media file';
    return form.file.name;
  }, [form.file]);

  const fetchSubmissions = useCallback(async () => {
    if (!hasAdminAccess) return;

    setAdminLoading(true);

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Submissions failed to load.', 'error');
      setAdminSubs([]);
    } else {
      setAdminSubs((data || []) as Submission[]);
    }

    setAdminLoading(false);
  }, [addToast, hasAdminAccess]);

  useEffect(() => {
    if (!hasAdminAccess || !showAdmin) return;

    fetchSubmissions();

    const channel = supabase
      .channel('submission-room-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
        },
        () => {
          fetchSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSubmissions, hasAdminAccess, showAdmin]);

  const updateForm = <Key extends keyof SubmissionForm>(key: Key, value: SubmissionForm[Key]) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setView('form');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    updateForm('file', file);
  };

  const validateForm = () => {
    if (!form.buyer_name.trim()) {
      addToast('Name is required.', 'error');
      return false;
    }

    if (!form.buyer_email.trim()) {
      addToast('Email or contact is required.', 'error');
      return false;
    }

    if (!form.song_title.trim()) {
      addToast('Title is required.', 'error');
      return false;
    }

    if (!form.purchased_beat.trim()) {
      addToast('Purchased beat title is required.', 'error');
      return false;
    }

    if (!form.file) {
      addToast('Please attach your submission file.', 'error');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (submitting || !validateForm() || !form.file) return;

    setSubmitting(true);

    try {
      const cleanName = form.buyer_name.trim();
      const cleanContact = form.buyer_email.trim();
      const cleanBeatTitle = form.purchased_beat.trim();
      const cleanTitle = form.song_title.trim();
      const cleanNotes = form.notes.trim();

      const { data: matchedBeat, error: beatError } = await supabase
        .from('beats')
        .select('id,title,is_free')
        .ilike('title', cleanBeatTitle)
        .limit(1)
        .maybeSingle();

      if (beatError) {
        throw new Error('Could not verify the beat for this submission.');
      }

      if (!matchedBeat || matchedBeat.is_free) {
        throw new Error('Submissions are only for purchased Beat Lab beats.');
      }

      const { data: matchedOrder, error: orderError } = await supabase
        .from('orders')
        .select('id,beat_id,buyer_email,status,payment_received')
        .eq('buyer_email', cleanContact)
        .eq('beat_id', matchedBeat.id)
        .in('status', ['Sold', 'Released'])
        .limit(1)
        .maybeSingle();

      if (orderError) {
        throw new Error('Could not verify your purchase right now.');
      }

      if (!matchedOrder) {
        throw new Error('Only purchased Beat Lab beats can be submitted here.');
      }

      const uploaded = await uploadSubmissionFile(form.file);

      const { data: inserted, error } = await supabase
        .from('submissions')
        .insert({
          buyer_name: cleanName,
          buyer_email: cleanContact,
          beat_id: matchedBeat.id,
          song_title: cleanTitle,
          song_file_url: uploaded.url,
          song_file_path: uploaded.path,
          status: 'Pending',
          mic_rating: null,
          accepted: false,
          rejected: false,
          produced_by_toggle: false,
          exclusive_toggle: false,
          list_eligible_toggle: false,
          admin_notes: cleanNotes,
          metadata: {
            contact: cleanContact,
            notes: cleanNotes,
            purchased_beat: cleanBeatTitle,
            original_file_name: form.file.name,
            file_type: form.file.type,
            file_size: form.file.size,
            storage_path: uploaded.path,
            source_room: 'submission',
          },
        })
        .select()
        .single();

      if (error || !inserted) throw new Error(error?.message || 'Submission insert failed.');

      await supabase.from('notifications').insert({
        type: 'submission',
        title: `New Submission: ${cleanTitle}`,
        body: `From ${cleanName} — ${cleanContact}`,
        data: {
          submission_id: inserted.id,
          title: cleanTitle,
          contact: cleanContact,
        },
      });

      setView('success');
      addToast('Submission sent.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed.';
      addToast(message, 'error');
    }

    setSubmitting(false);
  };

  const updateSubmission = async (id: string, updates: Partial<Submission>) => {
    if (!hasAdminAccess || busySubId) return;

    setBusySubId(id);

    const { error } = await supabase
      .from('submissions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      addToast('Submission update failed.', 'error');
    } else {
      setAdminSubs((currentSubs) =>
        currentSubs.map((submission) =>
          submission.id === id
            ? {
                ...submission,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : submission
        )
      );

      addToast('Submission updated.', 'success');
    }

    setBusySubId(null);
  };

  const deleteSubmission = async (id: string) => {
    if (!hasAdminAccess || busySubId) return;

    const confirmed = window.confirm('Delete this submission from the admin inbox?');
    if (!confirmed) return;

    setBusySubId(id);

    const { error } = await supabase.from('submissions').delete().eq('id', id);

    if (error) {
      addToast('Delete failed.', 'error');
    } else {
      setAdminSubs((currentSubs) => currentSubs.filter((submission) => submission.id !== id));
      addToast('Submission deleted.', 'success');
    }

    setBusySubId(null);
  };

  const markHandled = (submission: Submission) => {
    updateSubmission(submission.id, {
      status: 'Accepted',
      accepted: true,
      rejected: false,
    });
  };

  const markRejected = (submission: Submission) => {
    updateSubmission(submission.id, {
      status: 'Rejected',
      accepted: false,
      rejected: true,
      produced_by_toggle: false,
      exclusive_toggle: false,
      list_eligible_toggle: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div>
              <h1 className="font-display font-800 text-xl uppercase tracking-wide text-white leading-none flex items-center gap-2">
                <img src="/assets/icons/grab-icon.png" alt="" className="w-5 h-5 object-contain" />
                Submission Room
              </h1>
              <p className="text-[10px] text-[#555] mt-0.5">
                Will be submitted for review.
              </p>
            </div>
          </div>

          {hasAdminAccess && (
            <button
              onClick={() => setShowAdmin((value) => !value)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                showAdmin
                  ? 'bg-[#f5c518] text-black'
                  : 'bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-white'
              }`}
            >
              {showAdmin ? 'Guest View' : 'Admin Inbox'}
            </button>
          )}
        </div>
      </div>

      {hasAdminAccess && showAdmin ? (
        <div className="px-4 py-4 space-y-3 pb-32">
          <div className="beat-card p-4">
            <div className="flex items-center gap-2 text-[#f5c518] text-xs font-bold uppercase tracking-[0.2em]">
              <ShieldCheck size={14} />
              Admin Submission Inbox
            </div>

            <p className="text-xs text-[#777] mt-2 leading-relaxed">
              Submissions stay private until manually reviewed.
            </p>
          </div>

          {adminLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin text-[#f5c518]" />
            </div>
          ) : adminSubs.length === 0 ? (
            <div className="text-center py-12 text-[#444]">
              <FileAudio size={34} className="mx-auto mb-3 opacity-40" />
              <div className="font-display text-xl">No submissions yet</div>
            </div>
          ) : (
            adminSubs.map((submission) => (
              <div key={submission.id} className="beat-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display font-800 text-white text-lg leading-tight truncate">
                      {submission.song_title}
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-[#888]">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-[#555]" />
                        <span>{submission.buyer_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-[#555]" />
                        <span className="break-all">{submission.buyer_email}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-[#555]" />
                        <span>{formatDate(submission.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${submissionStatusClasses(
                      submission.status
                    )}`}
                  >
                    {submission.status === 'Accepted' ? 'Handled' : submission.status}
                  </span>
                </div>

                {submission.admin_notes && (
                  <div className="rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] px-3 py-2">
                    <div className="text-[10px] text-[#555] uppercase tracking-[0.18em] mb-1">Notes</div>
                    <p className="text-xs text-[#aaa] whitespace-pre-wrap leading-relaxed">
                      {submission.admin_notes}
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] px-3 py-2">
                  <div className="text-[10px] text-[#555] uppercase tracking-[0.18em] mb-2">
                    Attached File
                  </div>

                  {submission.song_file_url ? (
                    <a
                      href={submission.song_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#f5c518] hover:underline flex items-center gap-2"
                    >
                      <FileAudio size={14} />
                      {getSubmissionFileName(submission.song_file_url)}
                    </a>
                  ) : (
                    <div className="text-xs text-[#555]">No file URL saved.</div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateSubmission(submission.id, { mic_rating: rating })}
                      disabled={busySubId === submission.id}
                      className="p-1 disabled:opacity-40"
                      aria-label={`Rate ${rating} mics`}
                    >
                      <Star
                        size={17}
                        className={
                          rating <= (submission.mic_rating || 0)
                            ? 'text-[#f5c518] fill-[#f5c518]'
                            : 'text-[#333]'
                        }
                      />
                    </button>
                  ))}

                  <span className="text-xs text-[#555] ml-1">
                    {submission.mic_rating ? `${submission.mic_rating}/5 mics` : 'Rate'}
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => markHandled(submission)}
                    disabled={busySubId === submission.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                      submission.status === 'Accepted'
                        ? 'bg-green-900/40 text-green-400 border border-green-800/30'
                        : 'bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-green-400'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    Mark Handled
                  </button>

                  <button
                    onClick={() => markRejected(submission)}
                    disabled={busySubId === submission.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                      submission.status === 'Rejected'
                        ? 'bg-red-900/40 text-red-400 border border-red-800/30'
                        : 'bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-red-400'
                    }`}
                  >
                    <XCircle size={13} />
                    Reject
                  </button>

                  <button
                    onClick={() =>
                      updateSubmission(submission.id, {
                        produced_by_toggle: !submission.produced_by_toggle,
                      })
                    }
                    disabled={busySubId === submission.id || submission.status !== 'Accepted'}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40 ${
                      submission.produced_by_toggle
                        ? 'bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20'
                        : 'bg-[#111] border border-[#1e1e1e] text-[#555] hover:text-white'
                    }`}
                  >
                    Prod. By
                  </button>

                  <button
                    onClick={() =>
                      updateSubmission(submission.id, {
                        exclusive_toggle: !submission.exclusive_toggle,
                      })
                    }
                    disabled={busySubId === submission.id || submission.status !== 'Accepted'}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40 ${
                      submission.exclusive_toggle
                        ? 'bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20'
                        : 'bg-[#111] border border-[#1e1e1e] text-[#555] hover:text-white'
                    }`}
                  >
                    Exclusive
                  </button>

                  <button
                    onClick={() =>
                      updateSubmission(submission.id, {
                        list_eligible_toggle: !submission.list_eligible_toggle,
                      })
                    }
                    disabled={busySubId === submission.id || submission.status !== 'Accepted'}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40 ${
                      submission.list_eligible_toggle
                        ? 'bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20'
                        : 'bg-[#111] border border-[#1e1e1e] text-[#555] hover:text-white'
                    }`}
                  >
                    List Eligible
                  </button>

                  <button
                    onClick={() => deleteSubmission(submission.id)}
                    disabled={busySubId === submission.id}
                    className="px-3 py-1.5 rounded-lg text-xs bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="px-4 py-8 max-w-md mx-auto pb-32">
          {view === 'form' ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <img
                  src="/assets/images/thisbeatizbananazmainlogo copy.png"
                  alt=""
                  className="w-20 h-20 object-contain mx-auto"
                />

                <h2 className="font-display text-2xl font-900 text-white uppercase">
                  Submit Your Song
                </h2>

                <p className="text-[#888] text-sm leading-relaxed">
                  Upload your finished record from a purchased Beat Lab beat for review.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  className="input-dark w-full px-4 py-3 text-sm"
                  placeholder="Name"
                  value={form.buyer_name}
                  onChange={(event) => updateForm('buyer_name', event.target.value)}
                />

                <input
                  className="input-dark w-full px-4 py-3 text-sm"
                  placeholder="Email / contact"
                  value={form.buyer_email}
                  onChange={(event) => updateForm('buyer_email', event.target.value)}
                />

                <input
                  className="input-dark w-full px-4 py-3 text-sm"
                  placeholder="Purchased beat title"
                  value={form.purchased_beat}
                  onChange={(event) => updateForm('purchased_beat', event.target.value)}
                />

                <input
                  className="input-dark w-full px-4 py-3 text-sm"
                  placeholder="Title"
                  value={form.song_title}
                  onChange={(event) => updateForm('song_title', event.target.value)}
                />

                <textarea
                  className="input-dark w-full px-4 py-3 text-sm min-h-[110px] resize-none"
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                />

                <label className="block cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                  />

                  <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] px-4 py-5 text-center hover:border-[#f5c518]/40 transition-all">
                    <Music size={24} className="mx-auto text-[#f5c518] mb-2" />
                    <div className="text-sm text-white font-medium truncate">
                      {selectedFileLabel}
                    </div>
                    <div className="text-[11px] text-[#555] mt-1">Audio or video accepted</div>
                  </div>
                </label>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-[#f5c518]" />
              </div>

              <div className="font-display text-2xl font-900 text-[#f5c518] uppercase">
                Submitted
              </div>

              <p className="text-[#888] text-sm leading-relaxed max-w-xs mx-auto">
                Your file went to the private admin inbox for approval.
              </p>

              <button onClick={resetForm} className="btn-dark px-6 py-3 rounded-xl text-sm">
                Submit Another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
