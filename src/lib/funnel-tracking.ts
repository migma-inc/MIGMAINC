/**
 * Funnel tracking utilities for seller analytics
 */

import { supabase } from './supabase';

export type FunnelEventType = 'link_click' | 'form_started' | 'form_completed' | 'payment_started' | 'payment_completed';

interface TrackEventParams {
  sellerId: string;
  eventType: FunnelEventType;
  productSlug?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Generate or retrieve session ID from localStorage
 */
export function getSessionId(): string {
  const key = 'seller_funnel_session_id';
  let sessionId = localStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}

/**
 * Clear session ID (useful when user completes purchase)
 */
export function clearSessionId(): void {
  localStorage.removeItem('seller_funnel_session_id');
}

/**
 * Get client IP address
 */
async function getClientIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('Could not fetch IP address:', error);
    return null;
  }
}

/**
 * Track a funnel event
 */
export async function trackFunnelEvent({
  sellerId,
  eventType,
  productSlug,
  sessionId,
  metadata = {},
}: TrackEventParams): Promise<void> {
  if (!sellerId) {
    return; // Don't track if no seller ID
  }

  try {
    const ipAddress = await getClientIP();
    const userAgent = navigator.userAgent;
    const referer = document.referrer;

    const { error } = await supabase
      .from('seller_funnel_events')
      .insert({
        seller_id: sellerId,
        product_slug: productSlug || null,
        event_type: eventType,
        session_id: sessionId || getSessionId(),
        ip_address: ipAddress,
        user_agent: userAgent,
        referer: referer || null,
        metadata: metadata,
      });

    if (error) {
      console.error('Error tracking funnel event:', error);
    }
  } catch (error) {
    console.error('Exception tracking funnel event:', error);
    // Fail silently - tracking should not break the app
  }
}

/**
 * Track link click (when user lands on checkout page with seller_id)
 */
export async function trackLinkClick(sellerId: string, productSlug: string): Promise<void> {
  await trackFunnelEvent({
    sellerId,
    eventType: 'link_click',
    productSlug,
  });
}

/**
 * Track form started (when user starts filling the form)
 */
export async function trackFormStarted(sellerId: string, productSlug: string): Promise<void> {
  await trackFunnelEvent({
    sellerId,
    eventType: 'form_started',
    productSlug,
  });
}

/**
 * Track form completed (when user submits form data)
 */
export async function trackFormCompleted(sellerId: string, productSlug: string, metadata?: Record<string, any>): Promise<void> {
  await trackFunnelEvent({
    sellerId,
    eventType: 'form_completed',
    productSlug,
    metadata,
  });
}

/**
 * Track payment started (when user clicks payment button)
 */
export async function trackPaymentStarted(sellerId: string, productSlug: string, paymentMethod: string, metadata?: Record<string, any>): Promise<void> {
  await trackFunnelEvent({
    sellerId,
    eventType: 'payment_started',
    productSlug,
    metadata: {
      payment_method: paymentMethod,
      ...metadata,
    },
  });
}

/**
 * Track payment completed (called from backend/webhook)
 * This is typically called from Edge Functions, not frontend
 */
export async function trackPaymentCompleted(sellerId: string, productSlug: string, orderId: string, metadata?: Record<string, any>): Promise<void> {
  await trackFunnelEvent({
    sellerId,
    eventType: 'payment_completed',
    productSlug,
    metadata: {
      order_id: orderId,
      ...metadata,
    },
  });
}






















