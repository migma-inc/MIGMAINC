import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Step4Props {
    register: UseFormRegister<FormData>;
    errors: FieldErrors<FormData>;
    watch: UseFormWatch<FormData>;
    setValue: UseFormSetValue<FormData>;
}

export const Step4AvailabilityFit = ({ register, errors, watch, setValue }: Step4Props) => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.weekly_availability', 'Weekly Availability')}</Label>
                    <select
                        {...register('weeklyAvailability')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="">{t('global_partner.form.select_availability', 'Select availability')}</option>
                        <option value="Full-time (40h/week)">{t('global_partner.form.avail_full_time', 'Full-time (40h/week)')}</option>
                        <option value="Part-time (20h/week)">{t('global_partner.form.avail_part_time', 'Part-time (20h/week)')}</option>
                        <option value="Flexible / project based">{t('global_partner.form.avail_flexible', 'Flexible / project based')}</option>
                    </select>
                    {errors.weeklyAvailability && <span className="text-red-500 text-xs">{errors.weeklyAvailability.message}</span>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="whyMigma" className="text-white">{t('global_partner.form.why_migma', 'Why do you want to join MIGMA?')}</Label>
                    <Textarea
                        id="whyMigma"
                        {...register('whyMigma')}
                        placeholder={t('global_partner.form.why_migma_placeholder', 'Tell us about your motivation and how you can contribute.')}
                        className="min-h-[120px]"
                    />
                    {errors.whyMigma && <span className="text-red-500 text-xs">{errors.whyMigma.message}</span>}
                </div>

                <div className="flex items-start space-x-3 pt-4">
                    <div className="pt-1">
                        <Checkbox
                            id="comfortableModel"
                            checked={watch('comfortableModel')}
                            onCheckedChange={(checked) => setValue('comfortableModel', checked === true)}
                        />
                    </div>
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="comfortableModel" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white cursor-pointer">
                            {t('global_partner.form.comfortable_model', 'I understand and am comfortable with the independent contractor model (earning per success/project).')}
                        </Label>
                        {errors.comfortableModel && <p className="text-xs text-red-500">{errors.comfortableModel.message}</p>}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
