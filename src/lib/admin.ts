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

    // Send meeting invitation email
    const emailSent = await sendMeetingInvitationEmail(
      application.email,
      application.full_name,
      meetingDate,
      meetingTime,
      meetingLink
    );

    if (!emailSent) {
      console.warn('[ADMIN] Meeting invitation email failed to send, but status was updated');
      // Status was updated, so we consider it a partial success
      return {
        success: true,
        error: 'Application approved for meeting, but email sending failed. Please send manually.',
      };
    }

    // Invalidate cache after status update
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
 * Approve an application after meeting (second approval step)
 * Updates status to 'approved_for_contract' and sends contract terms link email
 */
export async function approveApplicationAfterMeeting(
  applicationId: string
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

    // Generate token and send contract terms email
    const token = await approveCandidateAndSendTermsLink(applicationId);

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
  approved: number;
  approved_for_meeting: number;
  approved_for_contract: number;
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
      approved_for_meeting: data.filter((app) => app.status === 'approved_for_meeting').length,
      approved_for_contract: data.filter((app) => app.status === 'approved_for_contract').length,
      rejected: data.filter((app) => app.status === 'rejected').length,
    };

    return stats;
  } catch (error) {
    console.error('[ADMIN] Error calculating stats:', error);
    return null;
  }
}

