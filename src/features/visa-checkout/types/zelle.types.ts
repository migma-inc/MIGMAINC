// Zelle Payment Types
export interface ZellePaymentRequest {
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
    payment_method: 'zelle';
    contract_document_url: string;
    contract_selfie_url: string;
    signature_image_url: string;
    service_request_id: string;
    ip_address: string;
    contract_accepted: boolean;
    contract_signed_at: string;
    contract_template_id?: string | null;
    zelle_receipt_url: string; // Unique to Zelle
}

export interface ZellePaymentResponse {
    success: boolean;
    order_id: string;
    message?: string;
    status: 'approved' | 'pending_verification' | 'rejected';
}
