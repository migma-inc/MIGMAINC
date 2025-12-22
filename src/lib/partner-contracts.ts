/**
 * Helper functions for managing Global Partner contract verifications
 */

import { supabase } from './supabase';

/**
 * Approve a partner contract
 * Calls the approve-partner-contract Edge Function
 */
export async function approvePartnerContract(
  acceptanceId: string,
  reviewedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('approve-partner-contract', {
      body: {
        acceptance_id: acceptanceId,
        reviewed_by: reviewedBy,
      },
    });

    if (error) {
      console.error('[PARTNER_CONTRACTS] Error approving contract:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[PARTNER_CONTRACTS] Error from Edge Function:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error) {
    console.error('[PARTNER_CONTRACTS] Exception approving contract:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Reject a partner contract
 * Calls the reject-partner-contract Edge Function which sends email
 * If contractTemplateId is provided, generates a new token and resends the contract link
 */
export async function rejectPartnerContract(
  acceptanceId: string,
  reviewedBy: string,
  reason?: string,
  contractTemplateId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('reject-partner-contract', {
      body: {
        acceptance_id: acceptanceId,
        reviewed_by: reviewedBy,
        rejection_reason: reason || null,
        contract_template_id: contractTemplateId || null,
      },
    });

    if (error) {
      console.error('[PARTNER_CONTRACTS] Error rejecting contract:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[PARTNER_CONTRACTS] Error from Edge Function:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error) {
    console.error('[PARTNER_CONTRACTS] Exception rejecting contract:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch pending partner contracts that need verification
 */
export async function fetchPendingPartnerContracts(): Promise<{
  success: boolean;
  contracts?: any[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('partner_terms_acceptances')
      .select(`
        *,
        global_partner_applications (
          id,
          full_name,
          email,
          phone,
          status
        )
      `)
      .eq('verification_status', 'pending')
      .not('accepted_at', 'is', null)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('[PARTNER_CONTRACTS] Error fetching pending contracts:', error);
      return { success: false, error: error.message };
    }

    return { success: true, contracts: data || [] };
  } catch (error) {
    console.error('[PARTNER_CONTRACTS] Exception fetching pending contracts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

