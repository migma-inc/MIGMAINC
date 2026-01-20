import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight } from 'lucide-react';
import type { VisaProduct } from '@/types/visa-product';
import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { validateStep1, type Step1FormData } from '@/lib/visa-checkout-validation';
import { saveStep1Data } from '@/lib/visa-checkout-service';
import { DRAFT_STORAGE_KEY, getPhoneCodeFromCountry } from '@/lib/visa-checkout-constants';
import { useParams, useSearchParams } from 'react-router-dom';

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
    const { productSlug } = useParams<{ productSlug: string }>();
    const [searchParams] = useSearchParams();
    const sellerId = searchParams.get('seller') || '';

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
            clientNationality, clientWhatsApp, maritalStatus
        };

        const validation = validateStep1(formData);
        if (!validation.valid) {
            setFieldErrors(validation.errors || {});
            // Optional: Scroll to first error
            const firstError = Object.keys(validation.errors || {})[0];
            if (firstError) {
                const el = document.getElementById(firstError === 'state' ? 'state' : firstError);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        const result = await saveStep1Data(
            formData,
            extraUnits,
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
            setError(result.error || 'Failed to save information');
            return;
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
                <CardTitle className="text-white text-lg sm:text-xl">Step 1: Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <QuantitySelector
                    product={product}
                    extraUnits={extraUnits}
                    dependentNames={dependentNames}
                    onExtraUnitsChange={setExtraUnits}
                    onDependentNamesChange={setDependentNames}
                />

                <hr className="border-gold-medium/20" />

                <ContactFields
                    clientName={clientName}
                    clientEmail={clientEmail}
                    dateOfBirth={dateOfBirth}
                    fieldErrors={fieldErrors}
                    onClientNameChange={setClientName}
                    onClientEmailChange={setClientEmail}
                    onDateOfBirthChange={setDateOfBirth}
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
                />

                <div className="space-y-2">
                    <Label htmlFor="observations" className="text-white text-sm sm:text-base">Additional Observations (Optional)</Label>
                    <Textarea
                        id="observations"
                        value={clientObservations}
                        onChange={(e) => setClientObservations(e.target.value)}
                        className="bg-white text-black min-h-[100px]"
                        placeholder="Any extra information..."
                    />
                </div>

                <Button
                    onClick={handleNext}
                    disabled={submitting}
                    className="w-full bg-gold-medium text-black font-bold hover:bg-gold-light mt-6"
                >
                    {submitting ? 'Saving...' : 'Continue'} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
};
