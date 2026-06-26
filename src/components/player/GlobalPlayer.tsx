import { useMemo, useState } from 'react';
import {
  Pause,
  Play,
  Share2,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp, useAudio } from '../../context/AppContext';

const FALLBACK_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getCover(item: any) {
  return item.cover_art_url || item.cover_url || item.cover || item.image_url || FALLBACK_LOGO;
}

function getArtistLine(item: any) {
  return (
    item.artist_name ||
    item.producer_name ||
    item.genre ||
    item.style ||
    item.type ||
    item.vibe ||
    'ThisBeatIzBananaz'
  );
}

export function GlobalPlayer() {
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    volume,
    previewOnly,
    previewSeconds,
    queue,
    queueIndex,
    toggle,
    stop,
    seek,
    setVolume,
    next,
    prev,
    hasNext,
    hasPrev,
  } = useAudio();

  const { addToast } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;

    const cap = previewOnly ? Math.min(duration, previewSeconds) : duration;
    const safeCap = cap <= 0 ? duration : cap;

    return Math.min(100, Math.max(0, (currentTime / safeCap) * 100));
  }, [currentTime, duration, previewOnly, previewSeconds]);

  if (!currentBeat) return null;

  const displayDuration = previewOnly
    ? Math.min(duration || previewSeconds, previewSeconds)
    : duration;

  const title = currentBeat.title || 'Untitled';
  const cover = getCover(currentBeat);
  const artistLine = getArtistLine(currentBeat);
  const queueLabel =
    queue.length > 1 && queueIndex >= 0
      ? `${queueIndex + 1} / ${queue.length}`
      : previewOnly
        ? '45 sec preview'
        : 'Now playing';

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width)
    );

    const seekLimit = previewOnly ? Math.min(duration, previewSeconds) : duration;
    seek(percentage * seekLimit);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#play-${currentBeat.id}`;

    const shareData = {
      title,
      text: `${title} — ${artistLine}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      addToast('Player link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        addToast('Player link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[500] pb-safe pointer-events-none">
      {expanded && (
        <div className="pointer-events-auto fixed inset-0 z-[499] bg-black/86 backdrop-blur-xl flex items-center justify-center px-5 pb-28">
          <div className="w-full max-w-md rounded-[2rem] bg-[#0d0d0d] border border-[#f5c518]/20 shadow-[0_0_50px_rgba(245,197,24,0.12)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="text-[10px] font-display font-900 uppercase tracking-[0.25em] text-[#f5c518]">
                Global Player
              </div>

              <button
                onClick={() => setExpanded(false)}
                className="w-9 h-9 rounded-full bg-white/5 text-[#888] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                aria-label="Close expanded player"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <div className="aspect-square rounded-[1.7rem] overflow-hidden bg-black border border-white/10 shadow-2xl">
                <img
                  src={cover}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="mt-5">
                <div className="font-display text-2xl font-900 text-white uppercase tracking-wide leading-tight">
                  {title}
                </div>

                <div className="text-sm text-[#f5c518] mt-1 truncate">
                  {artistLine}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#777] mt-2">
                  <span>{queueLabel}</span>
                  {previewOnly && (
                    <span className="text-[#f5c518] uppercase tracking-widest">
                      Preview Mode
                    </span>
                  )}
                </div>
              </div>

              <div
                className="mt-5 h-3 rounded-full bg-[#1a1a1a] overflow-hidden cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#f5c518] to-[#ffdf4d] transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-[#777] mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{displayDuration ? formatTime(displayDuration) : '--:--'}</span>
              </div>

              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={prev}
                  disabled={!hasPrev}
                  className="w-12 h-12 rounded-full bg-[#171717] text-[#aaa] hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  aria-label="Previous"
                >
                  <SkipBack size={20} />
                </button>

                <button
                  onClick={toggle}
                  className="w-16 h-16 rounded-full bg-[#f5c518] text-black hover:bg-[#ffdf4d] transition-all flex items-center justify-center shadow-[0_0_28px_rgba(245,197,24,0.35)]"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause size={28} fill="black" />
                  ) : (
                    <Play size={28} fill="black" className="ml-1" />
                  )}
                </button>

                <button
                  onClick={next}
                  disabled={!hasNext}
                  className="w-12 h-12 rounded-full bg-[#171717] text-[#aaa] hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  aria-label="Next"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <button
                  onClick={stop}
                  className="h-11 rounded-2xl bg-[#141414] border border-white/5 text-[#aaa] hover:text-white hover:border-[#f5c518]/25 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </button>

                <button
                  onClick={handleShare}
                  className="h-11 rounded-2xl bg-[#141414] border border-white/5 text-[#aaa] hover:text-white hover:border-[#f5c518]/25 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  <Share2 size={14} />
                  Share
                </button>

                <button
                  onClick={() => setShowVolume((value) => !value)}
                  className="h-11 rounded-2xl bg-[#141414] border border-white/5 text-[#aaa] hover:text-white hover:border-[#f5c518]/25 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  Vol
                </button>
              </div>

              {showVolume && (
                <div className="mt-4 rounded-2xl bg-black/45 border border-white/10 px-4 py-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="w-full accent-[#f5c518]"
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto player-bar border-t border-[#f5c518]/15 bg-[#080808]/95 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
        <div
          className="h-[3px] bg-[#171717] cursor-pointer"
          onClick={handleSeek}
          role="presentation"
        >
          <div
            className="h-full bg-gradient-to-r from-[#f5c518] via-[#ffe600] to-[#ff8a00] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={() => setExpanded(true)}
            className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-[#222] flex-shrink-0 shadow-lg"
            aria-label="Open expanded player"
          >
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          </button>

          <button
            onClick={() => setExpanded(true)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="font-display font-900 text-sm text-white uppercase truncate leading-tight">
              {title}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[#777] mt-0.5">
              <span className="truncate">{artistLine}</span>
              <span className="text-[#444]">•</span>
              <span className="text-[#f5c518] shrink-0">{queueLabel}</span>
            </div>

            <div className="text-[10px] text-[#666] mt-0.5">
              {formatTime(currentTime)} /{' '}
              {displayDuration ? formatTime(displayDuration) : '--:--'}
            </div>
          </button>

          {isPlaying && (
            <div className="hidden xs:flex items-end gap-[2px] h-5 flex-shrink-0">
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="waveform-bar w-[3px]"
                  style={{
                    animationDelay: `${index * 0.12}s`,
                    height: '100%',
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={prev}
              disabled={!hasPrev}
              className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              aria-label="Previous"
            >
              <SkipBack size={13} />
            </button>

            <button
              onClick={toggle}
              className="w-10 h-10 rounded-full bg-[#f5c518] text-black flex items-center justify-center hover:bg-[#ffdf4d] transition-all shadow-[0_0_22px_rgba(245,197,24,0.28)]"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={16} fill="black" />
              ) : (
                <Play size={16} fill="black" className="ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              disabled={!hasNext}
              className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              aria-label="Next"
            >
              <SkipForward size={13} />
            </button>

            <button
              onClick={stop}
              className="hidden sm:flex w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] transition-all items-center justify-center"
              aria-label="Stop"
            >
              <Square size={13} fill="currentColor" />
            </button>

            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowVolume((value) => !value)}
                className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] transition-all flex items-center justify-center"
                aria-label="Volume"
              >
                {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>

              {showVolume && !expanded && (
                <div className="absolute bottom-11 right-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-3 shadow-xl">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="w-24 accent-[#f5c518]"
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleShare}
              className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] transition-all flex items-center justify-center"
              aria-label="Share current audio"
            >
              <Share2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}