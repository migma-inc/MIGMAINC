import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Step3Props {
    register: UseFormRegister<FormData>;
    errors: FieldErrors<FormData>;
    watch: UseFormWatch<FormData>;
    setValue: UseFormSetValue<FormData>;
}

export const Step3ProfessionalBackground = ({ register, errors, watch, setValue }: Step3Props) => {
    const { t } = useTranslation();
    const areaOfExpertise = watch('areaOfExpertise') || [];
    const interestedRoles = watch('interestedRoles') || [];

    const toggleExpertise = (area: string) => {
        const current = [...areaOfExpertise];
        const index = current.indexOf(area);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(area);
        }
        setValue('areaOfExpertise', current);
    };

    const toggleRole = (role: string) => {
        const current = [...interestedRoles];
        const index = current.indexOf(role);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(role);
        }
        setValue('interestedRoles', current);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="currentOccupation" className="text-white">{t('global_partner.form.current_occupation', 'Current Occupation')}</Label>
                    <Input id="currentOccupation" {...register('currentOccupation')} placeholder="Sales Manager" />
                </div>
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.years_of_experience', 'Years of Relevant Experience')}</Label>
                    <select
                        {...register('yearsOfExperience')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="">{t('global_partner.form.select_years', 'Select experience')}</option>
                        <option value="Less than 2 years">{t('global_partner.form.exp_less_2', 'Less than 2 years')}</option>
                        <option value="2-5 years">{t('global_partner.form.exp_2_5', '2-5 years')}</option>
                        <option value="5-10 years">{t('global_partner.form.exp_5_10', '5-10 years')}</option>
                        <option value="More than 10 years">{t('global_partner.form.exp_more_10', 'More than 10 years')}</option>
                    </select>
                    {errors.yearsOfExperience && <span className="text-red-500 text-xs">{errors.yearsOfExperience.message}</span>}
                </div>
            </div>

            <div className="space-y-3">
                <Label className="text-white">{t('global_partner.form.expertise_areas', 'Areas of Expertise (Select all that apply)')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        'Sales & Closing',
                        'Customer Success',
                        'Legal consulting',
                        'Immigration Services',
                        'Operations',
                        'Marketing',
                        'Other'
                    ].map((area) => (
                        <div key={area} className="flex items-center space-x-2">
                            <Checkbox
                                id={`expertise-${area}`}
                                checked={areaOfExpertise.includes(area)}
                                onCheckedChange={() => toggleExpertise(area)}
                            />
                            <Label htmlFor={`expertise-${area}`} className="text-white cursor-pointer">{area}</Label>
                        </div>
                    ))}
                </div>
                {areaOfExpertise.includes('Other') && (
                    <Input
                        {...register('otherAreaOfExpertise')}
                        placeholder={t('global_partner.form.other_expertise_placeholder', 'Please specify')}
                        className="mt-2"
                    />
                )}
                {errors.areaOfExpertise && <p className="text-xs text-red-500">{errors.areaOfExpertise.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.english_level', 'English Proficiency Level')}</Label>
                    <select
                        {...register('englishLevel')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="">{t('global_partner.form.select_level', 'Select level')}</option>
                        <option value="Basic">{t('global_partner.form.level_basic', 'Basic')}</option>
                        <option value="Intermediate">{t('global_partner.form.level_intermediate', 'Intermediate')}</option>
                        <option value="Advanced / Fluent">{t('global_partner.form.level_fluent', 'Advanced / Fluent')}</option>
                        <option value="Native">{t('global_partner.form.level_native', 'Native')}</option>
                    </select>
                    {errors.englishLevel && <span className="text-red-500 text-xs">{errors.englishLevel.message}</span>}
                </div>
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.visa_experience', 'Experience with US Visas?')}</Label>
                    <select
                        {...register('visaExperience')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="">{t('global_partner.form.select_option', 'Select option')}</option>
                        <option value="None">{t('global_partner.form.visa_none', 'No experience')}</option>
                        <option value="Personal">{t('global_partner.form.visa_personal', 'Personal experience (already have one)')}</option>
                        <option value="Professional">{t('global_partner.form.visa_pro', 'Professional experience (helped others)')}</option>
                    </select>
                    {errors.visaExperience && <span className="text-red-500 text-xs">{errors.visaExperience.message}</span>}
                </div>
            </div>

            <div className="space-y-3">
                <Label className="text-white">{t('global_partner.form.interested_roles', 'Which roles are you interested in? (Select all that apply)')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        'Sales Partner',
                        'Customer Success Partner',
                        'Legal/Admin support',
                        'Affiliate/Referral only'
                    ].map((role) => (
                        <div key={role} className="flex items-center space-x-2">
                            <Checkbox
                                id={`role-${role}`}
                                checked={interestedRoles.includes(role)}
                                onCheckedChange={() => toggleRole(role)}
                            />
                            <Label htmlFor={`role-${role}`} className="text-white cursor-pointer">{role}</Label>
                        </div>
                    ))}
                </div>
                {errors.interestedRoles && <p className="text-xs text-red-500">{errors.interestedRoles.message}</p>}
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.client_experience', 'Do you have experience managing high-ticket clients?')}</Label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="radio" {...register('clientExperience')} value="Yes" className="accent-gold-medium" /> {t('global_partner.form.yes', 'Yes')}
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="radio" {...register('clientExperience')} value="No" className="accent-gold-medium" /> {t('global_partner.form.no', 'No')}
                        </label>
                    </div>
                </div>
                {watch('clientExperience') === 'Yes' && (
                    <Textarea
                        {...register('clientExperienceDescription')}
                        placeholder={t('global_partner.form.client_experience_desc', 'Briefly describe your experience')}
                    />
                )}
            </div>
        </motion.div>
    );
};
