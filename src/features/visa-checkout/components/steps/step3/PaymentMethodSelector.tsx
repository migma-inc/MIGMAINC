import React from 'react';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, DollarSign } from 'lucide-react';
import type { PaymentMethod } from '../../../types/form.types';

interface PaymentMethodSelectorProps {
    paymentMethod: PaymentMethod;
    onMethodChange: (method: PaymentMethod) => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    paymentMethod,
    onMethodChange,
}) => {
    const { t } = useTranslation();
    return (
        <div className="pt-4 border-t border-gold-medium/30">
            <Label className="text-white mb-3 block text-sm sm:text-base font-medium">{t('checkout.select_payment_method', 'Select Payment Method')}</Label>
            <Select value={paymentMethod || undefined} onValueChange={(val) => onMethodChange(val as PaymentMethod)}>
                <SelectTrigger className="w-full bg-white border-gray-300 text-black h-12 focus:ring-gold-medium/50">
                    <SelectValue placeholder={t('checkout.select_payment_method_placeholder', 'Select a payment method')} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-black">
                    <SelectItem value="zelle" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span>Zelle</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="parcelow_card" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <span>{t('checkout.parcelow_card', 'Parcelow – Cartão')}</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="parcelow_pix" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16.706 16.12a2.99 2.99 0 0 1-2.122-.879l-2.827-2.827a.504.504 0 0 0-.7 0l-2.84 2.84a2.99 2.99 0 0 1-2.121.879H5.04l3.584 3.584a3.503 3.503 0 0 0 4.952 0l3.597-3.597h-.467ZM5.096 7.868a2.99 2.99 0 0 1 2.121.879l2.84 2.84a.495.495 0 0 0 .7 0l2.827-2.827a2.99 2.99 0 0 1 2.122-.879h.467L12.576 4.285a3.503 3.503 0 0 0-4.952 0L4.04 7.868h1.056ZM19.96 9.04l-1.986-1.986h-1.268c-.56 0-1.12.214-1.548.641l-2.827 2.827a1.508 1.508 0 0 1-2.129 0l-2.84-2.84A2.183 2.183 0 0 0 5.815 7.04H4.04L2.054 9.027a3.503 3.503 0 0 0 0 4.952L4.04 15.96h1.775c.56 0 1.12-.214 1.548-.641l2.84-2.84a1.536 1.536 0 0 1 2.129 0l2.827 2.827c.428.427.989.641 1.548.641h1.268L19.96 13.96a3.503 3.503 0 0 0 0-4.92Z" />
                            </svg>
                            <span>{t('checkout.parcelow_pix', 'Parcelow – PIX')}</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="parcelow_ted" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                {/* cédula */}
                                <rect x="1" y="6" width="22" height="12" rx="2" />
                                {/* círculo central (valor) */}
                                <circle cx="12" cy="12" r="2.5" />
                                {/* detalhe esquerdo */}
                                <path d="M5 9.5v5" />
                                {/* detalhe direito */}
                                <path d="M19 9.5v5" />
                            </svg>
                            <span>{t('checkout.parcelow_ted', 'Parcelow – TED')}</span>
                        </div>
                    </SelectItem>

                    {/* STRIPE REMOVED - No longer using Stripe payments
                    <SelectItem value="card" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-gray-600" />
                            <span>Credit Card</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="pix" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span>PIX</span>
                        </div>
                    </SelectItem> 
                    */}
                </SelectContent>
            </Select>
        </div>
    );
};
