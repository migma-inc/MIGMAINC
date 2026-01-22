/**
 * Helper functions for managing Visa contract approvals and resubmissions
 */

import { supabase } from './supabase';

export interface ResubmissionToken {
  id: string;
  order_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: ResubmissionToken;
  order?: any;
  error?: string;
}

/**
 * Approve a visa contract (main contract or ANNEX I)
 * Calls the approve-visa-contract Edge Function
 */
export async function approveVisaContract(
  orderId: string,
  reviewedBy: string,
  contractType: 'annex' | 'contract' = 'contract'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('approve-visa-contract', {
      body: {
        order_id: orderId,
        reviewed_by: reviewedBy,
        contract_type: contractType,
      },
    });

    if (error) {
      console.error('[VISA_CONTRACTS] Error approving contract:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[VISA_CONTRACTS] Error from Edge Function:', data.error);
      return { success: false, error: data.error };
    }

    // NEW: If the contract was approved, and it's a manual order, trigger Invoice generation
    try {
      const { data: orderData } = await supabase
        .from('visa_orders')
        .select('payment_method')
        .eq('id', orderId)
        .single();

      if (orderData?.payment_method === 'manual') {
        console.log('[VISA_CONTRACTS] Manual order detected, triggering Invoice generation...');
        // We trigger this in the background/parallel to not delay the UI success message
        supabase.functions.invoke('generate-invoice-pdf', {
          body: { order_id: orderId },
        }).catch(err => console.error('[VISA_CONTRACTS] Error triggering invoice:', err));
      }
    } catch (orderErr) {
      console.error('[VISA_CONTRACTS] Error checking order for invoice trigger:', orderErr);
    }

    return { success: true };
  } catch (error) {
    console.error('[VISA_CONTRACTS] Exception approving contract:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Reject a visa contract (main contract or ANNEX I)
 * Calls the reject-visa-contract Edge Function which generates token and sends email
 */
export async function rejectVisaContract(
  orderId: string,
  reviewedBy: string,
  reason?: string,
  contractType: 'annex' | 'contract' = 'contract'
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Get current origin (localhost in dev, production URL in prod)
    const getAppUrl = (): string => {
      // If in browser, use current origin
      if (typeof window !== 'undefined' && window.location.origin) {
        return window.location.origin;
      }

      // Try environment variable (for production builds)
      const envUrl = import.meta.env.VITE_APP_URL;
      if (envUrl) {
        // Remove trailing slash and return
        return envUrl.trim().replace(/\/+$/, '');
      }

      // Fallback
      return 'https://migmainc.com';
    };

    const appUrl = getAppUrl();
    console.log('[VISA_CONTRACTS] Sending rejection with app_url:', appUrl);

    const { data, error } = await supabase.functions.invoke('reject-visa-contract', {
      body: {
        order_id: orderId,
        reviewed_by: reviewedBy,
        rejection_reason: reason || null,
        app_url: appUrl, // Send current origin so Edge Function knows which URL to use
        contract_type: contractType,
      },
    });

    if (error) {
      console.error('[VISA_CONTRACTS] Error rejecting contract:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[VISA_CONTRACTS] Error from Edge Function:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true, token: data?.token };
  } catch (error) {
    console.error('[VISA_CONTRACTS] Exception rejecting contract:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate a resubmission token
 * Checks if token exists, is not expired, and hasn't been used
 */
export async function validateResubmissionToken(
  token: string
): Promise<TokenValidationResult> {
  try {
    console.log('[VISA_CONTRACTS] Starting token validation for:', token);

    // Fetch token from database
    console.log('[VISA_CONTRACTS] Fetching token from database...');
    const { data: tokenData, error: tokenError } = await supabase
      .from('visa_contract_resubmission_tokens')
      .select('*')
      .eq('token', token)
      .single();

    console.log('[VISA_CONTRACTS] Token query result:', { tokenData, tokenError });

    if (tokenError) {
      console.error('[VISA_CONTRACTS] Token validation error:', tokenError);
      return {
        valid: false,
        error: tokenError.message || 'Invalid token. Please check the link and try again.',
      };
    }

    if (!tokenData) {
      console.error('[VISA_CONTRACTS] Token not found in database');
      return {
        valid: false,
        error: 'Invalid token. Please check the link and try again.',
      };
    }

    // Check if token has been used
    if (tokenData.used_at) {
      console.log('[VISA_CONTRACTS] Token already used');
      return {
        valid: false,
        error: 'You have already resubmitted your documents using this link. If you need to resubmit again, please contact support for a new link.',
      };
    }

    // Token expiration check removed - links don't expire anymore
    // Users can resubmit at any time as long as the token hasn't been used

    // Fetch order separately
    console.log('[VISA_CONTRACTS] Fetching order:', tokenData.order_id);
    const { data: orderData, error: orderError } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('id', tokenData.order_id)
      .single();

    console.log('[VISA_CONTRACTS] Order query result:', { orderData, orderError });

    if (orderError) {
      console.error('[VISA_CONTRACTS] Order fetch error:', orderError);
      return {
        valid: false,
        error: orderError.message || 'Order not found. Please contact support.',
      };
    }

    if (!orderData) {
      console.error('[VISA_CONTRACTS] Order not found');
      return {
        valid: false,
        error: 'Order not found. Please contact support.',
      };
    }

    // Token is valid
    console.log('[VISA_CONTRACTS] Token validation successful');
    return {
      valid: true,
      token: tokenData as ResubmissionToken,
      order: orderData,
    };
  } catch (error) {
    console.error('[VISA_CONTRACTS] Exception validating token:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Process document resubmission
 * Marks token as used, updates documents, and regenerates PDF
 */
export async function resubmitContractDocuments(
  token: string,
  documents: {
    documentFront: { file: File; url: string };
    documentBack: { file: File; url: string };
    selfie: { file: File; url: string };
  },
  serviceRequestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First validate token
    const validation = await validateResubmissionToken(token);
    if (!validation.valid || !validation.token || !validation.order) {
      return {
        success: false,
        error: validation.error || 'Invalid token',
      };
    }

    const orderId = validation.order.id;
    const clientIP = await getClientIP();
    const userAgent = getUserAgent();

    // Delete old documents from identity_files
    const { error: deleteError } = await supabase
      .from('identity_files')
      .delete()
      .eq('service_request_id', serviceRequestId);

    if (deleteError) {
      console.error('[VISA_CONTRACTS] Error deleting old documents:', deleteError);
      // Continue anyway - we'll insert new ones
    }

    // Insert new documents
    const documentsToInsert = [
      {
        service_request_id: serviceRequestId,
        file_type: 'document_front',
        file_path: documents.documentFront.url,
        file_name: documents.documentFront.file.name,
        file_size: documents.documentFront.file.size,
        created_ip: clientIP,
        user_agent: userAgent,
      },
      {
        service_request_id: serviceRequestId,
        file_type: 'document_back',
        file_path: documents.documentBack.url,
        file_name: documents.documentBack.file.name,
        file_size: documents.documentBack.file.size,
        created_ip: clientIP,
        user_agent: userAgent,
      },
      {
        service_request_id: serviceRequestId,
        file_type: 'selfie_doc',
        file_path: documents.selfie.url,
        file_name: documents.selfie.file.name,
        file_size: documents.selfie.file.size,
        created_ip: clientIP,
        user_agent: userAgent,
      },
    ];

    const { error: insertError } = await supabase
      .from('identity_files')
      .insert(documentsToInsert);

    if (insertError) {
      console.error('[VISA_CONTRACTS] Error inserting new documents:', insertError);
      return {
        success: false,
        error: 'Failed to save documents. Please try again.',
      };
    }

    // Mark token as used
    const { error: tokenUpdateError } = await supabase
      .from('visa_contract_resubmission_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (tokenUpdateError) {
      console.error('[VISA_CONTRACTS] Error marking token as used:', tokenUpdateError);
      // Continue anyway - documents were saved
    }

    // Update order status back to pending
    const { error: orderUpdateError } = await supabase
      .from('visa_orders')
      .update({
        contract_approval_status: 'pending',
        contract_document_url: documents.documentFront.url,
        contract_selfie_url: documents.selfie.url,
        contract_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('[VISA_CONTRACTS] Error updating order status:', orderUpdateError);
      return {
        success: false,
        error: 'Failed to update order status. Please contact support.',
      };
    }

    // Regenerate PDF with new documents
    try {
      await supabase.functions.invoke('generate-visa-contract-pdf', {
        body: { order_id: orderId },
      });
      console.log('[VISA_CONTRACTS] PDF regeneration triggered');
    } catch (pdfError) {
      console.error('[VISA_CONTRACTS] Error regenerating PDF:', pdfError);
      // Don't fail the whole operation if PDF generation fails
    }

    return { success: true };
  } catch (error) {
    console.error('[VISA_CONTRACTS] Exception processing resubmission:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Helper function to get client IP
 */
async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Helper function to get user agent
 */
function getUserAgent(): string {
  if (typeof window !== 'undefined' && window.navigator) {
    return window.navigator.userAgent || 'unknown';
  }
  return 'unknown';
}



