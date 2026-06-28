import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const SUPAMASTER_LOGO = '/assets/images/supamasterlogo.svg';
const SUPAMASTER_URL = 'https://supamaster52.base44.app';

export function SupaMasterRoom() {
  const { goBack } = useApp();

  const openApp = () => {
    window.open(SUPAMASTER_URL, '_blank', 'noopener,noreferrer');
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
              SupaMaster
            </h1>
            <p className="text-sm text-[#777] mt-1">
              Master your beat, without leaving the shop!
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-32">
        <img
          src={SUPAMASTER_LOGO}
          alt="SupaMaster"
          className="w-64 max-w-full mb-8 object-contain"
        />

        <p className="text-base text-[#bdbdbd] max-w-sm mb-8 leading-relaxed">
          Master your beat, without leaving the shop!
        </p>

        <button
          type="button"
          onClick={openApp}
          className="btn-gold px-8 py-4 rounded-2xl flex items-center gap-2 text-lg"
        >
          Open App
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}