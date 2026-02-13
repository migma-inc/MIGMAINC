import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { showWarning } from './utils';
import { uploadCV } from '@/lib/storage';
import { sendApplicationConfirmationEmail, sendAdminNewApplicationNotification } from '@/lib/emails';
import { getAllAdminEmails } from '@/lib/auth';

import { baseFormSchema } from './types';
import type { FormData, ApplicationData } from './types';
import { checkEmailExists, getClientIP, insertApplication } from './services';
import { countryPhoneCodes } from './constants';

import { Step1BasicInfo } from './wizard/Step1BasicInfo';
import { Step2Experience } from './wizard/Step2Experience';
import { Step3ProfessionalBackground } from './wizard/Step3ProfessionalBackground';
import { Step4AvailabilityFit } from './wizard/Step4AvailabilityFit';
import { Step5CVLinks } from './wizard/Step5CVLinks';
import { Step6Consents } from './wizard/Step6Consents';

interface ApplicationWizardProps {
    cardRef: React.RefObject<HTMLDivElement | null>;
}

export const ApplicationWizard = ({ cardRef }: ApplicationWizardProps) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [triedToSubmit, setTriedToSubmit] = useState(false);
    const isSubmittingRef = useRef(false);
    const formRef = useRef<HTMLDivElement>(null);
    const totalSteps = 6;

    const form = useForm<FormData>({
        resolver: zodResolver(baseFormSchema),
        defaultValues: {
            areaOfExpertise: [],
            interestedRoles: [],
            hasBusiness: undefined,
            clientExperience: undefined,
            comfortableModel: false,
            infoAccurate: false,
            marketingConsent: true,
        },
        mode: 'onChange',
    });

    const { register, handleSubmit, formState: { errors }, watch, setValue, trigger, setError, clearErrors } = form;

    const selectedCountry = watch('country');
    const areaOfExpertise = watch('areaOfExpertise');
    const interestedRoles = watch('interestedRoles');

    const updatePhoneWithCountryCode = (country: string) => {
        const code = countryPhoneCodes[country];
        if (code) {
            const currentPhone = watch('phone');
            if (!currentPhone || currentPhone === '' || Object.values(countryPhoneCodes).includes(currentPhone)) {
                setValue('phone', code);
            }
        }
    };

    const validateStep = async (currentStep: number) => {
        let fieldsToValidate: any[] = [];
        if (currentStep === 1) fieldsToValidate = ['fullName', 'email', 'country', 'phone'];
        if (currentStep === 2) {
            fieldsToValidate = ['hasBusiness'];
            if (watch('hasBusiness') === 'Yes') {
                fieldsToValidate.push('businessId');
            }
        }
        if (currentStep === 3) fieldsToValidate = ['areaOfExpertise', 'yearsOfExperience', 'interestedRoles', 'visaExperience', 'englishLevel', 'clientExperience'];
        if (currentStep === 4) fieldsToValidate = ['weeklyAvailability', 'whyMigma', 'comfortableModel'];
        if (currentStep === 5) fieldsToValidate = ['cv'];
        if (currentStep === 6) fieldsToValidate = ['infoAccurate'];

        const result = await trigger(fieldsToValidate as any);

        if (currentStep === 1 && result) {
            const emailValue = watch('email');
            const emailExists = await checkEmailExists(emailValue);
            if (emailExists) {
                setError('email', {
                    type: 'manual',
                    message: t('global_partner.validation.email_exists', 'This email is already registered.'),
                });
                return false;
            }
        }

        if (currentStep === 3) {
            if (!areaOfExpertise || areaOfExpertise.length === 0) {
                setError('areaOfExpertise', { type: 'manual', message: t('global_partner.validation.expertise_required', 'Select at least one expertise') });
                return false;
            }
            if (!interestedRoles || interestedRoles.length === 0) {
                setError('interestedRoles', { type: 'manual', message: t('global_partner.validation.role_required', 'Select at least one role') });
                return false;
            }
        }

        return result;
    };

    const handleNext = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (step === 6) setTriedToSubmit(true);

        const isStepValid = await validateStep(step);
        if (isStepValid && step < totalSteps) {
            setStep((s) => Math.min(s + 1, totalSteps));
            if (cardRef?.current) {
                cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    const handlePrev = () => {
        setStep((s) => Math.max(s - 1, 1));
        if (cardRef?.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const progress = (step / totalSteps) * 100;

    const findFirstInvalidStep = async (): Promise<number | null> => {
        const step1Valid = await validateStep(1);
        if (!step1Valid) return 1;

        const validationPromises = [];
        for (let stepNum = 2; stepNum <= totalSteps; stepNum++) {
            validationPromises.push(validateStep(stepNum).then(isValid => ({ stepNum, isValid })));
        }

        const results = await Promise.all(validationPromises);
        for (const { stepNum, isValid } of results) {
            if (!isValid) return stepNum;
        }
        return null;
    };

    const onSubmit = async (data: FormData) => {
        if (step !== 6) {
            await handleNext();
            return;
        }

        if (isSubmittingRef.current || isSubmitting) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            const firstInvalidStep = await findFirstInvalidStep();
            if (firstInvalidStep !== null) {
                const stepNames: Record<number, string> = {
                    1: t('global_partner.wizard.personal_info'),
                    2: t('global_partner.wizard.legal_info'),
                    3: t('global_partner.wizard.professional_background'),
                    4: t('global_partner.wizard.availability_fit'),
                    5: t('global_partner.wizard.cv_links'),
                    6: t('global_partner.wizard.consents')
                };

                const stepName = stepNames[firstInvalidStep] || `Step ${firstInvalidStep}`;
                showWarning(t('global_partner.validation.complete_required_fields', { stepName }));
                setStep(firstInvalidStep);
                setTriedToSubmit(true);
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }

            let cvFilePath: string | undefined;
            let cvFileName: string | undefined;

            if (data.cv && data.cv instanceof File) {
                const uploadResult = await uploadCV(data.cv);
                if (!uploadResult.success) {
                    showWarning(t('global_partner.validation.cv_upload_error', { error: uploadResult.error }));
                    setIsSubmitting(false);
                    isSubmittingRef.current = false;
                    return;
                }
                cvFilePath = uploadResult.filePath;
                cvFileName = uploadResult.fileName;
            }

            const ipAddress = await getClientIP();

            let processedAreaOfExpertise = [...(data.areaOfExpertise || [])];
            if (processedAreaOfExpertise.includes('Other') && data.otherAreaOfExpertise?.trim()) {
                processedAreaOfExpertise = processedAreaOfExpertise.filter(area => area !== 'Other');
                processedAreaOfExpertise.push(`Other: ${data.otherAreaOfExpertise.trim()}`);
            }

            const applicationData: ApplicationData = {
                full_name: data.fullName,
                email: data.email,
                phone: data.phone,
                country: data.country,
                city: data.city || null,
                has_business_registration: data.hasBusiness,
                registration_type: data.registrationType || null,
                business_name: data.businessName || null,
                business_id: data.businessId || null,
                tax_id: data.taxId || null,
                current_occupation: data.currentOccupation || null,
                area_of_expertise: processedAreaOfExpertise,
                interested_roles: data.interestedRoles || [],
                visa_experience: data.visaExperience || null,
                years_of_experience: data.yearsOfExperience,
                english_level: data.englishLevel,
                client_experience: data.clientExperience,
                client_experience_description: data.clientExperienceDescription || null,
                weekly_availability: data.weeklyAvailability,
                why_migma: data.whyMigma,
                comfortable_model: data.comfortableModel === true,
                linkedin_url: data.linkedin || null,
                other_links: data.otherLinks || null,
                cv_file_path: cvFilePath || null,
                cv_file_name: cvFileName || null,
                info_accurate: data.infoAccurate === true,
                marketing_consent: data.marketingConsent === true,
                ip_address: ipAddress || null,
            };

            const { data: insertedData, error: insertError } = await insertApplication(applicationData);

            if (insertError) {
                if (insertError.code === '23505' && insertError.message.includes('email')) {
                    setError('email', { type: 'manual', message: t('global_partner.validation.email_exists') });
                    setStep(1);
                } else {
                    showWarning(t('global_partner.validation.submission_error', { error: insertError.message }));
                }
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }

            try {
                await sendApplicationConfirmationEmail(data.email, data.fullName);
            } catch (e) { console.error(e); }

            try {
                const adminEmails = await getAllAdminEmails();
                const applicationId = insertedData?.[0]?.id;
                if (applicationId && adminEmails.length > 0) {
                    await Promise.all(adminEmails.map(adminEmail =>
                        sendAdminNewApplicationNotification(adminEmail, {
                            fullName: data.fullName,
                            email: data.email,
                            country: data.country,
                            applicationId: applicationId
                        })
                    ));
                }
            } catch (e) { console.error(e); }

            // Handle success - parent will handle redirection if needed
            window.location.href = '/global-partner/success';

        } catch (error) {
            console.error(error);
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div ref={formRef}>
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="loader-gold mx-auto mb-4"></div>
                        <p className="text-gold-light text-lg font-semibold">{t('global_partner.form.submitting', 'Submitting your application...')}</p>
                        <p className="text-gray-400 text-sm mt-2">{t('global_partner.form.please_wait', 'Please wait')}</p>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <div className="flex justify-between text-sm font-medium text-white mb-2">
                    <span>{t('global_partner.form.step_x_of_y', { step, totalSteps, defaultValue: `Step ${step} of ${totalSteps}` })}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                    <Step1BasicInfo
                        register={register}
                        errors={errors}
                        setValue={setValue}
                        selectedCountry={selectedCountry}
                        updatePhoneWithCountryCode={updatePhoneWithCountryCode}
                    />
                )}

                {step === 2 && (
                    <Step2Experience
                        register={register}
                        errors={errors}
                        watch={watch}
                    />
                )}

                {step === 3 && (
                    <Step3ProfessionalBackground
                        register={register}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                    />
                )}

                {step === 4 && (
                    <Step4AvailabilityFit
                        register={register}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                    />
                )}

                {step === 5 && (
                    <Step5CVLinks
                        register={register}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                        setError={setError}
                        clearErrors={clearErrors}
                    />
                )}

                {step === 6 && (
                    <Step6Consents
                        watch={watch}
                        setValue={setValue}
                        errors={errors}
                        triedToSubmit={triedToSubmit}
                    />
                )}

                <div className="flex justify-between pt-6 border-t mt-8">
                    {step > 1 ? (
                        <Button type="button" variant="outline" onClick={handlePrev}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> {t('global_partner.form.back_button', 'Back')}
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step < totalSteps ? (
                        <Button
                            type="button"
                            onClick={handleNext}
                            className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg"
                        >
                            {t('global_partner.form.next_button', 'Next Step')} <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? t('global_partner.form.submitting_button', 'Submitting...') : t('global_partner.form.submit_button', 'Submit Application')} <Check className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
};
