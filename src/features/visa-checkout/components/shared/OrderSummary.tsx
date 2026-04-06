import type { VisaProduct } from '@/types/visa-product';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, DollarSign, Lock, CheckCircle } from 'lucide-react';
import { isParcelowMethod } from '../../types/form.types';
import type { SplitPaymentConfig } from '../steps/step3/SplitPaymentSelector';

interface OrderSummaryProps {
    product: VisaProduct;
    extraUnits: number | null;
    totalWithFees: number;
    paymentMethod: string;
    splitPaymentConfig?: SplitPaymentConfig | null;
    showPaymentButton?: boolean;
    isPaymentReady?: boolean;
    isSubmitting?: boolean;
    onPay?: () => void;
    selectedUpsell?: 'none' | 'canada-premium' | 'canada-revolution';

    upsellPrice?: number;
    discountAmount?: number;
    appliedCouponCode?: string | null;
    checkoutButtonRef?: React.RefObject<HTMLDivElement | null>;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
    product,
    extraUnits,
    totalWithFees,
    paymentMethod,
    splitPaymentConfig,
    showPaymentButton,
    isPaymentReady,
    isSubmitting,
    onPay,
    selectedUpsell = 'none',
    upsellPrice = 0,
    discountAmount = 0,
    appliedCouponCode,
    checkoutButtonRef
}) => {
    const { t } = useTranslation();
    const basePrice = parseFloat(product.base_price_usd);
    const extraUnitPrice = parseFloat(product.extra_unit_price);
    const splitEnabled = Boolean(splitPaymentConfig?.enabled && isParcelowMethod(paymentMethod as any));

    console.log('[OrderSummary] Render:', { paymentMethod, isPaymentReady, isSubmitting });

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 lg:sticky lg:top-4">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">{t('checkout.order_summary', 'Order Summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="space-y-2">
                    {product.calculation_type === 'base_plus_units' && (
                        <>
                            <div className="flex justify-between text-xs sm:text-sm">
                                <span className="text-gray-400">{t('checkout.base_price', 'Base Price')}</span>
                                <span className="text-white">US$ {basePrice.toFixed(2)}</span>
                            </div>
                            {extraUnits !== null && extraUnits > 0 && product.allow_extra_units && (
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-gray-400">{product.extra_unit_label} ({extraUnits})</span>
                                    <span className="text-white">US$ {(extraUnits * extraUnitPrice).toFixed(2)}</span>
                                </div>
                            )}
                        </>
                    )}

                    {selectedUpsell !== 'none' && upsellPrice > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-left-2">
                            <span className="text-gold-light font-medium italic">
                                Bundle: {selectedUpsell === 'canada-premium' ? 'Canada Premium' : 'Canada Revolution'}
                            </span>
                            <span className="text-white">US$ {upsellPrice.toFixed(2)}</span>
                        </div>
                    )}
                    {product.calculation_type === 'units_only' && (
                        <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400">{t('checkout.number_of_applicants', 'Number of applicants')} ({extraUnits || 0})</span>
                            <span className="text-white">US$ {((extraUnits || 0) * extraUnitPrice).toFixed(2)}</span>
                        </div>
                    )}

                    {discountAmount > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-left-2">
                            <span className="text-green-400 font-medium">
                                {t('checkout.discount', 'Discount')} ({appliedCouponCode})
                            </span>
                            <span className="text-green-400">- US$ {discountAmount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="border-t border-gold-medium/30 pt-2 mt-2">
                        <div className="flex justify-between">
                            <span className="text-white font-bold text-sm sm:text-base">{t('checkout.total', 'Total')}</span>
                            <span className="text-xl sm:text-2xl font-bold text-gold-light">
                                US$ {totalWithFees.toFixed(2)}
                            </span>
                        </div>
                        {splitEnabled && splitPaymentConfig && (
                            <div className="mt-3 rounded-lg border border-gold-medium/30 bg-gold-medium/10 p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                                    <span className="text-gold-light font-semibold">
                                        {t('checkout.split.total_label', 'Split total')}
                                    </span>
                                    <span className="text-white font-bold">
                                        US$ {totalWithFees.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                                    <span className="text-gold-light font-semibold">
                                        {t('checkout.split.first_part_label', 'First payment now')}
                                    </span>
                                    <span className="text-white font-bold">
                                        US$ {splitPaymentConfig.part1_amount.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-gray-300 leading-relaxed">
                                    {t(
                                        'checkout.split.first_part_method',
                                        'Selected method for the first payment: {{method}}',
                                        { method: splitPaymentConfig.part1_method.toUpperCase() }
                                    )}
                                </p>
                            </div>
                        )}
                        {isParcelowMethod(paymentMethod as any) && (
                            <div className="bg-gold-dark/10 border border-gold-medium/30 rounded-md p-2 mt-2">
                                <p className="text-[10px] sm:text-xs text-gray-300 leading-relaxed">
                                    ⚠️ <strong className="text-gold-light">{t('checkout.note', 'Note')}:</strong> {t('checkout.parcelow_note', 'Final amount will be calculated by Parcelow at checkout, including:')}
                                </p>
                                <ul className="text-[9px] sm:text-[10px] text-gray-400 mt-1 ml-3 list-disc list-inside">
                                    <li>{t('checkout.processing_fees', 'Processing fees')}</li>
                                    <li>{t('checkout.exchange_rate_fluctuations', 'Exchange rate fluctuations (real-time quote)')}</li>
                                    <li>{t('checkout.discounts_installments', 'Discounts (Pix/TED) or installment fees')}</li>
                                </ul>
                            </div>
                        )}

                        {(paymentMethod === 'card' || paymentMethod === 'pix') && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-md p-2 mt-2">
                                <p className="text-[10px] sm:text-xs text-blue-200/70 leading-relaxed italic text-center">
                                    {t('checkout.stripe_fee_notice', '* Processing and management fees included in the total.')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {showPaymentButton && onPay && (
                    <div ref={checkoutButtonRef} className="pt-4 animate-in fade-in slide-in-from-bottom-2 hidden lg:block">
                        <Button
                            onClick={onPay}
                            disabled={!isPaymentReady || isSubmitting}
                            className={`w-full font-bold min-h-12 h-auto py-3 px-2 text-sm sm:text-base whitespace-normal leading-tight ${isParcelowMethod(paymentMethod as any)
                                ? '!bg-[#22c55e] hover:!bg-[#16a34a] text-white'
                                : 'bg-gold-medium hover:bg-gold-light text-black'
                                }`}
                        >
                            {isSubmitting ? (
                                t('checkout.processing', 'Processing...')
                            ) : (
                                <div className="flex items-center justify-center gap-2 w-full">
                                    {isParcelowMethod(paymentMethod as any) ? (
                                        <>
                                            <CreditCard className="w-5 h-5 flex-shrink-0" />
                                            <span>{t('checkout.pay_with_parcelow', 'Pay with Parcelow')}</span>
                                        </>
                                    ) : paymentMethod === 'zelle' ? (
                                        <>
                                            <DollarSign className="w-5 h-5 flex-shrink-0" />
                                            <span>{t('checkout.confirm_zelle_payment', 'Confirm Zelle Payment')}</span>
                                        </>
                                    ) : paymentMethod === 'manual' ? (
                                        <>
                                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                            <span>{t('checkout.confirm_sign_contract', 'Confirm & Sign Contract')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-5 h-5 flex-shrink-0" />
                                            <span>{t('checkout.pay_now', 'Pay Now')}</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </Button>
                        <div className="flex items-center justify-center gap-2 mt-3 opacity-60">
                            {paymentMethod === 'manual' ? (
                                <span className="text-[10px] text-gray-400">{t('checkout.legally_verified', 'Verificado juridicamente')}</span>
                            ) : (
                                <>
                                    <Lock className="w-3 h-3 text-gold-light" />
                                    <span className="text-[10px] text-gray-400">{t('checkout.secure_payment', '100% Secure Payment')}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
