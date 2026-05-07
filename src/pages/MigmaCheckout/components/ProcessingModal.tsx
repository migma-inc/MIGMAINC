import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, progress, message }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#111] border border-gold-medium/30 rounded-3xl p-8 shadow-2xl shadow-gold-medium/10">
        <div className="flex flex-col items-center text-center space-y-6">
          
          <div className="relative w-24 h-24 flex items-center justify-center">
            {progress < 100 ? (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-t-gold-medium border-r-gold-medium border-b-transparent border-l-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                ></div>
                <span className="text-xl font-black text-white">{progress}%</span>
              </>
            ) : (
              <div className="bg-emerald-500 rounded-full p-4 animate-in zoom-in duration-500">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          <div className="space-y-2 w-full">
            <h3 className="text-xl font-bold text-white tracking-tight">
              {progress === 100
                ? t('migma_checkout.processing.ready', 'All set!')
                : t('migma_checkout.processing.title', 'Processing your request')}
            </h3>
            <p className="text-gray-400 text-sm min-h-[40px] flex items-center justify-center gap-2">
              {progress < 100 && <Loader2 className="w-3 h-3 animate-spin text-gold-medium" />}
              {message}
            </p>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-gold-dark via-gold-medium to-gold-light transition-all duration-500 ease-out shadow-[0_0_10px_rgba(206,159,72,0.3)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <p className="text-[10px] uppercase font-black text-white/20 tracking-[0.2em]">
            {t('migma_checkout.processing.secure_checkout', 'Migma Inc. Secure Checkout')}
          </p>
        </div>
      </div>
    </div>
  );
};
