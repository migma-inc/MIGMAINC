/**
 * Hook for fetching and managing Global Partner applications
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Application } from '@/types/application';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/cache';

// Re-export for convenience
export type { Application };

export interface UseApplicationsOptions {
  status?: 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'rejected';
  limit?: number;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
}

export function useApplications(options: UseApplicationsOptions = {}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status,
    limit,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options;

  const cacheKey = generateCacheKey('applications', options);

  const fetchApplications = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = getCachedData<Application[]>(cacheKey);
      if (cached) {
        setApplications(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('global_partner_applications')
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' });

      if (status) {
        query = query.eq('status', status);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      const apps = (data as Application[]) || [];
      setApplications(apps);
      setCachedData(cacheKey, apps);
    } catch (err) {
      console.error('[useApplications] Error fetching applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [status, limit, orderBy, orderDirection, cacheKey]);

  useEffect(() => {
    fetchApplications(true);
  }, [fetchApplications]);

  return {
    applications,
    loading,
    error,
    refetch: () => fetchApplications(false), // Force refetch without cache
  };
}
