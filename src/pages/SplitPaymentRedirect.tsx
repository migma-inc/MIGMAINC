import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const SplitPaymentRedirect = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(3);
    const [splitPayment, setSplitPayment] = useState<any>(null);
    const [nextCheckoutUrl, setNextCheckoutUrl] = useState<string | null>(null);

    const splitPaymentId = searchParams.get('split_payment_id');

    useEffect(() => {
        if (!splitPaymentId) {
            setError('Split Payment ID não encontrado');
            setLoading(false);
            return;
        }

        fetchSplitPaymentStatus();
    }, [splitPaymentId]);

    const fetchSplitPaymentStatus = async () => {
        try {
            console.log('[Split Redirect] 🔍 Buscando status do split payment...');

            // Buscar split payment
            const { data: split, error: splitError } = await supabase
                .from('split_payments')
                .select('*')
                .eq('id', splitPaymentId)
                .single();

            if (splitError || !split) {
                throw new Error('Split payment não encontrado');
            }

            console.log('[Split Redirect] ✅ Split payment encontrado:', split);
            setSplitPayment(split);

            // Verificar status
            if (split.overall_status === 'fully_completed') {
                console.log('[Split Redirect] 🎉 Pagamento completo! Redirecionando para sucesso...');
                setTimeout(() => {
                    navigate(`/checkout/success?order_id=${split.order_id}&method=parcelow_split`);
                }, 2000);
                setLoading(false);
                return;
            }

            // Se Part 1 ainda não foi paga, redirecionar para Part 1
            if (split.part1_payment_status !== 'completed') {
                console.log('[Split Redirect] ⏳ Part 1 ainda não foi paga, redirecionando...');
                setNextCheckoutUrl(split.part1_parcelow_checkout_url);
                setLoading(false);
                startCountdown(split.part1_parcelow_checkout_url);
                return;
            }

            // Se Part 1 paga mas Part 2 não, redirecionar para Part 2
            if (split.part1_payment_status === 'completed' && split.part2_payment_status !== 'completed') {
                console.log('[Split Redirect] ✅ Part 1 paga! Redirecionando para Part 2...');
                setNextCheckoutUrl(split.part2_parcelow_checkout_url);
                setLoading(false);
                startCountdown(split.part2_parcelow_checkout_url);
                return;
            }

            setLoading(false);
        } catch (err: any) {
            console.error('[Split Redirect] ❌ Erro:', err);
            setError(err.message || 'Erro ao buscar status do pagamento');
            setLoading(false);
        }
    };

    const startCountdown = (url: string) => {
        let count = 3;
        setCountdown(count);

        const interval = setInterval(() => {
            count--;
            setCountdown(count);

            if (count === 0) {
                clearInterval(interval);
                console.log('[Split Redirect] 🚀 Redirecionando para:', url);
                window.location.href = url;
            }
        }, 1000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
                <Card className="bg-black/40 border-gold-medium/30 max-w-md w-full">
                    <CardContent className="p-8 text-center space-y-4">
                        <Loader2 className="h-12 w-12 text-gold-medium animate-spin mx-auto" />
                        <h2 className="text-2xl font-bold text-gold-light">
                            Verificando Status do Pagamento...
                        </h2>
                        <p className="text-gold-light/70">
                            Aguarde enquanto verificamos o status do seu pagamento dividido.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
                <Card className="bg-black/40 border-red-500/30 max-w-md w-full">
                    <CardContent className="p-8 text-center space-y-4">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-red-400">
                            Erro ao Processar Pagamento
                        </h2>
                        <p className="text-gold-light/70">{error}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-6 py-3 bg-gold-medium text-black font-bold rounded-lg hover:bg-gold-light transition-colors"
                        >
                            Voltar para Início
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isPart1Completed = splitPayment?.part1_payment_status === 'completed';
    const isPart2Pending = splitPayment?.part2_payment_status !== 'completed';

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
            <Card className="bg-black/40 border-gold-medium/30 max-w-md w-full">
                <CardContent className="p-8 text-center space-y-6">
                    {/* Success Icon */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gold-medium/20 blur-3xl rounded-full"></div>
                        <CheckCircle2 className="h-20 w-20 text-gold-medium mx-auto relative animate-pulse" />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-gold-light">
                            {isPart1Completed && isPart2Pending ? (
                                '✅ Primeira Parte Paga!'
                            ) : (
                                'Processando Pagamento...'
                            )}
                        </h2>
                        <p className="text-gold-light/70 text-lg">
                            {isPart1Completed && isPart2Pending ? (
                                'Agora vamos para a segunda parte do pagamento'
                            ) : (
                                'Aguarde enquanto processamos seu pagamento'
                            )}
                        </p>
                    </div>

                    {/* Payment Summary */}
                    {splitPayment && (
                        <div className="bg-gold-medium/10 border border-gold-medium/30 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gold-light/70">Parte 1:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gold-light font-semibold">
                                        ${parseFloat(splitPayment.part1_amount_usd).toFixed(2)}
                                    </span>
                                    {isPart1Completed ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <div className="h-5 w-5 border-2 border-gold-medium/30 rounded-full"></div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gold-light/70">Parte 2:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gold-light font-semibold">
                                        ${parseFloat(splitPayment.part2_amount_usd).toFixed(2)}
                                    </span>
                                    {splitPayment.part2_payment_status === 'completed' ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <div className="h-5 w-5 border-2 border-gold-medium/30 rounded-full"></div>
                                    )}
                                </div>
                            </div>
                            <div className="border-t border-gold-medium/30 pt-3 mt-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gold-light font-bold">Total:</span>
                                    <span className="text-gold-light font-bold text-xl">
                                        ${parseFloat(splitPayment.total_amount_usd).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Countdown */}
                    {nextCheckoutUrl && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-gold-light/70 mb-2">
                                    Redirecionando em
                                </p>
                                <div className="text-6xl font-bold text-gold-medium animate-pulse">
                                    {countdown}
                                </div>
                            </div>

                            <button
                                onClick={() => window.location.href = nextCheckoutUrl}
                                className="w-full px-6 py-3 bg-gold-medium text-black font-bold rounded-lg hover:bg-gold-light transition-colors"
                            >
                                Ir para Próximo Pagamento Agora
                            </button>
                        </div>
                    )}

                    {/* Info */}
                    <p className="text-gold-light/50 text-sm">
                        Você será redirecionado automaticamente para completar o pagamento.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
