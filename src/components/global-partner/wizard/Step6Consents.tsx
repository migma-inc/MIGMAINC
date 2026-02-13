import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface Step6Props {
    watch: UseFormWatch<FormData>;
    setValue: UseFormSetValue<FormData>;
    errors: FieldErrors<FormData>;
    triedToSubmit: boolean;
}

export const Step6Consents = ({ watch, setValue, errors, triedToSubmit }: Step6Props) => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gold-light mb-4">{t('global_partner.form.final_steps', 'Final Steps')}</h3>

                <div className="flex items-start space-x-3 p-4 rounded-lg bg-gold-medium/5 border border-gold-medium/20">
                    <div className="pt-1">
                        <Checkbox
                            id="infoAccurate"
                            checked={watch('infoAccurate')}
                            onCheckedChange={(checked) => setValue('infoAccurate', checked === true)}
                        />
                    </div>
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="infoAccurate" className="text-sm font-medium leading-none text-white cursor-pointer">
                            {t('global_partner.form.info_accurate', 'I confirm that all information provided is accurate and truthful.')}
                        </Label>
                        {errors.infoAccurate && <p className="text-xs text-red-500">{errors.infoAccurate.message}</p>}
                    </div>
                </div>

                <div className="flex items-start space-x-3 p-4">
                    <div className="pt-1">
                        <Checkbox
                            id="marketingConsent"
                            checked={watch('marketingConsent')}
                            onCheckedChange={(checked) => setValue('marketingConsent', checked === true)}
                        />
                    </div>
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="marketingConsent" className="text-sm font-medium leading-none text-gray-400 cursor-pointer">
                            {t('global_partner.form.marketing_consent', 'I agree to receive communications from MIGMA regarding this application and future opportunities.')}
                        </Label>
                    </div>
                </div>

                {triedToSubmit && Object.keys(errors).length > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-red-500 text-sm font-medium">
                            {t('global_partner.form.please_fix_errors', 'Please review all steps and correct the errors before submitting.')}
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
