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
 */
export async function fetchAcceptedContracts(): Promise<AcceptedContract[]> {
  try {
    const { data, error } = await supabase
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
      .not('accepted_at', 'is', null)
      .order('accepted_at', { ascending: false });

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

