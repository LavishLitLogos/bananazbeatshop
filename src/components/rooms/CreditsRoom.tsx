import { ChevronLeft, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';

export function CreditsRoom() {
  const { goBack, addToast } = useApp();

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Credits room link copied.', 'success');
    } catch {
      addToast('Share failed.', 'error');
    }
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
              <h1 className="font-display font-900 text-2xl uppercase tracking-wide text-white leading-none">
                Credits
              </h1>
              <p className="text-sm text-[#777] mt-1">
                Production credits, placements, and artist showcases.
              </p>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#f5c518]"
            aria-label="Share credits room"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 pb-32">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-4 rounded-3xl border border-[#1e1e1e] bg-[#101010] p-5 text-center">
            <img src={MAIN_LOGO} alt="" className="w-20 h-20 object-contain mx-auto mb-3 opacity-80" />
            <div className="font-display font-900 text-xl uppercase text-[#f5c518]">
              Credits Room
            </div>
            <p className="text-sm text-[#888] mt-2 leading-relaxed">
              Artist production showcases will live here. Tracks should play full-length,
              pop out with artist details, and stay shareable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
