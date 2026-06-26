import React from 'react';
import { X, ChevronLeft } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function Modal({ onClose, title, children, maxWidth = 'max-w-lg', showBack, onBack }: ModalProps) {
  const handleBackdrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdrop} onMouseDown={(e) => e.stopPropagation()}>
      <div className={`modal-box w-full ${maxWidth}`} onClick={(e) => e.stopPropagation()}>
        {(title || showBack) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
            <div className="flex items-center gap-2">
              {showBack && onBack && (
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 text-[#888] hover:text-white transition-colors">
                  <ChevronLeft size={18} />
                </button>
              )}
              {title && (
                <h2 className="font-display font-800 text-lg uppercase tracking-wider text-white">{title}</h2>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        {!title && !showBack && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
