import { X } from 'lucide-react';
import { Button } from './button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-gold-medium/30 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-gold-medium/10 text-gold-medium'
          }`}>
            {variant === 'danger' ? (
              <X className="w-6 h-6" />
            ) : (
              <div className="w-2.5 h-2.5 bg-gold-medium rounded-full animate-pulse" />
            )}
          </div>
          
          <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">{title}</h3>
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-6 px-2">{message}</p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 h-11 border-gold-medium/30 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
            >
              {cancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 h-11 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg transition-all ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20'
                  : 'bg-gold-medium hover:bg-gold-dark text-black shadow-gold-medium/10'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Wait...
                </div>
              ) : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

