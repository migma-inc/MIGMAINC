import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contractTitle: string;
  contractText: string;
}

export const TermsModal: React.FC<Props> = ({ isOpen, onClose, contractTitle, contractText }) => {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-[#111] border border-gold-medium/30 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="font-bold text-white text-base">{contractTitle}</h2>
          <button
            onClick={onClose}
            aria-label={t('migma_checkout.terms.close', 'Close')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar"
        >
          <div
            className="text-gray-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: contractText }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all"
          >
            {t('migma_checkout.terms.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
