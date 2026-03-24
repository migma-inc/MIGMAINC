import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, QrCode, Landmark, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type PaymentMethod = 'card' | 'pix' | 'ted';

export interface SplitPaymentConfig {
    enabled: boolean;
    part1_amount: number;
    part1_method: PaymentMethod;
    part2_amount: number;
    part2_method: PaymentMethod;
}

interface SplitPaymentSelectorProps {
    totalAmount: number;
    onSplitChange: (config: SplitPaymentConfig | null) => void;
    disabled?: boolean;
}

export const SplitPaymentSelector: React.FC<SplitPaymentSelectorProps> = ({
    totalAmount,
    onSplitChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const [useSplit, setUseSplit] = useState(false);
    const [part1Amount, setPart1Amount] = useState('');
    const [part1Method, setPart1Method] = useState<PaymentMethod>('card');
    const [part2Method, setPart2Method] = useState<PaymentMethod>('pix');

    // Usar ref para evitar loop infinito de re-renders no componente pai
    const onSplitChangeRef = useRef(onSplitChange);

    useEffect(() => {
        onSplitChangeRef.current = onSplitChange;
    }, [onSplitChange]);

    // Validar totalAmount
    const validTotal = totalAmount && !isNaN(totalAmount) ? totalAmount : 0;

    // Calcular Part 2 automaticamente
    const part1Value = parseFloat(part1Amount) || 0;
    const part2Value = validTotal - part1Value;

    // Validação
    const isValid = part1Value > 0 && part2Value > 0 && part1Value < validTotal && part1Method && part2Method;

    useEffect(() => {
        if (useSplit && isValid) {
            onSplitChangeRef.current({
                enabled: true,
                part1_amount: part1Value,
                part1_method: part1Method,
                part2_amount: part2Value,
                part2_method: part2Method,
            });
        } else {
            onSplitChangeRef.current(null);
        }
    }, [useSplit, part1Value, part2Value, isValid, part1Method, part2Method]);

    const toggleSplit = () => {
        if (!useSplit && validTotal > 0) {
            setPart1Amount((validTotal / 2).toFixed(2));
        } else {
            setPart1Amount('');
        }
        setUseSplit(!useSplit);
    };

    const MethodButton = ({
        selected,
        onClick,
        label,
        icon: Icon
    }: {
        selected: boolean,
        onClick: () => void,
        label: string,
        icon: any
    }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-semibold transition-all ${selected
                ? 'bg-gold-medium border-gold-medium text-black'
                : 'bg-black/20 border-white/10 text-white/60 hover:border-gold-medium/40 hover:bg-gold-medium/5'
                } disabled:opacity-50 uppercase`}
        >
            <Icon className={`w-4 h-4 ${selected ? 'text-black' : 'text-gold-medium/60'}`} />
            {label}
        </button>
    );

    if (!validTotal || validTotal <= 0) return null;

    return (
        <div className="space-y-4">
            {/* Principal Toggle */}
            <button
                type="button"
                onClick={toggleSplit}
                disabled={disabled}
                className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${useSplit
                    ? 'bg-gold-medium/10 border-gold-medium'
                    : 'bg-zinc-900/40 border-white/10 hover:border-gold-medium/40'
                    } disabled:opacity-50`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${useSplit 
                        ? 'bg-gold-medium border-gold-medium' 
                        : 'border-white/20 bg-black/40'
                        }`}>
                        {useSplit && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                    </div>
                    <span className={`font-semibold text-sm ${useSplit ? 'text-white' : 'text-white/70'}`}>
                        {t('checkout.split.title', 'Dividir em 2 pagamentos')}
                    </span>
                </div>
                {useSplit && (
                    <span className="text-[10px] bg-gold-medium text-black px-2 py-0.5 rounded font-bold uppercase">
                        {t('checkout.split.active', 'ATIVO')}
                    </span>
                )}
            </button>

            {/* Configuration Card */}
            {useSplit && (
                <div className="bg-zinc-900/80 backdrop-blur-md rounded-xl border border-gold-medium/20 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-5 space-y-6">

                        {/* Header: Total info */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">{t('checkout.split.total_value', 'VALOR TOTAL')}</span>
                            <span className="text-xl font-bold text-white">US$ {validTotal.toFixed(2)}</span>
                        </div>

                        {/* PART 1 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-gold-medium text-black text-[10px] font-black rounded flex items-center justify-center shadow-lg shadow-gold-medium/20">1</span>
                                <label className="text-[11px] font-black text-gold-light uppercase tracking-wide">
                                    {t('checkout.split.part1_label', 'Primeiro Pagamento (Imediato)')}
                                </label>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-lg">$</span>
                                <input
                                    type="number"
                                    value={part1Amount}
                                    onChange={(e) => setPart1Amount(e.target.value)}
                                    placeholder="0.00"
                                    disabled={disabled}
                                    className="w-full pl-9 pr-4 py-3 border border-white/10 rounded-lg bg-black/40 text-white font-bold text-xl focus:outline-none focus:border-gold-medium focus:bg-black/60 transition-all placeholder:text-zinc-800"
                                />
                            </div>

                            <div className="flex gap-2">
                                <MethodButton
                                    label={t('checkout.split.card', 'CARTÃO')} icon={CreditCard}
                                    selected={part1Method === 'card'} onClick={() => setPart1Method('card')}
                                />
                                <MethodButton
                                    label="PIX" icon={QrCode}
                                    selected={part1Method === 'pix'} onClick={() => setPart1Method('pix')}
                                />
                                <MethodButton
                                    label="TED" icon={Landmark}
                                    selected={part1Method === 'ted'} onClick={() => setPart1Method('ted')}
                                />
                            </div>
                        </div>

                        <div className="relative h-px bg-white/5 flex items-center justify-center">
                            <div className="absolute bg-zinc-900 border border-white/5 p-1 rounded-full">
                                <div className="w-1.5 h-1.5 bg-gold-medium/40 rounded-full" />
                            </div>
                        </div>

                        {/* PART 2 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-zinc-800 text-gold-medium/60 border border-gold-medium/10 text-[10px] font-black rounded flex items-center justify-center">2</span>
                                <label className="text-[11px] font-black text-gold-light/60 uppercase tracking-wide">
                                    {t('checkout.split.part2_label', 'Segundo Pagamento (Pendente)')}
                                </label>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-semibold text-lg">$</span>
                                <div className="w-full pl-9 pr-4 py-3 border border-white/5 bg-black/20 rounded-lg text-white/40 font-bold text-xl transition-opacity">
                                    {part2Value.toFixed(2)}
                                </div>
                            </div>

                            <div className="flex gap-2 opacity-80">
                                <MethodButton
                                    label={t('checkout.split.card', 'CARTÃO')} icon={CreditCard}
                                    selected={part2Method === 'card'} onClick={() => setPart2Method('card')}
                                />
                                <MethodButton
                                    label="PIX" icon={QrCode}
                                    selected={part2Method === 'pix'} onClick={() => setPart2Method('pix')}
                                />
                                <MethodButton
                                    label="TED" icon={Landmark}
                                    selected={part2Method === 'ted'} onClick={() => setPart2Method('ted')}
                                />
                            </div>
                        </div>

                        {/* Footer Notice */}
                        <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-lg p-4 flex gap-4 mt-2">
                            <div className="w-8 h-8 rounded-full bg-gold-medium/10 flex items-center justify-center shrink-0 border border-gold-medium/20">
                                <AlertCircle className="w-4 h-4 text-gold-medium" />
                            </div>
                            <p className="text-[10px] text-gold-light/80 leading-relaxed font-bold tracking-tight">
                                <strong className="text-gold-light uppercase tracking-wider block mb-0.5">{t('checkout.split.important', 'Importante')}:</strong>
                                {t('checkout.split.footer_notice', 'Você finalizará os detalhes de cada parte na página segura da Parcelow. O link para a segunda parte será enviado para o seu e-mail após a confirmação da primeira.')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
