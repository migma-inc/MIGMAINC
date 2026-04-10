import { supabase } from '@/lib/supabase';

const UPSELL_BASE_PRICES: Record<string, number> = {
  'canada-tourist-premium': 399,
  'canada-tourist-revolution': 199,
};

type ServiceRequestCandidate = {
  id: string;
  dependents_count: number | null;
  payment_method: string | null;
  status: string | null;
  created_at: string;
};

type VisaOrderCandidate = {
  id: string;
  order_number: string;
  seller_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_whatsapp?: string | null;
  client_country?: string | null;
  client_nationality?: string | null;
  client_observations?: string | null;
  service_request_id?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  base_price_usd?: string | number | null;
  price_per_dependent_usd?: string | number | null;
  extra_unit_price_usd?: string | number | null;
  extra_unit_label?: string | null;
  extra_units?: number | null;
  dependent_names?: string[] | null;
  upsell_product_slug?: string | null;
  upsell_price_usd?: string | number | null;
  payment_metadata?: Record<string, unknown> | null;
};

type MigmaPaymentLike = {
  metadata?: Record<string, unknown> | null;
};

type OrderAddonLike = {
  extra_units?: number | null;
  dependent_names?: string[] | null;
  upsell_product_slug?: string | null;
  payment_metadata?: {
    upsell_details?: {
      slug?: string | null;
    } | null;
  } | null;
};

export function getExplicitMigmaUpsell(payment: MigmaPaymentLike) {
  const metadata = payment?.metadata || null;
  const slug = typeof metadata?.upsell_product_slug === 'string'
    ? metadata.upsell_product_slug
    : null;

  if (!slug) {
    return {
      upsellProductSlug: null,
      upsellPriceUsd: null,
    };
  }

  const rawPrice = Number(metadata?.upsell_price_usd ?? UPSELL_BASE_PRICES[slug] ?? 0);

  return {
    upsellProductSlug: slug,
    upsellPriceUsd: rawPrice > 0 ? rawPrice : null,
  };
}

export async function resolveMigmaOrderLink(clientId: string, productSlug: string, explicitServiceRequestId?: string | null) {
  let matchedServiceRequest: ServiceRequestCandidate | null = null;
  let resolution: 'explicit' | 'single_zelle' | 'single_candidate' | 'ambiguous' | 'not_found' = 'not_found';

  if (explicitServiceRequestId) {
    const { data } = await supabase
      .from('service_requests')
      .select('id, dependents_count, payment_method, status, created_at')
      .eq('id', explicitServiceRequestId)
      .maybeSingle();

    if (data) {
      matchedServiceRequest = data;
      resolution = 'explicit';
    }
  }

  if (!matchedServiceRequest) {
    const { data: serviceRequests } = await supabase
      .from('service_requests')
      .select('id, dependents_count, payment_method, status, created_at')
      .eq('client_id', clientId)
      .eq('service_id', productSlug)
      .order('created_at', { ascending: false })
      .limit(5);

    const candidates = serviceRequests || [];
    const zelleCandidates = candidates.filter((candidate) => candidate.payment_method === 'zelle');

    if (zelleCandidates.length === 1) {
      matchedServiceRequest = zelleCandidates[0];
      resolution = 'single_zelle';
    } else if (candidates.length === 1) {
      matchedServiceRequest = candidates[0];
      resolution = 'single_candidate';
    } else if (candidates.length > 1) {
      resolution = 'ambiguous';
    }
  }

  let sourceOrder: VisaOrderCandidate | null = null;

  if (matchedServiceRequest?.id) {
    const { data: relatedOrders } = await supabase
      .from('visa_orders')
      .select(`
        id,
        order_number,
        seller_id,
        client_name,
        client_email,
        client_whatsapp,
        client_country,
        client_nationality,
        client_observations,
        service_request_id,
        payment_method,
        payment_status,
        base_price_usd,
        price_per_dependent_usd,
        extra_unit_price_usd,
        extra_unit_label,
        extra_units,
        dependent_names,
        upsell_product_slug,
        upsell_price_usd,
        payment_metadata
      `)
      .eq('service_request_id', matchedServiceRequest.id)
      .eq('product_slug', productSlug)
      .order('created_at', { ascending: false });

    if (relatedOrders && relatedOrders.length > 0) {
      sourceOrder = relatedOrders.find((order) => order.payment_status === 'pending') || relatedOrders[0];
    }
  }

  return {
    matchedServiceRequest,
    sourceOrder,
    resolution,
  };
}

export function getOrderAddonLabel(order: OrderAddonLike) {
  const upsellSlug = order.upsell_product_slug || order.payment_metadata?.upsell_details?.slug || null;
  if (upsellSlug) {
    return `+ ${upsellSlug.replace(/-/g, ' ')}`;
  }

  const extraUnits = Number(order.extra_units || 0);
  if (extraUnits > 0) {
    return `+ ${extraUnits} dependent${extraUnits > 1 ? 's' : ''}`;
  }

  const dependentCount = Array.isArray(order.dependent_names) ? order.dependent_names.length : 0;
  if (dependentCount > 0) {
    return `+ ${dependentCount} dependent${dependentCount > 1 ? 's' : ''}`;
  }

  return null;
}
