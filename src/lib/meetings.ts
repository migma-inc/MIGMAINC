/**
 * Functions for managing scheduled meetings
 * Allows admins to schedule meetings and send emails directly to users
 */

import { supabase } from './supabase';
import { sendScheduledMeetingEmail, sendScheduledMeetingUpdateEmail } from './emails';

export interface ScheduledMeeting {
  id: string;
  email: string;
  full_name: string;
  meeting_date: string;
  meeting_time: string;
  meeting_link: string;
  meeting_scheduled_at: string;
  scheduled_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleMeetingData {
  email: string;
  full_name: string;
  meeting_date: string;
  meeting_time: string;
  meeting_link: string;
  scheduled_by?: string;
  notes?: string;
}

/**
 * Schedule a new meeting and send invitation email
 */
export async function scheduleMeeting(
  data: ScheduleMeetingData
): Promise<{ success: boolean; error?: string; meetingId?: string }> {
  try {
    // Validate inputs
    if (!data.email || !data.full_name || !data.meeting_date || !data.meeting_time || !data.meeting_link) {
      return { success: false, error: 'All required fields must be provided' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Validate date is in the future
    const [year, month, day] = data.meeting_date.split('-').map(Number);
    const meetingDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDate < today) {
      return { success: false, error: 'Meeting date cannot be in the past' };
    }

    // Validate URL format
    try {
      new URL(data.meeting_link);
    } catch {
      return { success: false, error: 'Invalid meeting link URL format' };
    }

    // Insert meeting into database
    const { data: meeting, error: insertError } = await supabase
      .from('scheduled_meetings')
      .insert([
        {
          email: data.email.trim().toLowerCase(),
          full_name: data.full_name.trim(),
          meeting_date: data.meeting_date,
          meeting_time: data.meeting_time.trim(),
          meeting_link: data.meeting_link.trim(),
          scheduled_by: data.scheduled_by?.trim() || null,
          notes: data.notes?.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError || !meeting) {
      console.error('[MEETINGS] Error inserting meeting:', insertError);
      return { success: false, error: insertError?.message || 'Failed to save meeting' };
    }

    // Send meeting invitation email
    const emailSent = await sendScheduledMeetingEmail(
      data.email,
      data.full_name,
      data.meeting_date,
      data.meeting_time,
      data.meeting_link
    );

    if (!emailSent) {
      console.warn('[MEETINGS] Meeting invitation email failed to send, but meeting was saved');
      return {
        success: true,
        meetingId: meeting.id,
        error: 'Meeting scheduled, but email sending failed. Please send manually.',
      };
    }

    return { success: true, meetingId: meeting.id };
  } catch (error) {
    console.error('[MEETINGS] Error scheduling meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get all scheduled meetings
 */
export async function getScheduledMeetings(options?: {
  limit?: number;
  orderBy?: 'meeting_date' | 'created_at';
  orderDirection?: 'asc' | 'desc';
  filterDate?: 'upcoming' | 'past' | 'all';
}): Promise<{ success: boolean; data?: ScheduledMeeting[]; error?: string }> {
  try {
    let query = supabase
      .from('scheduled_meetings')
      .select('*');

    // Apply date filter
    if (options?.filterDate === 'upcoming') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('meeting_date', today);
    } else if (options?.filterDate === 'past') {
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('meeting_date', today);
    }

    // Apply ordering
    const orderBy = options?.orderBy || 'meeting_date';
    const orderDirection = options?.orderDirection || 'asc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MEETINGS] Error fetching meetings:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('[MEETINGS] Error fetching meetings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update a scheduled meeting
 */
export async function updateScheduledMeeting(
  meetingId: string,
  data: Partial<ScheduleMeetingData>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate meeting exists
    const { data: existingMeeting, error: fetchError } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (fetchError || !existingMeeting) {
      return { success: false, error: 'Meeting not found' };
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return { success: false, error: 'Invalid email format' };
      }
      updateData.email = data.email.trim().toLowerCase();
    }

    if (data.full_name !== undefined) {
      updateData.full_name = data.full_name.trim();
    }

    if (data.meeting_date !== undefined) {
      // Validate date is in the future (if updating)
      const [year, month, day] = data.meeting_date.split('-').map(Number);
      const meetingDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (meetingDate < today) {
        return { success: false, error: 'Meeting date cannot be in the past' };
      }
      updateData.meeting_date = data.meeting_date;
    }

    if (data.meeting_time !== undefined) {
      updateData.meeting_time = data.meeting_time.trim();
    }

    if (data.meeting_link !== undefined) {
      // Validate URL format
      try {
        new URL(data.meeting_link);
      } catch {
        return { success: false, error: 'Invalid meeting link URL format' };
      }
      updateData.meeting_link = data.meeting_link.trim();
    }

    if (data.scheduled_by !== undefined) {
      updateData.scheduled_by = data.scheduled_by?.trim() || null;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null;
    }

    // Update meeting
    const { error: updateError } = await supabase
      .from('scheduled_meetings')
      .update(updateData)
      .eq('id', meetingId);

    if (updateError) {
      console.error('[MEETINGS] Error updating meeting:', updateError);
      return { success: false, error: updateError.message };
    }

      // If email, name, date, time, or link changed, send update email
      if (
        data.email !== undefined ||
        data.full_name !== undefined ||
        data.meeting_date !== undefined ||
        data.meeting_time !== undefined ||
        data.meeting_link !== undefined
      ) {
        const finalEmail = data.email || existingMeeting.email;
        const finalName = data.full_name || existingMeeting.full_name;
        const finalDate = data.meeting_date || existingMeeting.meeting_date;
        const finalTime = data.meeting_time || existingMeeting.meeting_time;
        const finalLink = data.meeting_link || existingMeeting.meeting_link;

        // Send update email for scheduled meeting
        await sendScheduledMeetingUpdateEmail(finalEmail, finalName, finalDate, finalTime, finalLink);
      }

    return { success: true };
  } catch (error) {
    console.error('[MEETINGS] Error updating meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete a scheduled meeting
 */
export async function deleteScheduledMeeting(
  meetingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scheduled_meetings')
      .delete()
      .eq('id', meetingId);

    if (error) {
      console.error('[MEETINGS] Error deleting meeting:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[MEETINGS] Error deleting meeting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Resend meeting invitation email
 */
export async function resendMeetingEmail(
  meetingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: meeting, error: fetchError } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (fetchError || !meeting) {
      return { success: false, error: 'Meeting not found' };
    }

    const emailSent = await sendScheduledMeetingEmail(
      meeting.email,
      meeting.full_name,
      meeting.meeting_date,
      meeting.meeting_time,
      meeting.meeting_link
    );

    if (!emailSent) {
      return { success: false, error: 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('[MEETINGS] Error resending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

