import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from './button';
import { Label } from './label';
import { RotateCcw, Check } from 'lucide-react';

interface SignaturePadComponentProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  onSignatureConfirm?: (signatureDataUrl: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

export function SignaturePadComponent({
  onSignatureChange,
  onSignatureConfirm,
  label = 'Digital Signature',
  required = false,
  className = '',
  width = 600,
  height = 200,
}: SignaturePadComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || signaturePadRef.current) return;

    const canvas = canvasRef.current;
    
    // Setup canvas dimensions for high DPI displays
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    // Initialize SignaturePad
    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: '#ffffff',
      penColor: '#000000', // Cor preta
      minWidth: 1.5,
      maxWidth: 3,
      throttle: 16,
    });

    signaturePadRef.current = signaturePad;

    // Listen for signature changes
    signaturePad.addEventListener('beginStroke', () => {
      if (isConfirmed) {
        setIsConfirmed(false);
      }
      setIsEmpty(false);
    });

    signaturePad.addEventListener('endStroke', () => {
      if (!signaturePad.isEmpty()) {
        setIsEmpty(false);
        const dataURL = signaturePad.toDataURL('image/png');
        onSignatureChange(dataURL);
      }
    });

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      setIsConfirmed(false);
      onSignatureChange(null);
    }
  };

  const handleConfirm = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataURL = signaturePadRef.current.toDataURL('image/png');
      setIsConfirmed(true);
      if (onSignatureConfirm) {
        onSignatureConfirm(dataURL);
      }
      onSignatureChange(dataURL);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-white font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative border-2 border-gray-600 rounded-lg bg-white overflow-hidden" style={{ minHeight: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{ 
            touchAction: 'none', 
            opacity: isConfirmed ? 0.7 : 1,
            display: 'block',
            width: `${width}px`,
            maxWidth: '100%',
            height: `${height}px`,
            position: 'relative',
            zIndex: 1
          }}
        />
        
        {isEmpty && !isConfirmed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
            <p className="text-gray-400 text-sm">Sign here with your mouse or finger</p>
          </div>
        )}

        {isConfirmed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-green-900/20" style={{ zIndex: 0 }}>
            <div className="bg-black/80 px-4 py-2 rounded-lg">
              <p className="text-gold-light font-semibold text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                Signature Confirmed
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty && !isConfirmed}
          className="bg-black text-gold-light border-gold-medium hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear
        </Button>
        
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={isEmpty || isConfirmed}
          className="bg-black text-gold-light hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50 font-semibold"
        >
          <Check className="w-4 h-4 mr-2" />
          Done
        </Button>
      </div>

      {isConfirmed && (
        <p className="text-xs text-gold-light font-medium">
          ✓ Signature confirmed. You can clear and re-sign if needed.
        </p>
      )}

      {!isConfirmed && !isEmpty && (
        <p className="text-xs text-gray-400">
          Click "Done" to confirm your signature.
        </p>
      )}

      {isEmpty && (
        <p className="text-xs text-gray-400">
          By signing above, you are providing your electronic signature to this agreement.
        </p>
      )}
    </div>
  );
}
