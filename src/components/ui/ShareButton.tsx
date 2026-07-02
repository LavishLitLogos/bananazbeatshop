import { Share2 } from 'lucide-react';
import { BRAND_NAME } from '../../utils/branding';

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
  small?: boolean;
}

export function ShareButton({ title = `${BRAND_NAME} Beat Shop`, text = `Check out this fire release from ${BRAND_NAME}.`, url, className = '', small }: ShareButtonProps) {
  const shareUrl = url || window.location.href;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    }
  };

  if (small) {
    return (
      <button
        onClick={handleShare}
        className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#666] hover:text-[#f5c518] transition-all ${className}`}
        title="Share"
        aria-label="Share"
      >
        <Share2 size={13} />
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#888] hover:text-[#f5c518] transition-all text-sm ${className}`}
      title="Share"
      aria-label="Share"
    >
      <Share2 size={14} />
    </button>
  );
}
