import { useState, useEffect, useRef, useCallback } from 'react';
import { Share2, Flame, Lock, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAdmin } from '../../context/AdminContext';
import { useAudio } from '../../context/AudioContext';
import { supabase } from '../../lib/supabase';
import type { Room } from '../../types';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const FLAME_ICON = '/assets/images/glofirereact.png';
const PLAY_ICON = '/assets/icons/play-icon.png';
const GRAB_ICON = '/assets/icons/grab-icon.png';
const NOTI_ICON = '/assets/images/notis.png';

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
  { id: 'profile', label: 'Profile', icon: MAIN_LOGO },
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
  const [latestDrops, setLatestDrops] = useState<any[]>([]);
  const [adminCode, setAdminCode] = useState('');
  const [hasExclusives, setHasExclusives] = useState(false);
  const [showWelcomeAdmin, setShowWelcomeAdmin] = useState(false);
  const pwaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHomeData = useCallback(async () => {
    const { count } = await supabase
      .from('beats')
      .select('*', { count: 'exact', head: true })
      .eq('hidden', false);

    setTotalBeats(count || 0);

    const { data } = await supabase
      .from('beats')
      .select('*')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(4);

    setLatestDrops(data || []);

    const { count: excCount } = await supabase
      .from('beats')
      .select('*', { count: 'exact', head: true })
      .eq('exclusive', true)
      .eq('hidden', false)
      .eq('admin_approved', true);

    setHasExclusives((excCount || 0) > 0);
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

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
      title: 'ThisBeatIzBananaz Beat Shop',
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
    const { data, error } = await supabase
      .from('prod_by_songs')
      .select('*')
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error || !data || data.length === 0) {
      setCurrentRoom('prodby');
      return;
    }

    audio.playQueue(data as any, 0, false);
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
          <button onClick={() => setCurrentRoom('home')} className="flex-shrink-0">
            <img
              src={MAIN_LOGO}
              alt="ThisBeatIzBananaz"
              className="w-9 h-9 object-contain"
            />
          </button>

          <button
            onClick={handleShare}
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
              ? 'Tap Share → Add to Home Screen'
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

        <div className="font-display text-4xl font-900 text-white tracking-tight text-center leading-tight mt-1 glow-gold-text">
          ThisBeatIzBananaz
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
            ···
          </button>
        )}
      </div>

      <div className="px-4 pb-5 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg font-900 text-white uppercase tracking-wide">
              Latest Drops
            </h2>
            <p className="text-xs text-[#777]">Fresh out the pot!</p>
          </div>

          <button
            onClick={() => setCurrentRoom('beatlab')}
            className="text-xs text-[#f5c518] font-bold uppercase tracking-widest"
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {latestDrops.length > 0 ? (
            latestDrops.map((beat) => (
              <button
                key={beat.id}
                onClick={() => audio.play(beat, false)}
                className="rounded-2xl bg-[#111] border border-[#1e1e1e] p-3 text-left hover:border-[#f5c518]/30 transition-all"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-black/40 mb-2">
                  <img
                    src={beat.cover_art_url || MAIN_LOGO}
                    alt={beat.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="font-display text-xs font-800 text-white uppercase truncate">
                  {beat.title}
                </div>

                <div className="text-[10px] text-[#f5c518] mt-1">
                  ${beat.price || 30}
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-2 rounded-2xl border border-[#1e1e1e] bg-[#101010] p-4 text-center text-xs text-[#777]">
              Latest drops will appear here.
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-6 relative z-10">
        <div className="grid grid-cols-4 gap-3">
          {ROOMS.filter((room) => room.id !== 'exclusives' || hasExclusives).map((room) => (
            <button
              key={room.id}
              onClick={() => setCurrentRoom(room.id)}
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
          onClick={() => setCurrentRoom('profile')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] border border-[#1e1e1e] hover:border-[#f5c518]/20 transition-all"
        >
          <img src={MAIN_LOGO} alt="" className="w-4 h-4 object-contain" />
          <span className="text-xs text-[#888]">FAMZ</span>
          <span className="text-xs font-bold text-[#f5c518]">11,603</span>
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
                className="w-8 h-8 rounded-full bg-white/5 text-[#777] hover:text-white"
              >
                ×
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
    </div>
  );
}