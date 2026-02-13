import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormRegister, FieldErrors, UseFormWatch } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Step2Props {
    register: UseFormRegister<FormData>;
    errors: FieldErrors<FormData>;
    watch: UseFormWatch<FormData>;
}

export const Step2Experience = ({ register, errors, watch }: Step2Props) => {
    const { t } = useTranslation();
    const hasBusiness = watch('hasBusiness');

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.has_business', 'Do you have a registered business / tax entity?')}</Label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="radio" {...register('hasBusiness')} value="Yes" className="accent-gold-medium" /> {t('global_partner.form.yes', 'Yes')}
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="radio" {...register('hasBusiness')} value="No" className="accent-gold-medium" /> {t('global_partner.form.no', 'No')}
                        </label>
                    </div>
                    {errors.hasBusiness && <span className="text-red-500 text-xs">{errors.hasBusiness.message}</span>}
                </div>

                {hasBusiness === 'Yes' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4 pt-2"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="registrationType" className="text-white">{t('global_partner.form.registration_type', 'Entity Type (e.g. LLC, MEI, Ltd)')}</Label>
                                <Input id="registrationType" {...register('registrationType')} placeholder="LLC" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessName" className="text-white">{t('global_partner.form.business_name', 'Business Legal Name')}</Label>
                                <Input id="businessName" {...register('businessName')} placeholder="Acme Corp" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="businessId" className="text-white">{t('global_partner.form.business_id', 'Tax ID / Registration Number')}</Label>
                                <Input id="businessId" {...register('businessId')} placeholder="12-3456789" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};
