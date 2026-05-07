-- Migration: add logo_url to institutions
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS logo_url TEXT;
