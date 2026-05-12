-- Expand support chat message roles for human replies from CRM.
-- The RLS policies and sender trigger already validate which actor can use
-- admin/mentor roles; this table-level constraint only defines valid values.

ALTER TABLE public.support_chat_messages
  DROP CONSTRAINT IF EXISTS support_chat_messages_role_check;

ALTER TABLE public.support_chat_messages
  ADD CONSTRAINT support_chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'mentor', 'admin'));
