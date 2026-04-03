import type { ContractTemplate } from '@/lib/contract-templates';
import type { SplitPaymentConfig } from '../components/steps/step3/SplitPaymentSelector';

export type PaymentMethod = '' | 'card' | 'pix' | 'zelle' | 'wise' | 'parcelow_card' | 'parcelow_pix' | 'parcelow_ted';

/** Helper para verificar se o método selecionado é qualquer variante do Parcelow */
export const isParcelowMethod = (method: PaymentMethod): boolean =>
    method === 'parcelow_card' || method === 'parcelow_pix' || method === 'parcelow_ted';

export interface DocumentFile {
    file: File;
    url: string;
}

export interface DocumentFiles {
    documentFront: DocumentFile | null;
    documentBack: DocumentFile | null;
    selfie: DocumentFile | null;
}

export interface ExistingContractData {
    contract_document_url: string;
    contract_selfie_url: string;
    contract_signed_at: string;
}

export interface PayerInfo {
    name: string;
    cpf: string;
    email: string;
    phone: string;
    postal_code: string;
    address_street: string;
    address_number: string;
    address_neighborhood: string;
    address_city: string;
    address_state: string;
    address_complement?: string;
}

export interface VisaCheckoutState {
    // Meta/App State
    currentStep: number;
    loading: boolean;
    submitting: boolean;
    isZelleProcessing: boolean;
    error: string;
    fieldErrors: Record<string, string>;
    step2Errors: Record<string, string>;
    step3Errors: Record<string, string>;

    // Step 1: Personal Info
    extraUnits: number | null;
    dependentNames: string[];
    clientName: string;
    clientEmail: string;
    clientWhatsApp: string;
    clientCountry: string;
    clientNationality: string;
    dateOfBirth: string;
    documentType: 'passport' | 'id' | 'driver_license' | '';
    documentNumber: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '';
    clientObservations: string;
    formStartedTracked: boolean;

    // Step 2: Documents
    documentsUploaded: boolean;
    documentFiles: DocumentFiles | null;
    hasExistingContract: boolean;
    existingContractData: ExistingContractData | null;

    // Step 3: Terms & Payment
    termsAccepted: boolean;
    dataAuthorization: boolean;
    paymentMethod: PaymentMethod;
    creditCardName: string;
    cpf: string;
    zelleReceipt: File | null;
    signatureImageDataUrl: string | null;
    signatureConfirmed: boolean;
    payerInfo: PayerInfo | null;

    // Persistence/Identifiers
    serviceRequestId: string | null;
    clientId: string | null;

    // Templates
    contractTemplate: ContractTemplate | null;
    chargebackAnnexTemplate: ContractTemplate | null;
    loadingTemplate: boolean;
    loadingAnnexTemplate: boolean;
    exchangeRate: number | null;

    // Upsell
    selectedUpsell: 'none' | 'canada-premium' | 'canada-revolution';
    upsellProduct: any | null; // Product info for Canada
    upsellContractTemplate: ContractTemplate | null;
    loadingUpsellTemplate: boolean;

    // Coupon
    couponCode: string;
    appliedCoupon: {
        code: string;
        discountType: 'fixed' | 'percentage';
        discountValue: number;
    } | null;
    discountAmount: number;

    // Split Payment
    splitPaymentConfig: SplitPaymentConfig | null;

    // Recurring Billing
    billingInstallmentId: string | null;

    // EB-3 Installment
    eb3ScheduleId: string | null;
    customAmount: number | null;
    eb3LateFee: number;

    // EB-2 Installment
    eb2ScheduleId: string | null;
    eb2LateFee: number;

    // Scholarship Maintenance Fee
    scholarshipScheduleId: string | null;
    scholarshipLateFee: number;

    // Geolocation for payment restrictions
    isBrazil: boolean;
    loadingLocation: boolean;
}

export interface VisaCheckoutActions {
    setExtraUnits: (val: number | null) => void;
    setDependentNames: (val: string[]) => void;
    setClientName: (val: string) => void;
    setClientEmail: (val: string) => void;
    setClientWhatsApp: (val: string) => void;
    setClientCountry: (val: string) => void;
    setClientNationality: (val: string) => void;
    setDateOfBirth: (val: string) => void;
    setDocumentType: (val: 'passport' | 'id' | 'driver_license' | '') => void;
    setDocumentNumber: (val: string) => void;
    setAddressLine: (val: string) => void;
    setCity: (val: string) => void;
    setState: (val: string) => void;
    setPostalCode: (val: string) => void;
    setMaritalStatus: (val: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '') => void;
    setClientObservations: (val: string) => void;

    setCurrentStep: (val: number) => void;
    setDocumentsUploaded: (val: boolean) => void;
    setDocumentFiles: (val: DocumentFiles | null) => void;

    setTermsAccepted: (val: boolean) => void;
    setDataAuthorization: (val: boolean) => void;
    setPaymentMethod: (val: PaymentMethod) => void;
    setCreditCardName: (val: string) => void;
    setCpf: (val: string) => void;
    setZelleReceipt: (val: File | null) => void;

    setSignatureImageDataUrl: (val: string | null) => void;
    setSignatureConfirmed: (val: boolean) => void;
    setPayerInfo: (val: PayerInfo | null) => void;

    setError: (val: string) => void;
    setFieldErrors: (val: Record<string, string>) => void;
    setStep2Errors: (val: Record<string, string>) => void;
    setStep3Errors: (val: Record<string, string>) => void;
    setSubmitting: (val: boolean) => void;
    setLoading: (val: boolean) => void;
    setIsZelleProcessing: (val: boolean) => void;

    setClientId: (val: string | null) => void;
    setServiceRequestId: (val: string | null) => void;
    setFormStartedTracked: (val: boolean) => void;
    setHasExistingContract: (val: boolean) => void;
    setExistingContractData: (val: ExistingContractData | null) => void;
    setContractTemplate: (val: ContractTemplate | null) => void;
    setChargebackAnnexTemplate: (val: ContractTemplate | null) => void;
    setLoadingTemplate: (val: boolean) => void;
    setLoadingAnnexTemplate: (val: boolean) => void;
    setExchangeRate: (val: number | null) => void;
    // Upsell
    setSelectedUpsell: (val: 'none' | 'canada-premium' | 'canada-revolution') => void;
    setUpsellProduct: (val: any | null) => void;
    setUpsellContractTemplate: (val: ContractTemplate | null) => void;
    setLoadingUpsellTemplate: (val: boolean) => void;

    // Coupon
    setCouponCode: (val: string) => void;
    setAppliedCoupon: (val: { code: string; discountType: 'fixed' | 'percentage'; discountValue: number; } | null) => void;
    setDiscountAmount: (val: number) => void;

    // Split Payment
    setSplitPaymentConfig: (val: SplitPaymentConfig | null) => void;

    // Recurring Billing
    setBillingInstallmentId: (val: string | null) => void;

    // EB-3 Installment
    setEb3ScheduleId: (val: string | null) => void;
    setCustomAmount: (val: number | null) => void;
    setEb3LateFee: (val: number) => void;

    // EB-2 Installment
    setEb2ScheduleId: (val: string | null) => void;
    setEb2LateFee: (val: number) => void;

    // Scholarship Maintenance Fee
    setScholarshipScheduleId: (val: string | null) => void;
    setScholarshipLateFee: (val: number) => void;

    // Geolocation
    setIsBrazil: (val: boolean) => void;
    setLoadingLocation: (val: boolean) => void;
    fillDevData: () => void;
}
