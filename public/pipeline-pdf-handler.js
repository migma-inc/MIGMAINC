/**
 * Handles the PDF generation functionality using native browser print.
 * This is the "Nuclear Option" version:
 * 1. Force expands EVERY accordion.
 * 2. Disables ALL animations (fade, scroll-reveal).
 * 3. Forces BLOCK display on hidden sections.
 * 4. Ensures dark background integrity.
 */

window.printAsPdf = function () {
    const btn = document.querySelector('.pdf-btn');
    const originalText = btn ? btn.innerHTML : '';

    if (btn) {
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Preparando...</span>';
    }

    // Add a class that triggers our print-specific CSS overrides
    document.body.classList.add('force-print-dark-mode');

    // NUCLEAR OPTION: FORCE EXPAND EVERYTHING MANUALLY AS WELL
    // Iterate over common collapsible classes
    const forceExpand = (selector) => {
        document.querySelectorAll(selector).forEach(el => {
            el.setAttribute('style', 'display: block !important; max-height: none !important; height: auto !important; opacity: 1 !important; visibility: visible !important; transform: none !important;');
            el.classList.add('open');
            el.classList.add('visible');
            el.classList.remove('hidden');
        });
    };

    forceExpand('.step-content');
    forceExpand('.faq-answer');
    forceExpand('.changelog-body');
    forceExpand('.template-section'); // Sometimes sections have hidden overflow
    forceExpand('.step-block');
    forceExpand('.animate'); // Force show animated elements

    // Force Manual View active
    const manualView = document.getElementById('manualView');
    if (manualView) {
        manualView.setAttribute('style', 'display: block !important; visibility: visible !important;');
        manualView.hidden = false;
    }

    // Give the browser a moment to repaint with the new class and inline styles
    setTimeout(() => {
        window.print();

        // Cleanup after printing
        // We use a slightly longer timeout fallback if onafterprint isn't reliable
        const cleanup = () => {
            document.body.classList.remove('force-print-dark-mode');
            // We reload the page to cleanly reset all the aggressive inline styles we just added
            // This is safer than trying to undo them one by one
            if (confirm('Impressão concluída. Deseja recarregar a página para restaurar o layout interativo?')) {
                window.location.reload();
            } else {
                if (btn) btn.innerHTML = originalText;
            }
        };

        if ('onafterprint' in window) {
            window.onafterprint = function () {
                cleanup();
                window.onafterprint = null;
            };
        } else {
            setTimeout(cleanup, 8000);
        }
    }, 800);
};

// Inject the Critical Print CSS
const printStyles = document.createElement('style');
printStyles.innerHTML = `
    @media print {
        /* NUCLEAR RESET: FORCE VISIBILITY */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            transition: none !important;
            animation: none !important;
        }

        /* PAGE SETUP */
        @page {
            size: A4 portrait;
            margin: 5mm; 
            background-color: #080808 !important;
        }

        /* BODY & CONTAINER */
        html, body {
            background-color: #080808 !important;
            color: #E8D4A8 !important;
            width: 100% !important;
            min-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
        }

        body.force-print-dark-mode {
             margin: 0 !important;
             padding: 0 !important;
        }
        
        /* HIDE UI ELEMENTS */
        .print-btn, .pdf-btn, .progress-widget, .view-bar, .hero-actions, .scroll-indicator, nav, .bg-effects {
            display: none !important;
        }

        /* HEADER FIX */
        header {
             min-height: auto !important;
             height: auto !important;
             padding: 2rem 0 !important;
             display: block !important;
        }

        /* FORCE DARK CARDS & VISIBILITY */
        /* FORCE DARK CARDS & VISIBILITY */
        .template-section, .source-card, .team-card, .flag-item, .win-item, 
        .quality-item, .extract-item, .step-block, .scenario-card, .example-card, 
        .faq-item, .channel-card, .benchmark-card, .glossary-item, .escalation-flow, 
        .checklist-section, .bi-tab-card, .bi-kpi, .bi-tool, .bi-spreadsheet table, 
        .bi-formula-box, .bi-rule-box, .quote-block, .highlight-box,
        /* ONBOARDING SPECIFIC CLASSES */
        .alert-box, .commission-box, .service-row, .req-card, .clickup-rule, 
        .routine-card, .check-item, .prohibition-card, .fii-category, .service-item,
        .hero-badge, .hero-reading-time, .hero-role, .quote, .mission, .about-grid, 
        .value-card, .process-step, .role-card, .tool-card, .kpi-card, 
        .meeting-card, .stakeholder-card, .services-category-title, .fii-category-header,
        .clickup-rule-item, .routine-header, .routine-body, .prohibition-content {
            background-color: #080808 !important;
            border: 1px solid rgba(212,175,55,.18) !important;
            color: #E8D4A8 !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            display: block !important; /* Force block to show content */
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
        }

        /* TYPOGRAPHY COLORS */
        .text-gold-100, h1, h2, h3, .hero-title, .section-title { 
            color: #FDF6E3 !important;
            opacity: 1 !important; 
        }
        .text-gold-200 { color: #F5E6C8 !important; }

        /* EXPAND CONTENT - The Nuclear Rules */
        .step-content, .faq-answer, .changelog-body {
            display: block !important;
            max-height: none !important;
            height: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            overflow: visible !important;
        }

        /* SPECIFIC SCROLL REVEAL OVERRIDE */
        .animate, .visible, .hidden {
            opacity: 1 !important;
            transform: none !important;
            visibility: visible !important;
        }

        /* GRID RESTORATION (Overrides generic display: block) */
        .source-grid, .team-grid, .bi-kpi-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 1rem !important;
        }
        
        /* Inline elements fix */
        span, i, b, strong, em, a {
            display: inline !important;
        }
    }
`;
document.head.appendChild(printStyles);
