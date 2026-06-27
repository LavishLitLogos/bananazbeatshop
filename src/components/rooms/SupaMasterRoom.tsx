import { ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MAIN_LOGO = 'https://raw.githubusercontent.com/LavishLitLogos/dc52images/dfde2fa717e8c15f2d9c3353bf7db1c48be97613/supamasterlogo.svg';

export function SupaMasterRoom() {
  const { goBack } = useApp();

  return (
    <div className="min-h-screen bg-[#070707] text-white">
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
              Master control room placeholder.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-32">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-4 rounded-3xl border border-[#1e1e1e] bg-[#101010] p-5 text-center">
            <img src={MAIN_LOGO} alt="" className="w-20 h-20 object-contain mx-auto mb-3 opacity-80" />
            <div className="font-display font-900 text-xl uppercase text-[#f5c518]">
              SupaMaster
            </div>
            <p className="text-sm text-[#888] mt-2 leading-relaxed">
              This room is wired into the app now and ready for its real feature pass.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
