/**
 * Shows a visual warning message at the top of the screen.
 * @param message The message to display.
 */
export const showWarning = (message: string) => {
    // Add animation styles if they don't exist
    if (!document.getElementById('global-partner-warning-styles')) {
        const style = document.createElement('style');
        style.id = 'global-partner-warning-styles';
        style.textContent = `
            @keyframes slideDown {
                0% { transform: translate(-50%, -100%); opacity: 0; }
                10% { transform: translate(-50%, 20px); opacity: 1; }
                90% { transform: translate(-50%, 20px); opacity: 1; }
                100% { transform: translate(-50%, -100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Create and show the warning
    const warning = document.createElement('div');
    warning.textContent = message;
    warning.style.position = 'fixed';
    warning.style.top = '0';
    warning.style.left = '50%';
    warning.style.transform = 'translateX(-50%)';
    warning.style.backgroundColor = '#ef4444';
    warning.style.color = 'white';
    warning.style.padding = '12px 24px';
    warning.style.borderRadius = '8px';
    warning.style.zIndex = '9999';
    warning.style.fontWeight = 'bold';
    warning.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    warning.style.animation = 'slideDown 4s ease-in-out forwards';
    warning.style.width = 'max-content';
    warning.style.maxWidth = '90vw';
    warning.style.textAlign = 'center';

    document.body.appendChild(warning);

    // Remove the element after animation completes
    setTimeout(() => {
        if (document.body.contains(warning)) {
            document.body.removeChild(warning);
        }
    }, 4500);
};
