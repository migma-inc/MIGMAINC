import { supabase } from './supabase';

export interface AcceptedContract {
  id: string;
  application_id: string;
  token: string;
  accepted_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  identity_photo_path: string | null;
  identity_photo_name: string | null;
  contract_pdf_path: string | null;
  contract_pdf_url: string | null;
  contract_version: string | null;
  contract_hash: string | null;
  geolocation_country: string | null;
  geolocation_city: string | null;
  signature_name: string | null;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  document_front_url: string | null;
  document_back_url: string | null;
  signature_image_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data from application
  application?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    country: string;
    cv_file_path: string | null;
    cv_file_name: string | null;
  };
}

/**
 * Fetch all accepted contracts (terms acceptances with accepted_at not null)
 * @param statusFilter Optional filter by verification_status ('pending', 'approved', 'rejected', or 'all')
 */
export async function fetchAcceptedContracts(statusFilter?: 'pending' | 'approved' | 'rejected' | 'all'): Promise<AcceptedContract[]> {
  try {
    let query = supabase
      .from('partner_terms_acceptances')
      .select(`
        *,
        application:global_partner_applications(
          id,
          full_name,
          email,
          phone,
          country,
          cv_file_path,
          cv_file_name
        )
      `)
      .not('accepted_at', 'is', null);

    // Apply status filter if provided and not 'all'
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        // Include both 'pending' and null (old contracts without verification_status)
        // Use .or() with proper Supabase PostgREST syntax
        query = query.or('verification_status.eq.pending,verification_status.is.null');
      } else if (statusFilter === 'approved') {
        query = query.eq('verification_status', 'approved');
      } else if (statusFilter === 'rejected') {
        query = query.eq('verification_status', 'rejected');
      }
    }

    const { data, error } = await query.order('accepted_at', { ascending: false });

    if (error) {
      console.error('[contracts] Error fetching contracts:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      ...item,
      application: Array.isArray(item.application) ? item.application[0] : item.application,
    })) as AcceptedContract[];
  } catch (error) {
    console.error('[contracts] Unexpected error:', error);
    return [];
  }
}

/**
 * Get public URL for a contract PDF
 */
export function getContractPdfUrl(contract: AcceptedContract): string | null {
  if (!contract.contract_pdf_url) {
    return null;
  }
  return contract.contract_pdf_url;
}

/**
 * Get public URL for a CV file
 */
export function getCvFileUrl(cvPath: string | null): string | null {
  if (!cvPath) {
    return null;
  }
  
  // Construct public URL for CV file
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const bucketName = 'cv-files';
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cvPath}`;
}

/**
 * Get active contract version from application_terms table
 * Returns the version and content of the currently active partner contract
 */
export async function getActiveContractVersion(): Promise<{ version: string; content: string } | null> {
  try {
    const { data, error } = await supabase
      .from('application_terms')
      .select('version, content')
      .eq('term_type', 'partner_contract')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[contracts] Error fetching active contract version:', error);
      return null;
    }

    if (!data) {
      console.warn('[contracts] No active contract version found');
      return null;
    }

    return {
      version: data.version,
      content: data.content,
    };
  } catch (error) {
    console.error('[contracts] Unexpected error fetching contract version:', error);
    return null;
  }
}

/**
 * Generate SHA-256 hash of contract content
 * Uses Web Crypto API (native browser API)
 */
export async function generateContractHash(contractHTML: string): Promise<string> {
  try {
    // Encode the HTML string to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(contractHTML);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('[contracts] Error generating contract hash:', error);
    throw error;
  }
}

/**
 * Get geolocation (country and city) from IP address
 * Uses ipapi.co free API (no API key required)
 * Returns nulls if IP is not provided or API fails
 */
export async function getGeolocationFromIP(ipAddress: string | null): Promise<{ country: string | null; city: string | null }> {
  // If no IP provided, return nulls
  if (!ipAddress || ipAddress.trim() === '') {
    return { country: null, city: null };
  }

  try {
    // Use ipapi.co free API
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[contracts] Geolocation API returned non-OK status:', response.status);
      return { country: null, city: null };
    }

    const data = await response.json();

    // Check for API error response
    if (data.error) {
      console.warn('[contracts] Geolocation API error:', data.reason || data.error);
      return { country: null, city: null };
    }

    // Extract country and city
    const country = data.country_name || data.country || null;
    const city = data.city || null;

    return { country, city };
  } catch (error) {
    console.warn('[contracts] Error fetching geolocation (non-critical):', error);
    // Return nulls on error - geolocation is not critical for functionality
    return { country: null, city: null };
  }
}

/**
 * Fetch contract statistics by verification status
 * Returns counts of contracts by status
 */
export async function fetchContractStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from('partner_terms_acceptances')
      .select('verification_status')
      .not('accepted_at', 'is', null);

    if (error) {
      console.error('[contracts] Error fetching contract stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      // Include null status as pending (old contracts before verification system)
      pending: data.filter((item) => item.verification_status === 'pending' || item.verification_status === null).length,
      approved: data.filter((item) => item.verification_status === 'approved').length,
      rejected: data.filter((item) => item.verification_status === 'rejected').length,
    };

    return stats;
  } catch (error) {
    console.error('[contracts] Unexpected error fetching contract stats:', error);
    return null;
  }
}

