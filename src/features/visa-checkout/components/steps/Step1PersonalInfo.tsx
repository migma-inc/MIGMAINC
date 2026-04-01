import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { VisaProduct } from '@/types/visa-product';
import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { validateStep1, type Step1FormData } from '@/lib/visa-checkout-validation';
import { saveStep1Data } from '@/lib/visa-checkout-service';
import { DRAFT_STORAGE_KEY, getPhoneCodeFromCountry } from '@/lib/visa-checkout-constants';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// Granular Components
import { QuantitySelector } from './step1/QuantitySelector';
import { ContactFields } from './step1/ContactFields';
import { LegalAddressFields } from './step1/LegalAddressFields';

interface Step1Props {
    product: VisaProduct;
    state: VisaCheckoutState;
    actions: VisaCheckoutActions;
}

export const Step1PersonalInfo: React.FC<Step1Props> = ({ product, state, actions }) => {
    const { t } = useTranslation();
    const { productSlug } = useParams<{ productSlug: string }>();
    const [searchParams] = useSearchParams();
    const sellerId = searchParams.get('seller') || '';
    const prefillToken = searchParams.get('prefill');

    const {
        clientName, clientEmail, clientWhatsApp, clientCountry, clientNationality,
        dateOfBirth, documentType, documentNumber, addressLine, city, state: clientState,
        postalCode, maritalStatus, clientObservations, extraUnits, dependentNames,
        fieldErrors, submitting, clientId, serviceRequestId, formStartedTracked
    } = state;

    const {
        setClientName, setClientEmail, setClientWhatsApp, setClientCountry, setClientNationality,
        setDateOfBirth, setDocumentType, setDocumentNumber, setAddressLine, setCity, setState,
        setPostalCode, setMaritalStatus, setClientObservations, setExtraUnits, setDependentNames,
        setFieldErrors, setError, setCurrentStep, setClientId, setServiceRequestId, setFormStartedTracked
    } = actions;

    const handleCountryChange = (value: string) => {
        const phoneCode = getPhoneCodeFromCountry(value);
        // Se o WhatsApp já tem um código de país, substituir; senão, adicionar o novo código
        let newWhatsApp = clientWhatsApp;
        if (newWhatsApp) {
            // Remove qualquer código de país existente (começa com +)
            const withoutCode = newWhatsApp.replace(/^\+\d{1,4}\s*/, '');
            newWhatsApp = phoneCode + (withoutCode ? ' ' + withoutCode : '');
        } else {
            newWhatsApp = phoneCode;
        }
        setClientCountry(value);
        setClientWhatsApp(newWhatsApp);
    };

    const handleNext = async () => {
        const formData: Step1FormData = {
            clientName, clientEmail, dateOfBirth, documentType, documentNumber,
            addressLine, city, state: clientState, postalCode, clientCountry,
            clientNationality, clientWhatsApp, maritalStatus, extraUnits,
            dependentNames
        };

        const validation = validateStep1(formData, productSlug, product.allow_extra_units);
        if (!validation.valid) {
            setFieldErrors(validation.errors || {});

            // Set global error message to trigger scroll-to-top and show alert banner
            setError(t('checkout.error_fill_required_fields', 'Please fill in all required fields marked with * to proceed.'));

            // Still scroll to specific field for precision
            const firstError = Object.keys(validation.errors || {})[0];
            if (firstError) {
                const el = document.getElementById(firstError === 'state' ? 'state' : firstError);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }

        // Clear global error if validation passes
        setError('');

        const result = await saveStep1Data(
            formData,
            extraUnits || 0,
            productSlug!,
            sellerId,
            clientId || undefined,
            serviceRequestId || undefined,
            setClientId,
            setServiceRequestId,
            formStartedTracked,
            setFormStartedTracked,
            DRAFT_STORAGE_KEY
        );

        if (!result.success) {
            setError(result.error || t('checkout.error_save_info', 'Failed to save information'));
            return;
        }

        // Update token client_data with the client's email and name so the
        // admin tracking page can identify who opened a quick (empty) link
        if (prefillToken && clientEmail) {
            supabase
                .from('checkout_prefill_tokens')
                .update({
                    client_data: {
                        clientName: clientName,
                        clientEmail: clientEmail,
                    },
                })
                .eq('token', prefillToken)
                .then(() => {});
        }

        // Se for consulta comum, pular Step 2 (Documentos)
        if (productSlug === 'consultation-common') {
            setCurrentStep(3);
        } else {
            setCurrentStep(2);
        }
    };

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">{t('checkout.step_1_title', 'Step 1: Personal Information')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {productSlug !== 'consultation-common' && (
                    <>
                        <QuantitySelector
                            product={product}
                            extraUnits={extraUnits}
                            dependentNames={dependentNames}
                            onExtraUnitsChange={setExtraUnits}
                            onDependentNamesChange={setDependentNames}
                            fieldErrors={fieldErrors}
                        />
                        <hr className="border-gold-medium/20" />
                    </>
                )}

                <ContactFields
                    clientName={clientName}
                    clientEmail={clientEmail}
                    dateOfBirth={dateOfBirth}
                    fieldErrors={fieldErrors}
                    onClientNameChange={setClientName}
                    onClientEmailChange={setClientEmail}
                    onDateOfBirthChange={setDateOfBirth}
                    isSimplified={productSlug === 'consultation-common'}
                />

                <hr className="border-gold-medium/20" />

                <LegalAddressFields
                    documentType={documentType}
                    documentNumber={documentNumber}
                    addressLine={addressLine}
                    city={city}
                    state={clientState}
                    postalCode={postalCode}
                    clientCountry={clientCountry}
                    clientNationality={clientNationality}
                    clientWhatsApp={clientWhatsApp}
                    maritalStatus={maritalStatus}
                    fieldErrors={fieldErrors}
                    onDocumentTypeChange={setDocumentType}
                    onDocumentNumberChange={setDocumentNumber}
                    onAddressLineChange={setAddressLine}
                    onCityChange={setCity}
                    onStateChange={setState}
                    onPostalCodeChange={setPostalCode}
                    onCountryChange={handleCountryChange}
                    onNationalityChange={setClientNationality}
                    onClientWhatsAppChange={setClientWhatsApp}
                    onMaritalStatusChange={setMaritalStatus}
                    isSimplified={productSlug === 'consultation-common'}
                />

                <div className="space-y-2">
                    <Label htmlFor="observations" className="text-white text-sm sm:text-base">{t('checkout.additional_observations', 'Additional Observations (Optional)')}</Label>
                    <Textarea
                        id="observations"
                        value={clientObservations}
                        onChange={(e) => setClientObservations(e.target.value)}
                        className="bg-white text-black min-h-[100px]"
                        placeholder={t('checkout.extra_info_placeholder', 'Any extra information...')}
                    />
                </div>

                <Button
                    onClick={handleNext}
                    disabled={submitting}
                    className="w-full bg-gold-medium text-black font-bold hover:bg-gold-light mt-6"
                >
                    {submitting ? t('checkout.saving', 'Saving...') : t('checkout.continue', 'Continue')} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
};
