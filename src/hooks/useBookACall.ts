import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BookACallSubmission } from '@/types/book-a-call';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/cache';

export interface UseBookACallOptions {
    limit?: number;
    orderBy?: 'created_at';
    orderDirection?: 'asc' | 'desc';
}

export function useBookACall(options: UseBookACallOptions = {}) {
    const [submissions, setSubmissions] = useState<BookACallSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const {
        limit,
        orderBy = 'created_at',
        orderDirection = 'desc',
    } = options;

    const cacheKey = generateCacheKey('book_a_call_submissions', options);

    const fetchSubmissions = useCallback(async (useCache = true) => {
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

            const dataTyped = (data as BookACallSubmission[]) || [];
            setSubmissions(dataTyped);
            setCachedData(cacheKey, dataTyped);
        } catch (err) {
            console.error('[useBookACall] Error fetching submissions:', err);
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
        refetch: () => fetchSubmissions(false),
    };
}
