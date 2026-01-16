// Stripe Payment Types
export interface StripeCheckoutRequest {
    product_slug: string;
    seller_id: string | null;
    extra_units: number;
    dependent_names: string[];
    client_name: string;
    client_email: string;
    client_whatsapp: string | null;
    client_country: string | null;
    client_nationality: string | null;
    client_observations: string | null;
    payment_method: 'card' | 'pix';
    exchange_rate?: number | null;
    contract_document_url: string;
    contract_selfie_url: string;
    signature_image_url: string;
    service_request_id: string;
    ip_address: string;
    contract_accepted: boolean;
    contract_signed_at: string;
    contract_template_id?: string | null;
}

export interface StripeCheckoutResponse {
    url: string;
    order_id: string;
}
