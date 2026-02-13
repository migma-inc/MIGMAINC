import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormRegister, FieldErrors, UseFormSetValue } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '../constants';

interface Step1Props {
    register: UseFormRegister<FormData>;
    errors: FieldErrors<FormData>;
    setValue: UseFormSetValue<FormData>;
    selectedCountry: string;
    updatePhoneWithCountryCode: (country: string) => void;
}

export const Step1BasicInfo = ({ register, errors, setValue, selectedCountry, updatePhoneWithCountryCode }: Step1Props) => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-white">{t('global_partner.form.fullName', 'Full Name')}</Label>
                    <Input id="fullName" {...register('fullName')} placeholder="John Doe" className={errors.fullName ? 'border-red-500' : ''} />
                    {errors.fullName && <span className="text-red-500 text-xs">{errors.fullName.message}</span>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">{t('global_partner.form.email', 'Email Address')}</Label>
                    <Input id="email" {...register('email')} type="email" placeholder="john@example.com" className={errors.email ? 'border-red-500' : ''} />
                    {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="country" className="text-white">{t('global_partner.form.country', 'Country of Residence')}</Label>
                    <Select
                        onValueChange={(value) => {
                            setValue('country', value);
                            updatePhoneWithCountryCode(value);
                        }}
                        value={selectedCountry}
                    >
                        <SelectTrigger className={errors.country ? 'border-red-500' : ''}>
                            <SelectValue placeholder={t('global_partner.form.select_country', 'Select your country')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {countries.map((country) => (
                                <SelectItem key={country} value={country}>{country}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.country && <span className="text-red-500 text-xs">{errors.country.message}</span>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white">{t('global_partner.form.phone', 'Phone / WhatsApp')}</Label>
                    <Input id="phone" {...register('phone')} placeholder="+1 234 567 890" className={errors.phone ? 'border-red-500' : ''} />
                    {errors.phone && <span className="text-red-500 text-xs">{errors.phone.message}</span>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="city" className="text-white">{t('global_partner.form.city', 'City (Optional)')}</Label>
                <Input id="city" {...register('city')} placeholder="New York" />
            </div>
        </motion.div>
    );
};
