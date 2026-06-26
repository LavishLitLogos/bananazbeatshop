import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
  small?: boolean;
}

export function ShareButton({ title = 'ThisBeatIzBananaz Beat Shop', text = 'Check out this fire beat!', url, className = '', small }: ShareButtonProps) {
  const shareUrl = url || window.location.href;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

  if (small) {
    return (
      <button
        onClick={handleShare}
        className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#666] hover:text-[#f5c518] transition-all ${className}`}
        title="Share"
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
    >
      <Share2 size={14} />
    </button>
  );
}
