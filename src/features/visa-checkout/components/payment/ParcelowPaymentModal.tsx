import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ParcelowCheckoutData } from '../../types/parcelow.types';
import { ParcelowService } from '../../services/payment/parcelowService';

interface ParcelowPaymentModalProps {
    checkoutData: ParcelowCheckoutData;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

/**
 * Parcelow Payment Confirmation Modal
 * Shows breakdown of payment amounts before redirecting to Parcelow
 */
export function ParcelowPaymentModal({
    checkoutData,
    onConfirm,
    onCancel,
    isLoading = false,
}: ParcelowPaymentModalProps) {
    const totalUsd = ParcelowService.formatAmount(checkoutData.total_usd);
    const totalBrl = ParcelowService.formatAmount(checkoutData.total_brl);


    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full bg-neutral-900 border border-gold-medium/30 animate-fade-in shadow-2xl">
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

                        <div className="space-y-4">

                            <div className="text-center py-4">
                                <span className="block text-gray-400 text-sm mb-1">Valor Estimado (USD)</span>
                                <span className="text-4xl font-bold migma-gold-text font-mono">
                                    US$ {totalUsd}
                                </span>

                                {checkoutData.total_brl && (
                                    <div className="mt-2 pt-2 border-t border-gray-700/30">
                                        <span className="block text-gray-500 text-xs mb-1">Aprox. no Cartão (BRL)</span>
                                        <span className="text-lg text-gray-300 font-mono">
                                            R$ {totalBrl}
                                        </span>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="bg-gold-dark/10 border border-gold-medium/30 rounded-lg p-4">
                        <div className="text-sm text-gray-300 leading-relaxed">
                            <span className="block mb-2">
                                ℹ️ <strong className="text-gold-light">Atenção:</strong> Ao prosseguir, você será redirecionado para o checkout seguro da Parcelow.
                            </span>

                            O valor final exato pode variar devido a:
                            <ul className="list-disc list-inside mt-1 ml-1 text-gray-400">
                                <li>Descontos para pagamentos à vista (Pix/TED)</li>
                                <li>Juros de parcelamento no cartão</li>
                                <li>Variações cambiais e taxas de processamento</li>
                            </ul>
                        </div>
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
                            disabled={isLoading}
                            className="flex-1 bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Processando...' : 'Confirmar e Pagar →'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
