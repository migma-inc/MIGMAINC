/**
 * Support Chat System - Helper Functions
 * Manages tokens, tickets, and replies for the support system
 */

import { supabase } from './supabase';
import { adminSupabase } from './auth';
import type {
  ContactMessage,
  ContactMessageReply,
  CreateReplyData,
  UpdateTicketMetadata,
  TicketWithReplies,
} from '@/types/support';

/**
 * Generate unique access token for a ticket
 */
export async function generateAccessToken(messageId: string): Promise<string | null> {
  try {
    // Generate token using database function
    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_access_token');
    
    if (tokenError || !tokenData) {
      console.error('[SUPPORT] Error generating token:', tokenError);
      return null;
    }

    const token = tokenData as string;

    // Update message with token
    const { error: updateError } = await supabase
      .from('contact_messages')
      .update({ access_token: token })
      .eq('id', messageId);

    if (updateError) {
      console.error('[SUPPORT] Error updating message with token:', updateError);
      return null;
    }

    return token;
  } catch (error) {
    console.error('[SUPPORT] Exception generating access token:', error);
    return null;
  }
}

/**
 * Validate access token and return message_id
 */
export async function validateAccessToken(token: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id')
      .eq('access_token', token)
      .maybeSingle();

    if (error) {
      console.error('[SUPPORT] Error validating token:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('[SUPPORT] Exception validating token:', error);
    return null;
  }
}

/**
 * Get ticket by token
 */
export async function getTicketByToken(token: string): Promise<ContactMessage | null> {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('access_token', token)
      .maybeSingle();

    if (error) {
      console.error('[SUPPORT] Error fetching ticket by token:', error);
      return null;
    }

    return data as ContactMessage | null;
  } catch (error) {
    console.error('[SUPPORT] Exception fetching ticket by token:', error);
    return null;
  }
}

/**
 * Get ticket by ID (admin only)
 */
export async function getTicketById(messageId: string): Promise<ContactMessage | null> {
  try {
    const { data, error } = await adminSupabase
      .from('contact_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      console.error('[SUPPORT] Error fetching ticket by ID:', error);
      return null;
    }

    return data as ContactMessage | null;
  } catch (error) {
    console.error('[SUPPORT] Exception fetching ticket by ID:', error);
    return null;
  }
}

/**
 * Get all replies for a ticket
 */
export async function getTicketReplies(messageId: string): Promise<ContactMessageReply[]> {
  try {
    const { data, error } = await supabase
      .from('contact_message_replies')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[SUPPORT] Error fetching replies:', error);
      return [];
    }

    return (data as ContactMessageReply[]) || [];
  } catch (error) {
    console.error('[SUPPORT] Exception fetching replies:', error);
    return [];
  }
}

/**
 * Get ticket with all replies
 */
export async function getTicketWithReplies(messageId: string, isAdmin = false): Promise<TicketWithReplies | null> {
  try {
    const ticket = isAdmin 
      ? await getTicketById(messageId)
      : await supabase
          .from('contact_messages')
          .select('*')
          .eq('id', messageId)
          .maybeSingle()
          .then(({ data }) => data as ContactMessage | null);

    if (!ticket) {
      return null;
    }

    const replies = await getTicketReplies(messageId);

    // Calculate unread count for admin
    const unread_count = isAdmin
      ? replies.filter(r => !r.read_by_admin && r.sender_type === 'user').length
      : replies.filter(r => !r.read_by_user && r.sender_type === 'admin').length;

    return {
      ...ticket,
      replies,
      unread_count,
    };
  } catch (error) {
    console.error('[SUPPORT] Exception fetching ticket with replies:', error);
    return null;
  }
}

/**
 * Create a new reply
 */
export async function createReply(replyData: CreateReplyData): Promise<ContactMessageReply | null> {
  try {
    const { data, error } = await supabase
      .from('contact_message_replies')
      .insert([replyData])
      .select()
      .single();

    if (error) {
      console.error('[SUPPORT] Error creating reply:', error);
      return null;
    }

    // Update ticket status to 'replied' if it was 'new' or 'read'
    const { error: statusError } = await supabase
      .from('contact_messages')
      .update({ status: 'replied' })
      .eq('id', replyData.message_id)
      .in('status', ['new', 'read']);

    if (statusError) {
      console.warn('[SUPPORT] Error updating ticket status:', statusError);
    }

    return data as ContactMessageReply;
  } catch (error) {
    console.error('[SUPPORT] Exception creating reply:', error);
    return null;
  }
}

/**
 * Update ticket metadata (priority, tags, assigned_to, status)
 */
export async function updateTicketMetadata(
  messageId: string,
  metadata: UpdateTicketMetadata
): Promise<boolean> {
  try {
    const { error } = await adminSupabase
      .from('contact_messages')
      .update(metadata)
      .eq('id', messageId);

    if (error) {
      console.error('[SUPPORT] Error updating ticket metadata:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SUPPORT] Exception updating ticket metadata:', error);
    return false;
  }
}

/**
 * Mark replies as read
 */
export async function markRepliesAsRead(
  messageId: string,
  readerType: 'user' | 'admin'
): Promise<boolean> {
  try {
    const field = readerType === 'user' ? 'read_by_user' : 'read_by_admin';
    
    const { error } = await supabase
      .from('contact_message_replies')
      .update({ [field]: true })
      .eq('message_id', messageId)
      .eq(field, false);

    if (error) {
      console.error('[SUPPORT] Error marking replies as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SUPPORT] Exception marking replies as read:', error);
    return false;
  }
}

/**
 * Get unread reply count for a ticket
 */
export async function getUnreadCount(
  messageId: string,
  readerType: 'user' | 'admin'
): Promise<number> {
  try {
    const field = readerType === 'user' ? 'read_by_user' : 'read_by_admin';
    const senderType = readerType === 'user' ? 'admin' : 'user';
    
    const { count, error } = await supabase
      .from('contact_message_replies')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId)
      .eq(field, false)
      .eq('sender_type', senderType);

    if (error) {
      console.error('[SUPPORT] Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[SUPPORT] Exception getting unread count:', error);
    return 0;
  }
}

