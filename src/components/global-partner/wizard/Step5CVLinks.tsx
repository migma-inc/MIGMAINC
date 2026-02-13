import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue, UseFormSetError, UseFormClearErrors } from 'react-hook-form';
import type { FormData } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';

interface Step5Props {
    register: UseFormRegister<FormData>;
    errors: FieldErrors<FormData>;
    watch: UseFormWatch<FormData>;
    setValue: UseFormSetValue<FormData>;
    setError: UseFormSetError<FormData>;
    clearErrors: UseFormClearErrors<FormData>;
}

export const Step5CVLinks = ({ register, errors, watch, setValue, setError, clearErrors }: Step5Props) => {
    const { t } = useTranslation();
    const cv = watch('cv');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validation: Max 10MB
            if (file.size > 10 * 1024 * 1024) {
                setError('cv', { type: 'manual', message: t('global_partner.validation.file_too_large', 'File is too large (max 10MB)') });
                return;
            }
            // Validation: PDF or DOCX
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
            if (!allowedTypes.includes(file.type)) {
                setError('cv', { type: 'manual', message: t('global_partner.validation.invalid_file_type', 'Please upload a PDF or Word document') });
                return;
            }

            clearErrors('cv');
            setValue('cv', file);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-white">{t('global_partner.form.upload_cv', 'Upload your CV / Resume')}</Label>
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${errors.cv ? 'border-red-500 bg-red-500/5' : 'border-gold-medium/30 hover:border-gold-medium/60 bg-white/5'}`}>
                        <input
                            type="file"
                            id="cv-upload"
                            className="hidden"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="cv-upload" className="cursor-pointer flex flex-col items-center">
                            <Upload className={`h-10 w-10 mb-4 ${errors.cv ? 'text-red-500' : 'text-gold-light'}`} />
                            <p className="text-white font-medium">
                                {cv instanceof File ? cv.name : t('global_partner.form.drag_drop_cv', 'Click to upload or drag and drop')}
                            </p>
                            <p className="text-gray-400 text-xs mt-2">{t('global_partner.form.file_limits', 'PDF, DOC, DOCX (Max 10MB)')}</p>
                        </label>
                    </div>
                    {errors.cv && <p className="text-xs text-red-500 mt-1">{errors.cv.message as string}</p>}
                </div>

                <div className="grid grid-cols-1 gap-6 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="linkedin" className="text-white">{t('global_partner.form.linkedin_profile', 'LinkedIn Profile URL')}</Label>
                        <Input
                            id="linkedin"
                            {...register('linkedin')}
                            placeholder="https://linkedin.com/in/username"
                            className={errors.linkedin ? 'border-red-500' : ''}
                        />
                        {errors.linkedin && <span className="text-red-500 text-xs">{errors.linkedin.message}</span>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="otherLinks" className="text-white">{t('global_partner.form.other_links', 'Other Portfolio / Website Links')}</Label>
                        <Input
                            id="otherLinks"
                            {...register('otherLinks')}
                            placeholder="https://example.com"
                        />
                        {errors.otherLinks && <span className="text-red-500 text-xs">{errors.otherLinks.message}</span>}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
