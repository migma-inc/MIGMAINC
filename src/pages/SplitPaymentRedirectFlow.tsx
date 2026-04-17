import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const SplitPaymentRedirectFlow = () => {
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
                    // Migma split: redirecionar ao checkout do aluno que verifica o flag de pagamento
                    const service = split.migma_service_type || 'transfer';
                    navigate(`/student/checkout/${service}?success=true`);
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

    const isPart1Completed = splitPayment?.part1_payment_status === 'completed';
    const isPart2Pending = splitPayment?.part2_payment_status !== 'completed';

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
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
            <Card className="bg-black/40 border-gold-medium/30 max-w-md w-full">
                <CardContent className="p-8 text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gold-medium/20 blur-3xl rounded-full"></div>
                        <CheckCircle2 className="h-20 w-20 text-gold-medium mx-auto relative animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-gold-light">
                            {isPolling ? 'Confirmando Pagamento...' : isPart1Completed && isPart2Pending ? 'Primeira Parte Paga!' : 'Processando Pagamento...'}
                        </h2>
                        <p className="text-gold-light/70 text-lg">
                            {isPolling
                                ? 'Aguarde enquanto confirmamos seu pagamento para seguir com a próxima etapa.'
                                : isPart1Completed && isPart2Pending
                                    ? 'Agora vamos para a segunda parte do pagamento'
                                    : 'Aguarde enquanto processamos seu pagamento'}
                        </p>
                    </div>

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

                    {isPolling && (
                        <p className="text-gold-light/70 text-sm">
                            Confirmando o retorno da Parcelow. Tentativa {pollAttempt + 1} de 10.
                        </p>
                    )}

                    {nextCheckoutUrl && !isPolling && (
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

                    <p className="text-gold-light/50 text-sm">
                        Você será redirecionado automaticamente para completar o pagamento.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
