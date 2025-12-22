-- Migration: Create function to get all admin emails
-- This function returns an array of email addresses for all users with admin role
-- Used to send notifications when new Global Partner applications are submitted

-- Create function to get admin emails
CREATE OR REPLACE FUNCTION get_admin_emails()
RETURNS TEXT[] AS $$
DECLARE
  admin_emails TEXT[];
BEGIN
  -- Query auth.users to get emails of users with admin role
  -- user_metadata is a JSONB column that stores the role
  SELECT ARRAY_AGG(email::TEXT)
  INTO admin_emails
  FROM auth.users
  WHERE (raw_user_meta_data->>'role' = 'admin')
    AND email IS NOT NULL
    AND deleted_at IS NULL;
  
  -- Return empty array if no admins found
  IF admin_emails IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  
  RETURN admin_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
-- This allows the frontend to call this function via RPC
GRANT EXECUTE ON FUNCTION get_admin_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_emails() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_admin_emails() IS 'Returns array of email addresses for all users with admin role. Used for sending notifications.';

