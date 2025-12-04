/**
 * Hook for fetching and managing Book a Call submissions
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/cache';

export interface BookACallSubmission {
  id: string;
  company_name: string;
  website: string | null;
  country: string;
  contact_name: string;
  email: string;
  phone: string;
  type_of_business: string;
  lead_volume: string;
  challenges: string | null;
  confirmation_accepted: boolean;
  ip_address: string | null;
  created_at: string;
}

export interface UseBookACallSubmissionsOptions {
  limit?: number;
  orderBy?: 'created_at';
  orderDirection?: 'asc' | 'desc';
}

export function useBookACallSubmissions(options: UseBookACallSubmissionsOptions = {}) {
  const [submissions, setSubmissions] = useState<BookACallSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    limit,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options;

  const cacheKey = generateCacheKey('book_a_call', options);

  const fetchSubmissions = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = getCachedData<BookACallSubmission[]>(cacheKey);
      if (cached) {
        setSubmissions(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('book_a_call_submissions')
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      const subs = (data as BookACallSubmission[]) || [];
      setSubmissions(subs);
      setCachedData(cacheKey, subs);
    } catch (err) {
      console.error('[useBookACallSubmissions] Error fetching submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [limit, orderBy, orderDirection, cacheKey]);

  useEffect(() => {
    fetchSubmissions(true);
  }, [fetchSubmissions]);

  return {
    submissions,
    loading,
    error,
    refetch: () => fetchSubmissions(false), // Force refetch without cache
  };
}

