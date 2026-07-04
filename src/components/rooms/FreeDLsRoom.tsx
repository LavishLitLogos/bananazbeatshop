import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, MoreHorizontal, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { Beat } from '../../types';
import { BeatUploadModal } from '../modals/BeatUploadModal';
import { BeatDetailModal } from '../modals/BeatDetailModal';
import { ShareButton } from '../ui/ShareButton';
import { isBeatInFreeDLs, triggerBeatDownload } from '../../utils/beatAccess';

export function FreeDLsRoom() {
  const { goBack, isAdmin, addToast } = useApp();
  const { currentBeat, isPlaying, play, playQueue, pause, resume } = useAudio();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [showFreeDLMsg, setShowFreeDLMsg] = useState(false);
  const [pendingBeat, setPendingBeat] = useState<Beat | null>(null);

  const playableBeats = useMemo(
    () => beats.filter((beat) => beat.audio_file_url),
    [beats]
  );

  const fetchBeats = useCallback(async () => {
    setLoading(true);

    const query = supabase
      .from('beats')
      .select('*')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      addToast('Free DLs failed to load.', 'error');
      setLoading(false);
      return;
    }

    setBeats(((data || []) as Beat[]).filter((beat) => isBeatInFreeDLs(beat, isAdmin)));
    setLoading(false);
  }, [addToast, isAdmin]);

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  const handlePlay = (beat: Beat) => {
    if (currentBeat?.id === beat.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }

      return;
    }

    const index = playableBeats.findIndex((item) => item.id === beat.id);

    if (index >= 0) {
      playQueue(playableBeats, index, false);
      return;
    }

    play(beat, false);
  };

  const handleFreeDL = (beat: Beat) => {
    setPendingBeat(beat);
    setShowFreeDLMsg(true);
  };

  const confirmFreeDL = async () => {
    if (!pendingBeat?.audio_file_url) {
      addToast('No audio available.', 'error');
      setShowFreeDLMsg(false);
      setPendingBeat(null);
      return;
    }

    if (!triggerBeatDownload(pendingBeat, isAdmin)) {
      addToast('Download is locked until admin releases it.', 'info');
      setShowFreeDLMsg(false);
      setPendingBeat(null);
      return;
    }

    setShowFreeDLMsg(false);
    setPendingBeat(null);
    addToast('Downloading... go cook!', 'success');
  };

  return (
    <div className="min-h-screen industrial-room-surface">
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe cracked-shell-panel console-panel mx-3 mt-3 rounded-[1.6rem]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="hardware-button p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
                aria-label="Go back"
              >
              <ChevronLeft size={20} />
            </button>

            <div>
              <h1 className="font-display font-800 text-xl text-white leading-none">
                Free DLs
              </h1>
              <p className="text-[10px] text-[#555] mt-0.5">
                {beats.length} free beats for the community
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ShareButton />

            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedBeat(null);
                  setShowUpload(true);
                }}
                className="btn-gold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                + Upload
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 grid grid-cols-3 gap-3 pb-32 sm:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="beat-card aspect-square animate-pulse bg-[#111]" />
          ))
        ) : beats.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-[#444] sm:col-span-4 cracked-shell-panel console-panel rounded-[1.8rem] p-6">
            <img
              src="/assets/icons/grab-icon.png"
              alt=""
              className="w-16 h-16 object-contain mx-auto mb-3 opacity-20"
            />
            <div className="font-display text-xl">No free beats yet</div>
          </div>
        ) : (
          beats.map((beat) => (
            <div
              key={beat.id}
              className="beat-card cut-corner-card cursor-pointer rounded-2xl"
              onClick={() => {
                setSelectedBeat(beat);
                setShowDetail(true);
              }}
            >
              <div className="relative aspect-square overflow-hidden rounded-t-xl">
                {beat.cover_art_url ? (
                  <img
                    src={beat.cover_art_url}
                    alt={beat.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center">
                    <span className="text-3xl font-display font-900 text-[#f5c518]/20">
                      Free
                    </span>
                  </div>
                )}

                <div className="absolute top-2 left-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500 text-black tracking-[0.04em]">
                    Free
                  </span>
                </div>

              </div>

              <div className="p-3">
                <div className="font-display font-800 text-[15px] text-white truncate leading-tight">
                  {beat.title}
                </div>

                <div className="flex gap-1.5 mt-2.5">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePlay(beat);
                    }}
                    className="w-9 h-9 rounded-xl bg-[#171717] border border-white/5 text-[#888] hover:text-[#f5c518] transition-all flex items-center justify-center"
                    aria-label={currentBeat?.id === beat.id && isPlaying ? 'Pause beat' : 'Play beat'}
                  >
                    {currentBeat?.id === beat.id && isPlaying ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFreeDL(beat);
                    }}
                    className="flex-1 h-9 rounded-xl bg-green-900/35 border border-green-700/30 text-green-400 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-green-900/60 transition-all"
                  >
                    <img
                      src="/assets/icons/grab-icon.png"
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                    />
                    Free DL
                  </button>

                  {isAdmin && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedBeat(beat);
                        setShowUpload(true);
                      }}
                      className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#555] hover:text-[#f5c518] transition-all text-xs"
                      aria-label="Edit free download beat"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showFreeDLMsg && pendingBeat && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowFreeDLMsg(false);
            }
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="modal-box cracked-shell-panel console-panel neon-frame glow-green cut-corner-card max-w-sm w-full p-6 text-center space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setShowFreeDLMsg(false)}
              className="hardware-button absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
              aria-label="Close free download message"
            >
              <ChevronLeft size={16} className="rotate-180" />
            </button>

            <img
              src="/assets/images/thisbeatizbananazmainlogo copy.png"
              alt=""
              className="w-20 h-20 object-contain mx-auto"
            />

            <div className="font-display text-xl font-800 text-[#f5c518]">
              Free DL
            </div>

            <p className="text-[#aaa] text-sm leading-relaxed">
              I wanna hear the cookup when it&apos;s ready fam! Let me know when you drop it,
              and I&apos;ll help promote it! We All We Got!
            </p>

            <button onClick={confirmFreeDL} className="btn-gold w-full py-3 rounded-xl text-sm">
              Download
            </button>
          </div>
        </div>
      )}

      {showUpload && (
        <BeatUploadModal
          beat={selectedBeat}
          onClose={() => {
            setShowUpload(false);
            setSelectedBeat(null);
          }}
          onSave={() => {
            setShowUpload(false);
            setSelectedBeat(null);
            fetchBeats();
          }}
        />
      )}

      {showDetail && selectedBeat && (
        <BeatDetailModal
          beat={selectedBeat}
          allBeats={beats}
          onClose={() => {
            setShowDetail(false);
            setSelectedBeat(null);
          }}
          onBuy={() => {}}
        />
      )}
    </div>
  );
}
