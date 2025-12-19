import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';
import { useContentProtection } from '@/hooks/useContentProtection';
import { getActiveContractVersion, generateContractHash, getGeolocationFromIP } from '@/lib/contracts';
import { sendTermsAcceptanceConfirmationEmail } from '@/lib/emails';
import { countries } from '@/lib/visa-checkout-constants';
import { SignaturePadComponent } from '@/components/ui/signature-pad';

export const PartnerTerms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [accepted, setAccepted] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [identityPhotoPath, setIdentityPhotoPath] = useState<string | null>(null); // selfie URL
    const [identityPhotoName, setIdentityPhotoName] = useState<string | null>(null); // selfie file name
    const [documentFrontUrl, setDocumentFrontUrl] = useState<string | null>(null);
    const [documentBackUrl, setDocumentBackUrl] = useState<string | null>(null);
    const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
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
                        content: "";
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
            if (!token) {
                setTokenValid(false);
                setLoading(false);
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
                    return;
                }

                // Verificar se token expirou
                const now = new Date();
                const expiresAt = new Date(data.expires_at);
                if (now > expiresAt) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                // Verificar se já foi aceito
                if (data.accepted_at) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setTokenValid(true);
                setTokenData(data);
            } catch (error) {
                console.error('Error validating token:', error);
                setTokenValid(false);
            } finally {
                setLoading(false);
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
                if (formData.signatureImageDataUrl) {
                    setSignatureImageDataUrl(formData.signatureImageDataUrl);
                    console.log('[PARTNER TERMS] Signature restored from localStorage');
                }
                if (formData.signatureConfirmed !== undefined) {
                    setSignatureConfirmed(formData.signatureConfirmed);
                    console.log('[PARTNER TERMS] Signature confirmed state restored:', formData.signatureConfirmed);
                }
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
            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            if (birthDate >= today) errors.dateOfBirth = 'Date of birth must be in the past';
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
        if (!addressCountry.trim()) errors.addressCountry = 'Country is required';

        // Estrutura Fiscal/Empresarial
        if (!businessType) errors.businessType = 'Business type is required';
        if (businessType === 'Company') {
            if (!companyLegalName.trim()) errors.companyLegalName = 'Company legal name is required';
            if (!taxIdNumber.trim()) errors.taxIdNumber = 'Tax ID number is required';
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
                const birthDate = new Date(dateOfBirth);
                const today = new Date();
                if (birthDate >= today) errors.dateOfBirth = 'Date of birth must be in the past';
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
            if (!addressCountry.trim()) errors.addressCountry = 'Country is required';
        } else if (step === 3) {
            // Validar Fiscal/Business
            if (!businessType) errors.businessType = 'Business type is required';
            if (businessType === 'Company') {
                if (!companyLegalName.trim()) errors.companyLegalName = 'Company legal name is required';
                if (!taxIdNumber.trim()) errors.taxIdNumber = 'Tax ID number is required';
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
            addressCountry.trim() &&
            businessType &&
            preferredPayoutMethod &&
            payoutDetails.trim() &&
            (businessType === 'Individual' || (businessType === 'Company' && companyLegalName.trim() && taxIdNumber.trim()))
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
        if (!accepted || !token || !tokenValid) return;

        // Use refs to get the latest values (avoid closure issues)
        const currentPhotoPath = identityPhotoPathRef.current;
        const currentPhotoName = identityPhotoNameRef.current;
        
        // Verificar se todas as imagens foram enviadas (frente, verso e selfie)
        if (!documentFrontUrl || !documentBackUrl || !currentPhotoPath || !currentPhotoName) {
            setPhotoUploadError('Please upload the front and back of your document and a selfie holding the document before accepting the terms.');
            return;
        }

        // Verificar se assinatura foi confirmada (botão Done clicado)
        if (!signatureImageDataUrl || !signatureConfirmed) {
            setPhotoUploadError('Please sign and confirm your signature by clicking "Done" button.');
            return;
        }

        // Iniciar animação de carregamento
        setIsSubmitting(true);

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
                alert('Please fill in all required fields correctly');
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
                    
                    // Upload para storage - usar identity-photos que já existe
                    const { error: uploadError } = await supabase.storage
                        .from('identity-photos')
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
                        .from('identity-photos')
                        .getPublicUrl(fileName);
                    
                    updateData.signature_image_url = publicUrl;
                    console.log('[PARTNER TERMS] Signature uploaded successfully:', publicUrl);
                } catch (sigError) {
                    console.error('[PARTNER TERMS] Error processing signature upload:', sigError);
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
                alert("There was an error accepting the terms. Please try again.");
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
                alert('There was an error saving your photo. Please try uploading again.');
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

            // Não desativar isSubmitting aqui - deixar o overlay até a navegação
            // O overlay será removido quando a página mudar
            navigate('/partner-terms/success');
        } catch (error) {
            console.error("Error accepting terms:", error);
            setIsSubmitting(false);
            alert("There was an error accepting the terms. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground py-12">
            {/* Loading Overlay */}
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

                        <div className="space-y-2">
                            <p>
                                <strong>INDEPENDENT CONTRACTOR AGREEMENT – SALES REPRESENTATIVE CLOSER</strong>
                                <br />
                                Effective Date: Upon electronic acceptance of this Agreement.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">1. Parties</h3>
                            <p>
                                This Agreement is entered into between:
                                <br />
                                MIGMA INC., legal entity headquartered at
                                <br />
                                3435 Wilshire Blvd, Suite 1740, Los Angeles, CA 90010, USA
                                <br />
                                Email: adm@migmainc.com
                                <br />
                                hereinafter referred to as “Client”;
                                <br />
                                and
                                <br />
                                The Independent Contractor accepting this Agreement electronically,
                                <br />
                                hereinafter referred to as “Contractor”.
                                <br />
                                Together, the Parties shall be referred to as the “Parties.”
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">2. Purpose of Services</h3>
                            <p>
                                The Contractor is engaged to perform independent commercial and sales services for
                                MIGMA INC., which include, but are not limited to:
                            </p>
                            <p>
                                (i) Promoting, intermediating, presenting and closing sales of services offered by
                                the Client to leads of any nationality, acting as a closer during live meetings or
                                scheduled calls;
                                <br />
                                (ii) Conducting sales meetings through Zoom, Google Meet, or other videoconference
                                platforms designated by MIGMA, and performing follow-up communications with
                                prospects as needed;
                                <br />
                                (iii) Using technological tools, platforms, CRMs and artificial intelligence
                                systems developed or provided by the Client, accessed exclusively through personal
                                and non-transferable login credentials;
                                <br />
                                (iv) Issuing invoices for each sale completed, following MIGMA’s internal policies,
                                commission structure and billing procedures;
                                <br />
                                (v) Meeting the Client’s requirements for functional English, and where necessary,
                                intermediate or advanced proficiency, depending on the complexity of the sales
                                process and service category;
                                <br />
                                (vi) Performing all sales-related activities independently, without fixed working
                                hours, and delivering results consistent with MIGMA’s commercial standards.
                            </p>
                            <p>
                                The Contractor agrees to perform services in compliance with internal methodology,
                                standards, policies and performance targets established by MIGMA.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">3. Term</h3>
                            <p>
                                3.1 This Agreement begins on the date of Contractor acceptance and remains in force
                                indefinitely, unless terminated in accordance with this Agreement.
                                <br />
                                3.2 Either Party may terminate this Agreement at any time via written notice.
                                <br />
                                3.3 Upon termination, obligations cease as defined herein.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">4. Nature of Relationship</h3>
                            <p>
                                4.1 The Contractor acts as an independent service provider, and nothing in this
                                Agreement shall be construed as employment, joint venture, partnership, franchise or
                                agency. Nothing in this Agreement shall be interpreted as granting the Contractor
                                authority to bind MIGMA, represent MIGMA in legal matters, or act on behalf of MIGMA
                                beyond sales interactions strictly permitted under this Agreement.
                            </p>
                            <p>
                                4.2 The Contractor is responsible for:
                                <br />
                                • local taxes,
                                <br />
                                • compliance obligations,
                                <br />
                                • social contributions,
                                <br />
                                • insurance,
                                <br />
                                • and any applicable governmental filings.
                            </p>
                            <p>4.3 The Contractor acknowledges they do not receive employee benefits.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                5. Autonomy and Compliance Obligations
                            </h3>
                            <p>
                                5.1 The Contractor shall have autonomy in organizing the means and methods of
                                performing the Services; however, all communications with clients, prospects or
                                leads must strictly follow MIGMA’s approved guidelines, compliance rules, immigration
                                restrictions, legal limitations, and training materials.
                            </p>
                            <p>
                                5.2 The Contractor is expressly prohibited from:
                                <br />
                                • providing immigration legal advice;
                                <br />
                                • making representations as a lawyer, attorney, agent or government representative;
                                <br />
                                • offering guarantees of visa approval;
                                <br />
                                • advising clients on unlawful or fraudulent practices.
                            </p>
                            <p>
                                5.3 Any violation of this clause constitutes material breach, resulting in immediate
                                termination and full liability for damages, including civil, administrative and
                                criminal exposure.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">6. Performance Requirements</h3>
                            <p>
                                6.1 The Contractor is not subject to fixed working hours. Instead, the Contractor
                                agrees to meet all daily performance requirements, including:
                            </p>
                            <p>
                                a) responding to leads within MIGMA’s required timeframe;
                                <br />
                                b) attending scheduled meetings and calls;
                                <br />
                                c) performing follow-ups and CRM updates promptly;
                                <br />
                                d) reaching daily, weekly and monthly targets established by MIGMA;
                                <br />
                                e) maintaining availability necessary to ensure continuity of service, regardless of
                                weekends, holidays or local schedules.
                            </p>
                            <p>
                                6.2 Failure to meet performance standards constitutes material breach and may result
                                in termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">7. Equipment / Costs</h3>
                            <p>
                                7.1 The Contractor provides all equipment, devices, software, tools and internet
                                connection required.
                                <br />
                                7.2 MIGMA will not reimburse operational or personal costs unless expressly agreed.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                8. Compensation &amp; Payment Terms
                            </h3>
                            <p>
                                <strong>8.1 Fixed Compensation</strong>
                                <br />
                                Contractor will receive:
                                <br />
                                US$ 500.00 (five hundred US dollars) fixed monthly.
                            </p>
                            <p>
                                <strong>8.2 Commission – Sales Performance</strong>
                                <br />
                                Commissions are based on gross sales value generated monthly by the Contractor, as
                                follows:
                                <br />
                                Sales Volume (USD) – Commission (%)
                                <br />
                                Up to $4,999.99 – 0.5%
                                <br />
                                $5,000.00 – $9,999.99 – 1%
                                <br />
                                $10,000.00 – $14,999.99 – 2%
                                <br />
                                $15,000.00 – $19,999.99 – 3%
                                <br />
                                $20,000.00 – $24,999.99 – 4%
                                <br />
                                Above $25,000.00 – 5%
                                <br />
                                Commissions apply only upon full payment by the client to MIGMA.
                            </p>
                            <p>
                                <strong>8.3 Billing and Payment Rules</strong>
                                <br />
                                (a) The Contractor shall issue one monthly invoice to MIGMA covering all commissions
                                and service fees earned for the immediately preceding month.
                                <br />
                                (b) MIGMA’s Finance Department shall calculate, verify, and publish the Contractor’s
                                commission results for the period. The Contractor may view the data through the
                                dashboard, but MIGMA’s audited calculation shall prevail as final and binding.
                                <br />
                                (c) MIGMA shall pay the approved invoice within five (5) business days of the
                                following month. No payment shall be made without an issued invoice.
                                <br />
                                (d) Payments shall be made exclusively through international digital payment
                                platforms, including Wise, Stripe, or any other transfer platform selected by MIGMA
                                at its sole discretion. The Contractor must have an active account on the chosen
                                platform and shall provide accurate payment details. MIGMA shall not be responsible
                                for delays or failures caused by incorrect information or issues related to the
                                Contractor’s account.
                                <br />
                                (e) The Contractor is solely responsible for any taxes, transfer fees, platform
                                fees, or financial obligations related to their compensation.
                                <br />
                                (f) MIGMA shall not reimburse the Contractor for any expenses unless expressly
                                authorized in writing and in advance.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                9. Non-Disclosure Agreement (NDA)
                            </h3>
                            <p>
                                The Contractor agrees not to disclose, share, reproduce or provide access to any
                                confidential information, including but not limited to:
                                <br />
                                • client data,
                                <br />
                                • financial records,
                                <br />
                                • procedures and scripts,
                                <br />
                                • training materials,
                                <br />
                                • immigration methodologies,
                                <br />
                                • AI systems and automations,
                                <br />
                                • business strategies,
                                <br />
                                • negotiations,
                                <br />
                                • pricing structures.
                                <br />
                                This obligation is perpetual and survives termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                10. Non-Disclosure &amp; Non-Disparagement
                            </h3>
                            <p>
                                The Contractor agrees not to:
                                <br />
                                • disclose internal information,
                                <br />
                                • speak negatively about MIGMA publicly or privately,
                                <br />
                                • use MIGMA data for personal gain.
                                <br />
                                This obligation survives termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                11. Confidentiality, Intellectual Property and Legal Penalties
                            </h3>
                            <p>
                                11.1 Any breach of confidentiality, unauthorized disclosure, or misuse of MIGMA’s
                                confidential information, data, client lists, scripts, automations, intellectual
                                property or technological systems constitutes a material breach.
                            </p>
                            <p>
                                11.2 Violations authorize MIGMA to:
                                <br />
                                i) Initiate civil and criminal proceedings in the United States (State of Arizona);
                                <br />
                                ii) Initiate proceedings in the Contractor’s country of residence;
                                <br />
                                iii) Seek damages and injunctive relief;
                                <br />
                                iv) Enforce a liquidated damages penalty of US$ 15,000.00 automatically upon breach.
                            </p>
                            <p>
                                11.3 All intellectual property developed, accessed or used by the Contractor during
                                this Agreement is exclusively owned by MIGMA.
                            </p>
                            <p>
                                11.4 The Contractor agrees not to copy, reproduce, store, transfer, make derivative
                                use of, or distribute any of MIGMA’s intellectual property under penalty of legal
                                action.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                12. Exclusivity and Non-Compete
                            </h3>
                            <p>
                                12.1 During the term of this Agreement, the Contractor shall not provide services of
                                any kind to any immigration, visa consulting, educational placement, or related
                                company, unless such company is an official client, partner, or subcontracted
                                affiliate of MIGMA and expressly authorized in writing. This restriction exists to
                                prevent conflicts of interest, diversion of clients, and the misuse of confidential
                                information acquired through MIGMA.
                            </p>
                            <p>
                                12.2 The Contractor acknowledges that MIGMA will grant access to confidential
                                operational methods, scripts, processes, artificial intelligence systems, CRM
                                structures, and proprietary business strategies. Therefore, performing services for
                                competing entities during the term of this Agreement constitutes a direct
                                competitive conflict.
                            </p>
                            <p>
                                12.3 After termination of this Agreement, the Contractor is free to work for any
                                company in the immigration or visa industry, with no restriction, provided that the
                                Contractor:
                                <br />
                                (a) does not use or reproduce MIGMA’s confidential information, documents, client
                                lists, scripts, manuals, AI systems, workflows, training materials, or intellectual
                                property;
                                <br />
                                (b) does not solicit, contact, divert, or attempt to divert any MIGMA clients,
                                leads, prospects, employees, or partners for personal or third-party benefit;
                                <br />
                                (c) does not replicate or attempt to recreate MIGMA’s internal operational model,
                                artificial intelligence environment, technological framework, or proprietary
                                business methodology;
                                <br />
                                (d) does not establish a new business or entity that, intentionally or by structure,
                                constitutes a reproduction or direct derivation of MIGMA’s business model or
                                intellectual property.
                            </p>
                            <p>
                                12.4 Any violation of this clause, whether during the term of the Agreement or after
                                its termination, shall result in:
                                <br />
                                (i) liquidated damages in the amount of US$ 15,000.00 (fifteen thousand U.S.
                                dollars), automatically due upon breach;
                                <br />
                                (ii) the right of MIGMA to pursue civil and criminal actions both in the United
                                States (State of Arizona) and in the Contractor’s country of residence;
                                <br />
                                (iii) immediate termination of this Agreement, if still active, without prejudice to
                                additional remedies.
                            </p>
                            <p>
                                12.5 The obligations set forth in this clause survive termination of the Agreement
                                for as long as necessary to protect MIGMA’s confidential information, intellectual
                                property, technological assets, and economic interests.
                            </p>
                            <p>
                                12.6 Nothing in this clause shall be interpreted as restricting the Contractor’s
                                general freedom to work for competitors after the termination of this Agreement,
                                provided the restrictions above are fully respected.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">13. Non-Solicitation</h3>
                            <p>
                                13.1 The Contractor shall not, during the term of this Agreement and for 24 months
                                after termination:
                                <br />
                                (a) solicit, contact, divert or attempt to divert any MIGMA client, lead, prospect
                                or partner for personal benefit or for the benefit of third parties;
                                <br />
                                (b) provide services directly or indirectly to any MIGMA client without MIGMA’s
                                written authorization;
                                <br />
                                (c) engage in private negotiations, side deals or agreements with MIGMA clients or
                                leads.
                            </p>
                            <p>
                                13.2 Violation results in:
                                <br />
                                • Automatic penalty of US$ 15,000.00;
                                <br />
                                • Legal action in the United States and abroad;
                                <br />
                                • Permanent ban from MIGMA network.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                14. Indemnity, Liability and Regress
                            </h3>
                            <p>
                                14.1 The Contractor shall fully indemnify and hold MIGMA harmless from any loss,
                                damage, claim, complaint, legal action, penalty, administrative sanction or
                                liability arising from:
                                <br />
                                • errors, omissions, misrepresentations or misconduct;
                                <br />
                                • unlawful advice, fraudulent statements or misguidance to clients;
                                <br />
                                • violations of immigration or consular regulations;
                                <br />
                                • breaches of compliance or operational standards;
                                <br />
                                • acts of negligence or intentional misconduct.
                            </p>
                            <p>
                                14.2 If any client or governmental authority initiates administrative, civil, labor,
                                tax or criminal proceedings against MIGMA due to acts attributable to the
                                Contractor, MIGMA may:
                                <br />
                                i) retain any payments owed to the Contractor until full resolution of the matter;
                                <br />
                                ii) demand immediate reimbursement of any amounts paid by MIGMA;
                                <br />
                                iii) enforce liquidated damages and legal penalties.
                            </p>
                            <p>
                                14.3 The Contractor must reimburse MIGMA for all expenses resulting from such
                                proceedings, including:
                                <br />
                                • attorney fees,
                                <br />
                                • court costs,
                                <br />
                                • settlements,
                                <br />
                                • damages,
                                <br />
                                • fines,
                                <br />
                                • immigration penalties,
                                <br />
                                • appeal deposits.
                                <br />
                                Payment must be made within 72 hours of MIGMA’s written request.
                            </p>
                            <p>
                                14.4 Failure to comply authorizes immediate termination and legal action for
                                recovery.
                            </p>
                            <p>14.5 The Contractor assumes full responsibility for any actions taken by subcontractors or collaborators.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">15. Subcontracting</h3>
                            <p>
                                The Contractor may subcontract assistance only with prior written consent, and
                                remains fully liable.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">16. Return of Property</h3>
                            <p>
                                Upon termination, the Contractor must:
                                <br />
                                • return all materials;
                                <br />
                                • delete access credentials;
                                <br />
                                • cease representation of MIGMA immediately.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">17. Termination</h3>
                            <p>
                                17.1 Either Party may terminate this Agreement at any time, with or without cause,
                                by written notice delivered electronically.
                            </p>
                            <p>
                                17.2 Upon termination, the Contractor shall:
                                <br />
                                (a) immediately cease representing MIGMA;
                                <br />
                                (b) return or delete all confidential information, documents, logins and client
                                data;
                                <br />
                                (c) finalize any pending administrative tasks only if expressly authorized by MIGMA;
                                <br />
                                (d) lose entitlement to any unpaid commissions related to sales that were not fully
                                paid to MIGMA by clients.
                            </p>
                            <p>
                                17.3 MIGMA may terminate this Agreement immediately, without prior notice, in cases
                                of:
                                <br />
                                (a) breach of confidentiality, non-compete, compliance or intellectual property
                                clauses;
                                <br />
                                (b) misconduct, misrepresentation or unethical behavior;
                                <br />
                                (c) fraud, unlawful immigration advice or violation of U.S. or foreign laws;
                                <br />
                                (d) reputational risk to MIGMA;
                                <br />
                                (e) client complaints involving negligence or malpractice;
                                <br />
                                (f) failure to meet performance requirements.
                            </p>
                            <p>
                                17.4 Termination does not exempt the Contractor from financial liabilities,
                                indemnities, penalties or damages owed to MIGMA under this Agreement.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">18. Amendments</h3>
                            <p>
                                Any amendment must be:
                                <br />
                                • in writing,
                                <br />
                                • digitally acknowledged by Contractor, and
                                <br />
                                • issued by MIGMA.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">19. Notices</h3>
                            <p>All notices must be sent in writing to: adm@migmainc.com</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">20. Assignment</h3>
                            <p>The Contractor may not assign obligations without express written consent.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">21. Entire Agreement</h3>
                            <p>This document constitutes the entire agreement and supersedes all prior declarations.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">22. Governing Law</h3>
                            <p>
                                This Agreement is governed by the laws of the State of Arizona, United States of
                                America.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">23. Severability</h3>
                            <p>If any provision becomes invalid, the remaining provisions continue in effect.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

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

                        <div className="h-12" /> {/* Spacer */}
                    </CardContent>
                </Card>

                {/* Contractual Information Form - SECOND */}
                {!loading && tokenValid && (
                    <Card id="contractual-form-section" className="mb-6 shadow-lg border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
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
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                                                    step === currentStep 
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
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="full-legal-name" className="text-white">
                                                Full Legal Name <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="full-legal-name"
                                                type="text"
                                                value={fullLegalName}
                                                onChange={(e) => setFullLegalName(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="Enter your full legal name"
                                            />
                                            {formErrors.fullLegalName && (
                                                <p className="text-sm text-red-400">{formErrors.fullLegalName}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="date-of-birth" className="text-white">
                                                Date of Birth <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="date-of-birth"
                                                type="date"
                                                value={dateOfBirth}
                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                className="bg-white text-black"
                                                max={new Date().toISOString().split('T')[0]}
                                            />
                                            {formErrors.dateOfBirth && (
                                                <p className="text-sm text-red-400">{formErrors.dateOfBirth}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="nationality" className="text-white">
                                                Nationality <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={nationality} onValueChange={setNationality}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select nationality" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {countries.map((country) => (
                                                        <SelectItem key={country} value={country}>
                                                            {country}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.nationality && (
                                                <p className="text-sm text-red-400">{formErrors.nationality}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="country-of-residence" className="text-white">
                                                Country of Residence <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={countryOfResidence} onValueChange={setCountryOfResidence}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select country" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {countries.map((country) => (
                                                        <SelectItem key={country} value={country}>
                                                            {country}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.countryOfResidence && (
                                                <p className="text-sm text-red-400">{formErrors.countryOfResidence}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="phone-whatsapp" className="text-white">
                                                Phone / WhatsApp <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="phone-whatsapp"
                                                type="tel"
                                                value={phoneWhatsapp}
                                                onChange={(e) => setPhoneWhatsapp(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="+55 11 99999-9999"
                                            />
                                            {formErrors.phoneWhatsapp && (
                                                <p className="text-sm text-red-400">{formErrors.phoneWhatsapp}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-white">
                                                Email <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="your.email@example.com"
                                            />
                                            {formErrors.email && (
                                                <p className="text-sm text-red-400">{formErrors.email}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Address */}
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="address-street" className="text-white">
                                            Street Address <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="address-street"
                                            type="text"
                                            value={addressStreet}
                                            onChange={(e) => setAddressStreet(e.target.value)}
                                            className="bg-white text-black"
                                            placeholder="Street name and number"
                                        />
                                        {formErrors.addressStreet && (
                                            <p className="text-sm text-red-400">{formErrors.addressStreet}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="address-city" className="text-white">
                                                City <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="address-city"
                                                type="text"
                                                value={addressCity}
                                                onChange={(e) => setAddressCity(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="City name"
                                            />
                                            {formErrors.addressCity && (
                                                <p className="text-sm text-red-400">{formErrors.addressCity}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="address-state" className="text-white">
                                                State / Province
                                            </Label>
                                            <Input
                                                id="address-state"
                                                type="text"
                                                value={addressState}
                                                onChange={(e) => setAddressState(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="State or Province"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="address-zip" className="text-white">
                                                ZIP / Postal Code
                                            </Label>
                                            <Input
                                                id="address-zip"
                                                type="text"
                                                value={addressZip}
                                                onChange={(e) => setAddressZip(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="12345-678"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="address-country" className="text-white">
                                                Country <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={addressCountry} onValueChange={setAddressCountry}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select country" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {countries.map((country) => (
                                                        <SelectItem key={country} value={country}>
                                                            {country}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formErrors.addressCountry && (
                                                <p className="text-sm text-red-400">{formErrors.addressCountry}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Fiscal/Business */}
                            {currentStep === 3 && (
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="business-type" className="text-white">
                                                Business Type <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={businessType} onValueChange={(value) => setBusinessType(value as 'Individual' | 'Company')}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select business type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Individual">Individual</SelectItem>
                                                    <SelectItem value="Company">Company</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {formErrors.businessType && (
                                                <p className="text-sm text-red-400">{formErrors.businessType}</p>
                                            )}
                                        </div>

                                        {businessType === 'Company' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="company-legal-name" className="text-white">
                                                    Company Legal Name <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="company-legal-name"
                                                    type="text"
                                                    value={companyLegalName}
                                                    onChange={(e) => setCompanyLegalName(e.target.value)}
                                                    className="bg-white text-black"
                                                    placeholder="Company registered name"
                                                />
                                                {formErrors.companyLegalName && (
                                                    <p className="text-sm text-red-400">{formErrors.companyLegalName}</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label htmlFor="tax-id-type" className="text-white">
                                                Tax ID Type
                                            </Label>
                                            <Select value={taxIdType} onValueChange={setTaxIdType}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select tax ID type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CNPJ">CNPJ (Brazil)</SelectItem>
                                                    <SelectItem value="NIF">NIF (Portugal/Spain)</SelectItem>
                                                    <SelectItem value="Equivalent">Equivalent</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="tax-id-number" className="text-white">
                                                Tax ID Number {businessType === 'Company' && <span className="text-red-500">*</span>}
                                            </Label>
                                            <Input
                                                id="tax-id-number"
                                                type="text"
                                                value={taxIdNumber}
                                                onChange={(e) => setTaxIdNumber(e.target.value)}
                                                className="bg-white text-black"
                                                placeholder="Enter tax ID number"
                                            />
                                            {formErrors.taxIdNumber && (
                                                <p className="text-sm text-red-400">{formErrors.taxIdNumber}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Payment */}
                            {currentStep === 4 && (
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="preferred-payout-method" className="text-white">
                                                Preferred Payout Method <span className="text-red-500">*</span>
                                            </Label>
                                            <Select value={preferredPayoutMethod} onValueChange={setPreferredPayoutMethod}>
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select payout method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Wise">Wise</SelectItem>
                                                    <SelectItem value="Stripe">Stripe</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {formErrors.preferredPayoutMethod && (
                                                <p className="text-sm text-red-400">{formErrors.preferredPayoutMethod}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="payout-details" className="text-white">
                                                Payout Details <span className="text-red-500">*</span>
                                            </Label>
                                            <Textarea
                                                id="payout-details"
                                                value={payoutDetails}
                                                onChange={(e) => setPayoutDetails(e.target.value)}
                                                className="bg-white text-black min-h-[100px]"
                                                placeholder="Enter your account details (account number, routing number, email, etc.)"
                                            />
                                            {formErrors.payoutDetails && (
                                                <p className="text-sm text-red-400">{formErrors.payoutDetails}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                        Upload the front and back of your document and a selfie holding the document before accepting the terms.
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
                                        
                                        // When user checks the box, smoothly scroll to form section
                                        if (isChecked) {
                                            setTimeout(() => {
                                                const formSection = document.getElementById('contractual-form-section');
                                                if (formSection) {
                                                    smoothScrollTo(formSection, 1000);
                                                }
                                            }, 150);
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
                                        }
                                    }}
                                    onSignatureConfirm={(dataUrl) => {
                                        // Confirma a assinatura quando clicar "Done"
                                        console.log('[PARTNER TERMS] onSignatureConfirm called, dataUrl length:', dataUrl?.length);
                                        setSignatureImageDataUrl(dataUrl);
                                        setSignatureConfirmed(true);
                                        
                                        // Salvar assinatura no localStorage
                                        if (token) {
                                            try {
                                                const storageKey = `partner_terms_form_${token}`;
                                                const existingData = localStorage.getItem(storageKey);
                                                const formData = existingData ? JSON.parse(existingData) : {};
                                                formData.signatureImageDataUrl = dataUrl;
                                                formData.signatureConfirmed = true;
                                                localStorage.setItem(storageKey, JSON.stringify(formData));
                                                console.log('[PARTNER TERMS] Signature saved to localStorage');
                                            } catch (error) {
                                                console.warn('[PARTNER TERMS] Error saving signature to localStorage:', error);
                                            }
                                        }
                                        
                                        console.log('[PARTNER TERMS] signatureConfirmed set to true');
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
                            <div className="flex justify-end">
                                <Button 
                                    onClick={handleAccept} 
                                    disabled={!accepted || !documentFrontUrl || !documentBackUrl || !identityPhotoPath || !signatureImageDataUrl || !signatureConfirmed || !isFormComplete()} 
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
        </div>
    );
};
