import { useState, useMemo } from 'react';
import type {
    VisaCheckoutState,
    VisaCheckoutActions,
    PaymentMethod,
    DocumentFiles,
    ExistingContractData
} from '../types/form.types';
import type { ContractTemplate } from '@/lib/contract-templates';

export const useVisaCheckoutForm = () => {
    // Meta/App State
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isZelleProcessing, setIsZelleProcessing] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
    const [step3Errors, setStep3Errors] = useState<Record<string, string>>({});

    // Step 1: Personal Info
    const [extraUnits, setExtraUnits] = useState(0);
    const [dependentNames, setDependentNames] = useState<string[]>([]);
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientWhatsApp, setClientWhatsApp] = useState('');
    const [clientCountry, setClientCountry] = useState('');
    const [clientNationality, setClientNationality] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [documentType, setDocumentType] = useState<'passport' | 'id' | 'driver_license' | ''>('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [addressLine, setAddressLine] = useState('');
    const [city, setCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [maritalStatus, setMaritalStatus] = useState<'single' | 'married' | 'divorced' | 'widowed' | 'other' | ''>('');
    const [clientObservations, setClientObservations] = useState('');
    const [formStartedTracked, setFormStartedTracked] = useState(false);

    // Step 2: Documents
    const [documentsUploaded, setDocumentsUploaded] = useState(false);
    const [documentFiles, setDocumentFiles] = useState<DocumentFiles | null>(null);
    const [hasExistingContract, setHasExistingContract] = useState(false);
    const [existingContractData, setExistingContractData] = useState<ExistingContractData | null>(null);

    // Step 3: Terms & Payment
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [dataAuthorization, setDataAuthorization] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
    const [creditCardName, setCreditCardName] = useState('');
    const [cpf, setCpf] = useState('');
    const [zelleReceipt, setZelleReceipt] = useState<File | null>(null);
    const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<string | null>(null);
    const [signatureConfirmed, setSignatureConfirmed] = useState<boolean>(false);

    // Persistence/Identifiers
    const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string | null>(null);

    // Templates
    const [contractTemplate, setContractTemplate] = useState<ContractTemplate | null>(null);
    const [chargebackAnnexTemplate, setChargebackAnnexTemplate] = useState<ContractTemplate | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [loadingAnnexTemplate, setLoadingAnnexTemplate] = useState(false);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);

    const state: VisaCheckoutState = {
        currentStep,
        loading,
        submitting,
        isZelleProcessing,
        error,
        fieldErrors,
        step2Errors,
        step3Errors,
        extraUnits,
        dependentNames,
        clientName,
        clientEmail,
        clientWhatsApp,
        clientCountry,
        clientNationality,
        dateOfBirth,
        documentType,
        documentNumber,
        addressLine,
        city,
        state: addressState,
        postalCode,
        maritalStatus,
        clientObservations,
        formStartedTracked,
        documentsUploaded,
        documentFiles,
        hasExistingContract,
        existingContractData,
        termsAccepted,
        dataAuthorization,
        paymentMethod,
        creditCardName,
        cpf,
        zelleReceipt,
        signatureImageDataUrl,
        signatureConfirmed,
        serviceRequestId,
        clientId,
        contractTemplate,
        chargebackAnnexTemplate,
        loadingTemplate,
        loadingAnnexTemplate,
        exchangeRate,
    };

    const actions: VisaCheckoutActions = useMemo(() => ({
        setExtraUnits,
        setDependentNames,
        setClientName,
        setClientEmail,
        setClientWhatsApp,
        setClientCountry,
        setClientNationality,
        setDateOfBirth,
        setDocumentType,
        setDocumentNumber,
        setAddressLine,
        setCity,
        setState: setAddressState,
        setPostalCode,
        setMaritalStatus,
        setClientObservations,
        setCurrentStep,
        setDocumentsUploaded,
        setDocumentFiles,
        setTermsAccepted,
        setDataAuthorization,
        setPaymentMethod,
        setCreditCardName,
        setCpf,
        setZelleReceipt,
        setSignatureImageDataUrl,
        setSignatureConfirmed,
        setError,
        setFieldErrors,
        setStep2Errors,
        setStep3Errors,
        setSubmitting,
        setLoading,
        setIsZelleProcessing,
        setClientId,
        setServiceRequestId,
        setFormStartedTracked,
        setHasExistingContract,
        setExistingContractData,
        setContractTemplate,
        setChargebackAnnexTemplate,
        setLoadingTemplate,
        setLoadingAnnexTemplate,
        setExchangeRate,
    }), []);

    return { state, actions };
};
