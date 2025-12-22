import { useEffect } from 'react';

/**
 * Hook para proteger conteúdo contra cópia, impressão e download
 * Aplica proteções apenas na área especificada do contrato
 */
export function useContentProtection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    // Variável para rastrear se o conteúdo está escondido
    let isContentHidden = false;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    // Função para mostrar aviso discreto
    const showWarning = (message: string) => {
      // Criar elemento de aviso temporário
      const warning = document.createElement('div');
      warning.textContent = message;
      warning.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(206, 159, 72, 0.95);
        color: #000;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(warning);
      
      setTimeout(() => {
        warning.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (warning.parentNode) {
            warning.parentNode.removeChild(warning);
          }
        }, 300);
      }, 2000);
    };

    // Adicionar estilos de animação se não existirem
    if (!document.getElementById('protection-styles')) {
      const style = document.createElement('style');
      style.id = 'protection-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Verificar se está na área de upload de documentos
    const isInUploadArea = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      
      const photoUploadSection = document.getElementById('photo-upload-section');
      
      // Verificar se está na seção de upload
      if (photoUploadSection && photoUploadSection.contains(target)) {
        return true;
      }
      
      // Verificar se está em qualquer elemento relacionado a upload
      let currentElement: Element | null = target as Element;
      while (currentElement) {
        if (currentElement.id === 'photo-upload-section' ||
            currentElement.closest('#photo-upload-section') ||
            currentElement.closest('[class*="upload"]') ||
            currentElement.closest('[class*="DocumentUpload"]') ||
            currentElement.closest('[class*="file"]')) {
          return true;
        }
        currentElement = currentElement.parentElement;
      }
      
      return false;
    };

    // Handler para verificar se o evento é dentro da área protegida
    // Mas NÃO em elementos interativos (botões, inputs, checkboxes, etc.)
    const isProtectedArea = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      
      // NÃO proteger se estiver na área de upload
      if (isInUploadArea(target)) {
        return false;
      }
      
      // Permitir elementos interativos mesmo dentro da área protegida
      const interactiveElements = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A', 'LABEL'];
      let currentElement: Element | null = target as Element;
      
      // Verificar se o elemento ou algum pai é interativo
      while (currentElement) {
        if (interactiveElements.includes(currentElement.tagName)) {
          return false; // Não proteger elementos interativos
        }
        // Verificar se tem role interativo
        const role = currentElement.getAttribute('role');
        if (role && ['button', 'checkbox', 'textbox', 'link'].includes(role)) {
          return false;
        }
        // Verificar se tem classe de componente UI (shadcn/ui)
        if (currentElement.classList.contains('ui-button') || 
            currentElement.closest('[class*="button"]') ||
            currentElement.closest('[class*="checkbox"]') ||
            currentElement.closest('[class*="upload"]') ||
            currentElement.closest('[class*="input"]')) {
          return false;
        }
        currentElement = currentElement.parentElement;
      }
      
      // Verificar se está no conteúdo do contrato OU no header (título e descrição)
      const contractContent = document.getElementById('contract-content');
      const contractHeader = document.getElementById('contract-header');
      
      const isInContractContent = contractContent && contractContent.contains(target);
      const isInContractHeader = contractHeader && contractHeader.contains(target);
      
      return isInContractContent || isInContractHeader || false;
    };

    // Bloquear botão direito (contextmenu) - EM TODA A PÁGINA
    const handleContextMenu = (e: MouseEvent) => {
      // Verificar se não é um elemento interativo (botão, input, etc.)
      const target = e.target as Element | null;
      if (target) {
        const interactiveElements = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'];
        let currentElement: Element | null = target;
        
        // Verificar se o elemento ou algum pai é interativo
        while (currentElement) {
          if (interactiveElements.includes(currentElement.tagName)) {
            return; // Permitir botão direito em elementos interativos
          }
          const role = currentElement.getAttribute('role');
          if (role && ['button', 'checkbox', 'textbox', 'link'].includes(role)) {
            return; // Permitir botão direito em elementos com role interativo
          }
          // Verificar se tem classe de componente UI (shadcn/ui)
          if (currentElement.closest('[class*="button"]') ||
              currentElement.closest('[class*="checkbox"]') ||
              currentElement.closest('[class*="upload"]') ||
              currentElement.closest('[class*="input"]')) {
            return; // Permitir botão direito em componentes UI
          }
          currentElement = currentElement.parentElement;
        }
      }
      
      // Bloquear botão direito em toda a página (exceto elementos interativos)
      e.preventDefault();
      e.stopPropagation();
      showWarning('Right-click is disabled on this page.');
      return false;
    };

    // Bloquear cópia
    const handleCopy = (e: ClipboardEvent) => {
      if (isProtectedArea(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Copying is disabled on this document.');
        return false;
      }
    };

    // Bloquear corte
    const handleCut = (e: ClipboardEvent) => {
      if (isProtectedArea(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Cutting is disabled on this document.');
        return false;
      }
    };

    // Bloquear colar
    const handlePaste = (e: ClipboardEvent) => {
      if (isProtectedArea(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Bloquear seleção de texto
    const handleSelectStart = (e: Event) => {
      if (isProtectedArea(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Bloquear arrastar imagens
    const handleDragStart = (e: DragEvent) => {
      if (isProtectedArea(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Função para esconder conteúdo do contrato (similar à proteção de impressão)
    // ESTILO NETFLIX/DISNEY+: Esconde durante o screenshot
    const hideContractContent = (duration: number = 3000) => {
      console.log('[PROTECTION] hideContractContent called, duration:', duration, 'isContentHidden:', isContentHidden);
      
      if (isContentHidden) {
        // Se já está escondido, estender o tempo
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
          restoreContractContent();
        }, duration);
        return;
      }
      
      const contractContent = document.getElementById('contract-content');
      const contractHeader = document.getElementById('contract-header');
      
      if (!contractContent) return;

      isContentHidden = true;

      // Esconder todo o conteúdo IMEDIATAMENTE (estilo Netflix)
      // Usar múltiplas técnicas para garantir que esconde
      contractContent.style.display = 'none';
      contractContent.style.visibility = 'hidden';
      contractContent.style.opacity = '0';
      contractContent.style.position = 'absolute';
      contractContent.style.left = '-9999px';
      contractContent.style.width = '0';
      contractContent.style.height = '0';
      contractContent.style.overflow = 'hidden';
      
      // Esconder também o header (título e descrição)
      if (contractHeader) {
        contractHeader.style.display = 'none';
        contractHeader.style.visibility = 'hidden';
        contractHeader.style.opacity = '0';
      }

      // Criar overlay preto (estilo Netflix/Disney+)
      let overlay = document.getElementById('screenshot-protection-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'screenshot-protection-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #000000;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #CE9F48;
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          padding: 40px;
          animation: fadeIn 0.1s ease-in;
          pointer-events: none;
        `;
        overlay.innerHTML = `
          <div style="max-width: 600px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
            <div>Screenshots are not permitted.</div>
            <div style="font-size: 18px; margin-top: 20px; color: #F3E196;">
              This document is protected and cannot be captured.
            </div>
            <div style="font-size: 16px; margin-top: 30px; color: #999;">
              This document is available exclusively through the MIGMA portal.
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      } else {
        // Se overlay já existe, garantir que está visível
        overlay.style.display = 'flex';
        overlay.style.animation = 'fadeIn 0.1s ease-in';
      }

      // Limpar timeout anterior se existir
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      // Restaurar após duração especificada
      hideTimeout = setTimeout(() => {
        restoreContractContent();
      }, duration);
    };

    // Função para restaurar conteúdo do contrato
    const restoreContractContent = () => {
      if (!isContentHidden) return; // Já está visível
      
      isContentHidden = false;

      const contractContent = document.getElementById('contract-content');
      const contractHeader = document.getElementById('contract-header');
      
      if (contractContent) {
        // Restaurar todas as propriedades
        contractContent.style.display = '';
        contractContent.style.visibility = '';
        contractContent.style.opacity = '';
        contractContent.style.position = '';
        contractContent.style.left = '';
        contractContent.style.width = '';
        contractContent.style.height = '';
        contractContent.style.overflow = '';
      }
      
      // Restaurar também o header (título e descrição)
      if (contractHeader) {
        contractHeader.style.display = '';
        contractHeader.style.visibility = '';
        contractHeader.style.opacity = '';
      }

      const overlay = document.getElementById('screenshot-protection-overlay');
      if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          overlay?.remove();
        }, 300);
      }

      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    // REMOVIDO: handleBlur e handleFocus
    // Alt+Tab é apenas troca de abas, não tem relação com screenshot/print
    // Não devemos ativar proteção por perda de foco da janela

    // Detectar mudanças no tamanho da janela (pode indicar DevTools ou screenshot)
    // AMENIZADO: Só ativar se mudança for MUITO grande e não estiver em upload
    let lastWindowSize = { width: window.innerWidth, height: window.innerHeight };
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      // Limpar timeout anterior
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Verificar se está em área de upload
      const activeElement = document.activeElement;
      if (activeElement && isInUploadArea(activeElement)) {
        lastWindowSize = { width: window.innerWidth, height: window.innerHeight };
        return; // Não ativar durante upload
      }
      
      // Delay antes de verificar (ameniza resize normal)
      resizeTimeout = setTimeout(() => {
        const currentSize = { width: window.innerWidth, height: window.innerHeight };
        const sizeChange = Math.abs(currentSize.width - lastWindowSize.width) + 
                          Math.abs(currentSize.height - lastWindowSize.height);
        
        // Só ativar se mudança for MUITO grande (mais de 300px) - indica DevTools ou screenshot tool
        if (sizeChange > 300) {
          hideContractContent(2000);
        }
        
        lastWindowSize = currentSize;
      }, 300); // Delay de 300ms antes de verificar
    };

    // Bloquear APIs de captura de tela
    const blockScreenCaptureAPIs = () => {
      // Bloquear getDisplayMedia (screen recording)
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = async () => {
          hideContractContent(3000);
          showWarning('Screen recording is not permitted.');
          throw new DOMException('Screen recording is not permitted on this page.', 'NotAllowedError');
        };
      }

      // Bloquear getUserMedia se tentar capturar tela
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (constraints?.video && 
              ((constraints.video as any).displaySurface === 'monitor' ||
               (constraints.video as any).displaySurface === 'window')) {
            hideContractContent(3000);
            showWarning('Screen capture is not permitted.');
            throw new DOMException('Screen capture is not permitted on this page.', 'NotAllowedError');
          }
          return originalGetUserMedia(constraints);
        };
      }
    };

    // Bloquear atalhos de teclado
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detectar teclas Windows (91) e Shift (16) e Control (17) - similar à solução compartilhada
      // Mas melhorado para esconder conteúdo durante screenshot
      const keyCode = e.keyCode || e.which;
      const isWindowsKey = keyCode === 91 || keyCode === 92 || keyCode === 93; // Windows keys
      const isShiftKey = keyCode === 16;
      const isControlKey = keyCode === 17; // Ctrl key (esquerdo e direito)
      
      // AMENIZADO: Só esconder Ctrl se estiver na área protegida OU se for combinação suspeita
      // Não esconder apenas por pressionar Ctrl sozinho (muito restritivo)
      const isCtrlPressed = isControlKey || 
                           e.ctrlKey || 
                           e.metaKey || 
                           keyCode === 17 || 
                           keyCode === 18 ||
                           e.key === 'Control' ||
                           e.code === 'ControlLeft' ||
                           e.code === 'ControlRight';
      
      // Só ativar proteção de Ctrl se for combinação suspeita (Ctrl+Shift+S, Ctrl+P, etc)
      // OU se estiver na área protegida do contrato
      const isSuspiciousCombination = isCtrlPressed && (
        e.shiftKey || // Ctrl+Shift (screenshot)
        e.key === 'p' || e.key === 'P' || // Ctrl+P (print)
        e.key === 's' || e.key === 'S' || // Ctrl+S (save)
        e.key === 'c' || e.key === 'C' || // Ctrl+C (copy)
        e.key === 'a' || e.key === 'A'    // Ctrl+A (select all)
      );
      
      if (isSuspiciousCombination && isProtectedArea(e.target)) {
        // Só esconder se for combinação suspeita E estiver na área protegida
        requestAnimationFrame(() => {
          hideContractContent(2000);
        });
      }
      
      // Detectar Print Screen no keydown (alguns navegadores)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || keyCode === 44) {
        // Esconder IMEDIATAMENTE antes de qualquer coisa
        hideContractContent(5000); // Manter escondido por mais tempo
        showWarning('Screenshots are not permitted. This document is protected.');
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Detectar combinações suspeitas (Windows+Shift+S, Ctrl+Shift+S, etc)
      if ((isWindowsKey || e.ctrlKey || e.metaKey) && isShiftKey) {
        // Esconder conteúdo preventivamente
        hideContractContent(3000);
      }
      
      // REMOVIDO: Não esconder quando Ctrl é pressionado sozinho (muito restritivo)
      // Só ativar em combinações específicas de screenshot/print

      // Verificar se está dentro da área protegida ou se é um atalho global
      const isGlobalShortcut = 
        (e.ctrlKey || e.metaKey) && 
        !e.shiftKey && // Ctrl+S sem Shift (para não conflitar com screenshot)
        (e.key === 'c' || e.key === 'C' || // Ctrl+C
         e.key === 'a' || e.key === 'A' || // Ctrl+A
         e.key === 'p' || e.key === 'P' || // Ctrl+P
         e.key === 's' || e.key === 'S' || // Ctrl+S
         e.key === 'u' || e.key === 'U');  // Ctrl+U

      // COMENTADO TEMPORARIAMENTE: Permitir acesso ao DevTools para debug
      // const isDevToolsShortcut = 
      //   e.key === 'F12' ||
      //   ((e.ctrlKey || e.metaKey) && e.shiftKey && 
      //    (e.key === 'i' || e.key === 'I' || // Ctrl+Shift+I
      //     e.key === 'c' || e.key === 'C' || // Ctrl+Shift+C
      //     e.key === 'j' || e.key === 'J')); // Ctrl+Shift+J

      // Bloquear screenshot do navegador (Chrome/Edge: Ctrl+Shift+S)
      const isScreenshotShortcut = 
        (e.ctrlKey || e.metaKey) && 
        e.shiftKey && 
        (e.key === 's' || e.key === 'S');

      if (isScreenshotShortcut) {
        // Esconder conteúdo imediatamente ANTES de prevenir o evento
        // Usar requestAnimationFrame para garantir que esconde ANTES do screenshot
        requestAnimationFrame(() => {
          hideContractContent(3000);
        });
        e.preventDefault();
        e.stopPropagation();
        showWarning('Screenshots are not permitted. This document is protected.');
        return false;
      }

      // COMENTADO TEMPORARIAMENTE: Permitir acesso ao DevTools para debug
      // if (isProtectedArea(e.target) || isGlobalShortcut || isDevToolsShortcut) {
      //   if (isGlobalShortcut || isDevToolsShortcut) {
      //     e.preventDefault();
      //     e.stopPropagation();
      //     if (e.key === 'p' || e.key === 'P') {
      //       showWarning('Printing is disabled on this document.');
      //     } else if (e.key === 'c' || e.key === 'C') {
      //       showWarning('Copying is disabled on this document.');
      //     } else if (e.key === 'a' || e.key === 'A') {
      //       showWarning('Select all is disabled on this document.');
      //     } else if (e.key === 's' || e.key === 'S') {
      //       showWarning('Saving is disabled on this document.');
      //     } else if (isDevToolsShortcut) {
      //       showWarning('Developer tools access is restricted.');
      //     }
      //     return false;
      //   }
      // }
      
      // Permitir apenas atalhos globais na área protegida (mas não DevTools)
      if (isProtectedArea(e.target) && isGlobalShortcut) {
        if (isGlobalShortcut) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'p' || e.key === 'P') {
            showWarning('Printing is disabled on this document.');
          } else if (e.key === 'c' || e.key === 'C') {
            showWarning('Copying is disabled on this document.');
          } else if (e.key === 'a' || e.key === 'A') {
            showWarning('Select all is disabled on this document.');
          } else if (e.key === 's' || e.key === 'S') {
            showWarning('Saving is disabled on this document.');
          }
          return false;
        }
      }
    };

    // Bloquear impressão
    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      showWarning('Printing is disabled. This document is available exclusively through the MIGMA portal.');
      return false;
    };

    const handleAfterPrint = () => {
      // Restaurar conteúdo se necessário
    };

    // Detectar tentativa de print screen (limitado)
    // Print Screen não pode ser bloqueado completamente, mas podemos esconder o conteúdo
    const handleKeyUp = (e: KeyboardEvent) => {
      // Detectar Print Screen no keyup também (alguns navegadores capturam aqui)
      if (e.key === 'PrintScreen' || 
          e.key === 'F13' || 
          (e.key === 'F13' && e.shiftKey) ||
          e.code === 'PrintScreen') {
        hideContractContent(3000);
        showWarning('Screenshots are not permitted. This document is protected.');
      }
    };

    // Bloquear APIs de captura de tela
    blockScreenCaptureAPIs();

    // Adicionar event listeners
    // IMPORTANTE: Usar capture phase (true) para capturar eventos antes de outros handlers
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keypress', handleKeyDown, true); // Também capturar keypress
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    // REMOVIDO: blur e focus listeners - Alt+Tab não deve ativar proteção
    window.addEventListener('resize', handleResize);
    
    console.log('[PROTECTION] Content protection enabled, event listeners added');

    // Cleanup: remover event listeners ao desmontar
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keypress', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      // REMOVIDO: blur e focus listeners
      window.removeEventListener('resize', handleResize);
      
      // Restaurar conteúdo se estiver escondido
      if (isContentHidden) {
        restoreContractContent();
      }
      
      // Limpar timeouts se existirem
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [enabled]);
}

