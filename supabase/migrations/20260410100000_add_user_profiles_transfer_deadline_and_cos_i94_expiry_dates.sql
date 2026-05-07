alter table public.user_profiles
  add column if not exists transfer_deadline_date date,
  add column if not exists cos_i94_expiry_date date;
