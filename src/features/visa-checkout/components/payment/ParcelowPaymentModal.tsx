import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ParcelowCheckoutData } from '../../types/parcelow.types';
import { ParcelowService } from '../../services/payment/parcelowService';

interface ParcelowPaymentModalProps {
    checkoutData: ParcelowCheckoutData;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Parcelow Payment Confirmation Modal
 * Shows breakdown of payment amounts before redirecting to Parcelow
 */
export function ParcelowPaymentModal({
    checkoutData,
    onConfirm,
    onCancel,
}: ParcelowPaymentModalProps) {
    const baseAmount = ParcelowService.formatAmount(checkoutData.order_amount || 0);
    const totalUsd = ParcelowService.formatAmount(checkoutData.total_usd);
    const totalBrl = ParcelowService.formatAmount(checkoutData.total_brl);
    const fees = ParcelowService.formatAmount(
        ParcelowService.calculateFees(checkoutData.total_usd, checkoutData.order_amount || 0)
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 animate-fade-in">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold migma-gold-text text-center">
                        Confirme o Valor do Pagamento
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Summary Box */}
                    <div className="bg-black/50 rounded-lg p-6 border border-gold-medium/20">
                        <h3 className="text-lg font-semibold text-gold-light mb-4">
                            Resumo do Pagamento
                        </h3>

                        <div className="space-y-3">
                            {/* Base Amount */}
                            <div className="flex justify-between items-center pb-2 border-b border-gray-700/50">
                                <span className="text-gray-400">Valor do Serviço:</span>
                                <span className="text-white font-mono">US$ {baseAmount}</span>
                            </div>

                            {/* Fees */}
                            {checkoutData.order_amount && (
                                <div className="flex justify-between items-center pb-2 border-b border-gray-700/50">
                                    <span className="text-gray-400">
                                        Taxas Parcelow (IOF + Processamento):
                                    </span>
                                    <span className="text-gold-light font-mono">+ US$ {fees}</span>
                                </div>
                            )}

                            {/* Total USD (highlighted) */}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xl font-bold text-white">TOTAL (USD):</span>
                                <span className="text-2xl font-bold migma-gold-text font-mono">
                                    US$ {totalUsd}
                                </span>
                            </div>

                            {/* Total BRL */}
                            {checkoutData.total_brl && (
                                <div className="flex justify-between items-center pt-1 text-sm">
                                    <span className="text-gray-500">Equivalente em Reais:</span>
                                    <span className="text-gray-300 font-mono">R$ {totalBrl}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="bg-gold-dark/10 border border-gold-medium/30 rounded-lg p-4">
                        <p className="text-sm text-gray-300">
                            ℹ️ <strong className="text-gold-light">Importante:</strong> Este é o
                            valor total que será cobrado no seu cartão de crédito, incluindo todas
                            as taxas de processamento internacional.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onCancel}
                            className="flex-1 border-gray-600 bg-black/50 text-white hover:bg-gray-800"
                        >
                            ← Cancelar
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className="flex-1 bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                        >
                            Confirmar e Pagar →
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
