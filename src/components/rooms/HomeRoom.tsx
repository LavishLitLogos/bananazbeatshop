import { useState, useEffect, useRef, useCallback } from 'react';
import { Share2, Flame, Lock, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAdmin } from '../../context/AdminContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import { appStorage } from '../../services/appStorage';
import type { Beat, ProdBySong, Room } from '../../types';
import { BRAND_NAME } from '../../utils/branding';
import { getBeatPriceLabel, isBeatFree } from '../../utils/beatAccess';
import { FamzProfileModal } from '../modals/FamzProfileModal';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const FLAME_ICON = '/assets/images/glofirereact.png';
const PLAY_ICON = '/assets/icons/play-icon.png';
const GRAB_ICON = '/assets/icons/grab-icon.png';
const NOTI_ICON = '/assets/images/notis.png';
const MAX_LATEST_DROPS = 12;
const HOME_LATEST_DROP_FIELDS = 'id,title,genre,description,artist_suggestion,vibe,cover_art_url,audio_file_url,price,is_free,sold,hidden,admin_approved,created_at';

const ROOMS: { id: Room; label: string; icon: string }[] = [
  { id: 'beatlab', label: 'Beats Lab', icon: '/assets/icons/play-icon.png' },
  { id: 'freedls', label: 'Free DLs', icon: '/assets/icons/grab-icon.png' },
  { id: 'beattapes', label: 'Beat Tapes', icon: '/assets/icons/beattapes.png' },
  { id: 'prodby', label: 'Produced By', icon: '/assets/icons/skip-icon.png' },
  { id: 'credits', label: 'Credits', icon: '/assets/icons/play-icon.png' },
  { id: 'submission', label: 'Submission', icon: '/assets/images/notis.png' },
  { id: 'beatbayngr', label: 'BeatBaynGr', icon: '/assets/images/glofirereact.png' },
  { id: 'supamaster', label: 'SupaMaster', icon: '/assets/images/glofirereact.png' },
  { id: 'thelab', label: 'The Lab', icon: '/assets/images/glofirereact.png' },
  { id: 'exclusives', label: 'Exclusives', icon: '/assets/icons/play-icon.png' },
  { id: 'bananazroom', label: 'Bananaz Room', icon: MAIN_LOGO },
];

export function HomeRoom() {
  const {
    setCurrentRoom,
    isAdmin,
    cart,
    setCartOpen,
    unreadCount,
    addToast,
    triggerBananazSplash,
  } = useApp();

  const admin = useAdmin();
  const audio = useAudio();

  const [logoBurst, setLogoBurst] = useState(false);
  const [showPWA, setShowPWA] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [iosPWA, setIosPWA] = useState(false);
  const [totalBeats, setTotalBeats] = useState(0);
  const [latestDrops, setLatestDrops] = useState<Beat[]>([]);
  const [exclusiveSongs, setExclusiveSongs] = useState<ProdBySong[]>([]);
  const [adminCode, setAdminCode] = useState('');
  const [hasExclusives, setHasExclusives] = useState(false);
  const [showWelcomeAdmin, setShowWelcomeAdmin] = useState(false);
  const [showFamzModal, setShowFamzModal] = useState(false);
  const [famzCount, setFamzCount] = useState(() => appStorage.getAdminSettings().famzCount);
  const pwaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHomeData = useCallback(async () => {
    const [beatsCountRes, latestDropsRes, exclusiveRes] = await Promise.all([
      supabase
        .from('beats')
        .select('id', { count: 'exact', head: true })
        .eq('hidden', false)
        .or('admin_approved.is.null,admin_approved.eq.true'),
      supabase
        .from('beats')
        .select(HOME_LATEST_DROP_FIELDS)
        .eq('hidden', false)
        .or('admin_approved.is.null,admin_approved.eq.true')
        .order('created_at', { ascending: false })
        .limit(MAX_LATEST_DROPS),
      supabase
        .from('prod_by_songs')
        .select('*')
        .eq('hidden', false)
        .eq('admin_approved', true)
        .eq('exclusive', true)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setTotalBeats(beatsCountRes.count || 0);
    setLatestDrops((latestDropsRes.data || []) as Beat[]);
    const nextExclusives = (exclusiveRes.data || []) as ProdBySong[];
    setExclusiveSongs(nextExclusives);
    setHasExclusives(nextExclusives.length > 0);
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  useEffect(() => {
    const syncFamzCount = () => {
      setFamzCount(appStorage.getAdminSettings().famzCount);
    };

    syncFamzCount();
    window.addEventListener('bananaz-app-storage:update', syncFamzCount as EventListener);

    return () => {
      window.removeEventListener('bananaz-app-storage:update', syncFamzCount as EventListener);
    };
  }, []);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone =
      ('standalone' in navigator && (navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (!isStandalone && isIos) {
      setIosPWA(true);
      setShowPWA(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    pwaTimerRef.current = setTimeout(() => {
      setShowPWA(false);
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);

      if (pwaTimerRef.current) {
        clearTimeout(pwaTimerRef.current);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }

    setShowPWA(false);
  };

  const handleLogoTap = () => {
    setLogoBurst(true);
    triggerBananazSplash();

    setTimeout(() => {
      setLogoBurst(false);
    }, 700);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${BRAND_NAME} Beat Shop`,
      text: 'Ayo FAMZ, This Beat Iz BANANAZ!!',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        addToast('App link copied.', 'success');
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  const handlePlayFeatured = async () => {
    if (exclusiveSongs.length === 0) {
      setCurrentRoom('exclusives');
      return;
    }

    const playable = exclusiveSongs.filter((song) => song.audio_file_url);

    if (playable.length === 0) {
      setCurrentRoom('exclusives');
      return;
    }

    audio.playQueue(playable, 0, false);
  };

  const handlePlayExclusive = (song: ProdBySong) => {
    if (!song.audio_file_url) {
      setCurrentRoom('exclusives');
      return;
    }

    const playable = exclusiveSongs.filter((item) => item.audio_file_url);
    const startIndex = playable.findIndex((item) => item.id === song.id);

    if (startIndex >= 0) {
      audio.playQueue(playable, startIndex, false);
      return;
    }

    audio.play(song, false);
  };

  const handlePlayLatest = (beat: Beat) => {
    if (!beat.audio_file_url) {
      setCurrentRoom('beatlab');
      return;
    }

    const playable = latestDrops.filter((item) => item.audio_file_url);
    const startIndex = playable.findIndex((item) => item.id === beat.id);

    if (startIndex >= 0) {
      audio.playQueue(playable, startIndex, false);
      return;
    }

    audio.play(beat, false);
  };

  const handleAdminCodeSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const prevStep = admin.adminStep;
    const result = admin.submitAdminCode(adminCode);

    setAdminCode('');

    if (!result.success) {
      addToast(result.message, 'error');
      return;
    }

    if (prevStep === 'second-code') {
      triggerBananazSplash();
      setShowWelcomeAdmin(true);
      setTimeout(() => {
        setShowWelcomeAdmin(false);
        setCurrentRoom('admin');
      }, 2200);
    } else {
      addToast(result.message, 'success');
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="flex items-center justify-between px-4 pt-safe pt-3 pb-2 relative z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentRoom('home')} title="Go to home" aria-label="Go to home" className="flex-shrink-0">
            <img
              src={MAIN_LOGO}
              alt="ThisBeatIzBananaz"
              className="w-9 h-9 object-contain"
            />
          </button>

          <button
            onClick={handleShare}
            title="Share app"
            aria-label="Share app"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#666] hover:text-[#f5c518] transition-all"
          >
            <Share2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setCurrentRoom('admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f5c518]/10 border border-[#f5c518]/20 text-[#f5c518] text-xs font-display font-700 hover:bg-[#f5c518]/15 transition-all"
            >
              <Flame size={13} />
              STUDIO
            </button>
          )}

          <button
            onClick={() => setCartOpen(true)}
            title="Open Beat Box"
            aria-label="Open Beat Box"
            className="relative p-2 rounded-xl bg-[#141414] border border-[#1e1e1e] text-[#888] hover:text-[#f5c518] hover:border-[#f5c518]/30 transition-all"
          >
            <img src={GRAB_ICON} alt="" className="w-4 h-4 object-contain" />

            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#f5c518] text-black rounded-full text-[10px] font-bold flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              onClick={() => setCurrentRoom('admin')}
              title="Open admin notifications"
              aria-label="Open admin notifications"
              className="relative p-2 rounded-xl bg-[#141414] border border-[#1e1e1e] hover:border-[#f5c518]/20 transition-all"
            >
              <img src={NOTI_ICON} alt="" className="w-4 h-4 object-contain" />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {showPWA && (
        <div className="mx-4 mb-2 p-3 bg-[#111] border border-[#f5c518]/20 rounded-xl flex items-center justify-between relative z-10">
          <span className="text-xs text-[#aaa]">
            {iosPWA
              ? 'Tap Share -> Add to Home Screen'
              : 'Install ThisBeatIzBananaz App'}
          </span>

          {!iosPWA && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="text-xs text-[#f5c518] font-bold hover:underline ml-2"
            >
              Install
            </button>
          )}

          <button
            onClick={() => setShowPWA(false)}
            title="Dismiss install message"
            aria-label="Dismiss install message"
            className="ml-2 text-[#555] hover:text-white transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex flex-col items-center px-6 py-4 relative z-10">
        <button
          onClick={handleLogoTap}
          className={`transition-all ${
            logoBurst ? 'animate-logo-burst' : 'animate-float'
          }`}
        >
          <img
            src={MAIN_LOGO}
            alt="ThisBeatIzBananaz"
            className="w-52 h-52 object-contain drop-shadow-2xl"
            style={{
              filter: 'drop-shadow(0 0 15px rgba(245,197,24,0.3))',
            }}
          />
        </button>

        <div className="mt-1 flex items-center gap-2 text-center">
          <img src={FLAME_ICON} alt="" className="w-7 h-7 object-contain" />
          <div className="font-display text-4xl font-900 text-white tracking-tight leading-tight glow-gold-text">
            {BRAND_NAME}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#f5c518] text-sm font-medium mt-2 text-center">
          <img src={FLAME_ICON} alt="" className="w-5 h-5 object-contain" />
          <span>Ayo FAMZ, This Beat Iz BANANAZ!!</span>
          <img src={FLAME_ICON} alt="" className="w-5 h-5 object-contain" />
        </div>

        <div className="text-xs text-[#666] mt-1">
          {totalBeats} beats available
        </div>

        <button
          onClick={handlePlayFeatured}
          className="btn-gold mt-4 px-8 py-3.5 rounded-2xl text-base flex items-center gap-2"
        >
          <img src={PLAY_ICON} alt="" className="w-5 h-5 object-contain" />
          Play Featured
        </button>

        <button
          onClick={() => setCurrentRoom('beatlab')}
          className="mt-3 px-8 py-3 rounded-2xl text-sm font-display font-800 uppercase tracking-widest bg-[#141414] border border-[#f5c518]/25 text-[#f5c518] hover:bg-[#f5c518]/10 transition-all flex items-center gap-2"
        >
          Browse Beats
          <ArrowRight size={16} />
        </button>

        {!isAdmin && (
          <button
            onClick={admin.registerAdminTap}
            className="admin-pill mt-3 px-6 py-1.5 text-[10px] text-[#2a2a2a] font-mono tracking-widest"
          >
            ...
          </button>
        )}
      </div>

      <div className="px-4 pb-5 relative z-10 space-y-5">
        <div className="section-shell p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-display text-xl font-900 text-white uppercase tracking-[0.08em]">
                Latest Drops
              </h2>
              <p className="text-sm text-[#8d8d8d]">Fresh drops from the lab, ready to run.</p>
            </div>

            <button
              onClick={() => setCurrentRoom('beatlab')}
              className="premium-action text-xs text-[#f5c518] font-bold uppercase tracking-[0.22em]"
            >
              View All
            </button>
          </div>

          {latestDrops.length > 0 ? (
            <div className="-mx-4 px-4 overflow-x-auto scroll-x pb-1">
              <div className="flex gap-3 min-w-max">
                {latestDrops.map((beat, index) => (
                  <button
                    key={beat.id}
                    onClick={() => handlePlayLatest(beat)}
                    className={`latest-drop-card ${index === 0 ? 'latest-drop-card-featured' : ''}`}
                  >
                    <div className="relative aspect-[0.96] overflow-hidden rounded-[1.15rem] bg-black">
                      <img
                        src={beat.cover_art_url || MAIN_LOGO}
                        alt={beat.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />

                      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                        <span className="status-badge status-badge-gold">
                          {beat.genre?.split(',')[0]?.trim() || 'Drop'}
                        </span>
                        {beat.sold ? (
                          <span className="status-badge status-badge-danger">Sold</span>
                        ) : isBeatFree(beat) ? (
                          <span className="status-badge status-badge-success">Free</span>
                        ) : null}
                      </div>

                      <div className="absolute left-3 right-3 bottom-3 text-left">
                        <div className="latest-drop-title">{beat.title}</div>
                        <div className="text-xs text-[#c8c8c8] mt-1 line-clamp-2">
                          {beat.description || beat.artist_suggestion || beat.vibe || 'Fresh from the lab.'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#686868] truncate">
                          Latest Drop
                        </div>
                        <div className={`font-display text-lg font-900 leading-none mt-1 ${isBeatFree(beat) ? 'text-green-400' : 'text-[#f5c518]'}`}>
                          {getBeatPriceLabel(beat)}
                        </div>
                      </div>

                      <div className="premium-play-chip">
                        <img src={PLAY_ICON} alt="" className="w-4 h-4 object-contain" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-[#1e1e1e] bg-[#101010] p-5 text-center text-sm text-[#777]">
              Latest drops will hit here as soon as they are released.
            </div>
          )}
        </div>

        <div className="section-shell p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-lg font-900 text-white uppercase tracking-wide">
                Exclusives
              </h2>
              <p className="text-xs text-[#777]">Premium records and requests.</p>
            </div>

            <button
              onClick={() => setCurrentRoom('exclusives')}
              className="premium-action text-xs text-[#f5c518] font-bold uppercase tracking-widest"
            >
              View All
            </button>
          </div>

          <div className="-mx-4 px-4 overflow-x-auto scroll-x pb-1">
            {exclusiveSongs.length > 0 ? (
              <div className="flex gap-2.5 min-w-max">
                {exclusiveSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handlePlayExclusive(song)}
                    className="w-28 sm:w-32 shrink-0 rounded-2xl bg-[#111] border border-[#1e1e1e] p-2 text-left hover:border-[#f5c518]/30 transition-all"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-black/40 mb-1.5">
                      <img
                        src={song.cover_art_url || MAIN_LOGO}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="font-display text-[11px] font-800 text-white uppercase truncate leading-tight">
                      {song.title}
                    </div>

                    <div className="text-[10px] text-[#888] truncate mt-0.5">
                      {song.artist_name || 'Artist TBA'}
                    </div>

                    <div className="text-[10px] text-[#f5c518] mt-0.5">
                      {getBeatPriceLabel(song)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#101010] p-4 text-center text-xs text-[#777]">
                Exclusive songs will appear here.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 relative z-10">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {ROOMS.filter((room) => room.id !== 'exclusives' || hasExclusives).map((room) => (
            <button
              key={room.id}
              onClick={() => setCurrentRoom(!isAdmin && room.id === 'prodby' ? 'credits' : room.id)}
              className="room-tile w-full aspect-square rounded-full"
            >
              <img src={room.icon} alt="" className="w-8 h-8 object-contain" />

              <span className="font-display font-700 text-[8px] text-white uppercase tracking-wide text-center leading-tight mt-1 px-1">
                {room.label}
              </span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => setCurrentRoom('admin')}
              className="room-tile w-full aspect-square rounded-full"
              style={{ borderColor: 'rgba(245,197,24,0.35)' }}
            >
              <img src={FLAME_ICON} alt="" className="w-8 h-8 object-contain" />

              <span className="font-display font-700 text-[8px] text-[#f5c518] uppercase tracking-wide text-center leading-tight mt-1 px-1">
                Studio
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-center pb-4 relative z-10">
        <button
          onClick={() => setShowFamzModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] border border-[#1e1e1e] hover:border-[#f5c518]/20 transition-all"
        >
          <img src={MAIN_LOGO} alt="" className="w-4 h-4 object-contain" />
          <span className="text-xs text-[#888]">FAMZ</span>
          <span className="text-xs font-bold text-[#f5c518]">{famzCount.toLocaleString()}</span>
        </button>
      </div>

      {showWelcomeAdmin && (
        <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center gap-6 animate-[fadeIn_0.3s_ease]">
          <img
            src={MAIN_LOGO}
            alt="ThisBeatIzBananaz"
            className="w-44 h-44 object-contain animate-logo-burst"
            style={{ filter: 'drop-shadow(0 0 40px #f5c518)' }}
          />
          <div className="font-display text-4xl font-900 text-[#f5c518] glow-gold-text uppercase tracking-widest animate-bounce-in text-center px-4">
            Welcome Admin
          </div>
          <div className="text-[#666] text-sm tracking-widest uppercase animate-[fadeIn_0.6s_ease_0.4s_both]">
            Access Granted
          </div>
        </div>
      )}

      {admin.gatewayOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="w-full max-w-sm rounded-3xl bg-[#0d0d0d] border border-[#f5c518]/25 shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[#f5c518] font-display font-900 uppercase tracking-widest text-sm">
                  Studio Control Room
                </div>
                <div className="text-[#777] text-xs mt-1">
                  {admin.adminStep === 'first-code'
                    ? 'Enter gateway code.'
                    : 'Enter owner code.'}
                </div>
              </div>

              <button
                onClick={admin.closeGateway}
                title="Close studio control room"
                aria-label="Close studio control room"
                className="w-8 h-8 rounded-full bg-white/5 text-[#777] hover:text-white"
              >
                x
              </button>
            </div>

            <form onSubmit={handleAdminCodeSubmit} className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl bg-black border border-[#1e1e1e] px-4 py-3">
                <Lock size={16} className="text-[#f5c518]" />

                <input
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  placeholder={
                    admin.adminStep === 'first-code'
                      ? 'Admin code'
                      : 'Owner code'
                  }
                  className="bg-transparent outline-none flex-1 text-white text-sm"
                  type="password"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-gold w-full py-3 rounded-2xl">
                Accept
              </button>
            </form>
          </div>
        </div>
      )}

      {showFamzModal && <FamzProfileModal onClose={() => setShowFamzModal(false)} />}
    </div>
  );
}


