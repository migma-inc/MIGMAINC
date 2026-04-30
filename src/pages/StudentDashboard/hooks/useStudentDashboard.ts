import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStudentAuth } from '@/contexts/StudentAuthContext';

export interface DashboardApplication {
  id: string;
  status: string;
  placement_fee_paid_at: string | null;
  placement_fee_installments: number | null;
  placement_fee_2nd_installment_paid_at: string | null;
  admin_approved_at: string | null;
  payment_link_url: string | null;
  forms_status: string | null;
  package_status: string | null;
  package_storage_url: string | null;
  acceptance_letter_url: string | null;
  transfer_form_url: string | null;
  transfer_form_filled_url: string | null;
  transfer_form_student_status: string | null;
  transfer_form_admin_status: string | null;
  transfer_form_rejection_reason: string | null;
  transfer_form_delivered_at: string | null;
  transfer_concluded_at: string | null;
  created_at: string;
  institutions: {
    name: string;
    city: string | null;
    state: string | null;
    slug: string | null;
  } | null;
  institution_scholarships: {
    scholarship_level: string | null;
    placement_fee_usd: number | null;
    discount_percent: number | null;
    tuition_annual_usd: number | null;
    monthly_migma_usd: number | null;
  } | null;
}

export interface DashboardDocument {
  id: string;
  document_type: string;
  status: string;
  requested_at: string;
  submitted_at: string | null;
  submitted_url: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface DashboardForm {
  id: string;
  application_id: string | null;
  form_type: string;
  template_url: string | null;
  generated_at: string | null;
  signed_url: string | null;
  signed_at: string | null;
  signature_metadata_json?: Record<string, unknown> | null;
}

export interface DashboardIdentity {
  birth_date: string | null;
  document_type: string | null;
  document_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  nationality: string | null;
  marital_status: string | null;
}

export interface DashboardStudentDocument {
  id: string;
  type: string;
  status: string;
  uploaded_at: string | null;
  file_url: string | null;
  rejection_reason: string | null;
}

export interface DashboardSurveyResponse {
  id: string;
  service_type: string;
  academic_formation: string | null;
  interest_areas: string[] | null;
  english_level: string | null;
  completed_at: string | null;
}

export interface DashboardWorkEntry {
  company: string;
  period: string;
  role: string;
}

export interface DashboardComplementaryData {
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_address: string | null;
  preferred_start_term: string | null;
  has_sponsor: boolean | null;
  sponsor_name: string | null;
  sponsor_relationship: string | null;
  sponsor_phone: string | null;
  sponsor_address: string | null;
  sponsor_employer: string | null;
  sponsor_job_title: string | null;
  sponsor_years_employed: number | null;
  sponsor_annual_income: string | null;
  sponsor_committed_amount_usd: number | null;
  work_experience: DashboardWorkEntry[] | null;
  recommender1_name: string | null;
  recommender1_role: string | null;
  recommender1_contact: string | null;
  recommender2_name: string | null;
  recommender2_role: string | null;
  recommender2_contact: string | null;
}

export interface DashboardData {
  applications: DashboardApplication[];
  documents: DashboardDocument[];
  forms: DashboardForm[];
  identity: DashboardIdentity | null;
  studentDocuments: DashboardStudentDocument[];
  surveyResponse: DashboardSurveyResponse | null;
  complementaryData: DashboardComplementaryData | null;
}

export function useStudentDashboard() {
  const { userProfile, refreshProfile } = useStudentAuth();
  const profileId = userProfile?.id ?? null;
  const userId = userProfile?.user_id ?? null;
  const [data, setData] = useState<DashboardData>({
    applications: [],
    documents: [],
    forms: [],
    identity: null,
    studentDocuments: [],
    surveyResponse: null,
    complementaryData: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!profileId || !userId) {
      setData({
        applications: [],
        documents: [],
        forms: [],
        identity: null,
        studentDocuments: [],
        surveyResponse: null,
        complementaryData: null,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [applicationsRes, documentsRes, formsRes, identityRes, studentDocumentsRes, surveyRes, complementaryRes] = await Promise.all([
      supabase
        .from('institution_applications')
        .select(`
          id, status, placement_fee_paid_at, placement_fee_installments,
          placement_fee_2nd_installment_paid_at, admin_approved_at,
          payment_link_url, forms_status, package_status, package_storage_url,
          acceptance_letter_url, transfer_form_url, transfer_form_filled_url, transfer_form_student_status,
          transfer_form_admin_status, transfer_form_rejection_reason,
          transfer_form_delivered_at, transfer_concluded_at, created_at,
          institutions ( name, city, state, slug ),
          institution_scholarships (
            scholarship_level, placement_fee_usd, discount_percent,
            tuition_annual_usd, monthly_migma_usd
          )
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false }),
      supabase
        .from('global_document_requests')
        .select('id, document_type, status, requested_at, submitted_at, submitted_url, approved_at, rejection_reason')
        .eq('profile_id', profileId)
        .order('requested_at', { ascending: false }),
      supabase
        .from('institution_forms')
        .select('id, application_id, form_type, template_url, generated_at, signed_url, signed_at, signature_metadata_json')
        .eq('profile_id', profileId)
        .neq('form_type', 'termo_responsabilidade_estudante')
        .order('generated_at', { ascending: false }),
      supabase
        .from('user_identity')
        .select('birth_date, document_type, document_number, address, city, state, zip_code, country, nationality, marital_status')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('student_documents')
        .select('id, type, status, uploaded_at, file_url, rejection_reason')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false }),
      supabase
        .from('selection_survey_responses')
        .select('id, service_type, academic_formation, interest_areas, english_level, completed_at')
        .eq('profile_id', profileId)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('student_complementary_data')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle(),
    ]);

    if (applicationsRes.error || documentsRes.error || formsRes.error || identityRes.error || studentDocumentsRes.error || surveyRes.error || complementaryRes.error) {
      setError(
        applicationsRes.error?.message ||
        documentsRes.error?.message ||
        formsRes.error?.message ||
        identityRes.error?.message ||
        studentDocumentsRes.error?.message ||
        surveyRes.error?.message ||
        complementaryRes.error?.message ||
        'Erro ao carregar dashboard',
      );
    }

    setData({
      applications: (applicationsRes.data ?? []) as unknown as DashboardApplication[],
      documents: (documentsRes.data ?? []) as DashboardDocument[],
      forms: (formsRes.data ?? []) as DashboardForm[],
      identity: (identityRes.data ?? null) as DashboardIdentity | null,
      studentDocuments: (studentDocumentsRes.data ?? []) as DashboardStudentDocument[],
      surveyResponse: (surveyRes.data ?? null) as DashboardSurveyResponse | null,
      complementaryData: (complementaryRes.data ?? null) as DashboardComplementaryData | null,
    });
    setLoading(false);
  }, [profileId, userId]);

  useEffect(() => {
    void Promise.resolve().then(fetchDashboard);
  }, [fetchDashboard]);

  const activeApplication = useMemo(() => {
    return data.applications.find(app => ['payment_confirmed', 'payment_pending', 'approved'].includes(app.status)) ?? data.applications[0] ?? null;
  }, [data.applications]);

  return {
    data,
    activeApplication,
    loading,
    error,
    refresh: async () => {
      await refreshProfile();
      await fetchDashboard();
    },
  };
}
