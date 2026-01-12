import { useRef, useEffect, useState, useCallback } from 'react';
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
  width: _width = 600,
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
  
  // Sincronizar isHidden com o prop isConfirmed quando ele mudar externamente
  useEffect(() => {
    if (isConfirmed && savedSignature) {
      // Se foi confirmado externamente e tem assinatura salva, esconder
      console.log('[SIGNATURE PAD] isConfirmed prop changed to true, hiding component');
      setIsHidden(true);
      // Não mostrar mensagem temporária se já estava confirmado antes
      if (!isHidden) {
        setShowMinimalMessage(true);
        // Remover mensagem temporária após 3 segundos
        setTimeout(() => {
          setShowMinimalMessage(false);
        }, 3000);
      }
    } else if (!isConfirmed && isHidden) {
      // Se foi desconfirmado externamente, mostrar novamente
      console.log('[SIGNATURE PAD] isConfirmed prop changed to false, showing component');
      setIsHidden(false);
      setShowMinimalMessage(false);
    }
  }, [isConfirmed, savedSignature]); // Dependências: isConfirmed e savedSignature
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState<number | null>(null);
  const handleConfirmRef = useRef<(() => void) | null>(null);
  const onSignatureChangeRef = useRef(onSignatureChange);
  const onSignatureConfirmRef = useRef(onSignatureConfirm);
  
  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
    onSignatureConfirmRef.current = onSignatureConfirm;
  }, [onSignatureChange, onSignatureConfirm]);

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

  // Ref para rastrear se já inicializamos o signature pad
  const isInitializedRef = useRef(false);
  const savedSignatureRef = useRef(savedSignature);
  const setupInProgressRef = useRef(false);

  // Atualizar ref quando savedSignature mudar
  useEffect(() => {
    savedSignatureRef.current = savedSignature;
  }, [savedSignature]);

  // Sincronizar estado quando isConfirmed mudar do componente pai
  // Isso garante que se o componente pai definir isConfirmed=true, o componente esconde e mostra como confirmado
  useEffect(() => {
    if (isConfirmed && savedSignature) {
      console.log('[SIGNATURE PAD] isConfirmed changed to true, hiding pad and showing confirmed message');
      setIsHidden(true);
      setShowMinimalMessage(true);
    } else if (!isConfirmed && !savedSignature) {
      // Se não está confirmado e não tem assinatura salva, mostrar o pad
      console.log('[SIGNATURE PAD] isConfirmed changed to false and no saved signature, showing pad');
      setIsHidden(false);
      setShowMinimalMessage(false);
    }
  }, [isConfirmed, savedSignature]);

  // Inicialização única do signature pad
  useEffect(() => {
    // Se já foi inicializado e o signaturePad ainda existe, não re-inicializar
    if (isInitializedRef.current && signaturePadRef.current) {
      console.log('[SIGNATURE PAD] Already initialized, skipping setup');
      return;
    }
    
    // Prevenir múltiplas inicializações simultâneas
    if (setupInProgressRef.current) {
      console.log('[SIGNATURE PAD] Setup already in progress, skipping');
      return;
    }
    
    if (!canvasRef.current || signaturePadRef.current) {
      console.log('[SIGNATURE PAD] Canvas not ready or signaturePad already exists, skipping');
      return;
    }
    
    setupInProgressRef.current = true;
    console.log('[SIGNATURE PAD] ========== useEffect SETUP STARTING ==========');

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
      isInitializedRef.current = true;
      setupInProgressRef.current = false;
      console.log('[SIGNATURE PAD] Signature pad initialized, isInitializedRef set to true');
      
      // Restaurar assinatura salva se existir (usar ref para pegar valor mais recente)
      const currentSavedSignature = savedSignatureRef.current;
      if (currentSavedSignature && signaturePad) {
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
                (signaturePad as any).fromDataURL(currentSavedSignature);
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
              onSignatureChangeRef.current(currentSavedSignature);
            }
          };
          img.onerror = () => {
            console.warn('[SIGNATURE PAD] Error loading saved signature image');
          };
          img.src = currentSavedSignature;
        } catch (error) {
          console.warn('[SIGNATURE PAD] Error restoring signature:', error);
        }
      }
      
      // Listen for signature changes
      signaturePad.addEventListener('beginStroke', () => {
        console.log('[SIGNATURE PAD] ========== beginStroke EVENT ==========');
        isDrawingRef.current = true;
        setIsEmpty(false);
        // Se estava escondido, mostrar novamente ao começar a desenhar
        if (isHidden) {
          setIsHidden(false);
        }
        // Cancelar auto-confirmação se o usuário voltar a desenhar
        if (autoConfirmTimeoutRef.current) {
          console.log('[SIGNATURE PAD] beginStroke: Canceling auto-confirm timeout');
          clearTimeout(autoConfirmTimeoutRef.current);
          autoConfirmTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
          console.log('[SIGNATURE PAD] beginStroke: Canceling countdown interval');
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setAutoConfirmCountdown(null);
      });

      signaturePad.addEventListener('endStroke', () => {
        console.log('[SIGNATURE PAD] ========== endStroke EVENT ==========');
        isDrawingRef.current = false;
        const isEmptyCheck = signaturePad.isEmpty();
        console.log('[SIGNATURE PAD] Signature pad isEmpty:', isEmptyCheck);
        
        if (!isEmptyCheck) {
          console.log('[SIGNATURE PAD] Signature pad is NOT empty, scheduling auto-confirm');
          setIsEmpty(false);
          const dataURL = signaturePad.toDataURL('image/png');
          console.log('[SIGNATURE PAD] DataURL generated, length:', dataURL.length);
          onSignatureChangeRef.current(dataURL);
          
          // Limpar timeout anterior se existir (debounce - só confirma após inatividade)
          if (autoConfirmTimeoutRef.current) {
            console.log('[SIGNATURE PAD] Clearing existing auto-confirm timeout (debounce)');
            clearTimeout(autoConfirmTimeoutRef.current);
            autoConfirmTimeoutRef.current = null;
          }
          
          // Limpar interval anterior se existir
          if (countdownIntervalRef.current) {
            console.log('[SIGNATURE PAD] Clearing existing countdown interval');
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          
          // Mostrar contador regressivo
          console.log('[SIGNATURE PAD] Setting countdown to 3');
          setAutoConfirmCountdown(3);
          
          // Contador regressivo visual
          let countdown = 3;
          console.log('[SIGNATURE PAD] Creating countdown interval');
          countdownIntervalRef.current = setInterval(() => {
            countdown--;
            console.log('[SIGNATURE PAD] Countdown tick:', countdown);
            setAutoConfirmCountdown(countdown);
            if (countdown <= 0) {
              console.log('[SIGNATURE PAD] Countdown reached 0, clearing interval');
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
            }
          }, 1000);
          
          // Auto-confirmar após 2.5 segundos de inatividade (debounce)
          // Este timeout será cancelado se o usuário começar a desenhar novamente (beginStroke)
          console.log('[SIGNATURE PAD] Creating auto-confirm timeout (2500ms)');
          console.log('[SIGNATURE PAD] handleConfirmRef.current exists?', !!handleConfirmRef.current);
          console.log('[SIGNATURE PAD] signaturePadRef.current exists?', !!signaturePadRef.current);
          
          // Salvar referências para uso no timeout
          const padRef = signaturePadRef;
          const confirmRef = handleConfirmRef;
          
          autoConfirmTimeoutRef.current = setTimeout(() => {
            console.log('[SIGNATURE PAD] ========== AUTO-CONFIRM TIMEOUT FIRED ==========');
            console.log('[SIGNATURE PAD] Current signaturePadRef:', padRef.current);
            console.log('[SIGNATURE PAD] Current handleConfirmRef:', confirmRef.current);
            console.log('[SIGNATURE PAD] Timeout ID:', autoConfirmTimeoutRef.current);
            console.log('[SIGNATURE PAD] Current time:', new Date().toISOString());
            
            // Verificar se ainda não está desenhando
            if (isDrawingRef.current) {
              console.log('[SIGNATURE PAD] User is still drawing, canceling auto-confirm');
              return;
            }
            
            if (countdownIntervalRef.current) {
              console.log('[SIGNATURE PAD] Clearing countdown interval');
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setAutoConfirmCountdown(null);
            console.log('[SIGNATURE PAD] Auto-confirming signature after inactivity');
            
            // Chamar handleConfirm através da referência
            if (confirmRef.current) {
              console.log('[SIGNATURE PAD] Calling handleConfirm via ref');
              try {
                confirmRef.current();
                console.log('[SIGNATURE PAD] handleConfirm called successfully');
              } catch (error) {
                console.error('[SIGNATURE PAD] ERROR calling handleConfirm:', error);
                console.error('[SIGNATURE PAD] Error stack:', error instanceof Error ? error.stack : 'No stack');
              }
            } else {
              console.warn('[SIGNATURE PAD] handleConfirmRef.current is NULL, using fallback');
              // Fallback: chamar callbacks diretamente usando signaturePadRef
              if (padRef.current && !padRef.current.isEmpty()) {
                const currentDataURL = padRef.current.toDataURL('image/png');
                console.log('[SIGNATURE PAD] Fallback: calling callbacks directly');
                console.log('[SIGNATURE PAD] DataURL length:', currentDataURL.length);
                console.log('[SIGNATURE PAD] onSignatureConfirm exists?', !!onSignatureConfirmRef.current);
                if (onSignatureConfirmRef.current) {
                  console.log('[SIGNATURE PAD] Calling onSignatureConfirm');
                  try {
                    onSignatureConfirmRef.current(currentDataURL);
                    console.log('[SIGNATURE PAD] onSignatureConfirm called successfully');
                  } catch (error) {
                    console.error('[SIGNATURE PAD] ERROR calling onSignatureConfirm:', error);
                  }
                }
                console.log('[SIGNATURE PAD] Calling onSignatureChange');
                try {
                  onSignatureChangeRef.current(currentDataURL);
                  console.log('[SIGNATURE PAD] onSignatureChange called successfully');
                } catch (error) {
                  console.error('[SIGNATURE PAD] ERROR calling onSignatureChange:', error);
                }
              } else {
                console.error('[SIGNATURE PAD] Cannot use fallback: signaturePad is null or empty');
                console.error('[SIGNATURE PAD] padRef.current:', padRef.current);
                console.error('[SIGNATURE PAD] padRef.current?.isEmpty():', padRef.current?.isEmpty());
              }
            }
            console.log('[SIGNATURE PAD] ========== AUTO-CONFIRM TIMEOUT COMPLETED ==========');
          }, 2500);
          console.log('[SIGNATURE PAD] Auto-confirm timeout created, ID:', autoConfirmTimeoutRef.current);
          console.log('[SIGNATURE PAD] Timeout will fire at:', new Date(Date.now() + 2500).toISOString());
        } else {
          console.log('[SIGNATURE PAD] Signature pad is empty, skipping auto-confirm');
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
      // Cleanup apenas quando componente desmontar
      // NÃO fazer cleanup em re-renders - isso cancela os timeouts
      // Verificar se realmente é um unmount (canvas não existe mais) ou se é apenas StrictMode
      const isRealUnmount = !canvasRef.current || !document.body.contains(canvasRef.current);
      
      if (isRealUnmount) {
        console.log('[SIGNATURE PAD] ========== useEffect CLEANUP (REAL UNMOUNT) ==========');
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        
        // Limpar timeouts apenas no unmount real
        if (autoConfirmTimeoutRef.current) {
          console.log('[SIGNATURE PAD] Cleanup: Clearing auto-confirm timeout (unmount)');
          clearTimeout(autoConfirmTimeoutRef.current);
          autoConfirmTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
          console.log('[SIGNATURE PAD] Cleanup: Clearing countdown interval (unmount)');
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        if (signaturePadRef.current) {
          console.log('[SIGNATURE PAD] Cleanup: Removing signature pad event listeners (unmount)');
          signaturePadRef.current.off();
          signaturePadRef.current = null;
          isInitializedRef.current = false;
        }
        console.log('[SIGNATURE PAD] ========== useEffect CLEANUP COMPLETED ==========');
      } else {
        // É apenas StrictMode ou re-render, não fazer cleanup completo
        console.log('[SIGNATURE PAD] ========== useEffect CLEANUP (StrictMode/re-render, preserving timeouts) ==========');
        // Apenas remover event listeners de window, mas manter signaturePad e timeouts
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        console.log('[SIGNATURE PAD] ========== useEffect CLEANUP COMPLETED (timeouts preserved) ==========');
      }
    };
  }, []); // Empty dependencies - só inicializar uma vez, nunca re-executar

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      onSignatureChange(null);
      // Cancelar auto-confirmação ao limpar
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setAutoConfirmCountdown(null);
    }
  };

  const handleConfirm = useCallback(() => {
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
      
      // Cancelar auto-confirmação se ainda estiver ativa
      if (autoConfirmTimeoutRef.current) {
        clearTimeout(autoConfirmTimeoutRef.current);
        autoConfirmTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setAutoConfirmCountdown(null);
      
      // Chamar callbacks primeiro
      if (onSignatureConfirm) {
        console.log('[SIGNATURE PAD] Calling onSignatureConfirm callback');
        onSignatureConfirm(dataURL);
      }
      console.log('[SIGNATURE PAD] Calling onSignatureChange callback');
      onSignatureChange(dataURL);
      
      // Esconder o componente após confirmação (tanto manual quanto automática)
      console.log('[SIGNATURE PAD] Hiding signature pad after confirmation');
      setIsHidden(true);
      // Mostrar mensagem de confirmação permanentemente (não temporária)
      // A mensagem permanecerá visível enquanto houver assinatura salva
      setShowMinimalMessage(true);
      
      console.log('[SIGNATURE PAD] ========== handleConfirm COMPLETED ==========');
    } catch (error) {
      console.error('[SIGNATURE PAD] ERROR in handleConfirm:', error);
    }
  }, [isEmpty, isHidden, savedSignature, onSignatureConfirm, onSignatureChange]);
  
  // Atualizar a referência sempre que handleConfirm mudar
  useEffect(() => {
    console.log('[SIGNATURE PAD] Updating handleConfirmRef');
    handleConfirmRef.current = handleConfirm;
    console.log('[SIGNATURE PAD] handleConfirmRef updated, function exists?', !!handleConfirmRef.current);
  }, [handleConfirm]);

  // Debug: log do estado atual
  console.log('[SIGNATURE PAD] Render - isHidden:', isHidden, 'showMinimalMessage:', showMinimalMessage, 'isEmpty:', isEmpty);
  
  // Se estiver escondido, mostrar apenas uma mensagem mínima ou nada
  if (isHidden) {
    console.log('[SIGNATURE PAD] Component is HIDDEN, rendering minimal view');
    // Se tem assinatura salva e está confirmada, mostrar sempre a mensagem de confirmada
    // Isso mantém a assinatura visível permanentemente, como na página GlobalPartner
    if (savedSignature && (isConfirmed || showMinimalMessage)) {
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
    
    // Se não tem assinatura salva, mostrar apenas o label com botão para editar
    return (
      <div className={`${className}`}>
        {label && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-white font-medium text-sm sm:text-base">
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <button
              type="button"
              onClick={() => {
                console.log('[SIGNATURE PAD] User clicked to show signature pad again');
                setIsHidden(false);
                setShowMinimalMessage(false);
              }}
              className="text-xs sm:text-sm text-gold-light/50 hover:text-gold-light underline min-h-[44px] px-2"
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
        <Label className="text-white font-medium text-sm sm:text-base">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="relative border-2 border-gray-600 rounded-lg bg-white overflow-hidden w-full" style={{ minHeight: `${height}px` }}>
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
            <p className="text-gray-400 text-xs sm:text-sm px-2 text-center">Sign here with your mouse or finger</p>
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
          className="bg-black text-gold-light border-gold-medium hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50 min-h-[44px] text-xs sm:text-sm flex-1 sm:flex-initial"
        >
          <RotateCcw className="w-4 h-4 mr-1 sm:mr-2" />
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
          className="bg-black text-gold-light hover:bg-gray-900 hover:text-gold-medium disabled:opacity-50 font-semibold min-h-[44px] text-xs sm:text-sm flex-1 sm:flex-initial"
        >
          <Check className="w-4 h-4 mr-1 sm:mr-2" />
          Done
        </Button>
      </div>

      {!isEmpty && (
        <p className="text-xs sm:text-sm text-gold-light font-medium">
          ✓ Signature captured. {autoConfirmCountdown !== null ? (
            <span>Auto-confirming in {autoConfirmCountdown} second{autoConfirmCountdown !== 1 ? 's' : ''}... or click "Done" now.</span>
          ) : (
            <span>Click "Done" to confirm, or "Clear" to re-sign.</span>
          )}
        </p>
      )}

      {isEmpty && (
        <p className="text-xs sm:text-sm text-gray-400">
          By signing above, you are providing your electronic signature to this agreement.
        </p>
      )}
    </div>
  );
}
