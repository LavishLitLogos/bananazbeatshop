import { ChevronLeft, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const BEATBAYNGR_LOGO = '/assets/icons/beattapes.png';
const BEATBAYNGR_URL = 'https://beatbayngr52.vercel.app';

export function BeatBaynGrRoom() {
  const { goBack } = useApp();

  const handleOpen = () => {
    window.open(BEATBAYNGR_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={goBack}
            className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
          </button>

          <div>
            <h1 className="font-display font-900 text-2xl uppercase tracking-wide text-white leading-none">
              BeatBaynGr
            </h1>
            <p className="text-sm text-[#777] mt-1">
              Master your new beat before you leave.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-32">
        <img
          src={BEATBAYNGR_LOGO}
          alt="BeatBaynGr"
          className="w-40 h-40 object-contain mb-8 animate-float"
        />

        <h2 className="font-display text-4xl font-900 text-white uppercase tracking-wide">
          BeatBaynGr
        </h2>

        <p className="text-base text-[#bdbdbd] max-w-sm mt-3 mb-8 leading-relaxed">
          Master your new beat, before you leave & save a few steps.
        </p>

        <button
          type="button"
          onClick={handleOpen}
          className="btn-gold px-8 py-4 rounded-2xl text-lg flex items-center gap-3"
        >
          Open App
          <ExternalLink size={18} />
        </button>
      </div>
    </div>
  );
}