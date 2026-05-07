import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onComplete: (dataUrl: string) => void;
  onClear?: () => void;
}

export const SignatureCanvas: React.FC<Props> = ({ onComplete, onClear }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [status, setStatus] = useState<'idle' | 'confirming' | 'done'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    return ctx;
  };

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const ctx = getCtx();
      if (!ctx) return;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasStrokes(true);
    };

    const stop = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stop);
    };
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    setStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    onClear?.();
  }, [onClear]);

  const handleDone = useCallback(() => {
    if (!hasStrokes) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onComplete(dataUrl);
    setStatus('done');
  }, [hasStrokes, onComplete]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-gold-medium/40 rounded-xl overflow-hidden bg-white"
        style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full cursor-crosshair"
          style={{ display: 'block' }}
        />
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm select-none">
              {t('signature.sign_here', 'Sign here with your mouse or finger')}
            </p>
          </div>
        )}
      </div>

      {status === 'confirming' && (
        <p className="text-gold-medium text-sm font-semibold text-center animate-pulse">
          {t('signature.captured', {
            seconds: 2,
            defaultValue: '✓ Assinatura capturada. Confirmando em 2 segundos...',
          })}
        </p>
      )}
      {status === 'done' && (
        <p className="text-emerald-400 text-sm font-semibold text-center">
          {t('signature.confirmed', '✓ Assinatura confirmada!')}
        </p>
      )}

      {status !== 'done' && (
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-gray-300 text-sm hover:border-white/40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('signature.clear', 'Clear')}
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={!hasStrokes || status === 'confirming'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold-medium text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-light transition-all"
          >
            <Check className="w-3.5 h-3.5" /> {t('signature.done', 'Done')}
          </button>
        </div>
      )}
    </div>
  );
};
