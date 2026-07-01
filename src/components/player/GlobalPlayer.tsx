import { useMemo, useState } from 'react';
import {
  Pause,
  Play,
  ShoppingBag,
  SkipBack,
  SkipForward,
  Square,
  X,
} from 'lucide-react';
import { useApp, useAudio } from '../../context/AppContext';
import type { Beat } from '../../types';
import { canBuyBeat, getBeatPriceLabel } from '../../utils/beatAccess';
import { BeatDetailModal } from '../modals/BeatDetailModal';
import { BuyModal } from '../modals/BuyModal';

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

function isBeatItem(item: any): item is Beat {
  return Boolean(item?.id && 'is_free' in item && 'price' in item);
}

export function GlobalPlayer() {
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    previewOnly,
    previewSeconds,
    queue,
    queueIndex,
    toggle,
    stop,
    seek,
    next,
    prev,
    hasNext,
    hasPrev,
  } = useAudio();

  const { addToast, addToCart, setCartOpen } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showBuy, setShowBuy] = useState(false);

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
  const beatItem = isBeatItem(currentBeat) ? currentBeat : null;
  const canPurchaseBeat = Boolean(beatItem && canBuyBeat(beatItem));
  const queueLabel =
    queue.length > 1 && queueIndex >= 0
      ? `${queueIndex + 1} / ${queue.length}`
      : previewOnly
        ? '45 sec preview'
        : 'Now playing';

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const seekLimit = previewOnly ? Math.min(duration, previewSeconds) : duration;

    seek(percentage * seekLimit);
  };

  const closePlayer = () => {
    setExpanded(false);
    setShowDetail(false);
    setShowBuy(false);
    stop();
  };

  const openBeatDetail = () => {
    if (!beatItem) return;
    setExpanded(false);
    setShowDetail(true);
  };

  const handleAddToBeatBox = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!beatItem) {
      addToast('Only Beat Lab beats can be added to Beat Box.', 'info');
      return;
    }

    if (!canPurchaseBeat) {
      addToast(beatItem.sold ? 'This beat is sold.' : 'Free beats do not need Beat Box.', 'info');
      return;
    }

    addToCart(beatItem);
    setCartOpen(true);
    addToast(`${beatItem.title} added to Beat Box.`, 'success');
  };

  const handleBuy = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!canPurchaseBeat) {
      addToast('This beat is not available for purchase.', 'info');
      return;
    }

    setExpanded(false);
    setShowDetail(false);
    setShowBuy(true);
  };

  const handleExpandedTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartY(event.touches[0]?.clientY ?? null);
  };

  const handleExpandedTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY === null) return;

    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const swipeDistance = endY - touchStartY;

    setTouchStartY(null);

    if (swipeDistance > 80) {
      setExpanded(false);
    }
  };

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[500] pb-safe pointer-events-none">
      {expanded && (
        <div
          className="pointer-events-auto fixed inset-0 z-[499] bg-black/86 backdrop-blur-xl flex items-center justify-center px-5 pb-28"
          onTouchStart={handleExpandedTouchStart}
          onTouchEnd={handleExpandedTouchEnd}
        >
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
              <button
                onClick={openBeatDetail}
                disabled={!beatItem}
                className="block w-full aspect-square rounded-[1.7rem] overflow-hidden bg-black border border-white/10 shadow-2xl disabled:cursor-default"
                aria-label="Open beat detail"
              >
                <img
                  src={cover}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </button>

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

              <div className={`grid gap-2 mt-5 ${canPurchaseBeat ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  onClick={stop}
                  className="h-11 rounded-2xl bg-[#141414] border border-white/5 text-[#aaa] hover:text-white hover:border-[#f5c518]/25 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </button>

                {canPurchaseBeat && (
                  <>
                    <button
                      onClick={handleBuy}
                      className="h-11 rounded-2xl bg-[#f5c518] text-black hover:bg-[#ffdf4d] transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                      <ShoppingBag size={14} />
                      Buy
                    </button>

                    <button
                      onClick={handleAddToBeatBox}
                      className="h-11 rounded-2xl bg-[#141414] border border-white/5 text-[#aaa] hover:text-white hover:border-[#f5c518]/25 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                      <ShoppingBag size={14} />
                      Box
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto player-bar border-t border-[#f5c518]/15 bg-[#080808]/95 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
        <div
          className="h-[3px] bg-[#171717] cursor-pointer"
          onClick={openBeatDetail}
          role="presentation"
        >
          <div
            className="h-full bg-gradient-to-r from-[#f5c518] via-[#ffe600] to-[#ff8a00] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={openBeatDetail}
            className="w-12 h-12 rounded-2xl overflow-hidden bg-black border border-[#262626] flex-shrink-0 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
            aria-label="Open beat detail"
          >
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          </button>

          <button
            onClick={openBeatDetail}
            className="flex-1 min-w-0 text-left"
          >
            <div className="font-display font-900 text-[15px] text-white uppercase truncate leading-tight">
              {title}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[#777] mt-0.5">
              <span className="truncate">{artistLine}</span>
              <span className="text-[#444]">•</span>
              <span className="text-[#f5c518] shrink-0">{queueLabel}</span>
            </div>

            <div className="text-[10px] text-[#666] mt-0.5">
              {formatTime(currentTime)} / {displayDuration ? formatTime(displayDuration) : '--:--'}
              {beatItem && (
                <span className="ml-2 text-[#f5c518]">{getBeatPriceLabel(beatItem)}</span>
              )}
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

          <div className="flex items-center gap-1.5 flex-shrink-0">
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

            {canPurchaseBeat && (
              <button
                onClick={handleBuy}
                className="h-8 px-2.5 rounded-full bg-[#171717] text-[#f5c518] hover:text-black hover:bg-[#f5c518] transition-all flex items-center justify-center text-[10px] font-bold uppercase tracking-widest"
                aria-label="Buy current beat"
              >
                Buy
              </button>
            )}

            <button
              onClick={handleAddToBeatBox}
              disabled={!canPurchaseBeat}
              className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              aria-label="Add current beat to Beat Box"
            >
              <ShoppingBag size={13} />
            </button>

            <button
              onClick={closePlayer}
              className="w-8 h-8 rounded-full bg-[#171717] text-[#888] hover:text-white hover:bg-[#222] transition-all flex items-center justify-center"
              aria-label="Close player"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto">
        {showDetail && beatItem && (
          <BeatDetailModal
            beat={beatItem}
            allBeats={queue.filter(isBeatItem)}
            onClose={() => setShowDetail(false)}
            onBuy={() => {
              setShowDetail(false);
              setShowBuy(true);
            }}
          />
        )}

        {showBuy && beatItem && (
          <BuyModal beat={beatItem} onClose={() => setShowBuy(false)} />
        )}
      </div>
    </div>
  );
}
