/**
 * TypeScript types for Support Chat System
 */

export type TicketStatus = 'new' | 'read' | 'replied' | 'resolved' | 'archived';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SenderType = 'user' | 'admin';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  assigned_to: string | null;
  access_token: string;
  last_reply_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactMessageReply {
  id: string;
  message_id: string;
  sender_type: SenderType;
  sender_name: string;
  sender_email: string;
  content: string;
  read_by_user: boolean;
  read_by_admin: boolean;
  created_at: string;
}

export interface CreateReplyData {
  message_id: string;
  sender_type: SenderType;
  sender_name: string;
  sender_email: string;
  content: string;
}

export interface UpdateTicketMetadata {
  priority?: TicketPriority;
  tags?: string[];
  assigned_to?: string | null;
  status?: TicketStatus;
}

export interface TicketWithReplies extends ContactMessage {
  replies: ContactMessageReply[];
  unread_count?: number;
}

