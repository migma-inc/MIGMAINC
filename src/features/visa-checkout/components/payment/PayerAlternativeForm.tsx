import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PayerInfo } from '../../types/form.types';

interface PayerAlternativeFormProps {
    payerInfo: PayerInfo | null;
    onPayerInfoChange: (info: PayerInfo | null) => void;
    baseCpf?: string;
    baseCardName?: string;
}

export const PayerAlternativeForm: React.FC<PayerAlternativeFormProps> = ({
    payerInfo,
    onPayerInfoChange,
    baseCpf,
    baseCardName
}) => {
    const { t } = useTranslation();
    const [isDifferentPayer, setIsDifferentPayer] = useState(!!payerInfo);

    const handleToggle = (checked: boolean) => {
        setIsDifferentPayer(checked);
        if (!checked) {
            onPayerInfoChange(null);
        } else {
            // Initialize with empty strings
            onPayerInfoChange({
                name: baseCardName || '',
                cpf: baseCpf || '',
                email: '',
                phone: '',
                postal_code: '',
                address_street: '',
                address_number: '',
                address_neighborhood: '',
                address_city: '',
                address_state: '',
                address_complement: ''
            });
        }
    };

    const updateField = (field: keyof PayerInfo, value: string) => {
        if (!payerInfo) return;
        onPayerInfoChange({
            ...payerInfo,
            [field]: value
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-zinc-900/60 p-5 rounded-xl border border-gold-medium/20 shadow-xl">
                <p className="text-sm font-bold text-white uppercase tracking-wide">
                    {t('checkout.is_card_owner_question', 'O cartão de crédito que você vai usar é seu ou de outra pessoa?')}
                </p>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => handleToggle(false)}
                        className={cn(
                            "flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all duration-300 font-bold uppercase tracking-wider text-xs",
                            !isDifferentPayer
                                ? "bg-gold-medium border-gold-medium text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                                : "bg-black/40 border-white/10 text-gray-400 hover:border-gold-light/50 hover:text-white"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            !isDifferentPayer ? "border-black" : "border-gray-600"
                        )}>
                            {!isDifferentPayer && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                        {t('checkout.my_card', 'Meu Cartão')}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleToggle(true)}
                        className={cn(
                            "flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all duration-300 font-bold uppercase tracking-wider text-xs",
                            isDifferentPayer
                                ? "bg-gold-medium border-gold-medium text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                                : "bg-black/40 border-white/10 text-gray-400 hover:border-gold-light/50 hover:text-white"
                        )}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            isDifferentPayer ? "border-black" : "border-gray-600"
                        )}>
                            {isDifferentPayer && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                        {t('checkout.third_party_card', 'Cartão de Terceiro')}
                    </button>
                </div>
            </div>

            {isDifferentPayer && payerInfo && (
                <div className="bg-zinc-900/40 border border-white/10 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-white font-bold text-sm border-b border-white/5 pb-2 mb-2">
                        {t('checkout.payer_data_title', 'Dados do Titular do Cartão')}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-400 uppercase">{t('checkout.payer_name', 'Nome Completo')}</Label>
                            <Input
                                value={payerInfo.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value.toUpperCase())}
                                className="bg-black/40 border-white/10 text-white text-sm h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-400 uppercase">{t('checkout.payer_cpf', 'CPF do Titular')}</Label>
                            <Input
                                value={payerInfo.cpf}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
                                className="bg-black/40 border-white/10 text-white text-sm h-9"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-400 uppercase">{t('checkout.payer_email', 'E-mail do Titular')}</Label>
                            <Input
                                type="email"
                                value={payerInfo.email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('email', e.target.value)}
                                className="bg-black/40 border-white/10 text-white text-sm h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-400 uppercase">{t('checkout.payer_phone', 'WhatsApp do Titular')}</Label>
                            <Input
                                value={payerInfo.phone}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('phone', e.target.value)}
                                className="bg-black/40 border-white/10 text-white text-sm h-9"
                            />
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="text-blue-400 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                            </svg>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-blue-200 uppercase tracking-tight">
                                {t('checkout.parcelow_address_notice_title')}
                            </p>
                            <p className="text-[11px] text-blue-100/80 leading-relaxed italic">
                                {t('checkout.parcelow_address_notice_content')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
