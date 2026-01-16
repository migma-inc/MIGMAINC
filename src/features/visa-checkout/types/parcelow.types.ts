// Parcelow Payment Types
export interface ParcelowCheckoutData {
    checkout_url: string;
    total_usd: number;
    total_brl: number;
    order_amount: number;
    order_id: string;
}

export interface ParcelowCheckoutRequest {
    order_id: string;
    currency: 'USD' | 'BRL';
}

export interface ParcelowCheckoutResponse {
    success: boolean;
    checkout_url: string;
    total_usd: number;
    total_brl: number;
    order_amount: number;
    order_id: string;
}

export interface ParcelowOrder {
    id: string;
    reference: string;
    order_amount: number;
    total_usd: number;
    total_brl: number;
    status_text: string;
    status: number;
    checkout_url: string;
}
