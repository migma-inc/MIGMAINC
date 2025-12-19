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
  savedSignature?: string | null; // Assinatura salva para restaurar
  isConfirmed?: boolean; // Estado de confirmação para restaurar
}

export function SignaturePadComponent({
  onSignatureChange,
  onSignatureConfirm,
  label = 'Digital Signature',
  required = false,
  className = '',
  width = 600,
  height = 200,
  savedSignature = null,
  isConfirmed = false,
}: SignaturePadComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [isEmpty, setIsEmpty] = useState(!savedSignature); // Se tem assinatura salva, não está vazio
  // Se já estava confirmado E tem assinatura salva, começar escondido; senão, visível
  const [isHidden, setIsHidden] = useState(isConfirmed && savedSignature ? true : false);
  const [showMinimalMessage, setShowMinimalMessage] = useState(false); // Para mostrar mensagem mínima temporária

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
      // Dimensions haven't changed significantly, no need to resize
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

    // Restore saved drawing data after resize
    // Note: signature_pad doesn't have resizeCanvas() method, but it automatically
    // recalculates coordinates when canvas size changes. We just need to restore the data.
    if (signaturePad && savedData) {
      signaturePad.fromData(savedData);
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
      
      // Restaurar assinatura salva se existir
      if (savedSignature && signaturePad) {
        try {
          console.log('[SIGNATURE PAD] Restoring saved signature');
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Limpar canvas primeiro
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Desenhar imagem restaurada
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              // IMPORTANTE: Após desenhar a imagem, precisamos fazer o SignaturePad reconhecer
              // que há conteúdo. Vamos forçar uma atualização do estado interno.
              // Como não podemos adicionar strokes diretamente, vamos usar uma abordagem diferente:
              // Converter a imagem para dados do SignaturePad ou marcar manualmente como não vazio
              
              // Solução: Desenhar um ponto invisível para fazer o SignaturePad reconhecer que não está vazio
              // Ou melhor: usar fromDataURL se disponível, senão forçar o estado
              
              // Tentar usar fromDataURL se o SignaturePad tiver esse método
              if (typeof (signaturePad as any).fromDataURL === 'function') {
                (signaturePad as any).fromDataURL(savedSignature);
                console.log('[SIGNATURE PAD] Used fromDataURL to restore');
              } else {
                // Fallback: desenhar um ponto muito pequeno e apagar para "ativar" o SignaturePad
                const tempCtx = canvas.getContext('2d');
                if (tempCtx) {
                  // Salvar o estado atual
                  tempCtx.save();
                  // Desenhar um ponto minúsculo invisível
                  tempCtx.globalAlpha = 0.01;
                  tempCtx.beginPath();
                  tempCtx.arc(1, 1, 0.5, 0, 2 * Math.PI);
                  tempCtx.fill();
                  tempCtx.restore();
                  // Agora o SignaturePad deve reconhecer que não está vazio
                }
              }
              
              setIsEmpty(false);
              console.log('[SIGNATURE PAD] Signature restored successfully, isEmpty should be false');
              console.log('[SIGNATURE PAD] signaturePad.isEmpty() after restore:', signaturePad.isEmpty());
              // Notificar o componente pai
              onSignatureChange(savedSignature);
            }
          };
          img.onerror = () => {
            console.warn('[SIGNATURE PAD] Error loading saved signature image');
          };
          img.src = savedSignature;
        } catch (error) {
          console.warn('[SIGNATURE PAD] Error restoring signature:', error);
        }
      }
      
      // Listen for signature changes
      signaturePad.addEventListener('beginStroke', () => {
        isDrawingRef.current = true;
        setIsEmpty(false);
        // Se estava escondido, mostrar novamente ao começar a desenhar
        if (isHidden) {
          setIsHidden(false);
        }
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
  }, [width, height, savedSignature, isConfirmed]); // Include savedSignature and isConfirmed to restore on mount

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      onSignatureChange(null);
    }
  };

  const handleConfirm = () => {
    console.log('[SIGNATURE PAD] ========== handleConfirm CALLED ==========');
    console.log('[SIGNATURE PAD] signaturePadRef.current:', signaturePadRef.current);
    console.log('[SIGNATURE PAD] isEmpty state:', isEmpty);
    console.log('[SIGNATURE PAD] isHidden state:', isHidden);
    console.log('[SIGNATURE PAD] savedSignature exists:', !!savedSignature);
    
    if (!signaturePadRef.current) {
      console.error('[SIGNATURE PAD] ERROR: signaturePadRef.current is null!');
      return;
    }
    
    // Verificar se há conteúdo de duas formas:
    // 1. Se o estado isEmpty está false (pode ser de assinatura restaurada)
    // 2. Se o signaturePad não está vazio (para assinaturas desenhadas diretamente)
    const isEmptyCheck = signaturePadRef.current.isEmpty();
    const hasVisualContent = !isEmpty || savedSignature; // Se isEmpty é false OU há assinatura salva
    
    console.log('[SIGNATURE PAD] signaturePad.isEmpty():', isEmptyCheck);
    console.log('[SIGNATURE PAD] hasVisualContent (isEmpty=false or savedSignature):', hasVisualContent);
    
    if (isEmptyCheck && !hasVisualContent) {
      console.warn('[SIGNATURE PAD] Cannot confirm: signature pad is EMPTY and no saved signature');
      alert('Please draw a signature before confirming.');
      return;
    }
    
    try {
      // Se há assinatura salva e o pad está vazio (restaurada), usar a assinatura salva
      // Senão, usar a do signaturePad
      let dataURL: string;
      if (savedSignature && isEmptyCheck) {
        console.log('[SIGNATURE PAD] Using saved signature because pad is empty but has visual content');
        dataURL = savedSignature;
      } else {
        dataURL = signaturePadRef.current.toDataURL('image/png');
      }
      
      console.log('[SIGNATURE PAD] Signature confirmed, dataURL length:', dataURL.length);
      console.log('[SIGNATURE PAD] dataURL preview:', dataURL.substring(0, 50) + '...');
      
      // Chamar callbacks primeiro
      if (onSignatureConfirm) {
        console.log('[SIGNATURE PAD] Calling onSignatureConfirm callback');
        onSignatureConfirm(dataURL);
      }
      console.log('[SIGNATURE PAD] Calling onSignatureChange callback');
      onSignatureChange(dataURL);
      
      // Esconder o componente para não atrapalhar a visualização
      console.log('[SIGNATURE PAD] Setting isHidden to TRUE');
      setIsHidden(true);
      console.log('[SIGNATURE PAD] Setting showMinimalMessage to TRUE');
      setShowMinimalMessage(true);
      console.log('[SIGNATURE PAD] Component should now be hidden');
      
      // Esconder a mensagem mínima após 3 segundos
      setTimeout(() => {
        console.log('[SIGNATURE PAD] 3 seconds passed, hiding minimal message');
        setShowMinimalMessage(false);
      }, 3000);
      
      console.log('[SIGNATURE PAD] ========== handleConfirm COMPLETED ==========');
    } catch (error) {
      console.error('[SIGNATURE PAD] ERROR in handleConfirm:', error);
    }
  };

  // Debug: log do estado atual
  console.log('[SIGNATURE PAD] Render - isHidden:', isHidden, 'showMinimalMessage:', showMinimalMessage, 'isEmpty:', isEmpty);
  
  // Se estiver escondido, mostrar apenas uma mensagem mínima ou nada
  if (isHidden) {
    console.log('[SIGNATURE PAD] Component is HIDDEN, rendering minimal view');
    // Se ainda está mostrando mensagem temporária, mostrar versão ultra-compacta
    if (showMinimalMessage) {
      return (
        <div className={`${className}`}>
          {label && (
            <Label className="text-white font-medium text-sm">
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-gold-light text-xs flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Confirmed</span>
            </p>
            <button
              type="button"
              onClick={() => {
                console.log('[SIGNATURE PAD] User clicked to show signature pad again');
                setIsHidden(false);
                setShowMinimalMessage(false);
              }}
              className="text-xs text-gold-light/70 hover:text-gold-light underline"
            >
              Edit
            </button>
          </div>
        </div>
      );
    }
    
    // Após 3 segundos, mostrar apenas o label (quase invisível)
    return (
      <div className={`${className}`}>
        {label && (
          <div className="flex items-center justify-between">
            <Label className="text-white font-medium text-sm">
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <button
              type="button"
              onClick={() => {
                console.log('[SIGNATURE PAD] User clicked to show signature pad again');
                setIsHidden(false);
                setShowMinimalMessage(false);
              }}
              className="text-xs text-gold-light/50 hover:text-gold-light underline"
            >
              Edit signature
            </button>
          </div>
        )}
      </div>
    );
  }

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
            opacity: 1,
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: `${height}px`,
            position: 'relative',
            zIndex: 1
          }}
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
            <p className="text-gray-400 text-sm">Sign here with your mouse or finger</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="bg-black text-gold-light border-gold-medium hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear
        </Button>
        
        <Button
          type="button"
          size="sm"
          onClick={(e) => {
            console.log('[SIGNATURE PAD] ========== Done BUTTON CLICKED ==========');
            console.log('[SIGNATURE PAD] Event:', e);
            console.log('[SIGNATURE PAD] isEmpty:', isEmpty);
            console.log('[SIGNATURE PAD] Button disabled?', isEmpty);
            e.preventDefault();
            e.stopPropagation();
            handleConfirm();
          }}
          disabled={isEmpty}
          className="bg-black text-gold-light hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50 font-semibold"
        >
          <Check className="w-4 h-4 mr-2" />
          Done
        </Button>
      </div>

      {!isEmpty && (
        <p className="text-xs text-gold-light font-medium">
          ✓ Signature captured. Click "Done" to confirm, or "Clear" to re-sign.
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
