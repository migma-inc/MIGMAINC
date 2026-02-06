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
  status?: 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'active_partner' | 'rejected';
  limit?: number;
  page?: number;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
  search?: string;
}

export function useApplications(options: UseApplicationsOptions = {}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status,
    limit = 10,
    page = 1,
    orderBy = 'created_at',
    orderDirection = 'desc',
    search = '',
  } = options;

  const cacheKey = generateCacheKey('applications', { ...options });

  const fetchApplications = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = getCachedData<{ apps: Application[], total: number }>(cacheKey);
      if (cached) {
        setApplications(cached.apps);
        setTotalCount(cached.total);
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
        .select('*', { count: 'exact' });

      // If status is provided, filter by it
      if (status) {
        query = query.eq('status', status);
      } else {
        // BY DEFAULT: Exclude rejected applications if no status filter is active
        query = query.neq('status', 'rejected');
      }

      // Search
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`);
      }

      // Order
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      // Pagination
      if (limit) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw queryError;
      }

      const apps = (data as Application[]) || [];
      const total = count || 0;

      setApplications(apps);
      setTotalCount(total);
      setCachedData(cacheKey, { apps, total });
    } catch (err) {
      console.error('[useApplications] Error fetching applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
      setApplications([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [status, limit, page, orderBy, orderDirection, search, cacheKey]);

  useEffect(() => {
    fetchApplications(true);
  }, [fetchApplications]);

  return {
    applications,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    loading,
    error,
    refetch: () => fetchApplications(false), // Force refetch without cache
  };
}
