-- Migration: Create scheduled_meetings table
-- Allows admins to schedule meetings and send emails directly to users

CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL,
  meeting_link TEXT NOT NULL,
  meeting_scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_date ON scheduled_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_email ON scheduled_meetings(email);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_created_at ON scheduled_meetings(created_at DESC);

-- Add comment to table
COMMENT ON TABLE scheduled_meetings IS 'Stores meetings scheduled by admins and sent directly to users via email';
