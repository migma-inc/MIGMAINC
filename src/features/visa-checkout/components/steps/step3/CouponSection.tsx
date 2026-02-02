import { useState } from 'react';
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
}

export const CouponSection = ({ actions, couponCode, appliedCoupon }: CouponSectionProps) => {
    const [localCode, setLocalCode] = useState(couponCode);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

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
                actions.setAppliedCoupon({
                    code: data.code,
                    discountType: data.type,
                    discountValue: data.value
                });
                actions.setCouponCode(data.code);
                setMessage({ text: data.message || 'Coupon applied!', type: 'success' });
            } else {
                setMessage({ text: data?.message || 'Invalid or inactive coupon.', type: 'error' });
                actions.setAppliedCoupon(null);
            }
        } catch (err) {
            console.error('Coupon error:', err);
            setMessage({ text: 'Error validating coupon.', type: 'error' });
            actions.setAppliedCoupon(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        actions.setAppliedCoupon(null);
        actions.setCouponCode('');
        setLocalCode('');
        setMessage(null);
    };

    return (
        <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-gold-medium" />
                Discount Coupon
            </h3>

            <div className="flex gap-2">
                <Input
                    value={localCode}
                    onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="bg-black/50 border-gold-medium/30 text-white uppercase placeholder:normal-case placeholder:text-gray-500"
                    disabled={!!appliedCoupon || loading}
                />

                {appliedCoupon ? (
                    <Button
                        variant="outline"
                        onClick={handleRemove}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                        Remove
                    </Button>
                ) : (
                    <Button
                        onClick={handleApply}
                        disabled={!localCode || loading}
                        className="bg-gold-medium text-black hover:bg-gold-light font-medium"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
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
