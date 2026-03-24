import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string in YYYY-MM-DD format to a Date object in local timezone.
 * This avoids timezone conversion issues that can cause dates to shift by one day.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone, or null if invalid
 */
export function parseLocalDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to YYYY-MM-DD string in local timezone.
 * This avoids timezone conversion issues that can cause dates to shift by one day.
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format, or empty string if invalid
 */
export function formatLocalDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format in local timezone.
 * This avoids timezone conversion issues that can cause dates to shift by one day.
 * 
 * @returns Today's date in YYYY-MM-DD format
 */
export function getTodayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Format a number as currency (USD) with thousands separators and 2 decimal places.
 * Example: 1234.5 -> $1,234.50
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Detect if the current environment is running locally (localhost/127.0.0.1)
 * or in a preview deployment format such as vercel preview URLs.
 */
export function isTestEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('vercel.app') && hostname.includes('preview')
  );
}

/**
 * Generate a random UUID.
 * Uses crypto.randomUUID() if available (secure contexts), 
 * otherwise falls back to a custom implementation.
 * Secure contexts (HTTPS/localhost) are required for crypto.randomUUID().
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  console.warn('[UUID] crypto.randomUUID is not available (likely non-secure context). Using fallback implementation.');
  
  // Fallback implementation for non-secure contexts (HTTP over IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Copy text to clipboard.
 * Uses navigator.clipboard.writeText if available (secure contexts),
 * otherwise falls back to document.execCommand('copy') with a hidden textarea.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed, trying fallback:', err);
    }
  }

  // Fallback to execCommand('copy')
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Ensure the textarea is not visible
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
  } catch (err) {
    console.error('[Clipboard] Fallback copy failed:', err);
  }

  return false;
}
