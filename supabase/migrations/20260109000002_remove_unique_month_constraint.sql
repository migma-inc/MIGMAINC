-- Migration: Remove unique constraint on request_month
-- This constraint was preventing multiple payment requests in the same month
-- Since we removed the frequency limit, sellers should be able to request multiple times per month

DROP INDEX IF EXISTS idx_seller_payment_requests_unique_month;
