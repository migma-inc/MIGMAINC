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
  source: 'manual' | 'partner';
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
    // 1. Fetch from scheduled_meetings
    let manualQuery = supabase.from('scheduled_meetings').select('*');

    // 2. Fetch from global_partner_applications (only those with meetings)
    let partnerQuery = supabase
      .from('global_partner_applications')
      .select('id, email, full_name, meeting_date, meeting_time, meeting_link, meeting_scheduled_by, created_at')
      .not('meeting_date', 'is', null);

    // Apply date filters
    const today = new Date().toISOString().split('T')[0];
    if (options?.filterDate === 'upcoming') {
      manualQuery = manualQuery.gte('meeting_date', today);
      partnerQuery = partnerQuery.gte('meeting_date', today);
    } else if (options?.filterDate === 'past') {
      manualQuery = manualQuery.lt('meeting_date', today);
      partnerQuery = partnerQuery.lt('meeting_date', today);
    }

    // Execute queries
    const [manualResult, partnerResult] = await Promise.all([manualQuery, partnerQuery]);

    if (manualResult.error) throw manualResult.error;
    if (partnerResult.error) throw partnerResult.error;

    // Map and unify
    const manualMeetings: ScheduledMeeting[] = (manualResult.data || []).map(m => ({
      ...m,
      source: 'manual',
      meeting_scheduled_at: m.created_at // existing interface field
    }));

    const partnerMeetings: ScheduledMeeting[] = (partnerResult.data || []).map(m => ({
      id: m.id,
      email: m.email,
      full_name: m.full_name,
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time || '',
      meeting_link: m.meeting_link || '',
      meeting_scheduled_at: m.created_at,
      scheduled_by: m.meeting_scheduled_by,
      notes: 'Global Partner Application Meeting',
      source: 'partner',
      created_at: m.created_at,
      updated_at: m.created_at
    }));

    let allMeetings = [...manualMeetings, ...partnerMeetings];

    // Sort
    const orderBy = options?.orderBy || 'meeting_date';
    const orderDirection = options?.orderDirection || 'asc';

    allMeetings.sort((a, b) => {
      const valA = a[orderBy] || '';
      const valB = b[orderBy] || '';
      if (orderDirection === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    // Limit
    if (options?.limit) {
      allMeetings = allMeetings.slice(0, options.limit);
    }

    return { success: true, data: allMeetings };
  } catch (error) {
    console.error('[MEETINGS] Error fetching unified meetings:', error);
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
    // 1. Validate meeting exists in either table
    let meeting;
    let source: 'manual' | 'partner' = 'manual';

    const { data: manualMeeting } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (manualMeeting) {
      meeting = manualMeeting;
      source = 'manual';
    } else {
      const { data: partnerMeeting } = await supabase
        .from('global_partner_applications')
        .select('id, email, full_name, meeting_date, meeting_time, meeting_link, meeting_scheduled_by')
        .eq('id', meetingId)
        .maybeSingle();

      if (partnerMeeting) {
        meeting = {
          ...partnerMeeting,
          scheduled_by: partnerMeeting.meeting_scheduled_by
        };
        source = 'partner';
      }
    }

    if (!meeting) {
      return { success: false, error: 'Meeting not found' };
    }

    // 2. Build update object
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
      // Validate date is not in the past (if updating)
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
      // For partner table we use meeting_scheduled_by, for manual we use scheduled_by
      if (source === 'manual') {
        updateData.scheduled_by = data.scheduled_by?.trim() || null;
      } else {
        updateData.meeting_scheduled_by = data.scheduled_by?.trim() || null;
      }
    }

    if (data.notes !== undefined && source === 'manual') {
      updateData.notes = data.notes?.trim() || null;
    }

    // 3. Update meeting in the correct table
    if (source === 'manual') {
      const { error: updateError } = await supabase
        .from('scheduled_meetings')
        .update(updateData)
        .eq('id', meetingId);

      if (updateError) {
        console.error('[MEETINGS] Error updating manual meeting:', updateError);
        return { success: false, error: 'Failed to update meeting' };
      }
    } else {
      // Partner meeting update
      const partnerUpdateData: any = {};
      if (updateData.meeting_date) partnerUpdateData.meeting_date = updateData.meeting_date;
      if (updateData.meeting_time) partnerUpdateData.meeting_time = updateData.meeting_time;
      if (updateData.meeting_link) partnerUpdateData.meeting_link = updateData.meeting_link;
      if (updateData.meeting_scheduled_by !== undefined) partnerUpdateData.meeting_scheduled_by = updateData.meeting_scheduled_by;

      // Also update email and name if they changed (though usually these come from the application)
      if (updateData.email) partnerUpdateData.email = updateData.email;
      if (updateData.full_name) partnerUpdateData.full_name = updateData.full_name;

      const { error: updateErrorPartner } = await supabase
        .from('global_partner_applications')
        .update(partnerUpdateData)
        .eq('id', meetingId);

      if (updateErrorPartner) {
        console.error('[MEETINGS] Error updating partner meeting:', updateErrorPartner);
        return { success: false, error: 'Failed to update partner meeting' };
      }
    }

    // 4. If critical fields changed, send update email
    if (
      data.email !== undefined ||
      data.full_name !== undefined ||
      data.meeting_date !== undefined ||
      data.meeting_time !== undefined ||
      data.meeting_link !== undefined
    ) {
      const finalEmail = data.email || meeting.email;
      const finalName = data.full_name || meeting.full_name;
      const finalDate = data.meeting_date || meeting.meeting_date;
      const finalTime = data.meeting_time || meeting.meeting_time;
      const finalLink = data.meeting_link || meeting.meeting_link;

      // Send update email in background to speed up UI response
      sendScheduledMeetingUpdateEmail(finalEmail, finalName, finalDate, finalTime, finalLink);
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
    // Tenta deletar da tabela scheduled_meetings
    const { data: deletedFromManual, error: delErrorManual } = await supabase
      .from('scheduled_meetings')
      .delete()
      .eq('id', meetingId)
      .select();

    // Se deletou com sucesso da tabela manual
    if (!delErrorManual && deletedFromManual && deletedFromManual.length > 0) {
      console.log('[MEETINGS] Meeting deleted from scheduled_meetings:', meetingId);
      return { success: true };
    }

    // Se não encontrou na tabela manual, tenta limpar da tabela partner
    const { data: updatedPartner, error: delErrorPartner } = await supabase
      .from('global_partner_applications')
      .update({
        meeting_date: null,
        meeting_time: null,
        meeting_link: null,
        meeting_scheduled_by: null
      })
      .eq('id', meetingId)
      .select();

    // Se atualizou com sucesso na tabela partner
    if (!delErrorPartner && updatedPartner && updatedPartner.length > 0) {
      console.log('[MEETINGS] Meeting cleared from global_partner_applications:', meetingId);
      return { success: true };
    }

    // Se chegou aqui, não encontrou em nenhuma tabela
    console.error('[MEETINGS] Meeting not found in any table:', meetingId);
    return { success: false, error: 'Meeting not found' };

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
    let meeting;
    const { data: manualMeeting } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();

    if (manualMeeting) {
      meeting = manualMeeting;
    } else {
      const { data: partnerMeeting } = await supabase
        .from('global_partner_applications')
        .select('id, email, full_name, meeting_date, meeting_time, meeting_link')
        .eq('id', meetingId)
        .maybeSingle();

      meeting = partnerMeeting;
    }

    if (!meeting) {
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
