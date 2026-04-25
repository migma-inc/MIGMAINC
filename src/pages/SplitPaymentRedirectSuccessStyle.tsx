import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CheckCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export const SplitPaymentRedirectSuccessStyle = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(10);
    const [splitPayment, setSplitPayment] = useState<any>(null);
    const [nextCheckoutUrl, setNextCheckoutUrl] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollAttempt, setPollAttempt] = useState(0);

    const splitPaymentIdFromQuery = searchParams.get('split_payment_id');
    const storedSplitPaymentId = typeof window !== 'undefined' ? sessionStorage.getItem('last_split_payment_id') : null;
    const isUuid = (value: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const splitPaymentId = isUuid(splitPaymentIdFromQuery) ? splitPaymentIdFromQuery : storedSplitPaymentId;
    const isSplitReturn = searchParams.get('split_return') === '1';
    const returnedPart = searchParams.get('part');

    useEffect(() => {
        if (!splitPaymentId) {
            setError('Split Payment ID não encontrado');
            setLoading(false);
            return;
        }

        void fetchSplitPaymentStatus();
    }, [splitPaymentId, isSplitReturn, returnedPart]);

    useEffect(() => {
        if (!isPolling || !splitPaymentId) return;

        if (pollAttempt >= 10) {
            setIsPolling(false);
            setError('Ainda estamos aguardando a confirmação do pagamento. Tente verificar novamente em alguns segundos.');
            return;
        }

        const timer = setTimeout(() => {
            setPollAttempt((prev) => prev + 1);
            void fetchSplitPaymentStatus();
        }, 2000);

        return () => clearTimeout(timer);
    }, [isPolling, pollAttempt, splitPaymentId]);

    const fetchSplitPaymentStatus = async () => {
        try {
            const { data: split, error: splitError } = await supabase
                .from('split_payments')
                .select('*')
                .eq('id', splitPaymentId)
                .single();

            if (splitError || !split) {
                throw new Error('Split payment não encontrado');
            }

            sessionStorage.setItem('last_split_payment_id', split.id);
            setSplitPayment(split);
            setError(null);
            handleSplitState(split);
        } catch (err: any) {
            setError(err.message || 'Erro ao buscar status do pagamento');
            setLoading(false);
        }
    };

    const handleSplitState = (split: any) => {
        if (split.overall_status === 'fully_completed') {
            setIsPolling(false);
            setLoading(false);
            setTimeout(() => {
                if (split.source === 'migma') {
                    const service = split.migma_service_type || 'transfer';
                    navigate(`/student/checkout/${service}?success=true`);
                } else if (split.source === 'placement_fee') {
                    navigate(`/student/onboarding?step=placement_fee&success=true&application_id=${split.application_id}`);
                } else {
                    navigate(`/checkout/success?order_id=${split.order_id}&method=parcelow_split`);
                }
            }, 2000);
            return;
        }

        if (isSplitReturn && returnedPart === '1' && split.part1_payment_status !== 'completed') {
            setLoading(false);
            setIsPolling(true);
            return;
        }

        if (isSplitReturn && returnedPart === '2' && split.part2_payment_status !== 'completed') {
            setLoading(false);
            setIsPolling(true);
            return;
        }

        if (split.part1_payment_status === 'completed' && split.part2_payment_status !== 'completed') {
            setIsPolling(false);
            setLoading(false);

            // Proteção anti-loop: se a URL da P2 for a mesma da P1, o checkout já foi pago
            // e Parcelow vai redirecionar de volta para P1 success URL → loop infinito.
            if (
                split.part2_parcelow_checkout_url &&
                split.part2_parcelow_checkout_url === split.part1_parcelow_checkout_url
            ) {
                console.error('[SplitRedirect] ⚠️ part2_parcelow_checkout_url = part1_parcelow_checkout_url. Dados corrompidos!');
                setError(
                    'Erro interno: o link do segundo pagamento está incorreto. Entre em contato com suporte para resolver. (SPLIT-URL-CONFLICT)'
                );
                return;
            }

            // Se o Parcelow order ID da P2 for o mesmo da P1, mesma situação
            if (
                split.part2_parcelow_order_id &&
                split.part2_parcelow_order_id === split.part1_parcelow_order_id
            ) {
                console.error('[SplitRedirect] ⚠️ part2_parcelow_order_id = part1_parcelow_order_id. Dados corrompidos!');
                setError(
                    'Erro interno: o pedido do segundo pagamento está incorreto. Entre em contato com suporte. (SPLIT-ORDER-CONFLICT)'
                );
                return;
            }

            startCountdown(split.part2_parcelow_checkout_url, 10);
            return;
        }

        if (split.part1_payment_status !== 'completed') {
            setIsPolling(false);
            setLoading(false);
            startCountdown(split.part1_parcelow_checkout_url, 3);
            return;
        }

        setIsPolling(false);
        setLoading(false);
    };

    const startCountdown = (url: string, initialCount: number) => {
        if (!url) {
            setError('URL do próximo pagamento não encontrada');
            return;
        }

        setNextCheckoutUrl(url);
        let count = initialCount;
        setCountdown(count);

        const interval = setInterval(() => {
            count--;
            setCountdown(count);

            if (count === 0) {
                clearInterval(interval);
                window.location.href = url;
            }
        }, 1000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-gold-medium animate-spin mx-auto mb-6" />
                    <p className="text-gray-400">Verificando o status do pagamento dividido...</p>
                </div>
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
                        <div className="flex flex-col gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setError(null);
                                    setPollAttempt(0);
                                    setLoading(true);
                                    void fetchSplitPaymentStatus();
                                }}
                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors"
                            >
                                Verificar Novamente
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="px-6 py-3 bg-gold-medium text-black font-bold rounded-lg hover:bg-gold-light transition-colors"
                            >
                                Voltar para Início
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 py-12">
            <Card className="max-w-2xl w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardContent className="p-8 text-center">
                    <div className="flex justify-end mb-4">
                        <LanguageSelector />
                    </div>

                    <div className="mb-6">
                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold migma-gold-text mb-2">
                            Pagamento Bem-sucedido!
                        </h1>
                        <p className="text-gray-300">
                            A primeira parte do pagamento foi processada com sucesso.
                        </p>
                    </div>

                    {splitPayment && (
                        <div className="bg-black/50 rounded-lg p-6 mb-6 text-left border border-white/5">
                            <h2 className="text-xl font-bold text-gold-light mb-4 flex items-center gap-2">
                                Resumo do Pedido
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded uppercase tracking-tighter">
                                    SPLIT PAYMENT
                                </span>
                            </h2>

                            <div className="space-y-4 text-sm">
                                <div className="space-y-2 pb-4 border-b border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Referência do Pedido:</span>
                                        <span className="text-white font-mono font-medium">{splitPayment.order_id}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Preço Total:</span>
                                        <span className="text-white font-bold text-lg">US$ {parseFloat(splitPayment.total_amount_usd).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <h3 className="text-gold-light/60 text-[10px] font-bold uppercase tracking-widest pl-1">
                                        DISTRIBUIÇÃO DO PAGAMENTO
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/30">
                                            <div className="flex flex-col h-full justify-between gap-1">
                                                <span className="text-gray-400 text-[10px] font-bold uppercase">
                                                    PARTE 1 ({splitPayment.part1_payment_method})
                                                </span>
                                                <span className="text-white font-bold text-base">
                                                    US$ {parseFloat(splitPayment.part1_amount_usd).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] font-bold mt-1 text-green-400">
                                                    ✓ PAGO
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-lg border bg-white/5 border-white/10">
                                            <div className="flex flex-col h-full justify-between gap-1">
                                                <span className="text-gray-400 text-[10px] font-bold uppercase">
                                                    PARTE 2 ({splitPayment.part2_payment_method})
                                                </span>
                                                <span className="text-white font-bold text-base">
                                                    US$ {parseFloat(splitPayment.part2_amount_usd).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] font-bold mt-1 text-gray-400">
                                                    ○ PENDENTE
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {isPolling && (
                                        <p className="text-xs text-blue-400 font-medium pt-4">
                                            Confirmando o retorno da Parcelow. Tentativa {pollAttempt + 1} de 10.
                                        </p>
                                    )}

                                    {nextCheckoutUrl && !isPolling && (
                                        <div className="pt-4 flex flex-col items-center gap-3">
                                            <div className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-5 text-center">
                                                <p className="text-xs text-blue-300 font-semibold uppercase tracking-widest">
                                                    Redirecionando para a Parte 2
                                                </p>
                                                <div className="mt-2 text-5xl font-bold text-blue-400">
                                                    {countdown}
                                                </div>
                                                <p className="mt-2 text-xs text-blue-200/80">
                                                    segundos
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => window.location.href = nextCheckoutUrl}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-tight py-6"
                                            >
                                                Pagar Parte 2 Agora
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 mt-8">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-300">
                                Seu progresso foi salvo. Assim que a Parte 2 for concluída, o pedido será finalizado.
                            </p>
                            <p className="text-sm text-gray-400">
                                Você será redirecionado automaticamente para completar a segunda parte do pagamento.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <Button
                                variant="ghost"
                                onClick={() => navigate('/')}
                                className="text-gold-light font-bold hover:bg-gold-light/10"
                            >
                                Voltar para Início
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
