import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from './button';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  onConfirm?: () => void;
  children?: React.ReactNode;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  onConfirm,
  children,
}: AlertModalProps) {
  if (!isOpen) return null;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const Icon = icons[variant];
  const iconColor = colors[variant];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-gold-medium/50 rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <Icon className={`w-6 h-6 ${iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-300">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            {onConfirm && (
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg"
            >
              {onConfirm ? 'Confirm' : 'OK'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

