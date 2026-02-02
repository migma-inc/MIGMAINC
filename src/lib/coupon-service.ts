import { supabase } from '@/lib/supabase';

export interface Coupon {
    id: string;
    code: string;
    description: string | null;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    max_uses: number | null;
    current_uses: number;
    valid_from: string;
    valid_until: string | null;
    is_active: boolean;
    created_at: string;
}

export interface CouponFormData {
    code: string;
    description?: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    max_uses?: number;
    valid_from: string;
    valid_until?: string;
    is_active: boolean;
}

export const getCoupons = async (): Promise<Coupon[]> => {
    const { data, error } = await supabase
        .from('promotional_coupons')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createCoupon = async (coupon: CouponFormData): Promise<Coupon> => {
    // Normalize code to uppercase
    const normalizedCoupon = {
        ...coupon,
        code: coupon.code.toUpperCase().trim(),
    };

    const { data, error } = await supabase
        .from('promotional_coupons')
        .insert(normalizedCoupon)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const toggleCouponStatus = async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
        .from('promotional_coupons')
        .update({ is_active: isActive })
        .eq('id', id);

    if (error) throw error;
};

export const deleteCoupon = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('promotional_coupons')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const updateCoupon = async (id: string, coupon: Partial<CouponFormData>): Promise<Coupon> => {
    const normalizedCoupon = {
        ...coupon,
        code: coupon.code ? coupon.code.toUpperCase().trim() : undefined,
    };

    const { data, error } = await supabase
        .from('promotional_coupons')
        .update(normalizedCoupon)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export interface CouponUsage {
    id: string;
    order_number: string;
    client_name: string;
    client_email: string;
    product_slug: string;
    created_at: string;
    discount_amount: number;
    total_price_usd: number;
    payment_method?: string;
}

export const getCouponUsage = async (couponCode: string): Promise<CouponUsage[]> => {
    const { data, error } = await supabase
        .from('visa_orders')
        .select(`
            id,
            order_number,
            client_name,
            client_email,
            product_slug,
            created_at,
            discount_amount,
            total_price_usd,
            payment_method
        `)
        .eq('coupon_code', couponCode)
        .neq('payment_status', 'cancelled') // Opcional: filtrar cancelados se desejar apenas usos efetivos
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};
