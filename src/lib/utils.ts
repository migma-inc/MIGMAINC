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
