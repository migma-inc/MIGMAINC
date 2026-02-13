import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';
import { useContentProtection } from '@/hooks/useContentProtection';
import { getActiveContractVersion, generateContractHash, getGeolocationFromIP } from '@/lib/contracts';
import { getContractTemplate } from '@/lib/contract-templates';
import { formatContractTextToHtml } from '@/lib/contract-formatter';
import { sendTermsAcceptanceConfirmationEmail } from '@/lib/emails';
import { SignaturePadComponent } from '@/components/ui/signature-pad';
import { AlertModal } from '@/components/ui/alert-modal';
import { parseLocalDate } from '@/lib/utils';
import { PartnerAgreementText } from '@/components/partner/PartnerAgreementText';
import { Step1PersonalDetails } from '@/components/partner/steps/Step1PersonalDetails';
import { Step2AddressDetails } from '@/components/partner/steps/Step2AddressDetails';
import { Step3FiscalDetails } from '@/components/partner/steps/Step3FiscalDetails';
import { Step4PaymentDetails } from '@/components/partner/steps/Step4PaymentDetails';

export const PartnerTerms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [accepted, setAccepted] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [contractContent, setContractContent] = useState<string | null>(null);
    const [loadingContent, setLoadingContent] = useState(true);
    const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [identityPhotoPath, setIdentityPhotoPath] = useState<string | null>(null); // selfie URL
    const [identityPhotoName, setIdentityPhotoName] = useState<string | null>(null); // selfie file name
    const [documentFrontUrl, setDocumentFrontUrl] = useState<string | null>(null);
    const [documentBackUrl, setDocumentBackUrl] = useState<string | null>(null);
    const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationModalTitle, setValidationModalTitle] = useState<string>('');
    const [validationModalMessage, setValidationModalMessage] = useState<string>('');
    const [documentsUploaded, setDocumentsUploaded] = useState<boolean>(false); // Indica se os documentos foram realmente enviados (upload completo)
    const [signatureName, setSignatureName] = useState<string>(''); // Mantido para backward compatibility
    const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<string | null>(null); // Base64 da assinatura desenhada
    const [signatureConfirmed, setSignatureConfirmed] = useState<boolean>(false); // Se a assinatura foi confirmada (botão Done clicado)

    // Estados para dados contratuais
    // Identificação Pessoal
    const [fullLegalName, setFullLegalName] = useState<string>('');
    const [dateOfBirth, setDateOfBirth] = useState<string>('');
    const [nationality, setNationality] = useState<string>('');
    const [countryOfResidence, setCountryOfResidence] = useState<string>('');
    const [phoneWhatsapp, setPhoneWhatsapp] = useState<string>('');
    const [email, setEmail] = useState<string>('');

    // Endereço
    const [addressStreet, setAddressStreet] = useState<string>('');
    const [addressCity, setAddressCity] = useState<string>('');
    const [addressState, setAddressState] = useState<string>('');
    const [addressZip, setAddressZip] = useState<string>('');
    const [addressCountry, setAddressCountry] = useState<string>('');

    // Estrutura Fiscal/Empresarial
    const [businessType, setBusinessType] = useState<'Individual' | 'Company' | ''>('');
    const [taxIdType, setTaxIdType] = useState<string>('');
    const [taxIdNumber, setTaxIdNumber] = useState<string>('');
    const [companyLegalName, setCompanyLegalName] = useState<string>('');

    // Pagamento
    const [preferredPayoutMethod, setPreferredPayoutMethod] = useState<string>('');
    const [payoutDetails, setPayoutDetails] = useState<string>('');

    // Estado para controlar step atual (1=personal, 2=address, 3=fiscal, 4=payment)
    const [currentStep, setCurrentStep] = useState<number>(1);

    // Estados de validação
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Use refs to always have the latest values
    const identityPhotoPathRef = useRef<string | null>(null);
    const identityPhotoNameRef = useRef<string | null>(null);

    // Keep refs in sync with state
    useEffect(() => {
        identityPhotoPathRef.current = identityPhotoPath;
        identityPhotoNameRef.current = identityPhotoName;
    }, [identityPhotoPath, identityPhotoName]);

    // Função para mostrar aviso visual (similar ao useContentProtection)
    const showWarning = (message: string) => {
        // Adicionar estilos de animação se não existirem
        if (!document.getElementById('partner-terms-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'partner-terms-warning-styles';
            style.textContent = `
                @keyframes slideInWarning {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutWarning {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Criar elemento de aviso temporário
        const warning = document.createElement('div');
        warning.textContent = message;
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(206, 159, 72, 0.95);
            color: #000;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInWarning 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        document.body.appendChild(warning);

        setTimeout(() => {
            warning.style.animation = 'slideOutWarning 0.3s ease-out';
            setTimeout(() => {
                if (warning.parentNode) {
                    warning.parentNode.removeChild(warning);
                }
            }, 300);
        }, 3000); // Mostrar por 3 segundos
    };

    // Aplicar proteções de conteúdo quando token é válido
    useContentProtection(tokenValid === true);

    // Adicionar proteção de impressão CSS
    useEffect(() => {
        if (!tokenValid) return;

        // Adicionar estilos de proteção de impressão
        const styleId = 'contract-print-protection';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @media print {
                    #contract-content,
                    #contract-content * {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    
                    body::before {
                        content: "This document cannot be printed. It is available exclusively through the MIGMA portal.";
                        display: block !important;
                        visibility: visible !important;
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 18px;
                        font-weight: bold;
                        text-align: center;
                        color: #000;
                        background: #fff;
                        padding: 40px;
                        border: 3px solid #CE9F48;
                        border-radius: 8px;
                        z-index: 999999;
                        width: 80%;
                        max-width: 600px;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        return () => {
            const style = document.getElementById(styleId);
            if (style) {
                style.remove();
            }
        };
    }, [tokenValid]);

    // Validar token ao carregar a página
    useEffect(() => {
        const validateToken = async () => {
            // Iniciar com loading ativo desde o início
            setLoading(true);
            setLoadingContent(true);

            if (!token) {
                setTokenValid(false);
                setLoading(false);
                setLoadingContent(false);
                return;
            }

            try {
                // Buscar token no banco
                const { data, error } = await supabase
                    .from('partner_terms_acceptances')
                    .select('*, application_id')
                    .eq('token', token)
                    .single();

                if (error || !data) {
                    setTokenValid(false);
                    setLoading(false);
                    setLoadingContent(false);
                    return;
                }

                // Verificar se token expirou
                const now = new Date();
                const expiresAt = new Date(data.expires_at);
                if (now > expiresAt) {
                    setTokenValid(false);
                    setLoading(false);
                    setLoadingContent(false);
                    return;
                }

                // Verificar se já foi aceito
                if (data.accepted_at) {
                    setTokenValid(false);
                    setLoading(false);
                    setLoadingContent(false);
                    return;
                }

                setTokenValid(true);
                setTokenData(data);

                // Load contract content based on template_id
                // loadingContent já está true desde o início
                setTemplateLoadError(null);

                if (data.contract_template_id) {
                    // Template obrigatório - não pode fazer fallback
                    try {
                        const template = await getContractTemplate(data.contract_template_id);
                        if (template) {
                            // Auto-format content if it's plain text (no HTML tags)
                            let formattedContent = template.content;
                            if (template.content && !template.content.includes('<p>') && !template.content.includes('<div>')) {
                                // Content appears to be plain text, format it automatically
                                formattedContent = formatContractTextToHtml(template.content);
                                console.log('[PARTNER TERMS] Auto-formatted plain text content to HTML');
                            }
                            setContractContent(formattedContent);
                            console.log('[PARTNER TERMS] Loaded contract template:', template.name);
                        } else {
                            // Template não encontrado - ERRO CRÍTICO
                            setTemplateLoadError('The contract template selected by the administrator could not be found. Please contact support.');
                            setContractContent(null);
                            console.error('[PARTNER TERMS] Template not found:', data.contract_template_id);
                        }
                    } catch (templateError) {
                        // Erro ao buscar template - ERRO CRÍTICO
                        setTemplateLoadError('The contract template selected by the administrator could not be found. Please contact support.');
                        setContractContent(null);
                        console.error('[PARTNER TERMS] Error loading contract template:', templateError);
                    }
                } else {
                    // No template ID, fetch from application_terms
                    try {
                        const contractVersion = await getActiveContractVersion();
                        if (contractVersion && contractVersion.content) {
                            // Auto-format content if it's plain text (no HTML tags)
                            let formattedContent = contractVersion.content;
                            if (contractVersion.content && !contractVersion.content.includes('<p>') && !contractVersion.content.includes('<div>')) {
                                // Content appears to be plain text, format it automatically
                                formattedContent = formatContractTextToHtml(contractVersion.content);
                                console.log('[PARTNER TERMS] Auto-formatted plain text content from application_terms to HTML');
                            }
                            setContractContent(formattedContent);
                            console.log('[PARTNER TERMS] Loaded contract from application_terms, version:', contractVersion.version);
                        } else {
                            // application_terms não encontrado - ERRO
                            setTemplateLoadError('Default contract terms are not available. Please contact support.');
                            setContractContent(null);
                            console.error('[PARTNER TERMS] No active contract version found in application_terms');
                        }
                    } catch (termsError) {
                        // Erro ao buscar application_terms
                        setTemplateLoadError('Error loading contract content. Please try again later.');
                        setContractContent(null);
                        console.error('[PARTNER TERMS] Error loading application_terms:', termsError);
                    }
                }

                setLoadingContent(false);
            } catch (error) {
                console.error('Error validating token:', error);
                setTokenValid(false);
                setLoadingContent(false);
            } finally {
                setLoading(false);
                // loadingContent será setado como false apenas quando o conteúdo for carregado ou houver erro
            }
        };

        validateToken();
    }, [token]);

    // Chave única para localStorage baseada no token
    const getStorageKey = () => {
        if (!token) return null;
        return `partner_terms_form_${token}`;
    };

    // Função para salvar todos os dados do formulário no localStorage
    const saveFormData = () => {
        const storageKey = getStorageKey();
        if (!storageKey) return;

        const formData = {
            // Identificação Pessoal
            fullLegalName,
            dateOfBirth,
            nationality,
            countryOfResidence,
            phoneWhatsapp,
            email,
            // Endereço
            addressStreet,
            addressCity,
            addressState,
            addressZip,
            addressCountry,
            // Estrutura Fiscal/Empresarial
            businessType,
            taxIdType,
            taxIdNumber,
            companyLegalName,
            // Pagamento
            preferredPayoutMethod,
            payoutDetails,
            // Assinatura
            signatureName,
            signatureImageDataUrl,
            signatureConfirmed,
            documentsUploaded,
            // Step atual
            currentStep,
            // Checkbox de aceite
            accepted,
        };

        try {
            localStorage.setItem(storageKey, JSON.stringify(formData));
        } catch (error) {
            console.warn('Error saving form data to localStorage:', error);
        }
    };

    // Função para restaurar dados do formulário do localStorage
    const restoreFormData = () => {
        const storageKey = getStorageKey();
        if (!storageKey) return;

        try {
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                const formData = JSON.parse(savedData);

                // Restaurar todos os campos
                if (formData.fullLegalName !== undefined) setFullLegalName(formData.fullLegalName);
                if (formData.dateOfBirth !== undefined) setDateOfBirth(formData.dateOfBirth);
                if (formData.nationality !== undefined) setNationality(formData.nationality);
                if (formData.countryOfResidence !== undefined) setCountryOfResidence(formData.countryOfResidence);
                if (formData.phoneWhatsapp !== undefined) setPhoneWhatsapp(formData.phoneWhatsapp);
                if (formData.email !== undefined) setEmail(formData.email);
                if (formData.addressStreet !== undefined) setAddressStreet(formData.addressStreet);
                if (formData.addressCity !== undefined) setAddressCity(formData.addressCity);
                if (formData.addressState !== undefined) setAddressState(formData.addressState);
                if (formData.addressZip !== undefined) setAddressZip(formData.addressZip);
                if (formData.addressCountry !== undefined) setAddressCountry(formData.addressCountry);
                if (formData.businessType !== undefined) setBusinessType(formData.businessType);
                if (formData.taxIdType !== undefined) setTaxIdType(formData.taxIdType);
                if (formData.taxIdNumber !== undefined) setTaxIdNumber(formData.taxIdNumber);
                if (formData.companyLegalName !== undefined) setCompanyLegalName(formData.companyLegalName);
                if (formData.preferredPayoutMethod !== undefined) setPreferredPayoutMethod(formData.preferredPayoutMethod);
                if (formData.payoutDetails !== undefined) setPayoutDetails(formData.payoutDetails);
                if (formData.signatureName !== undefined) setSignatureName(formData.signatureName);
                if (formData.signatureImageDataUrl !== undefined) setSignatureImageDataUrl(formData.signatureImageDataUrl);
                if (formData.signatureConfirmed !== undefined) setSignatureConfirmed(formData.signatureConfirmed);
                if (formData.documentsUploaded !== undefined) setDocumentsUploaded(formData.documentsUploaded);
                if (formData.currentStep !== undefined) setCurrentStep(formData.currentStep);
                if (formData.accepted !== undefined) setAccepted(formData.accepted);
            }
        } catch (error) {
            console.warn('Error restoring form data from localStorage:', error);
        }
    };

    // Função para limpar dados salvos do localStorage
    const clearFormData = () => {
        const storageKey = getStorageKey();
        if (!storageKey) return;

        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn('Error clearing form data from localStorage:', error);
        }
    };

    // Pré-preenchimento de dados da aplicação e restauração de dados salvos
    useEffect(() => {
        if (tokenData?.application_id && tokenValid) {
            const storageKey = getStorageKey();
            const savedData = storageKey ? localStorage.getItem(storageKey) : null;

            if (savedData) {
                // Há dados salvos, restaurar eles primeiro
                restoreFormData();
            } else {
                // Não há dados salvos, pré-preencher com dados da aplicação
                supabase
                    .from('global_partner_applications')
                    .select('email, full_name, phone, country')
                    .eq('id', tokenData.application_id)
                    .single()
                    .then(({ data, error }) => {
                        if (!error && data) {
                            setEmail(data.email || '');
                            setFullLegalName(data.full_name || '');
                            setPhoneWhatsapp(data.phone || '');
                            setCountryOfResidence(data.country || '');
                            setAddressCountry(data.country || '');
                        }
                    });
            }
        }
    }, [tokenData, tokenValid]);

    // Salvar dados automaticamente sempre que qualquer campo mudar
    useEffect(() => {
        if (!tokenValid || !token) return;

        // Debounce para não salvar a cada keystroke
        const timer = setTimeout(() => {
            saveFormData();
        }, 500); // Salvar após 500ms de inatividade

        return () => clearTimeout(timer);
    }, [
        fullLegalName, dateOfBirth, nationality, countryOfResidence, phoneWhatsapp, email,
        addressStreet, addressCity, addressState, addressZip, addressCountry,
        businessType, taxIdType, taxIdNumber, companyLegalName,
        preferredPayoutMethod, payoutDetails,
        signatureName, currentStep, accepted,
        tokenValid, token
    ]);

    const getClientIP = async (): Promise<string | null> => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || null;
        } catch (error) {
            console.warn('Could not fetch IP address:', error);
            return null;
        }
    };

    // Função de validação do formulário
    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        // Identificação Pessoal
        if (!fullLegalName.trim()) errors.fullLegalName = 'Full legal name is required';
        if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
        else {
            // Parse date in local timezone to avoid timezone conversion issues
            const birthDate = parseLocalDate(dateOfBirth);
            if (!birthDate) {
                errors.dateOfBirth = 'Invalid date format';
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (birthDate >= today) errors.dateOfBirth = 'Date of birth must be in the past';
            }
        }
        if (!nationality.trim()) errors.nationality = 'Nationality is required';
        if (!countryOfResidence.trim()) errors.countryOfResidence = 'Country of residence is required';
        if (!phoneWhatsapp.trim()) errors.phoneWhatsapp = 'Phone/WhatsApp is required';
        else if (!/^[\d\s\-\+\(\)]+$/.test(phoneWhatsapp)) {
            errors.phoneWhatsapp = 'Invalid phone format';
        }
        if (!email.trim()) errors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = 'Invalid email format';
        }

        // Endereço
        if (!addressStreet.trim()) errors.addressStreet = 'Street address is required';
        if (!addressCity.trim()) errors.addressCity = 'City is required';
        else if (!/^[a-zA-ZÀ-ÿ\s\-\.,']+$/.test(addressCity)) {
            errors.addressCity = 'City name should only contain letters, spaces, and common punctuation';
        }
        if (!addressState.trim()) {
            // State is optional, no error if empty
        } else if (!/^[a-zA-ZÀ-ÿ\s\-\.,']+$/.test(addressState)) {
            errors.addressState = 'State/Province should only contain letters, spaces, and common punctuation';
        }
        // ZIP is optional, no validation needed
        if (!addressCountry.trim()) errors.addressCountry = 'Country is required';

        // Estrutura Fiscal/Empresarial
        if (!businessType) errors.businessType = 'Business type is required';
        if (!taxIdType) errors.taxIdType = 'Tax ID type is required';
        if (!taxIdNumber.trim()) errors.taxIdNumber = 'Tax ID number is required';
        if (businessType === 'Company') {
            if (!companyLegalName.trim()) errors.companyLegalName = 'Company legal name is required';
        }

        // Pagamento
        if (!preferredPayoutMethod) errors.preferredPayoutMethod = 'Preferred payout method is required';
        if (!payoutDetails.trim()) errors.payoutDetails = 'Payout details are required';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Função para validar step específico
    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        if (step === 1) {
            // Validar Personal Information
            if (!fullLegalName.trim()) errors.fullLegalName = 'Full legal name is required';
            if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
            else {
                // Parse date in local timezone to avoid timezone conversion issues
                const birthDate = parseLocalDate(dateOfBirth);
                if (!birthDate) {
                    errors.dateOfBirth = 'Invalid date format';
                } else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (birthDate >= today) errors.dateOfBirth = 'Date of birth must be in the past';
                }
            }
            if (!nationality.trim()) errors.nationality = 'Nationality is required';
            if (!countryOfResidence.trim()) errors.countryOfResidence = 'Country of residence is required';
            if (!phoneWhatsapp.trim()) errors.phoneWhatsapp = 'Phone/WhatsApp is required';
            else if (!/^[\d\s\-\+\(\)]+$/.test(phoneWhatsapp)) {
                errors.phoneWhatsapp = 'Invalid phone format';
            }
            if (!email.trim()) errors.email = 'Email is required';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.email = 'Invalid email format';
            }
        } else if (step === 2) {
            // Validar Address
            if (!addressStreet.trim()) errors.addressStreet = 'Street address is required';
            if (!addressCity.trim()) errors.addressCity = 'City is required';
            else if (!/^[a-zA-ZÀ-ÿ\s\-\.,']+$/.test(addressCity)) {
                errors.addressCity = 'City name should only contain letters, spaces, and common punctuation';
            }
            if (!addressState.trim()) {
                // State is optional, no error if empty
            } else if (!/^[a-zA-ZÀ-ÿ\s\-\.,']+$/.test(addressState)) {
                errors.addressState = 'State/Province should only contain letters, spaces, and common punctuation';
            }
            // ZIP is optional, no validation needed
            if (!addressCountry.trim()) errors.addressCountry = 'Country is required';
        } else if (step === 3) {
            // Validar Fiscal/Business
            if (!businessType) errors.businessType = 'Business type is required';
            if (!taxIdType) errors.taxIdType = 'Tax ID type is required';
            if (!taxIdNumber.trim()) errors.taxIdNumber = 'Tax ID number is required';
            if (businessType === 'Company') {
                if (!companyLegalName.trim()) errors.companyLegalName = 'Company legal name is required';
            }
        } else if (step === 4) {
            // Validar Payment
            if (!preferredPayoutMethod) errors.preferredPayoutMethod = 'Preferred payout method is required';
            if (!payoutDetails.trim()) errors.payoutDetails = 'Payout details are required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Função para avançar para próximo step
    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 4) {
                setCurrentStep(currentStep + 1);
            } else {
                // Step 4 completo - rolar para seção de upload de documentos
                setTimeout(() => {
                    const photoSection = document.getElementById('photo-upload-section');
                    if (photoSection) {
                        smoothScrollTo(photoSection, 1000);
                    }
                }, 300); // Pequeno delay para melhor UX
            }
        }
    };

    // Função para voltar ao step anterior
    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Função helper para verificar se formulário está completo
    const isFormComplete = (): boolean => {
        return !!(
            fullLegalName.trim() &&
            dateOfBirth &&
            nationality.trim() &&
            countryOfResidence.trim() &&
            phoneWhatsapp.trim() &&
            email.trim() &&
            addressStreet.trim() &&
            addressCity.trim() &&
            // addressState is optional
            // addressZip is optional
            addressCountry.trim() &&
            businessType &&
            taxIdType &&
            taxIdNumber.trim() &&
            preferredPayoutMethod &&
            payoutDetails.trim() &&
            (businessType === 'Individual' || (businessType === 'Company' && companyLegalName.trim()))
        );
    };

    // Smooth scroll animation function
    const smoothScrollTo = (targetElement: HTMLElement, duration: number = 800) => {
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        let startTime: number | null = null;

        const easeInOutCubic = (t: number): number => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        const animation = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = easeInOutCubic(progress);

            window.scrollTo(0, startPosition + distance * ease);

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    };

    const handleAccept = async () => {
        if (!accepted || !token || !tokenValid) {
            setValidationModalTitle('Attention Required');
            setValidationModalMessage('Please accept the terms and conditions first by checking the checkbox.');
            setShowValidationModal(true);
            return;
        }

        // Verificar se o formulário está completo
        if (!isFormComplete()) {
            setValidationModalTitle('Incomplete Form');
            setValidationModalMessage('Please complete all required fields in the form to proceed. Check all steps: Personal Information, Address, Fiscal Data, and Payment.');
            setShowValidationModal(true);
            // Scroll to first error
            setTimeout(() => {
                const firstErrorField = document.querySelector('[data-required="true"]:invalid, input[required]:invalid, select[required]:invalid');
                if (firstErrorField) {
                    firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            return;
        }

        // Verificar se os documentos foram realmente enviados (upload completo)
        if (!documentsUploaded) {
            setValidationModalTitle('Documents Pending');
            setValidationModalMessage('You have not uploaded all required documents. Please upload the front and back of your identity document, and a selfie holding the document to proceed.');
            setShowValidationModal(true);
            return;
        }

        // Use refs to get the latest values (avoid closure issues)
        const currentPhotoPath = identityPhotoPathRef.current;
        const currentPhotoName = identityPhotoNameRef.current;

        // Verificar se todas as imagens foram enviadas (frente, verso e selfie)
        if (!documentFrontUrl || !documentBackUrl || !currentPhotoPath || !currentPhotoName) {
            setValidationModalTitle('Documents Pending');
            setValidationModalMessage('You have not uploaded all required documents. Please upload the front and back of your identity document, and a selfie holding the document to proceed.');
            setShowValidationModal(true);
            return;
        }

        // Verificar se assinatura foi confirmada (botão Done clicado)
        if (!signatureImageDataUrl || !signatureConfirmed) {
            setValidationModalTitle('Signature Pending');
            setValidationModalMessage('You have not signed the contract. Please draw your digital signature and click the "Done" button to confirm before proceeding.');
            setShowValidationModal(true);
            return;
        }

        // Iniciar loading
        setIsSubmitting(true);
        setPhotoUploadError(null);

        try {
            // Validar formulário antes de continuar
            if (!validateForm()) {
                // Encontrar primeiro step com erro
                let firstErrorStep = 1;
                if (formErrors.fullLegalName || formErrors.dateOfBirth || formErrors.nationality ||
                    formErrors.countryOfResidence || formErrors.phoneWhatsapp || formErrors.email) {
                    firstErrorStep = 1;
                } else if (formErrors.addressStreet || formErrors.addressCity || formErrors.addressCountry) {
                    firstErrorStep = 2;
                } else if (formErrors.businessType || formErrors.companyLegalName || formErrors.taxIdNumber) {
                    firstErrorStep = 3;
                } else if (formErrors.preferredPayoutMethod || formErrors.payoutDetails) {
                    firstErrorStep = 4;
                }
                setCurrentStep(firstErrorStep);
                setIsSubmitting(false);
                setValidationModalTitle('Incomplete Form');
                setValidationModalMessage('Please fill in all required fields correctly. Check all form steps before proceeding.');
                setShowValidationModal(true);
                return;
            }

            // Obter IP address e user agent
            const ipAddress = await getClientIP();
            const userAgent = navigator.userAgent;

            // ETAPA 8: Buscar dados legais (versão, hash, geolocalização)
            console.log('[PARTNER TERMS] Fetching legal data (version, hash, geolocation)...');

            // 1. Buscar versão ativa do contrato
            let contractVersion: { version: string; content: string } | null = null;
            try {
                contractVersion = await getActiveContractVersion();
                if (contractVersion) {
                    console.log('[PARTNER TERMS] Active contract version found:', contractVersion.version);
                } else {
                    console.warn('[PARTNER TERMS] No active contract version found');
                }
            } catch (versionError) {
                console.warn('[PARTNER TERMS] Error fetching contract version:', versionError);
            }

            // 2. Obter HTML do contrato renderizado e gerar hash
            let contractHash: string | null = null;
            try {
                const contractElement = document.getElementById('contract-content');
                const headerElement = document.getElementById('contract-header');
                const contractHTML = contractElement?.innerHTML || '';
                const headerHTML = headerElement?.innerHTML || '';
                const fullHTML = headerHTML + contractHTML;

                if (fullHTML) {
                    contractHash = await generateContractHash(fullHTML);
                    console.log('[PARTNER TERMS] Contract hash generated:', contractHash.substring(0, 16) + '...');
                } else {
                    console.warn('[PARTNER TERMS] Contract HTML not found, cannot generate hash');
                }
            } catch (hashError) {
                console.warn('[PARTNER TERMS] Error generating contract hash:', hashError);
            }

            // 3. Obter geolocalização via IP
            let geolocation: { country: string | null; city: string | null } = { country: null, city: null };
            try {
                geolocation = await getGeolocationFromIP(ipAddress);
                if (geolocation.country) {
                    console.log('[PARTNER TERMS] Geolocation obtained:', geolocation);
                } else {
                    console.warn('[PARTNER TERMS] Geolocation not available');
                }
            } catch (geoError) {
                console.warn('[PARTNER TERMS] Error fetching geolocation (non-critical):', geoError);
            }

            // Atualizar registro de aceite no banco
            console.log('[PARTNER TERMS] Updating acceptance with photo and legal data:', {
                identityPhotoPath: currentPhotoPath,
                identityPhotoName: currentPhotoName,
                token,
                termAcceptanceId: tokenData.id,
                contractVersion: contractVersion?.version,
                hasHash: !!contractHash,
                geolocation: geolocation
            });


            const updateData: any = {
                accepted_at: new Date().toISOString(),
                ip_address: ipAddress,
                user_agent: userAgent,
                identity_photo_path: currentPhotoPath, // selfie URL
                identity_photo_name: currentPhotoName,
                document_front_url: documentFrontUrl,
                document_back_url: documentBackUrl,
            };

            // Upload da assinatura desenhada (Signature Pad)
            if (signatureImageDataUrl) {
                try {
                    console.log('[PARTNER TERMS] Uploading signature image...');

                    // Converter base64 para blob
                    const base64Data = signatureImageDataUrl.split(',')[1];
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/png' });

                    // Criar File a partir do blob
                    const fileName = `signatures/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
                    const file = new File([blob], fileName, { type: 'image/png' });

                    // Upload para storage (bucket específico para assinaturas)
                    const { error: uploadError } = await supabase.storage
                        .from('partner-signatures')
                        .upload(fileName, file, {
                            contentType: 'image/png',
                            upsert: false,
                        });

                    if (uploadError) {
                        console.error('[PARTNER TERMS] Error uploading signature:', uploadError);
                        throw uploadError;
                    }

                    // Obter URL pública
                    const { data: { publicUrl } } = supabase.storage
                        .from('partner-signatures')
                        .getPublicUrl(fileName);

                    updateData.signature_image_url = publicUrl;
                    console.log('[PARTNER TERMS] Signature uploaded successfully:', publicUrl);
                } catch (sigError) {
                    console.error('[PARTNER TERMS] Error processing signature upload:', sigError);
                    setIsSubmitting(false);
                    setPhotoUploadError('Error uploading signature. Please try again.');
                    return;
                }
            }

            // Adicionar assinatura digital (backward compatibility)
            if (signatureName.trim()) {
                updateData.signature_name = signatureName.trim();
            }

            // ETAPA 5: Adicionar dados contratuais
            updateData.full_legal_name = fullLegalName.trim();
            updateData.date_of_birth = dateOfBirth || null;
            updateData.nationality = nationality.trim();
            updateData.country_of_residence = countryOfResidence.trim();
            updateData.phone_whatsapp = phoneWhatsapp.trim();
            updateData.email = email.trim();
            updateData.address_street = addressStreet.trim();
            updateData.address_city = addressCity.trim();
            updateData.address_state = addressState.trim();
            updateData.address_zip = addressZip.trim();
            updateData.address_country = addressCountry.trim();
            updateData.business_type = businessType || null;
            updateData.tax_id_type = taxIdType.trim() || null;
            updateData.tax_id_number = taxIdNumber.trim() || null;
            updateData.company_legal_name = businessType === 'Company' ? companyLegalName.trim() : null;
            updateData.preferred_payout_method = preferredPayoutMethod || null;
            updateData.payout_details = payoutDetails.trim() || null;

            // ETAPA 8: Adicionar dados legais
            if (contractVersion) {
                updateData.contract_version = contractVersion.version;
            }
            if (contractHash) {
                updateData.contract_hash = contractHash;
            }
            if (geolocation.country) {
                updateData.geolocation_country = geolocation.country;
            }
            if (geolocation.city) {
                updateData.geolocation_city = geolocation.city;
            }

            const { data: updatedAcceptance, error: updateError } = await supabase
                .from('partner_terms_acceptances')
                .update(updateData)
                .eq('token', token)
                .select()
                .single();

            if (updateError) {
                console.error('[PARTNER TERMS] Error updating acceptance:', updateError);
                console.error('[PARTNER TERMS] Update error details:', {
                    code: updateError.code,
                    message: updateError.message,
                    details: updateError.details,
                    hint: updateError.hint
                });
                setIsSubmitting(false);
                showWarning("There was an error accepting the terms. Please try again.");
                return;
            }

            console.log('[PARTNER TERMS] Acceptance updated successfully:', updatedAcceptance);
            console.log('[PARTNER TERMS] Updated fields:', {
                identity_photo_path: updatedAcceptance?.identity_photo_path,
                identity_photo_name: updatedAcceptance?.identity_photo_name,
                accepted_at: updatedAcceptance?.accepted_at
            });

            // Verify that the saved photo path matches what we just set
            if (updatedAcceptance?.identity_photo_path !== currentPhotoPath) {
                console.error('[PARTNER TERMS] Photo path mismatch!', {
                    expected: currentPhotoPath,
                    saved: updatedAcceptance?.identity_photo_path
                });
                setIsSubmitting(false);
                showWarning('There was an error saving your photo. Please try uploading again.');
                return;
            }

            // ETAPA 9: Enviar email de confirmação após aceite bem-sucedido
            if (tokenData?.application_id) {
                try {
                    // Buscar dados da aplicação para obter email e nome
                    const { data: application, error: appError } = await supabase
                        .from('global_partner_applications')
                        .select('email, full_name')
                        .eq('id', tokenData.application_id)
                        .single();

                    if (!appError && application?.email && application?.full_name) {
                        console.log('[PARTNER TERMS] Sending confirmation email to:', application.email);
                        const emailSent = await sendTermsAcceptanceConfirmationEmail(
                            application.email,
                            application.full_name
                        );

                        if (emailSent) {
                            console.log('[PARTNER TERMS] Confirmation email sent successfully');
                        } else {
                            console.warn('[PARTNER TERMS] Failed to send confirmation email (non-critical)');
                        }
                    } else {
                        console.warn('[PARTNER TERMS] Could not fetch application data for email:', appError);
                    }
                } catch (emailError) {
                    console.warn('[PARTNER TERMS] Error sending confirmation email (non-critical):', emailError);
                    // Não bloquear - email é secundário e não deve impedir o fluxo
                }
            }

            // ETAPA 10: Token de visualização será gerado e email será enviado apenas quando o admin aprovar o contrato
            // O email com o link de visualização será enviado pela Edge Function approve-partner-contract
            // após a aprovação do admin, não imediatamente após a assinatura

            // Limpar dados salvos do localStorage após submissão bem-sucedida
            clearFormData();

            // Aguardar um pouco para garantir que o update foi persistido no banco
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Chamar Edge Function para gerar PDF do contrato (em background)
            if (tokenData?.application_id) {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                try {
                    console.log('[PARTNER TERMS] Triggering PDF generation:', {
                        application_id: tokenData.application_id,
                        term_acceptance_id: updatedAcceptance.id,
                        identity_photo_path: updatedAcceptance.identity_photo_path,
                        expected_photo_path: currentPhotoPath
                    });

                    fetch(`${SUPABASE_URL}/functions/v1/generate-contract-pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify({
                            application_id: tokenData.application_id,
                            term_acceptance_id: updatedAcceptance.id,
                        }),
                        keepalive: true, // Mantém a requisição mesmo após navegação
                    }).catch(err => {
                        console.warn('Failed to trigger PDF generation:', err);
                    });
                } catch (pdfError) {
                    console.warn('Error triggering PDF generation:', pdfError);
                }
            }

            navigate('/partner-terms/success');
        } catch (error) {
            console.error("Error accepting terms:", error);
            setIsSubmitting(false);
            showWarning("There was an error accepting the terms. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground py-12">
            {/* Loading Overlay - mesma animação do GlobalPartner */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="loader-gold mx-auto mb-4"></div>
                        <p className="text-gold-light text-lg font-semibold">Processing your acceptance...</p>
                        <p className="text-gray-400 text-sm mt-2">Please wait</p>
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-gold-light hover:text-gold-medium" onClick={() => navigate('/global-partner')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Application
                </Button>

                {/* Terms & Conditions Agreement - FIRST */}
                <Card className="mb-6 shadow-lg border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                    <CardHeader
                        id="contract-header"
                        className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark rounded-t-lg pb-8 pt-10"
                        style={{
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                        }}
                    >
                        <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2 text-white">
                            <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-gold-medium/50">1</span>
                            MIGMA Global Independent Contractor Terms & Conditions Agreement
                        </CardTitle>
                        <CardDescription className="text-lg mt-4 text-gold-light">
                            Please read this Agreement carefully. By accepting these Terms & Conditions, you agree to work with MIGMA as an independent contractor (not as an employee).
                        </CardDescription>
                        {!loading && !tokenValid && token && (
                            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-md">
                                <p className="text-red-300 text-sm">
                                    Invalid or expired token. Please contact MIGMA for a valid access link.
                                </p>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent
                        id="contract-content"
                        className="p-8 sm:p-12 space-y-8 text-justify leading-relaxed text-gray-300 contract-protected"
                        style={{
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                        }}
                    >
                        {/* Aviso Legal de Proteção */}
                        {!loading && tokenValid && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/40 via-yellow-800/30 to-yellow-900/40 border-2 border-yellow-600/50 rounded-lg flex items-start gap-3">
                                <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-yellow-200 font-semibold text-sm mb-1">
                                        Document Protection Active
                                    </p>
                                    <p className="text-yellow-300 text-sm">
                                        This agreement is available for viewing only. Downloading, copying or printing is disabled.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Loading skeleton - show while loading content or validating token */}
                        {(loading || loadingContent) && (
                            <div className="space-y-6 animate-pulse">
                                {/* Title skeleton */}
                                <div className="space-y-2">
                                    <div className="h-8 bg-gold-medium/20 rounded w-3/4"></div>
                                    <div className="h-4 bg-gold-medium/10 rounded w-1/2"></div>
                                </div>

                                {/* Separator skeleton */}
                                <div className="h-px bg-gold-medium/20"></div>

                                {/* Content paragraphs skeleton */}
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="h-4 bg-gold-medium/10 rounded w-full"></div>
                                        <div className="h-4 bg-gold-medium/10 rounded w-5/6"></div>
                                        <div className="h-4 bg-gold-medium/10 rounded w-4/5"></div>
                                    </div>
                                ))}

                                {/* Section title skeleton */}
                                <div className="space-y-3 mt-8">
                                    <div className="h-6 bg-gold-medium/20 rounded w-1/3"></div>
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="h-4 bg-gold-medium/10 rounded w-full"></div>
                                            <div className="h-4 bg-gold-medium/10 rounded w-5/6"></div>
                                        </div>
                                    ))}
                                </div>

                                {/* Another separator */}
                                <div className="h-px bg-gold-medium/20 mt-6"></div>

                                {/* More content */}
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="h-4 bg-gold-medium/10 rounded w-full"></div>
                                        <div className="h-4 bg-gold-medium/10 rounded w-4/5"></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error state - show only when loading is complete and there's an error */}
                        {!loading && !loadingContent && templateLoadError && (
                            <div className="mb-6 p-6 bg-red-900/30 border-2 border-red-500/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-red-300 mb-2">Contract Content Error</h3>
                                        <p className="text-red-200">{templateLoadError}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Render contract content - only show when loading is complete and content exists */}
                        {!loading && !loadingContent && contractContent && !templateLoadError && (
                            <div
                                className="prose prose-invert max-w-none prose-p:my-4 prose-p:leading-relaxed prose-strong:text-gold-light"
                                style={{
                                    lineHeight: '1.75',
                                }}
                                dangerouslySetInnerHTML={{ __html: contractContent }}
                            />
                        )}

                        {/* Fallback error - only show when loading is complete, no content, and no specific error */}
                        {!loading && !loadingContent && !contractContent && !templateLoadError && (
                            <div className="mb-6 p-6 bg-red-900/30 border-2 border-red-500/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-red-300 mb-2">Contract Content Unavailable</h3>
                                        <p className="text-red-200">Contract content could not be loaded. Please contact support.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <PartnerAgreementText />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">24. Waiver</h3>
                            <p>A waiver of breach does not waive future breaches.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">25. Execution</h3>
                            <p>
                                This Agreement is fully effective upon Contractor electronic acceptance, without
                                requiring signature from MIGMA INC.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Contractual Information Form - SECOND */}
                {!loading && tokenValid && !templateLoadError && contractContent && (
                    <Card id="contractual-information-section" className="mb-6 shadow-lg border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                        <CardHeader className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark rounded-t-lg pb-6 pt-8">
                            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-white">
                                <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-gold-medium/50">2</span>
                                Contractual Information
                            </CardTitle>
                            <CardDescription className="text-base mt-3 text-gold-light">
                                Please fill in all required contractual information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8">
                            {/* Progress Indicator */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    {[1, 2, 3, 4].map((step) => (
                                        <div key={step} className="flex items-center flex-1">
                                            <div className="flex flex-col items-center flex-1">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step === currentStep
                                                    ? 'bg-gold-medium text-black border-gold-medium'
                                                    : step < currentStep
                                                        ? 'bg-green-600 text-white border-green-600'
                                                        : 'bg-black/50 text-gray-400 border-gold-medium/30'
                                                    }`}>
                                                    {step < currentStep ? '✓' : step}
                                                </div>
                                                <span className={`text-xs mt-2 ${step === currentStep ? 'text-gold-light font-semibold' : 'text-gray-400'}`}>
                                                    {step === 1 ? 'Personal' : step === 2 ? 'Address' : step === 3 ? 'Fiscal' : 'Payment'}
                                                </span>
                                            </div>
                                            {step < 4 && (
                                                <div className={`flex-1 h-0.5 mx-2 ${step < currentStep ? 'bg-green-600' : 'bg-gold-medium/30'}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Step 1: Personal Information */}
                            {currentStep === 1 && (
                                <Step1PersonalDetails
                                    fullLegalName={fullLegalName}
                                    setFullLegalName={setFullLegalName}
                                    dateOfBirth={dateOfBirth}
                                    setDateOfBirth={setDateOfBirth}
                                    nationality={nationality}
                                    setNationality={setNationality}
                                    countryOfResidence={countryOfResidence}
                                    setCountryOfResidence={setCountryOfResidence}
                                    phoneWhatsapp={phoneWhatsapp}
                                    setPhoneWhatsapp={setPhoneWhatsapp}
                                    email={email}
                                    setEmail={setEmail}
                                    formErrors={formErrors}
                                />
                            )}

                            {/* Step 2: Address */}
                            {currentStep === 2 && (
                                <Step2AddressDetails
                                    addressStreet={addressStreet}
                                    setAddressStreet={setAddressStreet}
                                    addressCity={addressCity}
                                    setAddressCity={setAddressCity}
                                    addressState={addressState}
                                    setAddressState={setAddressState}
                                    addressZip={addressZip}
                                    setAddressZip={setAddressZip}
                                    addressCountry={addressCountry}
                                    setAddressCountry={setAddressCountry}
                                    formErrors={formErrors}
                                />
                            )}

                            {/* Step 3: Fiscal/Business */}
                            {currentStep === 3 && (
                                <Step3FiscalDetails
                                    businessType={businessType}
                                    setBusinessType={setBusinessType}
                                    companyLegalName={companyLegalName}
                                    setCompanyLegalName={setCompanyLegalName}
                                    taxIdType={taxIdType}
                                    setTaxIdType={setTaxIdType}
                                    taxIdNumber={taxIdNumber}
                                    setTaxIdNumber={setTaxIdNumber}
                                    formErrors={formErrors}
                                />
                            )}

                            {/* Step 4: Payment */}
                            {currentStep === 4 && (
                                <Step4PaymentDetails
                                    preferredPayoutMethod={preferredPayoutMethod}
                                    setPreferredPayoutMethod={setPreferredPayoutMethod}
                                    payoutDetails={payoutDetails}
                                    setPayoutDetails={setPayoutDetails}
                                    formErrors={formErrors}
                                />
                            )}

                            {/* Navigation Buttons */}
                            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gold-medium/30">
                                <Button
                                    onClick={handlePrevious}
                                    disabled={currentStep === 1}
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Previous
                                </Button>

                                <div className="text-sm text-gray-400">
                                    Step {currentStep} of 4
                                </div>

                                {currentStep < 4 ? (
                                    <Button
                                        onClick={handleNext}
                                        className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleNext}
                                        className="bg-gradient-to-b from-green-500 via-green-600 to-green-500 text-white font-bold hover:from-green-600 hover:via-green-500 hover:to-green-600 transition-all shadow-lg"
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        Complete
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Document + Selfie Upload Section - THIRD */}
                {!loading && tokenValid && (
                    <Card id="photo-upload-section" className="mb-6 shadow-xl border-2 border-gold-medium/50 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                        <CardHeader className="pb-6 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark text-white rounded-t-lg">
                            <div className="flex items-center gap-3">
                                <span className="bg-white text-gold-medium rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg">3</span>
                                <div>
                                    <CardTitle className="text-2xl font-bold text-white">
                                        Identity Verification Required
                                    </CardTitle>
                                    <CardDescription className="text-gold-light mt-1 text-base">
                                        Upload the front and back of your document and a selfie holding the document.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8">
                            <DocumentUpload
                                onComplete={({ documentFront, documentBack, selfie }) => {
                                    console.log('[PARTNER TERMS] Documents uploaded successfully:', {
                                        documentFrontUrl: documentFront.url,
                                        documentBackUrl: documentBack.url,
                                        selfieUrl: selfie.url,
                                    });
                                    setDocumentFrontUrl(documentFront.url);
                                    setDocumentBackUrl(documentBack.url);
                                    setIdentityPhotoPath(selfie.url);
                                    setIdentityPhotoName(selfie.file.name);
                                    identityPhotoPathRef.current = selfie.url;
                                    identityPhotoNameRef.current = selfie.file.name;
                                    setDocumentsUploaded(true); // Marcar que os documentos foram realmente enviados
                                    setPhotoUploadError(null);
                                }}
                                onCancel={() => {
                                    console.log('[PARTNER TERMS] Documents upload canceled, clearing state');
                                    setDocumentFrontUrl(null);
                                    setDocumentBackUrl(null);
                                    setIdentityPhotoPath(null);
                                    setIdentityPhotoName(null);
                                    identityPhotoPathRef.current = null;
                                    identityPhotoNameRef.current = null;
                                    setDocumentsUploaded(false); // Resetar estado de upload
                                    setPhotoUploadError(null);
                                }}
                            />

                            {photoUploadError && (
                                <div className="mt-4 p-4 bg-red-900/30 border-2 border-red-500/50 rounded-md">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-red-300 font-semibold">Upload Error</p>
                                            <p className="text-red-200 text-sm mt-1">{photoUploadError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Sticky Footer for Acceptance */}
                {!loading && tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-gold-medium/30 p-4 shadow-[0_-4px_6px_-1px_rgba(206,159,72,0.3)] z-50">
                        <div className="max-w-3xl mx-auto space-y-4">
                            {/* Checkbox de aceite */}
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="accept-terms"
                                    checked={accepted}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked as boolean;
                                        setAccepted(isChecked);

                                        // If user checks the box, scroll to the appropriate section
                                        if (isChecked) {
                                            // First check if form is complete
                                            if (!isFormComplete()) {
                                                // Form is incomplete, scroll to contractual information section (section 2)
                                                setTimeout(() => {
                                                    const contractSection = document.getElementById('contractual-information-section');
                                                    if (contractSection) {
                                                        smoothScrollTo(contractSection, 1000);
                                                    }
                                                }, 150);
                                            } else if (!documentFrontUrl || !documentBackUrl || !identityPhotoPath) {
                                                // Form is complete but documents not uploaded, scroll to photo section (section 3)
                                                setTimeout(() => {
                                                    const photoSection = document.getElementById('photo-upload-section');
                                                    if (photoSection) {
                                                        smoothScrollTo(photoSection, 1000);
                                                    }
                                                }, 150);
                                            }
                                        }
                                    }}
                                />
                                <Label htmlFor="accept-terms" className="cursor-pointer font-medium text-white">
                                    I have read and I agree to the MIGMA Global Independent Contractor Terms & Conditions.
                                </Label>
                            </div>

                            {/* Campo de assinatura digital - Signature Pad */}
                            {accepted && (
                                <SignaturePadComponent
                                    onSignatureChange={(dataUrl) => {
                                        // Atualiza enquanto desenha, mas só confirma quando clicar "Done"
                                        if (dataUrl) {
                                            setSignatureImageDataUrl(dataUrl);
                                        } else {
                                            setSignatureImageDataUrl(null);
                                        }
                                        // Salvar automaticamente no localStorage sempre que a assinatura mudar
                                        saveFormData();
                                    }}
                                    onSignatureConfirm={(dataUrl) => {
                                        // Confirma a assinatura quando clicar "Done"
                                        setSignatureImageDataUrl(dataUrl);
                                        setSignatureConfirmed(true);
                                        // Salvar automaticamente no localStorage quando confirmar
                                        saveFormData();
                                    }}
                                    savedSignature={signatureImageDataUrl}
                                    isConfirmed={signatureConfirmed}
                                    label="Digital Signature"
                                    required={true}
                                    width={600}
                                    height={200}
                                />
                            )}

                            {/* Botão de aceitar */}
                            <div className="flex justify-end mt-4">
                                <Button
                                    onClick={handleAccept}
                                    disabled={!accepted || !!templateLoadError || !contractContent || isSubmitting}
                                    className="w-full sm:w-auto min-w-[200px] bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg disabled:shadow-none"
                                >
                                    I ACCEPT <Check className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-gold-medium/30 p-4 shadow-[0_-4px_6px_-1px_rgba(206,159,72,0.3)] z-50">
                        <div className="max-w-3xl mx-auto text-center">
                            <p className="text-gray-400">
                                {token ? 'Invalid or expired token. Please contact MIGMA for a valid access link.' : 'A valid token is required to accept these terms. Please contact MIGMA for access.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Spacer for sticky footer */}
                <div className="h-24" />
            </div>

            {/* Modal de Validação */}
            <AlertModal
                isOpen={showValidationModal}
                onClose={() => setShowValidationModal(false)}
                title={validationModalTitle}
                message={validationModalMessage}
                variant="warning"
            />
        </div>
    );
};
