import type { VisaProduct } from '@/types/visa-product';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, DollarSign, Lock } from 'lucide-react';

interface OrderSummaryProps {
    product: VisaProduct;
    extraUnits: number;
    totalWithFees: number;
    paymentMethod: string;
    showPaymentButton?: boolean;
    isPaymentReady?: boolean;
    isSubmitting?: boolean;
    onPay?: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
    product,
    extraUnits,
    totalWithFees,
    paymentMethod,
    showPaymentButton,
    isPaymentReady,
    isSubmitting,
    onPay
}) => {
    const basePrice = parseFloat(product.base_price_usd);
    const extraUnitPrice = parseFloat(product.extra_unit_price);

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 lg:sticky lg:top-4">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="space-y-2">
                    {product.calculation_type === 'base_plus_units' && (
                        <>
                            <div className="flex justify-between text-xs sm:text-sm">
                                <span className="text-gray-400">Base Price</span>
                                <span className="text-white">US$ {basePrice.toFixed(2)}</span>
                            </div>
                            {extraUnits > 0 && product.allow_extra_units && (
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-gray-400">{product.extra_unit_label} ({extraUnits})</span>
                                    <span className="text-white">US$ {(extraUnits * extraUnitPrice).toFixed(2)}</span>
                                </div>
                            )}
                        </>
                    )}
                    {product.calculation_type === 'units_only' && (
                        <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400">Number of applicants ({extraUnits})</span>
                            <span className="text-white">US$ {(extraUnits * extraUnitPrice).toFixed(2)}</span>
                        </div>
                    )}

                    <div className="border-t border-gold-medium/30 pt-2 mt-2">
                        <div className="flex justify-between">
                            <span className="text-white font-bold text-sm sm:text-base">Total</span>
                            <span className="text-xl sm:text-2xl font-bold text-gold-light">
                                US$ {totalWithFees.toFixed(2)}
                            </span>
                        </div>
                        {paymentMethod === 'parcelow' && (
                            <div className="bg-gold-dark/10 border border-gold-medium/30 rounded-md p-2 mt-2">
                                <p className="text-[10px] sm:text-xs text-gray-300 leading-relaxed">
                                    ⚠️ <strong className="text-gold-light">Note:</strong> Final amount will be calculated by Parcelow at checkout, including:
                                </p>
                                <ul className="text-[9px] sm:text-[10px] text-gray-400 mt-1 ml-3 list-disc list-inside">
                                    <li>Processing fees</li>
                                    <li>Exchange rate fluctuations (real-time quote)</li>
                                    <li>Discounts (Pix/TED) or installment fees</li>
                                </ul>
                            </div>
                        )}
                        {/* STRIPE REMOVED - No longer using Stripe
                        {paymentMethod === 'pix' && exchangeRate && (
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                                Includes processing fee
                            </p>
                        )}
                        */}
                    </div>
                </div>

                {showPaymentButton && onPay && (
                    <div className="pt-4 animate-in fade-in slide-in-from-bottom-2 hidden lg:block">
                        <Button
                            onClick={onPay}
                            disabled={!isPaymentReady || isSubmitting}
                            className={`w-full font-bold h-12 text-sm sm:text-base ${paymentMethod === 'parcelow'
                                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
                                : 'bg-gold-medium hover:bg-gold-light text-black'
                                }`}
                        >
                            {isSubmitting ? (
                                'Processing...'
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    {paymentMethod === 'parcelow' ? (
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            Pay with Parcelow
                                        </>
                                    ) : paymentMethod === 'zelle' ? (
                                        <>
                                            <DollarSign className="w-5 h-5" />
                                            Confirm Zelle Payment
                                        </>
                                    ) : (
                                        /* STRIPE REMOVED - No longer using Stripe/Card payments
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            Pay Now
                                        </>
                                        */
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            Pay Now
                                        </>
                                    )}
                                </div>
                            )}
                        </Button>
                        <div className="flex items-center justify-center gap-2 mt-3 opacity-60">
                            <Lock className="w-3 h-3 text-gold-light" />
                            <span className="text-[10px] text-gray-400">100% Secure Payment</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
