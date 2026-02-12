import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Ticket, CheckCircle, XCircle } from 'lucide-react';
import type { VisaCheckoutActions } from '../../../types/form.types';

interface CouponSectionProps {
    actions: VisaCheckoutActions;
    couponCode: string;
    appliedCoupon: {
        code: string;
        discountType: 'fixed' | 'percentage';
        discountValue: number;
    } | null;
    serviceRequestId: string;
    clientName: string;
    clientEmail: string;
    productSlug: string;
    onRemove?: () => void;
}

export const CouponSection = ({
    actions,
    couponCode,
    appliedCoupon,
    serviceRequestId,
    clientName,
    clientEmail,
    productSlug,
    onRemove
}: CouponSectionProps) => {
    const { t } = useTranslation();
    const [localCode, setLocalCode] = useState(couponCode);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Sync localCode with prop (for draft recovery)
    useEffect(() => {
        if (couponCode && !localCode) {
            setLocalCode(couponCode);
        }
    }, [couponCode]);

    // Verify if the recovered coupon is still valid in the database
    useEffect(() => {
        const verifyCouponIntegrity = async () => {
            if (!serviceRequestId || !couponCode) return;

            try {
                const { data, error } = await supabase
                    .from('visa_orders')
                    .select('coupon_code')
                    .eq('service_request_id', serviceRequestId)
                    .maybeSingle();

                if (error) throw error;

                // If no record found OR coupon_code in DB is different/null
                if (!data || data.coupon_code !== couponCode) {
                    // console.log('Coupon integrity check failed, clearing local state');
                    actions.setAppliedCoupon(null);
                    actions.setCouponCode('');
                    setLocalCode('');
                    setMessage(null);
                    if (onRemove) onRemove();
                }
            } catch (err) {
                console.error('Failed to verify coupon integrity:', err);
            }
        };

        verifyCouponIntegrity();
    }, [serviceRequestId, couponCode]);

    // Real-time synchronization: if admin or system removes usage, clear it here
    useEffect(() => {
        if (!serviceRequestId) return;

        const channel = supabase
            .channel(`sync-coupon-${serviceRequestId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visa_orders',
                    filter: `service_request_id=eq.${serviceRequestId}`
                },
                (payload) => {
                    const event = payload.eventType;
                    const isRemoved = event === 'DELETE' || (event === 'UPDATE' && !(payload.new as any)?.coupon_code);

                    if (isRemoved) {
                        actions.setAppliedCoupon(null);
                        actions.setCouponCode('');
                        setLocalCode('');
                        setMessage(null);
                        if (onRemove) onRemove();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [serviceRequestId, onRemove]);

    const translateDBMessage = (dbMessage: string) => {
        if (!dbMessage) return null;

        const map: Record<string, string> = {
            'Cupom inválido ou inativo.': 'checkout.coupon.invalid',
            'Este cupom ainda não é válido.': 'checkout.coupon.not_yet_valid',
            'Este cupom expirou.': 'checkout.coupon.expired',
            'Limite de uso deste cupom atingido.': 'checkout.coupon.limit_reached',
            'Cupom aplicado com sucesso!': 'checkout.coupon.applied_success',
            'Cupom aplicado!': 'checkout.coupon.applied_success'
        };

        const key = map[dbMessage];
        return key ? t(key) : dbMessage;
    };

    const registerCouponIntent = async (code: string | null, discountVal: number = 0) => {
        if (!serviceRequestId) return;

        try {
            const { error } = await supabase.rpc('register_visa_order_intent', {
                p_service_request_id: serviceRequestId,
                p_coupon_code: code,
                p_discount_amount: discountVal,
                p_client_name: clientName,
                p_client_email: clientEmail,
                p_product_slug: productSlug
            });

            if (error) console.error('Error registering coupon intent via RPC:', error);
        } catch (err) {
            console.error('Failed to register coupon intent:', err);
        }
    };

    const handleApply = async () => {
        if (!localCode) return;

        setLoading(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.rpc('validate_promotional_coupon', {
                p_code: localCode
            });

            if (error) throw error;

            if (data && data.valid) {
                // UPDATE: Register intent in DB immediately
                await registerCouponIntent(data.code, data.value);

                actions.setAppliedCoupon({
                    code: data.code,
                    discountType: data.type,
                    discountValue: data.value
                });
                actions.setCouponCode(data.code);

                const translatedMsg = translateDBMessage(data.message) || t('checkout.coupon.applied_success');
                setMessage({ text: translatedMsg, type: 'success' });
            } else {
                const translatedMsg = translateDBMessage(data?.message) || t('checkout.coupon.invalid');
                setMessage({ text: translatedMsg, type: 'error' });
                actions.setAppliedCoupon(null);
            }
        } catch (err) {
            console.error('Coupon error:', err);
            setMessage({ text: t('checkout.coupon.error_validate'), type: 'error' });
            actions.setAppliedCoupon(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!appliedCoupon) return;

        setLoading(true);
        try {
            // UPDATE: Remove intent from DB immediately
            await registerCouponIntent(null, 0);

            actions.setAppliedCoupon(null);
            actions.setCouponCode('');
            setLocalCode('');
            setMessage(null);
        } catch (err) {
            console.error('Error removing coupon:', err);
            setMessage({ text: t('checkout.coupon.error_remove'), type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-gold-medium" />
                {t('checkout.coupon.title')}
            </h3>

            <div className="flex gap-2">
                <Input
                    value={localCode}
                    onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                    placeholder={t('checkout.coupon.placeholder')}
                    className="bg-black/50 border-gold-medium/30 text-white uppercase placeholder:normal-case placeholder:text-gray-500"
                    disabled={!!appliedCoupon || loading}
                />

                {appliedCoupon ? (
                    <Button
                        variant="outline"
                        onClick={handleRemove}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                        {t('checkout.coupon.remove')}
                    </Button>
                ) : (
                    <Button
                        onClick={handleApply}
                        disabled={!localCode || loading}
                        className="bg-gold-medium text-black hover:bg-gold-light font-medium"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('checkout.coupon.apply')}
                    </Button>
                )}
            </div>

            {message && (
                <div className={`text-xs flex items-center gap-1.5 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                        <XCircle className="w-3.5 h-3.5" />
                    )}
                    {message.text}
                </div>
            )}
        </div>
    );
};
