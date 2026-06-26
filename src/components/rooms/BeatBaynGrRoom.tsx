import { ChevronLeft, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function BeatBaynGrRoom() {
  const { goBack } = useApp();

  const handleOpen = () => {
    window.open('https://beatbayngr52.vercel.app', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img src="/assets/icons/beattapes.png" alt="" className="w-6 h-6 object-contain" />
              <h1 className="font-display font-800 text-xl uppercase tracking-wide text-white leading-none">BeatBaynGr</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-16 space-y-8">
        <button onClick={() => {}}>
          <img src="/assets/icons/beattapes.png" alt="BeatBaynGr" className="w-32 h-32 object-contain animate-float" />
        </button>

        <div className="text-center space-y-2">
          <h2 className="font-display text-3xl font-900 text-white uppercase tracking-wide">BeatBaynGr</h2>
          <p className="text-[#888] text-sm max-w-xs text-center leading-relaxed">
            Master your new beat, before you leave & save a few steps.
          </p>
        </div>

        <button
          onClick={handleOpen}
          className="btn-gold px-8 py-4 rounded-2xl text-base flex items-center gap-3"
        >
          <img src="/assets/icons/beattapes.png" alt="" className="w-5 h-5 object-contain" />
          <ExternalLink size={16} />
        </button>

        <div className="text-xs text-[#444] text-center max-w-xs">
          Opens BeatBaynGr in a new window. Master your beats and come back ready to drop.
        </div>
      </div>
    </div>
  );
}
