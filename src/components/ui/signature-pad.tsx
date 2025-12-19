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
  const isDrawingRef = useRef<boolean>(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Helper function to calculate canvas offset
  const getCanvasOffset = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  // Function to resize canvas and update SignaturePad
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Don't resize while user is drawing
    if (isDrawingRef.current) {
      return;
    }

    const signaturePad = signaturePadRef.current;
    
    // Save current drawing data before resizing (changing canvas size clears it)
    let savedData = null;
    if (signaturePad && !signaturePad.isEmpty()) {
      savedData = signaturePad.toData();
    }

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    // Get the container (parent element) to calculate available space
    const container = canvas.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    // Calculate available width (container width minus border)
    // Border is 2px on each side = 4px total
    // Use exactly the available space, no extra padding
    const borderWidth = 4; // 2px border on each side (2px left + 2px right)
    const borderHeight = 4; // 2px border on each side (2px top + 2px bottom)
    
    // Use exactly the container size minus borders - no minimum, no extra space
    const displayWidth = Math.max(containerRect.width - borderWidth, 0);
    const displayHeight = Math.max(containerRect.height - borderHeight, height);
    
    // Only resize if dimensions actually changed (to avoid clearing canvas unnecessarily)
    const currentWidth = canvas.width / ratio;
    const currentHeight = canvas.height / ratio;
    
    if (Math.abs(currentWidth - displayWidth) < 1 && Math.abs(currentHeight - displayHeight) < 1) {
      // Dimensions haven't changed significantly, just update SignaturePad coordinates
      if (signaturePad) {
        signaturePad.resizeCanvas();
      }
      return;
    }
    
    // Set internal canvas size (high DPI) - use exact available space
    // NOTE: Changing canvas.width or canvas.height clears the canvas!
    canvas.width = displayWidth * ratio;
    canvas.height = displayHeight * ratio;
    
    // Set CSS size (display size) - use exact available space
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // Scale context for high DPI
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    // Resize SignaturePad if it exists - this recalculates coordinates
    if (signaturePad) {
      signaturePad.resizeCanvas();
      
      // Restore saved drawing data after resize
      if (savedData) {
        signaturePad.fromData(savedData);
      }
    }
  };

  useEffect(() => {
    if (!canvasRef.current || signaturePadRef.current) return;

    const canvas = canvasRef.current;
    
    // Wait a bit for container to be fully rendered, then setup canvas
    // This ensures we get the correct container dimensions
    const setupCanvas = () => {
      resizeCanvas();
      
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
        isDrawingRef.current = true;
        if (isConfirmed) {
          setIsConfirmed(false);
        }
        setIsEmpty(false);
      });

      signaturePad.addEventListener('endStroke', () => {
        isDrawingRef.current = false;
        if (!signaturePad.isEmpty()) {
          setIsEmpty(false);
          const dataURL = signaturePad.toDataURL('image/png');
          onSignatureChange(dataURL);
        }
      });
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(setupCanvas);
    });

    // Handle window resize
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);
    
    // Also handle orientation change on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, [width, height]); // Only depend on width and height, not onSignatureChange or isConfirmed

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
      
      <div className="relative border-2 border-gray-600 rounded-lg bg-white overflow-hidden" style={{ minHeight: `${height}px`, width: '100%' }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{ 
            touchAction: 'none', 
            opacity: isConfirmed ? 0.7 : 1,
            display: 'block',
            width: '100%',
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
