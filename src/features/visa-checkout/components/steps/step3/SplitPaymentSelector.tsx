import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, QrCode, Landmark, Check } from 'lucide-react';

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
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg border text-xs font-bold transition-all ${selected
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                } disabled:opacity-50`}
        >
            <Icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-gray-400'}`} />
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
                className={`w-full px-4 py-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${useSplit
                    ? 'bg-blue-50/50 border-blue-500 ring-4 ring-blue-500/10'
                    : 'bg-zinc-900/40 border-gold-medium/20 hover:border-gold-medium/40'
                    } disabled:opacity-50`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${useSplit ? 'bg-blue-600 border-blue-600 scale-110 shadow-lg shadow-blue-500/40' : 'border-gold-medium/30'
                        }`}>
                        {useSplit && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                    <span className={`font-bold text-base ${useSplit ? 'text-blue-700' : 'text-gold-light'}`}>
                        Split payment into 2 parts
                    </span>
                </div>
                {useSplit ? (
                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-tighter">Active</span>
                ) : (
                    <span className="text-[10px] text-gold-medium/60 font-medium font-mono uppercase tracking-widest">New Option</span>
                )}
            </button>

            {/* Configuration Card */}
            {useSplit && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-5 space-y-6">

                        {/* Header: Total info */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Value</span>
                            <span className="text-xl font-black text-gray-900">US$ {validTotal.toFixed(2)}</span>
                        </div>

                        {/* PART 1 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded flex items-center justify-center">1</span>
                                <label className="text-sm font-black text-gray-800 uppercase tracking-tight">First Payment (Immediate)</label>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={part1Amount}
                                    onChange={(e) => setPart1Amount(e.target.value)}
                                    placeholder="0.00"
                                    disabled={disabled}
                                    className="w-full pl-8 pr-4 py-4 border-2 border-gray-100 rounded-xl bg-gray-50/50 text-gray-900 font-black text-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="flex gap-2">
                                <MethodButton
                                    label="Card" icon={CreditCard}
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

                        <div className="relative h-px bg-gray-100 flex items-center justify-center">
                            <div className="absolute bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                            </div>
                        </div>

                        {/* PART 2 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-gray-400 text-white text-[10px] font-black rounded flex items-center justify-center">2</span>
                                <label className="text-sm font-black text-gray-800 uppercase tracking-tight">Second Payment (Pending)</label>
                            </div>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <div className="w-full pl-8 pr-4 py-4 border-2 border-gray-50 bg-gray-50/30 rounded-xl text-gray-500 font-black text-xl italic">
                                    {part2Value.toFixed(2)}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <MethodButton
                                    label="Card" icon={CreditCard}
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
                        <div className="bg-blue-50 rounded-lg p-3 flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-blue-600 animate-pulse text-xs font-bold">!</span>
                            </div>
                            <p className="text-[11px] text-blue-800 leading-tight font-medium">
                                <strong>Important:</strong> You'll finalize the details for each part on the Parcelow secure page.
                                The second part will be sent to your email after Part 1 is confirmed.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
