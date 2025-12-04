/**
 * Administrative functions for managing Global Partner applications
 */

import { supabase } from './supabase';
import { approveCandidateAndSendTermsLink } from './partner-terms';
import { invalidateAllCache } from './cache';

/**
 * Approve an application
 * Updates status to 'approved' and sends terms link email
 */
export async function approveApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update status to approved
    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error updating application status:', updateError);
      return { success: false, error: updateError.message };
    }

    // Generate token and send email
    const token = await approveCandidateAndSendTermsLink(applicationId);

    // Invalidate cache after status update
    invalidateAllCache();

    if (!token) {
      console.warn('[ADMIN] Token generation or email sending failed, but status was updated');
      // Status was updated, so we consider it a partial success
      return { 
        success: true, 
        error: 'Application approved, but email sending failed. Token may have been generated.' 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[ADMIN] Error approving application:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Reject an application
 * Updates status to 'rejected'
 */
export async function rejectApplication(
  applicationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: { status: string; updated_at: string; rejection_reason?: string } = {
      status: 'rejected',
      updated_at: new Date().toISOString(),
    };

    // Add rejection reason if provided (if column exists)
    if (reason) {
      updateData.rejection_reason = reason;
    }

    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update(updateData)
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error rejecting application:', updateError);
      return { success: false, error: updateError.message };
    }

    // Invalidate cache after status update
    invalidateAllCache();

    return { success: true };
  } catch (error) {
    console.error('[ADMIN] Error rejecting application:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Get application statistics
 */
export async function getApplicationStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from('global_partner_applications')
      .select('status');

    if (error) {
      console.error('[ADMIN] Error fetching stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      pending: data.filter((app) => app.status === 'pending').length,
      approved: data.filter((app) => app.status === 'approved').length,
      rejected: data.filter((app) => app.status === 'rejected').length,
    };

    return stats;
  } catch (error) {
    console.error('[ADMIN] Error calculating stats:', error);
    return null;
  }
}

