/**
 * Administrative functions for managing Global Partner applications
 */

import { supabase } from './supabase';
import { approveCandidateAndSendTermsLink } from './partner-terms';
import { invalidateAllCache } from './cache';
import { sendMeetingInvitationEmail } from './emails';

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

    // Get application data for email
    const { data: application, error: fetchError } = await supabase
      .from('global_partner_applications')
      .select('email, full_name')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      console.error('[ADMIN] Error fetching application for rejection:', fetchError);
      return { success: false, error: 'Application not found' };
    }

    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update(updateData)
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error rejecting application:', updateError);
      return { success: false, error: updateError.message };
    }

    // Send rejection email
    // We import dynamically to avoid circular dependencies if any
    const { sendApplicationRejectedAfterMeetingEmail } = await import('./emails');
    const emailSent = await sendApplicationRejectedAfterMeetingEmail(
      application.email,
      application.full_name
    );

    if (!emailSent) {
      console.warn('[ADMIN] Rejection email failed to send, but status was updated');
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
 * Approve an application for meeting (first approval step)
 * Updates status to 'approved_for_meeting' and sends meeting invitation email
 */
export async function approveApplicationForMeeting(
  applicationId: string,
  meetingDate: string,
  meetingTime: string,
  meetingLink: string,
  scheduledBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!meetingDate || !meetingTime || !meetingLink) {
      return { success: false, error: 'Meeting date, time, and link are required' };
    }

    // Validate URL format
    try {
      new URL(meetingLink);
    } catch {
      return { success: false, error: 'Invalid meeting link URL format' };
    }

    // Get application data for email
    const { data: application, error: fetchError } = await supabase
      .from('global_partner_applications')
      .select('email, full_name')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      console.error('[ADMIN] Error fetching application:', fetchError);
      return { success: false, error: 'Application not found' };
    }

    // Update status and meeting fields
    const updateData: {
      status: string;
      meeting_date: string;
      meeting_time: string;
      meeting_link: string;
      meeting_scheduled_at: string;
      updated_at: string;
      meeting_scheduled_by?: string;
    } = {
      status: 'approved_for_meeting',
      meeting_date: meetingDate,
      meeting_time: meetingTime,
      meeting_link: meetingLink,
      meeting_scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (scheduledBy) {
      updateData.meeting_scheduled_by = scheduledBy;
    }

    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update(updateData)
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error updating application status:', updateError);
      return { success: false, error: updateError.message };
    }

    // Send meeting invitation email in background
    sendMeetingInvitationEmail(
      application.email,
      application.full_name,
      meetingDate,
      meetingTime,
      meetingLink
    );

    // Invalidate cache and return success immediately
    invalidateAllCache();
    return { success: true };
  } catch (error) {
    console.error('[ADMIN] Error approving application for meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update meeting information for an application
 * Updates meeting details and sends update notification email
 */
export async function updateMeetingInfo(
  applicationId: string,
  meetingDate: string,
  meetingTime: string,
  meetingLink: string,
  scheduledBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!meetingDate || !meetingTime || !meetingLink) {
      return { success: false, error: 'Meeting date, time, and link are required' };
    }

    // Validate URL format
    try {
      new URL(meetingLink);
    } catch {
      return { success: false, error: 'Invalid meeting link URL format' };
    }

    // Get application data for email
    const { data: application, error: fetchError } = await supabase
      .from('global_partner_applications')
      .select('email, full_name, status')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      console.error('[ADMIN] Error fetching application:', fetchError);
      return { success: false, error: 'Application not found' };
    }

    // Verify application is in a status that allows meeting updates
    if (application.status !== 'approved_for_meeting') {
      return {
        success: false,
        error: `Cannot update meeting for application with status: ${application.status}. Application must be in 'approved_for_meeting' status.`,
      };
    }

    // Update meeting fields
    const updateData: {
      meeting_date: string;
      meeting_time: string;
      meeting_link: string;
      meeting_scheduled_at: string;
      updated_at: string;
      meeting_scheduled_by?: string;
    } = {
      meeting_date: meetingDate,
      meeting_time: meetingTime,
      meeting_link: meetingLink,
      meeting_scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (scheduledBy) {
      updateData.meeting_scheduled_by = scheduledBy;
    }

    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update(updateData)
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error updating meeting information:', updateError);
      return { success: false, error: updateError.message };
    }

    // Send meeting update email in background
    const { sendMeetingUpdateEmail } = await import('./emails');
    sendMeetingUpdateEmail(
      application.email,
      application.full_name,
      meetingDate,
      meetingTime,
      meetingLink
    );

    // Invalidate cache and return success immediately
    invalidateAllCache();
    return { success: true };
  } catch (error) {
    console.error('[ADMIN] Error updating meeting information:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Approve an application after meeting (second approval step)
 * Updates status to 'approved_for_contract' and sends contract terms link email
 * @param applicationId - ID da aplicação
 * @param contractTemplateId - ID do template de contrato (opcional, para compatibilidade)
 */
export async function approveApplicationAfterMeeting(
  applicationId: string,
  contractTemplateId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current status is 'approved_for_meeting'
    const { data: application, error: fetchError } = await supabase
      .from('global_partner_applications')
      .select('status')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      console.error('[ADMIN] Error fetching application:', fetchError);
      return { success: false, error: 'Application not found' };
    }

    if (application.status !== 'approved_for_meeting') {
      return {
        success: false,
        error: `Application must be in 'approved_for_meeting' status. Current status: ${application.status}`,
      };
    }

    // Update status to 'approved_for_contract'
    const { error: updateError } = await supabase
      .from('global_partner_applications')
      .update({
        status: 'approved_for_contract',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('[ADMIN] Error updating application status:', updateError);
      return { success: false, error: updateError.message };
    }

    // Generate token and send contract terms email with template if provided
    const token = await approveCandidateAndSendTermsLink(applicationId, 30, contractTemplateId);

    // Invalidate cache after status update
    invalidateAllCache();

    if (!token) {
      console.warn('[ADMIN] Token generation or email sending failed, but status was updated');
      // Status was updated, so we consider it a partial success
      return {
        success: true,
        error: 'Application approved for contract, but email sending failed. Token may have been generated.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[ADMIN] Error approving application after meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get application statistics
 */
export async function getApplicationStats(): Promise<{
  total: number;
  pending: number;
  approved_for_meeting: number;
  awaiting_signature: number;
  awaiting_verification: number;
  active_partner: number;
  rejected: number;
} | null> {
  try {
    // 1. Fetch all applications
    const { data: apps, error: appsError } = await supabase
      .from('global_partner_applications')
      .select('id, status');

    if (appsError) throw appsError;

    // 2. Fetch all pending verification IDs to cross-reference
    const { data: pendingAcceptances, error: verifError } = await supabase
      .from('partner_terms_acceptances')
      .select('application_id')
      .eq('verification_status', 'pending')
      .not('accepted_at', 'is', null);

    if (verifError) throw verifError;

    const pendingVerifIds = new Set(pendingAcceptances?.map(a => String(a.application_id)) || []);
    console.log('[DEBUG] pendingVerifIds size:', pendingVerifIds.size);

    const stats = {
      total: apps.length,
      pending: apps.filter(a => a.status === 'pending').length,
      approved_for_meeting: apps.filter(a => a.status === 'approved_for_meeting').length,

      // Awaiting Signature: Has the status but hasn't updated the acceptance table yet
      awaiting_signature: apps.filter(a =>
        a.status === 'approved_for_contract' && !pendingVerifIds.has(String(a.id))
      ).length,

      // Awaiting Verification: The count from the acceptances table
      awaiting_verification: pendingVerifIds.size,

      // Active: Verified partners or legacy approvals
      active_partner: apps.filter(a => a.status === 'active_partner' || a.status === 'approved').length,

      rejected: apps.filter(a => a.status === 'rejected').length,
    };

    console.log('[DEBUG] Total Apps returned:', apps.length);
    console.log('[DEBUG] Final Stats returning:', stats);
    return stats;
  } catch (error) {
    console.error('[ADMIN] Error calculating funnel stats:', error);
    return null;
  }
}

