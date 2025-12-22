-- Migration: Add Support Chat System
-- Expands contact_messages table and creates contact_message_replies for chat functionality

-- Add new columns to contact_messages table
ALTER TABLE contact_messages
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_access_token ON contact_messages(access_token);
CREATE INDEX IF NOT EXISTS idx_contact_messages_priority ON contact_messages(priority);
CREATE INDEX IF NOT EXISTS idx_contact_messages_assigned_to ON contact_messages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_messages_last_reply_at ON contact_messages(last_reply_at DESC);

-- Create contact_message_replies table
CREATE TABLE IF NOT EXISTS contact_message_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  content TEXT NOT NULL,
  read_by_user BOOLEAN DEFAULT FALSE,
  read_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for contact_message_replies
CREATE INDEX IF NOT EXISTS idx_contact_message_replies_message_id ON contact_message_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_contact_message_replies_created_at ON contact_message_replies(created_at DESC);

-- Enable RLS on contact_message_replies
ALTER TABLE contact_message_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read all replies
CREATE POLICY "Admins can read all replies"
ON contact_message_replies
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- RLS Policy: Admins can create replies
CREATE POLICY "Admins can create replies"
ON contact_message_replies
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- RLS Policy: Users can read replies of their own ticket (via token validation)
-- Note: This will be handled in the application layer since we can't directly validate tokens in RLS
-- For now, we'll allow anonymous read if they have the message_id (validated in app)
CREATE POLICY "Users can read replies of their ticket"
ON contact_message_replies
FOR SELECT
TO anon
USING (
  -- This allows reading, but the app must validate the token before querying
  true
);

-- RLS Policy: Users can create replies in their own ticket
CREATE POLICY "Users can create replies in their ticket"
ON contact_message_replies
FOR INSERT
TO anon
WITH CHECK (
  -- This allows insertion, but the app must validate the token before allowing
  true
);

-- Function to update last_reply_at when a reply is created
CREATE OR REPLACE FUNCTION update_last_reply_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contact_messages
  SET last_reply_at = NEW.created_at
  WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_reply_at
CREATE TRIGGER update_contact_message_last_reply
AFTER INSERT ON contact_message_replies
FOR EACH ROW
EXECUTE FUNCTION update_last_reply_at();

-- Function to generate unique access token
CREATE OR REPLACE FUNCTION generate_access_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE contact_message_replies IS 'Stores replies/messages in support ticket conversations';
COMMENT ON COLUMN contact_messages.access_token IS 'Unique token for user to access their ticket';
COMMENT ON COLUMN contact_messages.priority IS 'Ticket priority: low, medium, high, urgent';
COMMENT ON COLUMN contact_messages.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN contact_messages.assigned_to IS 'Admin user assigned to this ticket';
COMMENT ON COLUMN contact_messages.last_reply_at IS 'Timestamp of last reply for sorting';

