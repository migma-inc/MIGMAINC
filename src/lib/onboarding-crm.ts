/**
 * onboarding-crm.ts
 * Aggregated read and mutation layer for the MIGMA Onboarding CRM hub.
 *
 * Scope: user_profiles (source='migma') as the primary aggregate, joined in-memory
 * with service_requests (via client_id = user_id) and visa_orders (via client_email).
 *
 * No schema changes: stage derivation is done in the application layer using
 * existing fields (payment_status, contract_approval_status, workflow_stage, case_status).
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrmProfile {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  field_of_interest: string | null;
  academic_level: string | null;
  status: string | null;
  source: string | null;
  service_type: string | null;
  total_price_usd: string | number | null;
  onboarding_completed: boolean | null;
  onboarding_current_step: string | null;
  has_paid_selection_process_fee: boolean | null;
  is_application_fee_paid: boolean | null;
  is_scholarship_fee_paid: boolean | null;
  has_paid_college_enrollment_fee: boolean | null;
  has_paid_i20_control_fee: boolean | null;
  is_placement_fee_paid: boolean | null;
  selection_survey_passed: boolean | null;
  placement_fee_flow: boolean | null;
  student_process_type: string | null;
  num_dependents: number | null;
  selection_process_fee_payment_method: string | null;
  signature_url: string | null;
  migma_seller_id: string | null;
  migma_agent_id: string | null;
  matricula_user_id: string | null;
  onboarding_email_status: string | null;
  // Deadline fields (added via migration — may be null until migration is applied)
  transfer_deadline_date: string | null;
  cos_i94_expiry_date: string | null;
  // Survey tracking
  selection_survey_completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface CrmServiceRequest {
  id: string;
  client_id: string | null;
  service_id: string | null;
  status: string | null;
  service_type: string | null;
  workflow_stage: string | null;
  case_status: string | null;
  priority: string | null;
  owner_user_id: string | null;
  stage_entered_at: string | null;
  last_client_contact_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CrmVisaOrder {
  id: string;
  order_number: string | null;
  product_slug: string | null;
  client_email: string | null;
  client_country: string | null;
  client_nationality: string | null;
  payment_method: string | null;
  payment_status: string | null;
  contract_approval_status: string | null;
  annex_approval_status: string | null;
  contract_accepted: boolean | null;
  contract_document_url: string | null;
  contract_selfie_url: string | null;
  contract_pdf_url: string | null;
  annex_pdf_url: string | null;
  signature_image_url: string | null;
  zelle_proof_url: string | null;
  service_request_id: string | null;
  total_price_usd: string | number | null;
  created_at: string | null;
  paid_at: string | null;
}

/** The unified CRM case view built from the three source tables. */
export interface OnboardingCase {
  profile: CrmProfile;
  serviceRequest: CrmServiceRequest | null;
  visaOrder: CrmVisaOrder | null;
  /** Derived operational stage readable by the admin team. */
  operationalStage: OperationalStage;
}

export type OperationalStage =
  | 'no_order'
  | 'checkout_started'
  | 'payment_pending'
  | 'awaiting_payment_confirmation'
  | 'payment_confirmed'
  | 'contract_pending'
  | 'contract_under_review'
  | 'contract_rejected'
  | 'documents_pending'
  | 'documents_under_review'
  | 'in_processing'
  | 'completed'
  | 'blocked'
  | 'cancelled';

// ---------------------------------------------------------------------------
// Stage derivation
// ---------------------------------------------------------------------------

/**
 * Derive a meaningful MIGMA operational stage from the three source objects.
 * Uses only existing columns — no schema changes required.
 */
export function deriveOperationalStage(
  profile: CrmProfile,
  sr: CrmServiceRequest | null,
  order: CrmVisaOrder | null
): OperationalStage {
  if (!order) return 'no_order';

  if (order.payment_status === 'cancelled') return 'cancelled';

  if (sr?.case_status === 'cancelled') return 'cancelled';
  if (sr?.case_status === 'blocked') return 'blocked';

  const profileStep = profile.onboarding_current_step?.toLowerCase() || null;
  const profileEmailStatus = profile.onboarding_email_status?.toLowerCase() || null;

  if (profile.onboarding_completed || profileStep === 'completed') {
    return 'completed';
  }

  if (profileEmailStatus === 'welcome_email_failed') {
    return 'blocked';
  }

  if (profileStep === 'awaiting_client_data') {
    return 'documents_pending';
  }

  if (profileStep === 'documents_upload') {
    return 'documents_under_review';
  }

  if (profileStep === 'payment') {
    if (order.payment_status === 'completed') return 'payment_confirmed';
    if (order.payment_status === 'pending') {
      return order.payment_method === 'zelle'
        ? 'awaiting_payment_confirmation'
        : 'payment_pending';
    }
    return 'checkout_started';
  }

  // Payment gates
  if (order.payment_status === 'pending') {
    // Zelle with proof uploaded = awaiting confirmation
    if (order.payment_method === 'zelle') return 'awaiting_payment_confirmation';
    return 'payment_pending';
  }

  if (order.payment_status !== 'completed') return 'checkout_started';

  // Payment confirmed — evaluate contract stage
  if (!order.contract_accepted) return 'contract_pending';

  const contractStatus = order.contract_approval_status;
  if (contractStatus === 'rejected') return 'contract_rejected';
  if (contractStatus === 'pending') return 'contract_under_review';

  // Contract approved — evaluate operational stage
  if (sr) {
    if (sr.case_status === 'completed' || sr.workflow_stage === 'completed') return 'completed';
    if (sr.workflow_stage === 'document_review') return 'documents_under_review';
    if (
      sr.workflow_stage === 'awaiting_client_data' ||
      sr.workflow_stage === 'case_created'
    ) return 'documents_pending';
  }

  if (profile.onboarding_completed) return 'completed';

  return 'in_processing';
}

export const OPERATIONAL_STAGE_LABELS: Record<OperationalStage, string> = {
  no_order: 'No Order',
  checkout_started: 'Checkout Started',
  payment_pending: 'Payment Pending',
  awaiting_payment_confirmation: 'Awaiting Confirmation',
  payment_confirmed: 'Payment Confirmed',
  contract_pending: 'Contract Pending',
  contract_under_review: 'Contract Review',
  contract_rejected: 'Contract Rejected',
  documents_pending: 'Documents Pending',
  documents_under_review: 'Documents Review',
  in_processing: 'In Processing',
  completed: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

export const OPERATIONAL_STAGE_COLORS: Record<OperationalStage, string> = {
  no_order: 'bg-white/5 text-gray-400 border-white/10',
  checkout_started: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  payment_pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  awaiting_payment_confirmation: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  payment_confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  contract_pending: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  contract_under_review: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  contract_rejected: 'bg-red-500/20 text-red-300 border-red-500/40',
  documents_pending: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  documents_under_review: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  in_processing: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  completed: 'bg-green-500/20 text-green-400 border-green-500/40',
  blocked: 'bg-red-700/20 text-red-400 border-red-700/40',
  cancelled: 'bg-white/5 text-gray-500 border-white/10',
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface OnboardingCrmFilters {
  /** Tab-level filter based on profile data */
  profileTab: 'all' | 'in_progress' | 'completed' | 'selection_paid' | 'placement';
  /** Ownership presence based on MIGMA profile metadata */
  ownership: 'all' | 'owned' | 'unassigned';
  /** Payment status from visa_orders */
  paymentStatus: 'all' | 'pending' | 'completed' | 'cancelled';
  /** Case status from service_requests */
  caseStatus: 'all' | 'active' | 'completed' | 'blocked' | 'cancelled';
  /** Whether to show archived (case_status=cancelled) cases */
  showArchived: boolean;
}

export const DEFAULT_CRM_FILTERS: OnboardingCrmFilters = {
  profileTab: 'all',
  ownership: 'all',
  paymentStatus: 'all',
  caseStatus: 'all',
  showArchived: false,
};

const FILTERS_STORAGE_KEY = 'migma_crm_filters_v1';

export function loadPersistedFilters(): OnboardingCrmFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CRM_FILTERS };
    return { ...DEFAULT_CRM_FILTERS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CRM_FILTERS };
  }
}

export function persistFilters(filters: OnboardingCrmFilters): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Load MIGMA profiles in bulk, then batch-load their service_requests and
 * visa_orders in two additional queries. Joins are performed in-memory.
 */
export async function loadOnboardingBoard(productLine?: 'cos' | 'transfer'): Promise<{
  cases: OnboardingCase[];
  error: string | null;
}> {
  // 1. Load all MIGMA profiles
  const { data: profilesData, error: profilesError } = await supabase
    .from('user_profiles')
    .select(`
      id, user_id, email, full_name, phone, country, field_of_interest, academic_level,
      status, source, service_type,
      total_price_usd, onboarding_completed, onboarding_current_step,
      has_paid_selection_process_fee, is_application_fee_paid,
      is_scholarship_fee_paid, has_paid_college_enrollment_fee, has_paid_i20_control_fee,
      is_placement_fee_paid, selection_survey_passed, placement_fee_flow,
      student_process_type, num_dependents, selection_process_fee_payment_method,
      signature_url, migma_seller_id, migma_agent_id, matricula_user_id, onboarding_email_status,
      transfer_deadline_date, cos_i94_expiry_date, selection_survey_completed_at,
      updated_at, created_at
    `)
    .eq('source', 'migma')
    .order('updated_at', { ascending: false });

  if (profilesError) {
    return { cases: [], error: profilesError.message };
  }

  const profiles = (profilesData ?? []) as CrmProfile[];
  if (profiles.length === 0) {
    return { cases: [], error: null };
  }

  // 2. Collect emails and resolve client_ids via the clients table
  const emails = profiles.map((p) => p.email).filter((e): e is string => !!e);

  // Resolve email → clients.id so we can join service_requests.client_id
  // (service_requests.client_id references clients.id, not auth.users.id)
  const clientsResult = emails.length > 0
    ? await supabase
        .from('clients')
        .select('id, email')
        .in('email', emails)
    : { data: [], error: null };

  const clientIdByEmail = new Map<string, string>();
  for (const c of (clientsResult.data ?? []) as { id: string; email: string }[]) {
    if (c.email && !clientIdByEmail.has(c.email)) {
      clientIdByEmail.set(c.email, c.id);
    }
  }

  const resolvedClientIds = [...clientIdByEmail.values()];

  const [requestsResult, ordersResult] = await Promise.all([
    resolvedClientIds.length > 0
      ? supabase
          .from('service_requests')
          .select(`
            id, client_id, service_id, status, service_type, workflow_stage,
            case_status, priority, owner_user_id, stage_entered_at,
            last_client_contact_at, created_at, updated_at
          `)
          .in('client_id', resolvedClientIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    emails.length > 0
      ? (() => {
          let q = supabase
            .from('visa_orders')
            .select(`
            id, order_number, product_slug, client_email, client_country, client_nationality,
            payment_method, payment_status, contract_approval_status, annex_approval_status,
            contract_accepted, contract_document_url, contract_selfie_url, contract_pdf_url,
            annex_pdf_url, signature_image_url, zelle_proof_url, service_request_id, total_price_usd,
            created_at, paid_at
          `)
            .in('client_email', emails)
            .order('created_at', { ascending: false });
          if (productLine === 'cos') q = q.ilike('product_slug', 'cos-%');
          if (productLine === 'transfer') q = q.ilike('product_slug', 'transfer-%');
          return q;
        })()
      : Promise.resolve({ data: [], error: null }),
  ]);

  const allRequests = (requestsResult.data ?? []) as CrmServiceRequest[];
  const allOrders = (ordersResult.data ?? []) as CrmVisaOrder[];

  // 3. Build lookup maps
  // service_requests by client_id (keep only the most recent per client)
  const srByClientId = new Map<string, CrmServiceRequest>();
  for (const sr of allRequests) {
    if (!sr.client_id) continue;
    if (!srByClientId.has(sr.client_id)) {
      srByClientId.set(sr.client_id, sr);
    }
  }

  // visa_orders by client_email (keep only the most recent per email)
  const orderByEmail = new Map<string, CrmVisaOrder>();
  for (const order of allOrders) {
    if (!order.client_email) continue;
    if (!orderByEmail.has(order.client_email)) {
      orderByEmail.set(order.client_email, order);
    }
  }

  // 4. Assemble OnboardingCase per profile
  // Resolve service_request via email → clients.id → service_requests.client_id
  const cases: OnboardingCase[] = profiles
    .map((profile) => {
      const clientId = profile.email ? clientIdByEmail.get(profile.email) ?? null : null;
      const sr = clientId ? srByClientId.get(clientId) ?? null : null;
      const order = profile.email ? orderByEmail.get(profile.email) ?? null : null;
      return {
        profile,
        serviceRequest: sr,
        visaOrder: order,
        operationalStage: deriveOperationalStage(profile, sr, order),
      };
    })
    // When filtering by product line, only show profiles that have a matching order
    .filter((c) => !productLine || c.visaOrder !== null);

  return { cases, error: null };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Assign a case to an admin user.
 * Updates service_requests.owner_user_id and updated_at.
 */
export async function updateCaseOwner(
  serviceRequestId: string,
  ownerUserId: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_requests')
    .update({
      owner_user_id: ownerUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceRequestId);

  return { error: error?.message ?? null };
}

/**
 * Update case_status on a service_request.
 * Used for archive (cancelled), blocking, or completing a case.
 */
export async function updateCaseStatus(
  serviceRequestId: string,
  caseStatus: 'active' | 'completed' | 'cancelled' | 'blocked'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_requests')
    .update({
      case_status: caseStatus,
      closed_at: caseStatus !== 'active' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceRequestId);

  return { error: error?.message ?? null };
}

/**
 * Update workflow_stage on a service_request (used by kanban drag-and-drop).
 */
export async function updateWorkflowStage(
  serviceRequestId: string,
  workflowStage: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('service_requests')
    .update({
      workflow_stage: workflowStage,
      stage_entered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceRequestId);

  return { error: error?.message ?? null };
}

/**
 * Create a follow-up on a service_request.
 */
export async function createFollowup(params: {
  serviceRequestId: string;
  followupType: string;
  notes: string;
  dueAt: string | null;
  ownerUserId: string | null;
}): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('service_request_followups')
    .insert({
      service_request_id: params.serviceRequestId,
      followup_type: params.followupType,
      status: 'open',
      notes: params.notes || null,
      due_at: params.dueAt || null,
      owner_user_id: params.ownerUserId || null,
      created_at: now,
      updated_at: now,
    });
  return { error: error?.message ?? null };
}

/**
 * Resolve an open follow-up.
 */
export async function resolveFollowup(followupId: string): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('service_request_followups')
    .update({ status: 'resolved', resolved_at: now, updated_at: now })
    .eq('id', followupId);
  return { error: error?.message ?? null };
}

/**
 * Load detailed data for a single case: events + followups from the
 * service_request_events and service_request_followups tables.
 * Requires the admin RLS policies from migration 20260408100000.
 */
export async function loadCaseDetail(serviceRequestIds: string[]): Promise<{
  events: Array<{
    id: string;
    service_request_id: string;
    event_type: string;
    event_source: string;
    payload_json: Record<string, unknown>;
    created_at: string;
  }>;
  followups: Array<{
    id: string;
    service_request_id: string;
    followup_type: string;
    status: string;
    due_at: string | null;
    resolved_at: string | null;
    owner_user_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;
  error: string | null;
}> {
  if (serviceRequestIds.length === 0) {
    return { events: [], followups: [], error: null };
  }

  const [eventsResult, followupsResult] = await Promise.all([
    supabase
      .from('service_request_events')
      .select('id, service_request_id, event_type, event_source, payload_json, created_at')
      .in('service_request_id', serviceRequestIds)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('service_request_followups')
      .select(
        'id, service_request_id, followup_type, status, due_at, resolved_at, owner_user_id, notes, created_at, updated_at'
      )
      .in('service_request_id', serviceRequestIds)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    events: (eventsResult.data ?? []) as any,
    followups: (followupsResult.data ?? []) as any,
    error: eventsResult.error?.message ?? followupsResult.error?.message ?? null,
  };
}

/**
 * Load all visa_orders for a given email to show the full order history
 * in the case detail dialog.
 */
export async function loadOrderHistory(email: string): Promise<CrmVisaOrder[]> {
  const { data } = await supabase
    .from('visa_orders')
    .select(`
      id, order_number, product_slug, client_email, payment_method,
      payment_status, contract_approval_status, annex_approval_status,
      contract_accepted, service_request_id, total_price_usd,
      created_at, paid_at
    `)
    .eq('client_email', email)
    .order('created_at', { ascending: false });

  return (data ?? []) as CrmVisaOrder[];
}

/**
 * Load all service_requests for a profile email, resolving client_id via the clients table.
 */
export async function loadAllServiceRequests(email: string): Promise<CrmServiceRequest[]> {
  // Resolve via visa_orders.service_request_id to avoid duplicate-client issues
  const { data: orders } = await supabase
    .from('visa_orders')
    .select('service_request_id')
    .eq('client_email', email)
    .not('service_request_id', 'is', null);

  const srIds = [
    ...new Set((orders ?? []).map((o: { service_request_id: string }) => o.service_request_id).filter(Boolean)),
  ];

  if (srIds.length === 0) return [];

  const { data } = await supabase
    .from('service_requests')
    .select(`
      id, client_id, service_id, status, service_type, workflow_stage,
      case_status, priority, owner_user_id, stage_entered_at,
      last_client_contact_at, created_at, updated_at
    `)
    .in('id', srIds)
    .order('updated_at', { ascending: false });

  return (data ?? []) as CrmServiceRequest[];
}

// ---------------------------------------------------------------------------
// Detail page types
// ---------------------------------------------------------------------------

export interface CrmStageHistory {
  id: string;
  service_request_id: string;
  from_stage: string | null;
  to_stage: string;
  reason: string | null;
  trigger_source: string | null;
  created_at: string;
}

export interface CrmEvent {
  id: string;
  service_request_id: string;
  event_type: string;
  event_source: string;
  event_key: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface CrmFollowup {
  id: string;
  service_request_id: string;
  followup_type: string;
  status: string;
  due_at: string | null;
  resolved_at: string | null;
  owner_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmIdentityFile {
  id: string;
  file_type: string;
  file_path: string;
  file_name: string | null;
}

export interface CrmDocument {
  id: string;
  service_request_id: string;
  source_message_id: string | null;
  document_type: string | null;
  source: string | null;
  storage_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  document_status: string | null;
  received_at: string | null;
  created_at: string;
}

export interface CrmMessage {
  id: string;
  service_request_id: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  provider: string | null;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  classification: string | null;
  thread_id: string | null;
  provider_message_id: string | null;
  received_at: string | null;
  created_at: string;
  message_metadata: Record<string, unknown> | null;
}

export interface CaseDetailPage {
  profile: CrmProfile;
  serviceRequests: CrmServiceRequest[];
  /** Most recent service_request, or null */
  primaryRequest: CrmServiceRequest | null;
  visaOrders: CrmVisaOrder[];
  /** Most recent visa_order, or null */
  primaryOrder: CrmVisaOrder | null;
  /** Derived stage based on primary request + order */
  operationalStage: OperationalStage;
  stageHistory: CrmStageHistory[];
  events: CrmEvent[];
  followups: CrmFollowup[];
  messages: CrmMessage[];
  srDocuments: CrmDocument[];
  identityFiles: CrmIdentityFile[];
}

/**
 * Load all data required by the dedicated case detail page.
 * Accepts the user_profiles.id (not user_id / auth UUID).
 */
export async function loadDetailPage(profileId: string): Promise<{
  data: CaseDetailPage | null;
  error: string | null;
}> {
  // 1. Load the profile
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select(`
      id, user_id, email, full_name, phone, country, field_of_interest, academic_level,
      status, source, service_type,
      total_price_usd, onboarding_completed, onboarding_current_step,
      has_paid_selection_process_fee, is_application_fee_paid,
      is_scholarship_fee_paid, has_paid_college_enrollment_fee, has_paid_i20_control_fee,
      is_placement_fee_paid, selection_survey_passed, placement_fee_flow,
      student_process_type, num_dependents, selection_process_fee_payment_method,
      signature_url, migma_seller_id, migma_agent_id, matricula_user_id, onboarding_email_status,
      transfer_deadline_date, cos_i94_expiry_date, selection_survey_completed_at,
      updated_at, created_at
    `)
    .eq('id', profileId)
    .single();

  if (profileError || !profileData) {
    return { data: null, error: profileError?.message ?? 'Profile not found' };
  }

  const profile = profileData as CrmProfile;

  // 2. Load visa_orders first — they carry service_request_id which we use directly
  //    to load service_requests, bypassing the clients table entirely (avoids duplicate-client issues)
  const ordersResult = profile.email
    ? await supabase
        .from('visa_orders')
        .select(`
          id, order_number, product_slug, client_email, client_country, client_nationality,
          payment_method, payment_status, contract_approval_status, annex_approval_status,
          contract_accepted, contract_document_url, contract_selfie_url, contract_pdf_url,
          annex_pdf_url, signature_image_url, zelle_proof_url, service_request_id, total_price_usd,
          created_at, paid_at
        `)
        .eq('client_email', profile.email)
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  const visaOrders = (ordersResult.data ?? []) as CrmVisaOrder[];

  // Collect unique service_request_ids from orders
  const srIdsFromOrders = [
    ...new Set(
      visaOrders.map((o) => o.service_request_id).filter((id): id is string => !!id)
    ),
  ];

  // Load service_requests directly by their IDs (no clients table join needed)
  const requestsResult = srIdsFromOrders.length > 0
    ? await supabase
        .from('service_requests')
        .select(`
          id, client_id, service_id, status, service_type, workflow_stage,
          case_status, priority, owner_user_id, stage_entered_at,
          last_client_contact_at, created_at, updated_at
        `)
        .in('id', srIdsFromOrders)
        .order('updated_at', { ascending: false })
    : { data: [], error: null };

  const serviceRequests = (requestsResult.data ?? []) as CrmServiceRequest[];
  const primaryRequest = serviceRequests[0] ?? null;
  const primaryOrder = visaOrders[0] ?? null;
  const operationalStage = deriveOperationalStage(profile, primaryRequest, primaryOrder);

  // 3. Load operational history, events, followups, and identity files in parallel
  const srId = primaryRequest?.id ?? null;
  const srIds = serviceRequests.map((sr) => sr.id);

  const [historyResult, eventsResult, followupsResult, messagesResult, srDocumentsResult, identityResult] = await Promise.all([
    srId
      ? supabase
          .from('service_request_stage_history')
          .select('id, service_request_id, from_stage, to_stage, reason, trigger_source, created_at')
          .eq('service_request_id', srId)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    srIds.length > 0
      ? supabase
          .from('service_request_events')
          .select('id, service_request_id, event_type, event_source, event_key, payload_json, created_at')
          .in('service_request_id', srIds)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),

    srIds.length > 0
      ? supabase
          .from('service_request_followups')
          .select('id, service_request_id, followup_type, status, due_at, resolved_at, owner_user_id, notes, created_at, updated_at')
          .in('service_request_id', srIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),

    srIds.length > 0
      ? supabase
          .from('service_request_messages')
          .select('id, service_request_id, direction, channel, provider, from_address, to_address, subject, body_text, classification, thread_id, provider_message_id, received_at, created_at, message_metadata')
          .in('service_request_id', srIds)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),

    srIds.length > 0
      ? supabase
          .from('service_request_documents')
          .select('id, service_request_id, source_message_id, document_type, source, storage_url, file_name, mime_type, document_status, received_at, created_at')
          .in('service_request_id', srIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    srId
      ? supabase
          .from('identity_files')
          .select('id, file_type, file_path, file_name')
          .eq('service_request_id', srId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    data: {
      profile,
      serviceRequests,
      primaryRequest,
      visaOrders,
      primaryOrder,
      operationalStage,
      stageHistory: (historyResult.data ?? []) as CrmStageHistory[],
      events: (eventsResult.data ?? []) as CrmEvent[],
      followups: (followupsResult.data ?? []) as CrmFollowup[],
      messages: (messagesResult.data ?? []) as CrmMessage[],
      srDocuments: (srDocumentsResult.data ?? []) as CrmDocument[],
      identityFiles: (identityResult.data ?? []) as CrmIdentityFile[],
    },
    error: null,
  };
}
