import React from 'react';
import { Label } from '@/components/ui/label';
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
    return (
        <div className="pt-4 border-t border-gold-medium/30">
            <Label className="text-white mb-3 block text-sm sm:text-base font-medium">Select Payment Method</Label>
            <Select value={paymentMethod || undefined} onValueChange={(val) => onMethodChange(val as PaymentMethod)}>
                <SelectTrigger className="w-full bg-white border-gray-300 text-black h-12 focus:ring-gold-medium/50">
                    <SelectValue placeholder="Select a payment method" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-black">
                    <SelectItem value="zelle" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span>Zelle</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="parcelow" className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-black">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <span>Parcelow (Split Payment)</span>
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
