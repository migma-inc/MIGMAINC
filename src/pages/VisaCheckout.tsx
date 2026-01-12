import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CreditCard, DollarSign, Upload, ChevronRight, ChevronLeft } from 'lucide-react';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';
import { trackLinkClick, trackFormCompleted, trackPaymentStarted } from '@/lib/funnel-tracking';
import { DRAFT_STORAGE_KEY, countries, getPhoneCodeFromCountry } from '@/lib/visa-checkout-constants';
import { getClientIP, calculateBaseTotal, calculateTotalWithFees } from '@/lib/visa-checkout-utils';
import { validateStep1, type Step1FormData } from '@/lib/visa-checkout-validation';
import { saveStep1Data, saveStep2Data, saveStep3Data } from '@/lib/visa-checkout-service';
import { getContractTemplateByProductSlug, type ContractTemplate } from '@/lib/contract-templates';
import { SignaturePadComponent } from '@/components/ui/signature-pad';
import { ANNEX_I_HTML } from '@/lib/annex-text';
import { processZellePaymentWithN8n } from '@/lib/zelle-n8n-integration';

interface VisaProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  base_price_usd: string;
  price_per_dependent_usd: string;
  allow_extra_units: boolean;
  extra_unit_label: string;
  extra_unit_price: string;
  calculation_type: 'base_plus_units' | 'units_only';
}

export const VisaCheckout = () => {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get('seller') || '';
  const prefillToken = searchParams.get('prefill') || '';

  const [product, setProduct] = useState<VisaProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isZelleProcessing, setIsZelleProcessing] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
  const [step3Errors, setStep3Errors] = useState<Record<string, string>>({});

  // Multi-step state - Initialize by checking localStorage immediately
  // If user was on step 2 or 3, force them to step 1 immediately
  const getInitialStep = (): number => {
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        // ALWAYS start at step 1 if user was on step 2 or 3
        // This ensures they review their data before re-uploading documents
        if (parsed.currentStep === 2 || parsed.currentStep === 3) {
          return 1;
        }
        return parsed.currentStep || 1;
      }
    } catch (err) {
      // Ignore errors
    }
    return 1;
  };
  
  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const totalSteps = 3;
  const hasRestoredStepRef = useRef(false); // Track if we've already restored the step

  // Form state - Step 1: Personal Information
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
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married' | 'divorced' | 'widowed' | 'other' | ''>('');
  const [clientObservations, setClientObservations] = useState('');
  const [formStartedTracked, setFormStartedTracked] = useState(false);

  // Step 2: Documents
  const [documentsUploaded, setDocumentsUploaded] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<{
    documentFront: { file: File; url: string } | null;
    documentBack: { file: File; url: string } | null;
    selfie: { file: File; url: string } | null;
  } | null>(null);

  // Step 3: Terms & Payment
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataAuthorization, setDataAuthorization] = useState(false);
  const [contractTemplate, setContractTemplate] = useState<ContractTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | 'zelle' | 'wise' | 'parcelow'>('card');
  const [zelleReceipt, setZelleReceipt] = useState<File | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  
  // Signature states
  const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<string | null>(null);
  const [signatureConfirmed, setSignatureConfirmed] = useState<boolean>(false);

  // Service request data (saved after step 1)
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // Existing contract data (for reusing signed contracts)
  const [hasExistingContract, setHasExistingContract] = useState(false);
  const [existingContractData, setExistingContractData] = useState<{
    contract_document_url: string;
    contract_selfie_url: string;
    contract_signed_at: string;
  } | null>(null);
  
  // Flag to prevent saving during restoration (using useRef for better control)
  const isRestoringRef = useRef(false);
  const restoreAttemptedRef = useRef(false);
  const returningFromStripeRef = useRef(false);

  // Check if user is returning from Stripe (via browser back button) - Fallback verification on Step 3
  // This is a fallback in case the initial check didn't catch it
  // IMPORTANT: Only check if user is actually returning from Stripe, not during normal navigation
  useEffect(() => {
    // Check if there's a pending order that was created but payment was cancelled
    const checkPendingOrder = async () => {
      // Only check if we have at least product_slug (required)
      if (!productSlug) return;
      
      // Verificar se usuário está navegando normalmente (não veio do Stripe)
      const referrer = document.referrer;
      if (referrer && (referrer.includes('/checkout/visa/') || referrer.includes(window.location.origin + '/checkout/visa/'))) {
        // Usuário está navegando normalmente pelo checkout, não verificar Stripe
        return;
      }
      
      // Verificar se usuário veio da página de cancelamento (não redirecionar novamente)
      if (referrer && referrer.includes('/checkout/cancel')) {
        // Usuário veio da página de cancelamento, não redirecionar novamente
        return;
      }
      
      // Verificar se já foi redirecionado para cancelamento antes
      const redirectKey = `stripe_redirected_to_cancel_${productSlug}_${sellerId || 'no-seller'}`;
      if (sessionStorage.getItem(redirectKey)) {
        // Já foi redirecionado para cancelamento antes, não redirecionar novamente
        return;
      }
      
      // Only check once when component mounts on step 3
      // Use a flag to prevent multiple checks
      const checkKey = `stripe_return_check_step3_${productSlug}_${sellerId || 'no-seller'}_${serviceRequestId || 'no-service'}`;
      if (sessionStorage.getItem(checkKey)) {
        return; // Already checked
      }
      
      // Só verificar se o referrer indica que veio de uma página externa (como Stripe)
      const isExternalReferrer = !referrer || 
        referrer.includes('checkout.stripe.com') || 
        referrer.includes('stripe.com') ||
        (!referrer.includes(window.location.hostname));
      
      if (!isExternalReferrer) {
        // Referrer indica navegação interna, não verificar Stripe
        sessionStorage.setItem(checkKey, 'true');
        return;
      }
      
      try {
        // Check if there's a pending order created in the last 10 minutes (expanded from 5)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        // Build query - try multiple approaches
        let query = supabase
          .from('visa_orders')
          .select('id, payment_status, stripe_session_id, created_at')
          .eq('product_slug', productSlug)
          .eq('payment_status', 'pending')
          .not('stripe_session_id', 'is', null)
          .gte('created_at', tenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);
        
        // Add seller filter if exists
        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }
        
        // If we have serviceRequestId, also try filtering by it (but don't require it)
        // This makes the query more flexible
        const { data: orders, error: queryError } = await query;
        
        if (queryError) {
          console.error('Error checking pending order:', queryError);
          sessionStorage.setItem(checkKey, 'true');
          return;
        }
        
        // If we have serviceRequestId, also try a more specific query
        if (serviceRequestId && (!orders || orders.length === 0)) {
          const { data: ordersByService } = await supabase
            .from('visa_orders')
            .select('id, payment_status, stripe_session_id, created_at')
            .eq('service_request_id', serviceRequestId)
            .eq('payment_status', 'pending')
            .not('stripe_session_id', 'is', null)
            .gte('created_at', tenMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (ordersByService && ordersByService.length > 0) {
            // Found order by service_request_id
            const order = ordersByService[0];
            if (order.stripe_session_id) {
              sessionStorage.setItem(checkKey, 'true');
              sessionStorage.setItem(redirectKey, 'true');
              returningFromStripeRef.current = true;
              window.location.replace(`/checkout/cancel?order_id=${order.id}`);
              return;
            }
          }
        }
        
        if (orders && orders.length > 0 && orders[0].stripe_session_id) {
          // Mark as checked to prevent multiple redirects
          sessionStorage.setItem(checkKey, 'true');
          sessionStorage.setItem(redirectKey, 'true');
          
          // User has a pending order with Stripe session - they likely came back from Stripe
          // Mark that user is returning from Stripe
          returningFromStripeRef.current = true;
          
          // Redirect to cancel page using replace() to not stay in history
          window.location.replace(`/checkout/cancel?order_id=${orders[0].id}`);
        } else {
          // No recent pending order, mark as checked
          sessionStorage.setItem(checkKey, 'true');
        }
      } catch (err) {
        console.error('Error checking pending order:', err);
        sessionStorage.setItem(checkKey, 'true');
      }
    };
    
    // Only check if we're on step 3 (as fallback) AND user might be returning from Stripe
    if (currentStep === 3 && productSlug) {
      // Small delay to ensure component is fully mounted
      const timeoutId = setTimeout(() => {
        checkPendingOrder();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, serviceRequestId, productSlug, sellerId]);

  // Function to restore draft from localStorage
  const restoreDraft = useCallback(() => {
    // Skip if already restoring
    if (isRestoringRef.current) {
      return;
    }
    
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draft) {
        restoreAttemptedRef.current = true;
        return;
      }
      
      const parsed = JSON.parse(draft);
      // Restore if same product and seller (or no seller in draft)
      if (parsed.productSlug === productSlug && (!parsed.sellerId || parsed.sellerId === sellerId || !sellerId)) {
        // Set restoring flag to prevent saving during restoration
        isRestoringRef.current = true;
        
        // Restore form data - Step 1
        setClientName(parsed.clientName || '');
        setClientEmail(parsed.clientEmail || '');
        setClientWhatsApp(parsed.clientWhatsApp || '');
        setClientCountry(parsed.clientCountry || '');
        setClientNationality(parsed.clientNationality || '');
        setDateOfBirth(parsed.dateOfBirth || '');
        setDocumentType(parsed.documentType || '');
        setDocumentNumber(parsed.documentNumber || '');
        setAddressLine(parsed.addressLine || '');
        setCity(parsed.city || '');
        setState(parsed.state || '');
        setPostalCode(parsed.postalCode || '');
        setMaritalStatus(parsed.maritalStatus || '');
        setClientObservations(parsed.clientObservations || '');
        // Restaurar extraUnits, mas garantir mínimo de 1 para produtos units_only
        const restoredExtraUnits = parsed.extraUnits || 0;
        if (product?.calculation_type === 'units_only' && restoredExtraUnits < 1) {
          setExtraUnits(1);
        } else {
          setExtraUnits(restoredExtraUnits);
        }
        // Restaurar nomes dos dependentes/aplicantes
        if (parsed.dependentNames && Array.isArray(parsed.dependentNames)) {
          setDependentNames(parsed.dependentNames);
        } else if (restoredExtraUnits > 0) {
          // Se não há nomes salvos, criar array vazio
          // Ajuste será feito quando o produto for carregado (no useEffect)
          setDependentNames(Array(restoredExtraUnits).fill(''));
        } else {
          setDependentNames([]);
        }
        
        // Restore Step 3 data (terms and payment method)
        if (parsed.termsAccepted !== undefined) {
          setTermsAccepted(parsed.termsAccepted || false);
        }
        if (parsed.dataAuthorization !== undefined) {
          setDataAuthorization(parsed.dataAuthorization || false);
        }
        if (parsed.paymentMethod) {
          setPaymentMethod(parsed.paymentMethod);
        }
        if (parsed.signatureImageDataUrl !== undefined) {
          setSignatureImageDataUrl(parsed.signatureImageDataUrl || null);
        }
        if (parsed.signatureConfirmed !== undefined) {
          setSignatureConfirmed(parsed.signatureConfirmed || false);
        }
        
        // Restore service_request_id and client_id if they exist
        // These are critical for Step 2 to work properly
        // Restore them BEFORE restoring the step to ensure they're available
        if (parsed.serviceRequestId) {
          setServiceRequestId(parsed.serviceRequestId);
        }
        if (parsed.clientId) {
          setClientId(parsed.clientId);
        }
        
        // Restore step - if user was on step 2 or 3, ALWAYS go back to step 1 (with data filled)
        // User can then click "Continue" to go to step 2 and re-upload documents
        // This applies when returning from Stripe, browser back button, or any navigation
        // Force step 1 immediately if user was on step 2 or 3
        if (!hasRestoredStepRef.current && parsed.currentStep && parsed.currentStep > 1) {
          // ALWAYS go back to step 1 if user was on step 2 or 3
          if (parsed.currentStep === 2 || parsed.currentStep === 3) {
            // Force Step 1 and ensure it's set
            setCurrentStep(1);
            hasRestoredStepRef.current = true;
            // Reset document upload state
            setDocumentsUploaded(false);
            setDocumentFiles(null);
            
            // Small delay to ensure state is updated
            setTimeout(() => {
              isRestoringRef.current = false;
            }, 300);
          } else {
            setCurrentStep(parsed.currentStep);
            hasRestoredStepRef.current = true;
            isRestoringRef.current = false;
          }
        } else {
          // No step restoration needed, allow saving immediately
          restoreAttemptedRef.current = true;
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 300);
        }
      } else {
        // No matching draft, allow saving immediately
        isRestoringRef.current = false;
        restoreAttemptedRef.current = true;
      }
    } catch (err) {
      console.warn('Failed to load draft:', err);
      isRestoringRef.current = false;
      restoreAttemptedRef.current = true;
    }
  }, [productSlug, sellerId]);

  // Load draft from localStorage - runs on mount and when productSlug/sellerId changes
  // IMPORTANT: This runs AFTER the Stripe return check to avoid showing checkout if user is returning
  useEffect(() => {
    // Don't restore if we're returning from Stripe (check happens in another useEffect)
    if (returningFromStripeRef.current) {
      return; // Skip restoration if we detected Stripe return
    }
    
    // Reset restore flag when productSlug or sellerId changes
    restoreAttemptedRef.current = false;
    isRestoringRef.current = false;
    hasRestoredStepRef.current = false; // Reset step restoration flag
    
    // Small delay to ensure Stripe check runs first
    const timeoutId = setTimeout(() => {
      // Double-check we're not returning from Stripe
      if (!returningFromStripeRef.current) {
        restoreDraft();
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSlug, sellerId, loading]); // Add loading to dependencies

  // Additional check: if form is empty but draft exists, restore it
  // This handles cases where restoration didn't happen for some reason
  useEffect(() => {
    // Only check if form is empty and we haven't restored yet
    if (!clientName && !clientEmail && !restoreAttemptedRef.current) {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.productSlug === productSlug && (!parsed.sellerId || parsed.sellerId === sellerId || !sellerId)) {
            // Form is empty but draft exists - restore it
            restoreDraft();
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName, clientEmail, productSlug, sellerId]);

  // Detect browser back/forward navigation and restore draft
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // When page is restored from cache (browser back/forward)
      if (event.persisted) {
        // Reset restore flag to allow restoration
        restoreAttemptedRef.current = false;
        isRestoringRef.current = false;
        hasRestoredStepRef.current = false; // Reset step restoration flag
        // Small delay to ensure component is ready
        setTimeout(() => {
          restoreDraft();
        }, 100);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSlug, sellerId]);

  // Save draft to localStorage (all text inputs and selects, but NOT file uploads)
  useEffect(() => {
    // Don't save during restoration
    if (isRestoringRef.current) {
      return;
    }
    
    // Don't save if we haven't attempted restoration yet (first render)
    if (!restoreAttemptedRef.current) {
      return;
    }
    
    try {
      const draft = {
        productSlug,
        sellerId, // Save seller ID so it works when user returns
        // Step 1: Personal Information
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
        state,
        postalCode,
        maritalStatus,
        clientObservations,
        extraUnits,
        dependentNames,
        // Step 3: Terms & Payment (text/select only, no files)
        termsAccepted,
        dataAuthorization,
        signatureImageDataUrl,
        signatureConfirmed,
        paymentMethod,
        // Service request and client IDs (if they exist)
        serviceRequestId: serviceRequestId || undefined,
        clientId: clientId || undefined,
        // Current step
        currentStep,
        // Timestamp for reference
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (err) {
      console.warn('Failed to save draft:', err);
      // If storage is full, try to clear old data
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          productSlug,
          sellerId,
          clientName,
          clientEmail,
          currentStep,
        }));
      } catch (clearErr) {
        console.warn('Failed to clear and save minimal draft:', clearErr);
      }
    }
  }, [
    productSlug,
    sellerId,
    // Step 1 fields
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
    state,
    postalCode,
    maritalStatus,
    clientObservations,
    extraUnits,
    dependentNames,
    // Step 3 fields (text/select only)
    termsAccepted,
    dataAuthorization,
    signatureImageDataUrl,
    signatureConfirmed,
    paymentMethod,
    // Current step
    currentStep,
  ]);

  // Check if user is returning from Stripe (BEFORE restoring draft)
  // This runs FIRST, immediately after product loads, to catch Stripe returns
  // This is critical - must run before any draft restoration to prevent showing checkout
  // IMPORTANT: Only check if user is actually returning from Stripe, not during normal navigation
  useEffect(() => {
    const checkStripeReturn = async () => {
      if (!productSlug || loading) return; // Aguardar produto carregar
      
      // Verificar se usuário veio da página de cancelamento (não redirecionar novamente)
      const referrer = document.referrer;
      if (referrer && referrer.includes('/checkout/cancel')) {
        // Usuário veio da página de cancelamento, não redirecionar novamente
        return;
      }
      
      // Verificar se usuário está navegando normalmente pelo checkout (não veio do Stripe)
      // Se o referrer é a própria página de checkout, significa que está navegando normalmente
      if (referrer && (referrer.includes('/checkout/visa/') || referrer.includes(window.location.origin + '/checkout/visa/'))) {
        // Usuário está navegando normalmente pelo checkout, não verificar Stripe
        return;
      }
      
      // Verificar se já foi redirecionado para cancelamento antes (flag persistente)
      const redirectKey = `stripe_redirected_to_cancel_${productSlug}_${sellerId || 'no-seller'}`;
      if (sessionStorage.getItem(redirectKey)) {
        // Já foi redirecionado para cancelamento antes, não redirecionar novamente
        return;
      }
      
      // Verificar se já foi checado nesta sessão
      const checkKey = `stripe_return_check_${productSlug}_${sellerId || 'no-seller'}`;
      if (sessionStorage.getItem(checkKey)) {
        return; // Já verificado
      }
      
      // Só verificar se o referrer indica que veio de uma página externa (como Stripe)
      // Ou se não há referrer (pode ser uma nova aba/janela)
      const isExternalReferrer = !referrer || 
        referrer.includes('checkout.stripe.com') || 
        referrer.includes('stripe.com') ||
        (!referrer.includes(window.location.hostname));
      
      if (!isExternalReferrer) {
        // Referrer indica navegação interna, não verificar Stripe
        sessionStorage.setItem(checkKey, 'true'); // Marcar como verificado para não verificar novamente
        return;
      }
      
      try {
        // Buscar ordem pendente recente (últimos 10 minutos)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        let query = supabase
          .from('visa_orders')
          .select('id, payment_status, stripe_session_id, created_at')
          .eq('product_slug', productSlug)
          .eq('payment_status', 'pending')
          .not('stripe_session_id', 'is', null)
          .gte('created_at', tenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);
        
        // Adicionar filtro de seller se existir
        if (sellerId) {
          query = query.eq('seller_id', sellerId);
        }
        
        const { data: orders, error: queryError } = await query;
        
        if (queryError) {
          console.error('Error checking Stripe return:', queryError);
          sessionStorage.setItem(checkKey, 'true'); // Marcar mesmo em erro para não ficar em loop
          return;
        }
        
        if (orders && orders.length > 0 && orders[0].stripe_session_id) {
          // Marcar como verificado ANTES de redirecionar
          sessionStorage.setItem(checkKey, 'true');
          // Marcar que foi redirecionado para cancelamento (flag persistente)
          sessionStorage.setItem(redirectKey, 'true');
          
          // Marcar que usuário está retornando do Stripe
          returningFromStripeRef.current = true;
          
          // Redirecionar para página de cancelamento usando replace() para não ficar no histórico
          window.location.replace(`/checkout/cancel?order_id=${orders[0].id}`);
          return; // Não continuar com o resto do componente
        } else {
          // Marcar como verificado mesmo sem encontrar ordem
          sessionStorage.setItem(checkKey, 'true');
        }
      } catch (err) {
        console.error('Error checking Stripe return:', err);
        sessionStorage.setItem(checkKey, 'true'); // Marcar mesmo em erro para não ficar em loop
      }
    };
    
    // Executar IMEDIATAMENTE após produto carregar (sem delay)
    if (!loading && productSlug) {
      // Executar de forma síncrona se possível, sem delay
      checkStripeReturn();
    }
  }, [productSlug, sellerId, loading]); // Dependências: produto e seller

  // Load product and track link click
  useEffect(() => {
    const loadProduct = async () => {
      if (!productSlug) return;

      try {
        const { data, error } = await supabase
          .from('visa_products')
          .select('*')
          .eq('slug', productSlug)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setError('Product not found or unavailable');
          setLoading(false);
          return;
        }

        setProduct(data);

        // Para produtos units_only, inicializar com 1 unidade (mínimo obrigatório)
        // Isso garante que o usuário não possa ter 0 unidades para esses serviços
        if (data.calculation_type === 'units_only') {
          setExtraUnits(1);
        }
        
        // Ajustar array de nomes baseado no calculation_type
        // Se já temos nomes salvos, ajustar o tamanho se necessário
        setDependentNames((prevNames) => {
          if (extraUnits === 0) return [];
          
          const isUnitsOnly = data.calculation_type === 'units_only';
          const requiredNamesCount = isUnitsOnly ? extraUnits - 1 : extraUnits;
          
          if (prevNames.length === requiredNamesCount) {
            return prevNames; // Tamanho já está correto
          } else if (prevNames.length > requiredNamesCount) {
            // Diminuir: remover nomes excedentes
            return prevNames.slice(0, requiredNamesCount);
          } else {
            // Aumentar: adicionar slots vazios
            const newNames = [...prevNames];
            while (newNames.length < requiredNamesCount) {
              newNames.push('');
            }
            return newNames;
          }
        });

        // Track link click if seller_id is present
        if (sellerId) {
          await trackLinkClick(sellerId, productSlug);
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productSlug, sellerId]);

  // Helper function to check if ANNEX I is required
  // ANNEX I is required for: scholarship, i20-control, and selection-process products (COS and Transfer)
  const isAnnexRequired = (slug: string | undefined): boolean => {
    if (!slug) return false;
    return (
      slug.endsWith('-scholarship') || 
      slug.endsWith('-i20-control') ||
      slug === 'cos-selection-process' ||
      slug === 'transfer-selection-process'
    );
  };

  // Load contract template when productSlug is available and user is on step 3
  // Skip loading template if ANNEX I is required
  useEffect(() => {
    const loadContractTemplate = async () => {
      if (!productSlug || currentStep !== 3) {
        return;
      }

      // Don't load template if ANNEX I is required
      if (isAnnexRequired(productSlug)) {
        setContractTemplate(null);
        setLoadingTemplate(false);
        return;
      }

      setLoadingTemplate(true);
      try {
        const template = await getContractTemplateByProductSlug(productSlug);
        setContractTemplate(template);
      } catch (err) {
        console.error('[VisaCheckout] Error loading contract template:', err);
        setContractTemplate(null);
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadContractTemplate();
  }, [productSlug, currentStep]);

  // Check for existing signed contract
  // Only reuses contract if:
  // - Current product is Scholarship or I-20 Control (not Selection Process)
  // - There's a contract from Selection Process of the same service (initial/cos/transfer)
  // 
  // IMPORTANT: This checks 3 criteria to avoid confusion between different clients/vendors:
  // 1. client_email - Must be the SAME client (different emails = different clients)
  // 2. seller_id - Must be the SAME seller (different sellers = different contracts)
  // 3. product_slug - Must be Selection Process of the SAME service (initial/cos/transfer)
  //
  // Example: Client 1 (email1) pays Selection Process → contract saved
  //          Client 2 (email2) gets Scholarship link → NO contract found (different email)
  //          Client 1 (email1) gets Scholarship link → Contract found (same email + seller + service)
  const checkExistingContract = async () => {
    // Only check if we have email, seller_id, and product
    // The email identifies the specific client, so different clients won't share contracts
    if (!clientEmail || !sellerId || !productSlug) {
      return;
    }

    // If this is Selection Process (first payment), always sign new contract
    // Never reuse contract for the first payment
    if (productSlug.includes('selection-process')) {
      return;
    }

    // For Scholarship and I-20 Control, check if there's a contract from Selection Process
    // of the same service (initial, cos, or transfer)
    try {
      // Extract service type from current product slug
      let serviceType = '';
      if (productSlug.startsWith('initial-')) {
        serviceType = 'initial';
      } else if (productSlug.startsWith('cos-')) {
        serviceType = 'cos';
      } else if (productSlug.startsWith('transfer-')) {
        serviceType = 'transfer';
      } else {
        // Not a service that supports contract reuse
        return;
      }

      // Find Selection Process contract from the same service
      const selectionProcessSlug = `${serviceType}-selection-process`;
      
      let query = supabase
        .from('visa_orders')
        .select('contract_document_url, contract_selfie_url, contract_signed_at, service_request_id, product_slug')
        .eq('client_email', clientEmail)
        .eq('seller_id', sellerId)
        .eq('product_slug', selectionProcessSlug)
        .eq('contract_accepted', true)
        .not('contract_signed_at', 'is', null)
        .order('contract_signed_at', { ascending: false })
        .limit(1);

      const { data: orders, error } = await query;

      if (error) {
        console.error('Error checking existing contract:', error);
        return;
      }

      if (orders && orders.length > 0) {
        const order = orders[0];
        if (order.contract_document_url && order.contract_selfie_url) {
          setHasExistingContract(true);
          setExistingContractData({
            contract_document_url: order.contract_document_url,
            contract_selfie_url: order.contract_selfie_url,
            contract_signed_at: order.contract_signed_at || '',
          });
          console.log('Found existing contract from Selection Process, will reuse it');
        }
      }
    } catch (err) {
      console.error('Error in checkExistingContract:', err);
    }
  };

  // Load prefill data from token
  const loadPrefillData = async (token: string) => {
    try {
      const { data: tokenData, error } = await supabase
        .from('checkout_prefill_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !tokenData) {
        console.error('Error loading prefill token:', error);
        return false;
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        setError('This link has expired. Please contact your seller for a new link.');
        return false;
      }

      // Parse client data
      const clientData = tokenData.client_data;

      // Fill form fields with prefill data
      if (clientData.clientName) setClientName(clientData.clientName);
      if (clientData.clientEmail) setClientEmail(clientData.clientEmail);
      if (clientData.clientWhatsApp) setClientWhatsApp(clientData.clientWhatsApp);
      if (clientData.clientCountry) setClientCountry(clientData.clientCountry);
      if (clientData.clientNationality) setClientNationality(clientData.clientNationality);
      if (clientData.dateOfBirth) setDateOfBirth(clientData.dateOfBirth);
      if (clientData.documentType) setDocumentType(clientData.documentType);
      if (clientData.documentNumber) setDocumentNumber(clientData.documentNumber);
      if (clientData.addressLine) setAddressLine(clientData.addressLine);
      if (clientData.city) setCity(clientData.city);
      if (clientData.state) setState(clientData.state);
      if (clientData.postalCode) setPostalCode(clientData.postalCode);
      if (clientData.maritalStatus) setMaritalStatus(clientData.maritalStatus);
      if (clientData.clientObservations) setClientObservations(clientData.clientObservations);
      if (clientData.extraUnits !== undefined) setExtraUnits(clientData.extraUnits);
      if (clientData.dependentNames && Array.isArray(clientData.dependentNames)) {
        setDependentNames(clientData.dependentNames);
      } else if (clientData.extraUnits > 0) {
        // Se não há nomes salvos, criar array vazio com tamanho correto
        // Para units_only: (extraUnits - 1), para base_plus_units: extraUnits
        const isUnitsOnly = product?.calculation_type === 'units_only';
        const requiredNamesCount = isUnitsOnly ? clientData.extraUnits - 1 : clientData.extraUnits;
        setDependentNames(Array(requiredNamesCount).fill(''));
      }

      // Mark token as used (but don't block if payment fails - user can retry)
      // The token will only be blocked if payment_status becomes 'completed' or 'paid'
      if (!tokenData.used_at) {
        await supabase
          .from('checkout_prefill_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token);
      }

      // Show success message
      console.log('Prefill data loaded successfully');
      return true;
    } catch (err) {
      console.error('Error in loadPrefillData:', err);
      return false;
    }
  };

  // Load prefill data on mount if token is present
  useEffect(() => {
    if (prefillToken && !loading && product) {
      loadPrefillData(prefillToken);
    }
  }, [prefillToken, loading, product]);

  // Check for existing contract when email is available
  // Only checks if current product is NOT selection-process
  useEffect(() => {
    if (clientEmail && sellerId && product && productSlug) {
      // Only check for existing contract if this is NOT the first payment (Selection Process)
      if (!productSlug.includes('selection-process')) {
        checkExistingContract();
      }
    }
  }, [clientEmail, sellerId, product, productSlug]);

  // Calculate base total (before fees) based on calculation_type
  const baseTotal = product ? calculateBaseTotal(product, extraUnits) : 0;

  // Calculate total with fees based on payment method
  const totalWithFees = calculateTotalWithFees(baseTotal, paymentMethod, exchangeRate || undefined);

  // Fetch exchange rate for PIX
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        const baseRate = parseFloat(data.rates.BRL);
        // Apply 4% commercial margin (matching backend)
        setExchangeRate(baseRate * 1.04);
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        // Fallback rate
        setExchangeRate(5.6);
      }
    };

    if (currentStep === 3) {
      fetchExchangeRate();
    }
  }, [currentStep]);


  // Função para fazer scroll até o primeiro campo com erro
  const scrollToFirstError = (fieldName: string) => {
    setTimeout(() => {
      // Mapeamento entre nomes de campos e IDs reais no DOM
      const fieldIdMap: Record<string, string> = {
        clientName: 'name',
        clientEmail: 'email',
        dateOfBirth: 'date-of-birth',
        documentType: 'document-type',
        documentNumber: 'document-number',
        addressLine: 'address-line',
        city: 'city',
        state: 'state',
        postalCode: 'postal-code',
        clientCountry: 'country',
        clientNationality: 'nationality',
        clientWhatsApp: 'whatsapp',
        maritalStatus: 'marital-status',
      };
      
      const elementId = fieldIdMap[fieldName] || fieldName;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Tentar focar no elemento se for um input ou select
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
          element.focus();
        } else {
          // Se for um SelectTrigger, tentar focar no elemento pai
          const selectTrigger = element.querySelector('button');
          if (selectTrigger) {
            selectTrigger.focus();
          }
        }
      }
    }, 100);
  };

  // Validate Step 1
  const validateStep1Form = (): boolean => {
    setFieldErrors({});
    setError('');

    // Validação especial para produtos units_only: deve ter pelo menos 1 unidade
    if (product?.calculation_type === 'units_only' && extraUnits < 1) {
      setError('Number of applicants must be at least 1 for this service');
      const extraUnitsElement = document.getElementById('extra-units');
      if (extraUnitsElement) {
        extraUnitsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    // Validação de nomes de dependentes/aplicantes
    if (extraUnits > 0) {
      const isUnitsOnly = product?.calculation_type === 'units_only';
      // For units_only: we need (extraUnits - 1) names (client is the first)
      // For base_plus_units: we need extraUnits names (dependents only)
      const requiredNamesCount = isUnitsOnly ? extraUnits - 1 : extraUnits;
      const entityName = isUnitsOnly ? 'applicant' : 'dependent';
      
      if (dependentNames.length !== requiredNamesCount) {
        setError(`Please provide names for all ${requiredNamesCount} ${entityName}${requiredNamesCount > 1 ? 's' : ''}`);
        const firstDependentInput = document.getElementById('dependent-name-0');
        if (firstDependentInput) {
          firstDependentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      // Verificar que todos os nomes estão preenchidos (não vazios)
      const emptyNames = dependentNames.filter(name => !name || name.trim() === '');
      if (emptyNames.length > 0) {
        const firstEmptyIndex = dependentNames.findIndex(name => !name || name.trim() === '');
        setError(`Please provide names for all ${entityName}s. ${emptyNames.length} name${emptyNames.length > 1 ? 's' : ''} missing.`);
        const emptyInput = document.getElementById(`dependent-name-${firstEmptyIndex}`);
        if (emptyInput) {
          emptyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
    }

    const formData: Step1FormData = {
      clientName,
      clientEmail,
      dateOfBirth,
      documentType,
      documentNumber,
      addressLine,
      city,
      state,
      postalCode,
      clientCountry,
      clientNationality,
      clientWhatsApp,
      maritalStatus,
    };
    
    const result = validateStep1(formData);
    if (!result.valid && result.errors) {
      setFieldErrors(result.errors);
      if (result.firstErrorField) {
        scrollToFirstError(result.firstErrorField);
      }
      return false;
    }
    return true;
  };

  // DEPRECATED: saveStep1, saveStep2, saveStep3 functions removed
  // Now using saveStep1Data, saveStep2Data, saveStep3Data from visa-checkout-service.ts

  // Handle step navigation
  const handleNext = async () => {
    setError('');

    if (currentStep === 1) {
      if (!validateStep1Form()) {
        return;
      }
      
      const formData: Step1FormData = {
        clientName,
        clientEmail,
        dateOfBirth,
        documentType,
        documentNumber,
        addressLine,
        city,
        state,
        postalCode,
        clientCountry,
        clientNationality,
        clientWhatsApp,
        maritalStatus,
      };
      
      const result = await saveStep1Data(
        formData,
        extraUnits,
        productSlug!,
        sellerId || '',
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
      
      const saved = result.success;
      if (saved) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      // If we have an existing contract, skip document upload
      if (hasExistingContract && existingContractData) {
        setCurrentStep(3);
        return;
      }
      
      setStep2Errors({});
      setError('');
      
      const errors: Record<string, string> = {};
      
      if (!documentsUploaded || !documentFiles) {
        errors.documents = 'Please upload all required documents (front, back, and selfie)';
        setStep2Errors(errors);
        setTimeout(() => {
          const documentUploadElement = document.querySelector('[data-document-upload]');
          if (documentUploadElement) {
            documentUploadElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
      
      // Ensure all required documents are present
      if (!documentFiles.documentFront) {
        errors.documentFront = 'Document front is required';
      }
      if (!documentFiles.documentBack) {
        errors.documentBack = 'Document back is required';
      }
      if (!documentFiles.selfie) {
        errors.selfie = 'Selfie is required';
      }
      
      if (Object.keys(errors).length > 0) {
        setStep2Errors(errors);
        setTimeout(() => {
          const documentUploadElement = document.querySelector('[data-document-upload]');
          if (documentUploadElement) {
            documentUploadElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
      
      // Ensure serviceRequestId exists
      let serviceRequestIdToUse = serviceRequestId;
      if (!serviceRequestIdToUse) {
        setError('Please complete Step 1 first');
        setCurrentStep(1);
        return;
      }
      
      const existingContractDataForSave = hasExistingContract && existingContractData ? {
        contract_document_url: existingContractData.contract_document_url,
        contract_selfie_url: existingContractData.contract_selfie_url,
      } : undefined;
      
      const result = await saveStep2Data(serviceRequestIdToUse, documentFiles, existingContractDataForSave);
      if (!result.success) {
        setError(result.error || 'Failed to save documents');
        return;
      }
      
      const saved = result.success;
      if (saved) {
        setCurrentStep(3);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  // Upload signature image to storage
  const uploadSignatureImage = async (): Promise<string | null> => {
    if (!signatureImageDataUrl) {
      return null;
    }

    try {
      // Convert base64 to blob
      const base64Data = signatureImageDataUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Create File
      const fileName = `signatures/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      
      // Upload to storage (using visa-documents bucket with signatures folder)
      const { error: uploadError } = await supabase.storage
        .from('visa-documents')
        .upload(fileName, file, {
          contentType: 'image/png',
          upsert: false,
        });
      
      if (uploadError) {
        console.error('[VISA_CHECKOUT] Error uploading signature:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('visa-documents')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error('[VISA_CHECKOUT] Error processing signature upload:', error);
      throw error;
    }
  };

  // Handle Stripe checkout
  const handleStripeCheckout = async (method: 'card' | 'pix') => {
    setStep3Errors({});
    setError('');
    
    const errors: Record<string, string> = {};
    
    if (!termsAccepted) {
      errors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    if (!dataAuthorization) {
      errors.dataAuthorization = 'You must accept the data authorization';
    }

    // Validate signature
    if (!signatureImageDataUrl || !signatureConfirmed) {
      errors.signature = 'Please draw and confirm your digital signature before proceeding with payment';
    }
    
    if (Object.keys(errors).length > 0) {
      setStep3Errors(errors);
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        if (firstErrorField === 'termsAccepted') {
          const element = document.getElementById('terms-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'dataAuthorization') {
          const element = document.getElementById('data-auth-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'signature') {
          const element = document.querySelector('[data-signature-pad]');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
      return;
    }

    if (!serviceRequestId) {
      alert('Please complete all steps first');
      return;
    }

      // Save terms acceptance
      const result = await saveStep3Data(
        serviceRequestId, 
        termsAccepted, 
        dataAuthorization,
        contractTemplate?.id || null
      );
      if (!result.success) {
        setError(result.error || 'Failed to save terms acceptance');
        return;
      }

    setSubmitting(true);
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: method,
          service_request_id: serviceRequestId || undefined,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp,
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, method, {
          total_amount: totalWithFees,
          extra_units: extraUnits,
          service_request_id: serviceRequestId || undefined,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Upload signature image
      let signatureImageUrl: string | null = null;
      try {
        signatureImageUrl = await uploadSignatureImage();
      } catch (sigError) {
        setError('Error uploading signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // Get document URLs from documentFiles or existing contract
      const documentFrontUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_document_url
        : documentFiles?.documentFront?.url || '';
      const selfieUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_selfie_url
        : documentFiles?.selfie?.url || '';

      // Force save current form data to localStorage before redirecting
      try {
        const draft = {
          productSlug,
          sellerId,
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
          state,
          postalCode,
          maritalStatus,
          clientObservations,
          extraUnits,
          dependentNames,
          termsAccepted,
          dataAuthorization,
          signatureImageDataUrl,
          signatureConfirmed,
          paymentMethod: method,
          currentStep,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        console.warn('Failed to save draft before redirect:', err);
      }

      const { data, error } = await supabase.functions.invoke('create-visa-checkout-session', {
        body: {
          product_slug: productSlug,
          seller_id: sellerId,
          extra_units: extraUnits,
          dependent_names: dependentNames,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp,
          client_country: clientCountry,
          client_nationality: clientNationality,
          client_observations: clientObservations,
          payment_method: method,
          exchange_rate: exchangeRate || undefined, // Pass exchange rate for PIX
          contract_document_url: documentFrontUrl, // Use front document
          contract_selfie_url: selfieUrl,
          signature_image_url: signatureImageUrl,
          ip_address: clientIP,
          service_request_id: serviceRequestId, // Pass service request ID
        },
      });

      if (error) {
        console.error('Error creating checkout:', error);
        setError('Failed to create checkout session. We were unable to redirect you to Stripe. Please try again later or contact support.');
        // Bring the user attention to the error banner
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (data?.checkout_url) {
        // Salvar informações da ordem no localStorage para detecção futura
        try {
          const orderInfo = {
            order_id: data.order_id,
            product_slug: productSlug,
            seller_id: sellerId || null,
            redirect_time: new Date().toISOString(),
          };
          localStorage.setItem('last_stripe_order', JSON.stringify(orderInfo));
          
          // Limpar flags de verificação anteriores para garantir detecção na próxima volta
          const checkKey = `stripe_return_check_${productSlug}_${sellerId || 'no-seller'}`;
          sessionStorage.removeItem(checkKey);
          // Limpar flag de redirecionamento para cancelamento - nova ordem foi criada
          const redirectKey = `stripe_redirected_to_cancel_${productSlug}_${sellerId || 'no-seller'}`;
          sessionStorage.removeItem(redirectKey);
        } catch (err) {
          console.warn('Failed to save order info:', err);
        }
        
        // DON'T clear draft - keep it so user can return and see their data
        // localStorage.removeItem(DRAFT_STORAGE_KEY);
        // Use replace() instead of href to prevent checkout from staying in browser history
        // This way, when user clicks browser back button, they won't return to checkout
        window.location.replace(data.checkout_url);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred while creating your checkout session. We were unable to redirect you to Stripe. Please try again later or contact support.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Zelle payment
  const handleZellePayment = async () => {
    setStep3Errors({});
    setError('');
    
    const errors: Record<string, string> = {};
    
    if (!termsAccepted) {
      errors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    if (!dataAuthorization) {
      errors.dataAuthorization = 'You must accept the data authorization';
    }

    // Validate signature
    if (!signatureImageDataUrl || !signatureConfirmed) {
      errors.signature = 'Please draw and confirm your digital signature before proceeding with payment';
    }

    if (!serviceRequestId) {
      errors.serviceRequest = 'Please complete all steps first';
    }

    if (!zelleReceipt) {
      errors.zelleReceipt = 'Please upload the Zelle payment receipt';
    }
    
    if (Object.keys(errors).length > 0) {
      setStep3Errors(errors);
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        if (firstErrorField === 'termsAccepted') {
          const element = document.getElementById('terms-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'dataAuthorization') {
          const element = document.getElementById('data-auth-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'signature') {
          const element = document.querySelector('[data-signature-pad]');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'zelleReceipt') {
          const element = document.getElementById('zelle-receipt');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
      return;
    }

      // Save terms acceptance
      if (!serviceRequestId) {
        setError('Service request ID is required');
        return;
      }
      const result = await saveStep3Data(
        serviceRequestId, 
        termsAccepted, 
        dataAuthorization,
        contractTemplate?.id || null
      );
      if (!result.success) {
        setError(result.error || 'Failed to save terms acceptance');
        return;
      }

    setSubmitting(true);
    setIsZelleProcessing(true); // Ativar overlay de loading
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: 'zelle',
          service_request_id: serviceRequestId || undefined,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp,
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, 'zelle', {
          total_amount: baseTotal, // Zelle uses base total (no fees)
          extra_units: extraUnits,
          service_request_id: serviceRequestId || undefined,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Process Zelle payment with n8n validation
      let n8nResult;
      let publicUrl: string;
      let paymentId: string;
      let zellePaymentStatus: 'approved' | 'pending_verification' = 'pending_verification';
      let n8nResponseData: any = null;
      let n8nConfidence: number | null = null;

      // Get user ID from service request if available
      if (!serviceRequestId) {
        throw new Error('Service request ID is required');
      }
      if (!zelleReceipt) {
        throw new Error('Zelle receipt is required');
      }
      const { data: serviceRequest } = await supabase
        .from('service_requests')
        .select('client_id')
        .eq('id', serviceRequestId)
        .single();

      const userId = serviceRequest?.client_id || null;

      // Process with n8n (upload + validation)
      // This will throw an error if zelle_comprovantes bucket doesn't exist
      n8nResult = await processZellePaymentWithN8n(
        zelleReceipt,
        baseTotal,
        productSlug!,
        userId,
        undefined // options (scholarships, coupons, etc.) - can be added later
      );

      publicUrl = n8nResult.imageUrl;
      paymentId = n8nResult.paymentId;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1406',message:'Before setting zellePaymentStatus',data:{decision:JSON.stringify(n8nResult.decision),shouldApprove:n8nResult.decision?.shouldApprove,shouldApproveType:typeof n8nResult.decision?.shouldApprove},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'status-check'})}).catch(()=>{});
      // #endregion
      
      zellePaymentStatus = n8nResult.decision.shouldApprove ? 'approved' : 'pending_verification';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1412',message:'After setting zellePaymentStatus',data:{zellePaymentStatus,zellePaymentStatusType:typeof zellePaymentStatus,zellePaymentStatusValue:JSON.stringify(zellePaymentStatus)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'status-check'})}).catch(()=>{});
      // #endregion
      
      n8nResponseData = n8nResult.n8nResponse;
      n8nConfidence = n8nResult.decision.confidence ?? null;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1407',message:'n8nResult received',data:{n8nResult:JSON.stringify(n8nResult),n8nResponseData:JSON.stringify(n8nResponseData),n8nResponseType:typeof n8nResponseData,n8nResponseIsNull:n8nResponseData===null,n8nResponseIsUndefined:n8nResponseData===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      console.log('[Zelle] n8n validation result:', {
        status: zellePaymentStatus,
        confidence: n8nConfidence,
        message: n8nResult.decision.message,
      });

      // Check if n8n response is valid - if not, redirect to processing page
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1417',message:'Before response extraction',data:{n8nResponseData:JSON.stringify(n8nResponseData),hasResponse:n8nResponseData?.response!==undefined,responseValue:n8nResponseData?.response,responseType:typeof n8nResponseData?.response},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      const n8nResponseText = n8nResponseData?.response?.toLowerCase().trim() || '';
      const isValidResponse = n8nResponseText === 'the proof of payment is valid.';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1418',message:'After response validation',data:{n8nResponseText,n8nResponseTextLength:n8nResponseText.length,expectedText:'the proof of payment is valid.',isValidResponse,comparisonResult:n8nResponseText=== 'the proof of payment is valid.'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log('[Zelle] Response validation check:', {
        n8nResponseText,
        isValidResponse,
        n8nResponseData: n8nResponseData,
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1426',message:'Entering redirect check',data:{isValidResponse:isValidResponse,willEnterIf:!isValidResponse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      if (!isValidResponse) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1427',message:'Inside redirect block',data:{isValidResponse},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        console.log('[Zelle] Response is not valid, redirecting to processing page...');
        
        // Try to save order data before redirecting (for manual review)
        // Wrap in try-catch to ensure redirect happens even if save fails
        try {
          // Upload signature image first
          let signatureImageUrl: string | null = null;
          try {
            signatureImageUrl = await uploadSignatureImage();
          } catch (sigError) {
            console.error('Error uploading signature:', sigError);
            // Continue anyway
          }

          // Create payment record
          const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .insert({
              service_request_id: serviceRequestId,
              amount: baseTotal,
              currency: 'USD',
              status: 'pending',
            })
            .select()
            .single();

          if (paymentError) {
            console.error('Error creating payment:', paymentError);
            // Continue anyway - will be created on processing page
          }

          // Create order (for compatibility with existing system)
          const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          
          // Get document URLs from documentFiles or existing contract
          const documentFrontUrl = hasExistingContract && existingContractData
            ? existingContractData.contract_document_url
            : documentFiles?.documentFront?.url || '';
          const selfieUrl = hasExistingContract && existingContractData
            ? existingContractData.contract_selfie_url
            : documentFiles?.selfie?.url || '';

          const { data: order, error: orderError } = await supabase
            .from('visa_orders')
            .insert({
              order_number: orderNumber,
              product_slug: productSlug,
              seller_id: sellerId || null,
              service_request_id: serviceRequestId,
              base_price_usd: parseFloat(product!.base_price_usd),
              price_per_dependent_usd: parseFloat(product!.price_per_dependent_usd),
              number_of_dependents: extraUnits,
              extra_units: extraUnits,
              dependent_names: extraUnits > 0 ? dependentNames : null,
              extra_unit_label: product!.extra_unit_label,
              extra_unit_price_usd: parseFloat(product!.extra_unit_price),
              calculation_type: product!.calculation_type,
              total_price_usd: baseTotal,
              client_name: clientName,
              client_email: clientEmail,
              client_whatsapp: clientWhatsApp || null,
              client_country: clientCountry || null,
              client_nationality: clientNationality || null,
              client_observations: clientObservations || null,
              payment_method: 'zelle',
              payment_status: 'pending',
              zelle_proof_url: publicUrl,
              contract_document_url: documentFrontUrl,
              contract_selfie_url: selfieUrl,
              signature_image_url: signatureImageUrl,
              contract_accepted: true,
              contract_signed_at: new Date().toISOString(),
              ip_address: clientIP,
              payment_metadata: {
                base_amount: parseFloat(product!.base_price_usd).toFixed(2),
                final_amount: baseTotal.toFixed(2),
                extra_units: extraUnits,
                calculation_type: product!.calculation_type,
                ip_address: clientIP,
                payment_id: paymentData?.id,
                n8n_validation: n8nResponseData ? {
                  response: n8nResponseData.response,
                  confidence: n8nConfidence,
                  status: n8nResponseData.status,
                } : null,
              },
            })
            .select()
            .single();

          if (orderError) {
            console.error('Error creating order:', orderError);
            // Continue anyway - redirect to processing page
          }

          // Create zelle_payment record
          const { error: zellePaymentError } = await supabase
            .from('zelle_payments')
            .insert({
              payment_id: paymentId,
              order_id: order?.id || null,
              service_request_id: serviceRequestId,
              user_id: userId,
              amount: baseTotal,
              currency: 'USD',
              fee_type: productSlug,
              screenshot_url: publicUrl,
              image_path: n8nResult?.imagePath || null,
              n8n_response: n8nResponseData,
              n8n_confidence: n8nConfidence,
              n8n_validated_at: n8nResponseData ? new Date().toISOString() : null,
              status: 'pending_verification',
              metadata: {},
            });

          if (zellePaymentError) {
            console.error('[Zelle] Error creating zelle_payment record:', zellePaymentError);
          }

          // Update payment with order reference if order was created
          if (order && paymentData) {
            await supabase
              .from('payments')
              .update({ external_payment_id: order.id })
              .eq('id', paymentData.id);
          }
        } catch (saveError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1573',message:'Error in save block before redirect',data:{saveError:saveError instanceof Error?saveError.message:String(saveError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          console.error('[Zelle] Error saving order data before redirect:', saveError);
          // Continue to redirect anyway
        }

        // ALWAYS redirect to processing page, even if save failed
        console.log('[Zelle] Redirecting to processing page...');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1556',message:'Before redirect execution',data:{submittingState:submitting},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        setSubmitting(false); // Reset submitting state before redirect
        // Manter isZelleProcessing ativo até o redirecionamento
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1559',message:'Executing redirect',data:{redirectUrl:'/checkout/zelle/processing',windowLocationExists:typeof window.location!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        window.location.href = '/checkout/zelle/processing';
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1562',message:'After redirect execution',data:{redirectExecuted:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        return;
      }

      // Upload signature image
      let signatureImageUrl: string | null = null;
      try {
        signatureImageUrl = await uploadSignatureImage();
      } catch (sigError) {
        setError('Error uploading signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          service_request_id: serviceRequestId,
          amount: baseTotal, // Zelle uses base total (no fees)
          currency: 'USD',
          status: 'pending',
        })
        .select()
        .single();

      if (paymentError) {
        throw paymentError;
      }

      // Create order (for compatibility with existing system)
      const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      // Get document URLs from documentFiles or existing contract
      const documentFrontUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_document_url
        : documentFiles?.documentFront?.url || '';
      const selfieUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_selfie_url
        : documentFiles?.selfie?.url || '';

      // Determine payment status based on n8n validation
      const orderPaymentStatus = zellePaymentStatus === 'approved' ? 'completed' : 'pending';

      const { data: order, error: orderError } = await supabase
        .from('visa_orders')
        .insert({
          order_number: orderNumber,
          product_slug: productSlug,
          seller_id: sellerId || null,
          service_request_id: serviceRequestId,
          base_price_usd: parseFloat(product!.base_price_usd),
          price_per_dependent_usd: parseFloat(product!.price_per_dependent_usd),
          number_of_dependents: extraUnits,
          extra_units: extraUnits,
          dependent_names: extraUnits > 0 ? dependentNames : null,
          extra_unit_label: product!.extra_unit_label,
          extra_unit_price_usd: parseFloat(product!.extra_unit_price),
          calculation_type: product!.calculation_type,
          total_price_usd: baseTotal, // Store base total, fees are handled separately
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp || null,
          client_country: clientCountry || null,
          client_nationality: clientNationality || null,
          client_observations: clientObservations || null,
          payment_method: 'zelle',
          payment_status: orderPaymentStatus,
          zelle_proof_url: publicUrl,
          contract_document_url: documentFrontUrl,
          contract_selfie_url: selfieUrl,
          signature_image_url: signatureImageUrl,
          contract_accepted: true,
          contract_signed_at: new Date().toISOString(),
          ip_address: clientIP,
          payment_metadata: {
            base_amount: parseFloat(product!.base_price_usd).toFixed(2),
            final_amount: baseTotal.toFixed(2), // Zelle uses base total (no fees)
            extra_units: extraUnits,
            calculation_type: product!.calculation_type,
            ip_address: clientIP,
            payment_id: paymentData.id,
            n8n_validation: n8nResponseData ? {
              response: n8nResponseData.response,
              confidence: n8nConfidence,
              status: n8nResponseData.status,
            } : null,
          },
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Create zelle_payment record
      const { data: serviceRequestForZelle } = await supabase
        .from('service_requests')
        .select('client_id')
        .eq('id', serviceRequestId)
        .single();

      const userIdForZelle = serviceRequestForZelle?.client_id || null;

      // Ensure status is valid for database constraint
      // Explicitly validate and set status to one of the allowed values
      let validStatus: 'pending_verification' | 'approved' | 'rejected';
      if (zellePaymentStatus === 'approved') {
        validStatus = 'approved';
      } else {
        validStatus = 'pending_verification';
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1706',message:'Status validation before insert',data:{zellePaymentStatus,zellePaymentStatusType:typeof zellePaymentStatus,zellePaymentStatusValue:JSON.stringify(zellePaymentStatus),validStatus,validStatusType:typeof validStatus,validStatusValue:JSON.stringify(validStatus),isApproved:zellePaymentStatus==='approved'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'status-check'})}).catch(()=>{});
      // #endregion
      
      if (!serviceRequestId) {
        throw new Error('Service request ID is required');
      }
      const insertData: {
        payment_id: string;
        order_id: string;
        service_request_id: string;
        user_id: string | null;
        amount: number;
        currency: string;
        fee_type: string;
        screenshot_url: string;
        image_path: string | null;
        n8n_response: any;
        n8n_confidence: number | null;
        n8n_validated_at: string | null;
        status: 'pending_verification' | 'approved' | 'rejected';
        metadata: {};
      } = {
        payment_id: paymentId,
        order_id: order.id,
        service_request_id: serviceRequestId,
        user_id: userIdForZelle,
        amount: baseTotal,
        currency: 'USD',
        fee_type: productSlug || '',
        screenshot_url: publicUrl,
        image_path: n8nResult?.imagePath || null,
        n8n_response: n8nResponseData,
        n8n_confidence: n8nConfidence,
        n8n_validated_at: n8nResponseData ? new Date().toISOString() : null,
        status: validStatus,
        metadata: {},
      };
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1735',message:'Insert data before database call',data:{insertStatus:insertData.status,insertStatusType:typeof insertData.status,insertStatusValue:JSON.stringify(insertData.status),insertStatusLength:insertData.status?.length,insertDataKeys:Object.keys(insertData),fullInsertData:JSON.stringify(insertData)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'status-check'})}).catch(()=>{});
      // #endregion
      
      const { error: zellePaymentError } = await supabase
        .from('zelle_payments')
        .insert(insertData);

      if (zellePaymentError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1740',message:'Error creating zelle_payment',data:{error:zellePaymentError,errorCode:zellePaymentError.code,errorMessage:zellePaymentError.message,insertDataStatus:insertData.status,insertDataStatusType:typeof insertData.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'status-check'})}).catch(()=>{});
        // #endregion
        
        console.error('[Zelle] Error creating zelle_payment record:', zellePaymentError);
        // Continue anyway - not critical
      }

      // Update payment with order reference
      await supabase
        .from('payments')
        .update({ external_payment_id: order.id })
        .eq('id', paymentData.id);

      // If approved automatically, update payment and service request status
      if (zellePaymentStatus === 'approved') {
        await supabase
          .from('payments')
          .update({ 
            status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentData.id);

        await supabase
          .from('service_requests')
          .update({ 
            status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', serviceRequestId);

        // Send webhook immediately for auto-approved payments
        try {
          await supabase.functions.invoke('send-zelle-webhook', {
            body: {
              order_id: order.id,
            },
          });
          console.log('[Zelle] Webhook sent for auto-approved payment');
        } catch (webhookError) {
          console.error('[Zelle] Error sending webhook:', webhookError);
          // Continue anyway - webhook is not critical
        }
      }

      // Generate contract PDF for Zelle (immediate generation)
      try {
        await supabase.functions.invoke('generate-visa-contract-pdf', {
          body: { order_id: order.id },
        });
        console.log('[Zelle] Contract PDF generated');
      } catch (pdfError) {
        console.error('[Zelle] Error generating PDF:', pdfError);
        // Continue anyway - PDF generation is not critical for redirect
      }

      // DON'T clear draft for Zelle - only clear on success page
      // localStorage.removeItem(DRAFT_STORAGE_KEY);

      // Redirect to success page
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1782',message:'Redirecting to success page',data:{orderId:order.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Manter isZelleProcessing ativo até o redirecionamento
      window.location.href = `/checkout/success?order_id=${order.id}&method=zelle`;
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b0c11d9c-30ac-43ca-8975-359f75c28b34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VisaCheckout.tsx:1786',message:'Error caught in catch block',data:{error:err instanceof Error?err.message:String(err),errorStack:err instanceof Error?err.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      console.error('Error:', err);
      setIsZelleProcessing(false); // Desativar overlay em caso de erro
      alert('Failed to process Zelle payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Wise payment
  const handleWisePayment = async () => {
    setStep3Errors({});
    setError('');
    
    const errors: Record<string, string> = {};
    
    if (!termsAccepted) {
      errors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    if (!dataAuthorization) {
      errors.dataAuthorization = 'You must accept the data authorization';
    }

    // Validate signature
    if (!signatureImageDataUrl || !signatureConfirmed) {
      errors.signature = 'Please draw and confirm your digital signature before proceeding with payment';
    }

    if (!serviceRequestId) {
      errors.serviceRequest = 'Please complete all steps first';
    }
    
    if (Object.keys(errors).length > 0) {
      setStep3Errors(errors);
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        if (firstErrorField === 'termsAccepted') {
          const element = document.getElementById('terms-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'dataAuthorization') {
          const element = document.getElementById('data-auth-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'signature') {
          const element = document.querySelector('[data-signature-pad]');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
      return;
    }

    // Save terms acceptance
    if (!serviceRequestId) {
      setError('Service request ID is required');
      return;
    }
    const result = await saveStep3Data(
      serviceRequestId, 
      termsAccepted, 
      dataAuthorization,
      contractTemplate?.id || null
    );
    if (!result.success) {
      setError(result.error || 'Failed to save terms acceptance');
      return;
    }

    setSubmitting(true);
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: 'wise',
          service_request_id: serviceRequestId || undefined,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp,
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, 'wise', {
          total_amount: totalWithFees,
          extra_units: extraUnits,
          service_request_id: serviceRequestId || undefined,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Upload signature image
      let signatureImageUrl: string | null = null;
      try {
        signatureImageUrl = await uploadSignatureImage();
      } catch (sigError) {
        setError('Error uploading signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // Get document URLs from documentFiles or existing contract
      const documentFrontUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_document_url
        : documentFiles?.documentFront?.url || '';
      const selfieUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_selfie_url
        : documentFiles?.selfie?.url || '';

      // Create order first (before calling Wise API)
      const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const { data: order, error: orderError } = await supabase
        .from('visa_orders')
        .insert({
          order_number: orderNumber,
          product_slug: productSlug,
          seller_id: sellerId || null,
          service_request_id: serviceRequestId,
          base_price_usd: parseFloat(product!.base_price_usd),
          price_per_dependent_usd: parseFloat(product!.price_per_dependent_usd),
          number_of_dependents: extraUnits,
          extra_units: extraUnits,
          dependent_names: extraUnits > 0 ? dependentNames : null,
          extra_unit_label: product!.extra_unit_label,
          extra_unit_price_usd: parseFloat(product!.extra_unit_price),
          calculation_type: product!.calculation_type,
          total_price_usd: totalWithFees,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp || null,
          client_country: clientCountry || null,
          client_nationality: clientNationality || null,
          client_observations: clientObservations || null,
          payment_method: 'wise',
          payment_status: 'pending',
          contract_document_url: documentFrontUrl,
          contract_selfie_url: selfieUrl,
          signature_image_url: signatureImageUrl,
          contract_accepted: true,
          contract_signed_at: new Date().toISOString(),
          ip_address: clientIP,
          payment_metadata: {
            base_amount: parseFloat(product!.base_price_usd).toFixed(2),
            final_amount: totalWithFees.toFixed(2),
            extra_units: extraUnits,
            calculation_type: product!.calculation_type,
            ip_address: clientIP,
          },
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Call Wise checkout Edge Function
      const { data: wiseCheckout, error: wiseError } = await supabase.functions.invoke(
        'create-wise-checkout',
        {
          body: {
            order_id: order.id,
            client_currency: 'USD', // Can be made dynamic later
          },
        }
      );

      if (wiseError || !wiseCheckout?.success) {
        console.error('[Wise] Error creating checkout:', wiseError || wiseCheckout);
        throw new Error(wiseError?.message || 'Failed to create Wise checkout');
      }

      // Redirect to Wise payment page
      if (wiseCheckout.payment_url) {
        window.location.href = wiseCheckout.payment_url;
      } else {
        throw new Error('Payment URL not provided by Wise');
      }
    } catch (err) {
      console.error('[Wise] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process Wise payment. Please try again.');
      setSubmitting(false);
    }
  };

  const handleParcelowPayment = async () => {
    setStep3Errors({});
    setError('');
    
    const errors: Record<string, string> = {};
    
    if (!termsAccepted) {
      errors.termsAccepted = 'You must accept the terms and conditions';
    }
    
    if (!dataAuthorization) {
      errors.dataAuthorization = 'You must accept the data authorization';
    }

    // Validate signature
    if (!signatureImageDataUrl || !signatureConfirmed) {
      errors.signature = 'Please draw and confirm your digital signature before proceeding with payment';
    }

    if (!serviceRequestId) {
      errors.serviceRequest = 'Please complete all steps first';
    }
    
    if (Object.keys(errors).length > 0) {
      setStep3Errors(errors);
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        if (firstErrorField === 'termsAccepted') {
          const element = document.getElementById('terms-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'dataAuthorization') {
          const element = document.getElementById('data-auth-checkbox');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (firstErrorField === 'signature') {
          const element = document.querySelector('[data-signature-pad]');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
      return;
    }

    // Save terms acceptance
    if (!serviceRequestId) {
      setError('Service request ID is required');
      return;
    }
    const result = await saveStep3Data(
      serviceRequestId, 
      termsAccepted, 
      dataAuthorization,
      contractTemplate?.id || null
    );
    if (!result.success) {
      setError(result.error || 'Failed to save terms acceptance');
      return;
    }

    setSubmitting(true);
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: 'parcelow',
          service_request_id: serviceRequestId || undefined,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp,
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, 'parcelow', {
          total_amount: totalWithFees,
          extra_units: extraUnits,
          service_request_id: serviceRequestId || undefined,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Upload signature image
      let signatureImageUrl: string | null = null;
      try {
        signatureImageUrl = await uploadSignatureImage();
      } catch (sigError) {
        setError('Error uploading signature. Please try again.');
        setSubmitting(false);
        return;
      }

      // Get document URLs from documentFiles or existing contract
      const documentFrontUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_document_url
        : documentFiles?.documentFront?.url || '';
      const selfieUrl = hasExistingContract && existingContractData
        ? existingContractData.contract_selfie_url
        : documentFiles?.selfie?.url || '';

      // Create order first (before calling Parcelow API)
      const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const { data: order, error: orderError } = await supabase
        .from('visa_orders')
        .insert({
          order_number: orderNumber,
          product_slug: productSlug,
          seller_id: sellerId || null,
          service_request_id: serviceRequestId,
          base_price_usd: parseFloat(product!.base_price_usd),
          price_per_dependent_usd: parseFloat(product!.price_per_dependent_usd),
          number_of_dependents: extraUnits,
          extra_units: extraUnits,
          dependent_names: extraUnits > 0 ? dependentNames : null,
          extra_unit_label: product!.extra_unit_label,
          extra_unit_price_usd: parseFloat(product!.extra_unit_price),
          calculation_type: product!.calculation_type,
          total_price_usd: totalWithFees,
          client_name: clientName,
          client_email: clientEmail,
          client_whatsapp: clientWhatsApp || null,
          client_country: clientCountry || null,
          client_nationality: clientNationality || null,
          client_observations: clientObservations || null,
          payment_method: 'parcelow',
          payment_status: 'pending',
          contract_document_url: documentFrontUrl,
          contract_selfie_url: selfieUrl,
          signature_image_url: signatureImageUrl,
          contract_accepted: true,
          contract_signed_at: new Date().toISOString(),
          ip_address: clientIP,
          payment_metadata: {
            base_amount: parseFloat(product!.base_price_usd).toFixed(2),
            final_amount: totalWithFees.toFixed(2),
            extra_units: extraUnits,
            calculation_type: product!.calculation_type,
            ip_address: clientIP,
          },
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Call Parcelow checkout Edge Function
      const { data: parcelowCheckout, error: parcelowError } = await supabase.functions.invoke(
        'create-parcelow-checkout',
        {
          body: {
            order_id: order.id,
            currency: 'USD', // Can be made dynamic later (USD or BRL)
          },
        }
      );

      if (parcelowError || !parcelowCheckout?.success) {
        console.error('[Parcelow] Error creating checkout:', parcelowError || parcelowCheckout);
        throw new Error(parcelowError?.message || 'Failed to create Parcelow checkout');
      }

      // Redirect to Parcelow checkout page
      if (parcelowCheckout.checkout_url) {
        window.location.href = parcelowCheckout.checkout_url;
      } else {
        throw new Error('Checkout URL not provided by Parcelow');
      }
    } catch (err) {
      console.error('[Parcelow] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process Parcelow payment. Please try again.');
      setSubmitting(false);
    }
  };

  // Show loading only when product is loading initially
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Only show error page if product is not found (critical error)
  // Other errors should be shown inline in the component
  if (!product) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-300 mb-4">{error || 'Product not found'}</p>
            <Link to="/">
              <Button variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-3 sm:mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm sm:text-base">Back to Home</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Visa Application Checkout</h1>
          {sellerId && (
            <p className="text-xs sm:text-sm text-gray-400 mt-2">Seller ID: {sellerId}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <span className="text-xs sm:text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-xs sm:text-sm text-gold-light text-right">
              {currentStep === 1 && 'Personal Information'}
              {currentStep === 2 && 'Documents & Selfie'}
              {currentStep === 3 && 'Terms & Payment'}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-500 flex-wrap gap-1">
            <span className="hidden sm:inline">1/3 Personal Information</span>
            <span className="sm:hidden">1/3 Info</span>
            <span className="hidden sm:inline">2/3 Documents</span>
            <span className="sm:hidden">2/3 Docs</span>
            <span className="hidden sm:inline">3/3 Terms & Payment</span>
            <span className="sm:hidden">3/3 Payment</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Summary - Always visible */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg sm:text-xl font-bold text-gold-light">{product.name}</h3>
                <p className="text-sm sm:text-base text-gray-300 mt-2">{product.description}</p>
                {product.calculation_type === 'base_plus_units' && (
                  <>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-sm sm:text-base text-gray-400">Base Price:</span>
                      <span className="text-xl sm:text-2xl font-bold text-gold-light">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                    </div>
                    {product.allow_extra_units && (
                      <div className="mt-2 flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-gray-400">Per {product.extra_unit_label.toLowerCase().replace('number of ', '')}:</span>
                        <span className="text-gold-light">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {product.calculation_type === 'units_only' && product.allow_extra_units && (
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm sm:text-base text-gray-400">Price per unit:</span>
                    <span className="text-xl sm:text-2xl font-bold text-gold-light">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* STEP 1: Personal Information */}
            {currentStep === 1 && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white text-lg sm:text-xl">Step 1: Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Extra Units (Dependents) */}
                  {product.allow_extra_units && (
                    <div className="space-y-2">
                      <Label htmlFor="extra-units" className="text-white text-sm sm:text-base">
                        {product.calculation_type === 'units_only' 
                          ? 'Number of applicants (required)' 
                          : product.extra_unit_label + ' (0-5)'}
                      </Label>
                      {product.calculation_type === 'units_only' && (
                        <p className="text-xs sm:text-sm text-gray-400 mt-1">
                          Note: You count as 1 applicant. If you select 2 applicants, you will need to provide 1 additional applicant name below.
                        </p>
                      )}
                      <div className="relative">
                      <Select
                        value={extraUnits.toString()}
                        onValueChange={(value) => {
                          const newExtraUnits = parseInt(value);
                          setExtraUnits(newExtraUnits);
                          // Ajustar array de nomes quando quantidade muda
                            const isUnitsOnly = product.calculation_type === 'units_only';
                            // For units_only: we need (extraUnits - 1) inputs (client is the first)
                            // For base_plus_units: we need extraUnits inputs (dependents only)
                            const requiredNamesCount = isUnitsOnly 
                              ? (newExtraUnits > 0 ? newExtraUnits - 1 : 0)
                              : newExtraUnits;
                            
                            if (requiredNamesCount === 0) {
                            setDependentNames([]);
                            } else if (requiredNamesCount < dependentNames.length) {
                            // Diminuir: remover nomes excedentes
                              setDependentNames(dependentNames.slice(0, requiredNamesCount));
                            } else if (requiredNamesCount > dependentNames.length) {
                            // Aumentar: adicionar slots vazios
                            const newNames = [...dependentNames];
                              while (newNames.length < requiredNamesCount) {
                                newNames.push('');
                              }
                              setDependentNames(newNames);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-white text-black min-h-[44px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(product.calculation_type === 'units_only' 
                              ? [1, 2, 3, 4, 5] // units_only: mínimo 1 unidade
                              : [0, 1, 2, 3, 4, 5] // base_plus_units: pode ser 0
                            ).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Overlay para garantir que "0" seja sempre exibido */}
                        {extraUnits === 0 && (
                          <span 
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none select-none"
                            style={{ 
                              lineHeight: '1.5rem',
                              fontSize: '0.875rem',
                              zIndex: 1
                            }}
                          >
                            0
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dependent/Applicant Names - Dynamic inputs */}
                  {extraUnits > 0 && (() => {
                    // For units_only products: extraUnits = total applicants, so we need (extraUnits - 1) inputs
                    // (the first applicant is the client themselves)
                    // For base_plus_units products: extraUnits = number of dependents, so we need extraUnits inputs
                    const isUnitsOnly = product.calculation_type === 'units_only';
                    const numberOfInputs = isUnitsOnly ? extraUnits - 1 : extraUnits;
                    const labelPrefix = isUnitsOnly ? 'Applicant Name' : 'Dependent Name';
                    
                    if (numberOfInputs <= 0) return null;
                    
                    return (
                    <div className="space-y-2">
                        {Array.from({ length: numberOfInputs }, (_, i) => (
                          <div key={i} className="space-y-2">
                            <Label htmlFor={`dependent-name-${i}`} className="text-white text-sm sm:text-base">
                              {labelPrefix} {i + 1} *
                            </Label>
                            <Input
                              id={`dependent-name-${i}`}
                              value={dependentNames[i] || ''}
                              onChange={(e) => {
                                const newNames = [...dependentNames];
                                newNames[i] = e.target.value;
                                setDependentNames(newNames);
                              }}
                              className="bg-white text-black min-h-[44px]"
                              required
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white text-sm sm:text-base">Full Name *</Label>
                    <Input
                      id="name"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (fieldErrors.clientName) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.clientName;
                            return newErrors;
                          });
                        }
                      }}
                      className={`bg-white text-black min-h-[44px] ${fieldErrors.clientName ? 'border-2 border-red-500' : ''}`}
                      required
                    />
                    {fieldErrors.clientName && (
                      <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.clientName}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white text-sm sm:text-base">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => {
                        // Remove spaces automatically
                        const value = e.target.value.replace(/\s/g, '');
                        setClientEmail(value);
                        if (fieldErrors.clientEmail) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.clientEmail;
                            return newErrors;
                          });
                        }
                      }}
                      className={`bg-white text-black min-h-[44px] ${fieldErrors.clientEmail ? 'border-2 border-red-500' : ''}`}
                      required
                    />
                    {fieldErrors.clientEmail && (
                      <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.clientEmail}</p>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label htmlFor="date-of-birth" className="text-white text-sm sm:text-base">Date of Birth *</Label>
                    <Input
                      id="date-of-birth"
                      type="date"
                      min="1900-01-01"
                      value={dateOfBirth}
                      onChange={(e) => {
                        setDateOfBirth(e.target.value);
                        if (fieldErrors.dateOfBirth) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.dateOfBirth;
                            return newErrors;
                          });
                        }
                      }}
                      className={`bg-white text-black min-h-[44px] ${fieldErrors.dateOfBirth ? 'border-2 border-red-500' : ''}`}
                      required
                    />
                    {fieldErrors.dateOfBirth && (
                      <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.dateOfBirth}</p>
                    )}
                  </div>

                  {/* Document Type and Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="document-type" className="text-white text-sm sm:text-base">Document Type *</Label>
                      <Select value={documentType} onValueChange={(value: any) => {
                        setDocumentType(value);
                        if (fieldErrors.documentType) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.documentType;
                            return newErrors;
                          });
                        }
                      }}>
                        <SelectTrigger 
                          id="document-type"
                          className={`bg-white text-black min-h-[44px] ${fieldErrors.documentType ? 'border-2 border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="id">ID</SelectItem>
                          <SelectItem value="driver_license">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldErrors.documentType && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.documentType}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document-number" className="text-white text-sm sm:text-base">Document Number *</Label>
                      <Input
                        id="document-number"
                        value={documentNumber}
                        onChange={(e) => {
                          setDocumentNumber(e.target.value);
                          if (fieldErrors.documentNumber) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.documentNumber;
                              return newErrors;
                            });
                          }
                        }}
                        className={`bg-white text-black min-h-[44px] ${fieldErrors.documentNumber ? 'border-2 border-red-500' : ''}`}
                        required
                      />
                      {fieldErrors.documentNumber && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.documentNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address-line" className="text-white text-sm sm:text-base">Address Line *</Label>
                    <Input
                      id="address-line"
                      value={addressLine}
                      onChange={(e) => {
                        setAddressLine(e.target.value);
                        if (fieldErrors.addressLine) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.addressLine;
                            return newErrors;
                          });
                        }
                      }}
                      className={`bg-white text-black min-h-[44px] ${fieldErrors.addressLine ? 'border-2 border-red-500' : ''}`}
                      required
                    />
                    {fieldErrors.addressLine && (
                      <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.addressLine}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-white text-sm sm:text-base">City *</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => {
                          // Only allow letters, spaces, hyphens, and apostrophes
                          const value = e.target.value.replace(/[^a-zA-Z\s\-']/g, '');
                          setCity(value);
                          if (fieldErrors.city) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.city;
                              return newErrors;
                            });
                          }
                        }}
                        className={`bg-white text-black min-h-[44px] ${fieldErrors.city ? 'border-2 border-red-500' : ''}`}
                        required
                      />
                      {fieldErrors.city && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-white text-sm sm:text-base">State *</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => {
                          // Only allow letters, spaces, hyphens, and apostrophes
                          const value = e.target.value.replace(/[^a-zA-Z\s\-']/g, '');
                          setState(value);
                          if (fieldErrors.state) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.state;
                              return newErrors;
                            });
                          }
                        }}
                        className={`bg-white text-black min-h-[44px] ${fieldErrors.state ? 'border-2 border-red-500' : ''}`}
                        required
                      />
                      {fieldErrors.state && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.state}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal-code" className="text-white text-sm sm:text-base">Postal Code *</Label>
                      <Input
                        id="postal-code"
                        value={postalCode}
                        onChange={(e) => {
                          setPostalCode(e.target.value);
                          if (fieldErrors.postalCode) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.postalCode;
                              return newErrors;
                            });
                          }
                        }}
                        className={`bg-white text-black min-h-[44px] ${fieldErrors.postalCode ? 'border-2 border-red-500' : ''}`}
                        required
                      />
                      {fieldErrors.postalCode && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.postalCode}</p>
                      )}
                    </div>
                  </div>

                  {/* Country and Nationality */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-white text-sm sm:text-base">Country of Residence *</Label>
                      <Select
                        value={clientCountry}
                        onValueChange={(value) => {
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
                          if (fieldErrors.clientCountry) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.clientCountry;
                              return newErrors;
                            });
                          }
                        }}
                      >
                        <SelectTrigger 
                          id="country"
                          className={`bg-white text-black min-h-[44px] ${fieldErrors.clientCountry ? 'border-2 border-red-500' : ''}`}
                        >
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
                      {fieldErrors.clientCountry && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.clientCountry}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality" className="text-white text-sm sm:text-base">Nationality *</Label>
                      <Select
                        value={clientNationality}
                        onValueChange={(value) => {
                          setClientNationality(value);
                          if (fieldErrors.clientNationality) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.clientNationality;
                              return newErrors;
                            });
                          }
                        }}
                      >
                        <SelectTrigger 
                          id="nationality"
                          className={`bg-white text-black min-h-[44px] ${fieldErrors.clientNationality ? 'border-2 border-red-500' : ''}`}
                        >
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
                      {fieldErrors.clientNationality && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.clientNationality}</p>
                      )}
                    </div>
                  </div>

                  {/* Phone and Marital Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-white text-sm sm:text-base">WhatsApp (with country code) *</Label>
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="+55 11 98765 4321"
                        value={clientWhatsApp}
                        onChange={(e) => {
                          setClientWhatsApp(e.target.value);
                          if (fieldErrors.clientWhatsApp) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.clientWhatsApp;
                              return newErrors;
                            });
                          }
                        }}
                        className={`bg-white text-black min-h-[44px] ${fieldErrors.clientWhatsApp ? 'border-2 border-red-500' : ''}`}
                        required
                      />
                      {fieldErrors.clientWhatsApp && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.clientWhatsApp}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marital-status" className="text-white text-sm sm:text-base">Marital Status *</Label>
                      <Select value={maritalStatus} onValueChange={(value: any) => {
                        setMaritalStatus(value);
                        if (fieldErrors.maritalStatus) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.maritalStatus;
                            return newErrors;
                          });
                        }
                      }}>
                        <SelectTrigger 
                          id="marital-status"
                          className={`bg-white text-black min-h-[44px] ${fieldErrors.maritalStatus ? 'border-2 border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldErrors.maritalStatus && (
                        <p className="text-red-400 text-xs sm:text-sm mt-1">{fieldErrors.maritalStatus}</p>
                      )}
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="space-y-2">
                    <Label htmlFor="observations" className="text-white text-sm sm:text-base">Observations (optional)</Label>
                    <Textarea
                      id="observations"
                      value={clientObservations}
                      onChange={(e) => setClientObservations(e.target.value)}
                      className="bg-white text-black min-h-[100px] text-sm sm:text-base"
                      placeholder="Any additional information you'd like to share..."
                    />
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleNext}
                      className="bg-gold-medium hover:bg-gold-light text-black w-full sm:w-auto min-h-[44px] px-4 sm:px-6 py-2 sm:py-3"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 2: Documents & Selfie */}
            {currentStep === 2 && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white text-lg sm:text-xl">Step 2: Documents & Selfie</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasExistingContract && existingContractData ? (
                    <div className="space-y-4">
                      <div className="bg-green-500/10 border border-green-500/50 text-green-300 p-3 sm:p-4 rounded-md">
                        <p className="font-semibold mb-2 text-sm sm:text-base">Reusing Previous Contract</p>
                        <p className="text-xs sm:text-sm">
                          You already have a signed contract from the Selection Process payment. We will reuse that contract for this payment.
                        </p>
                        {existingContractData.contract_signed_at && (
                          <p className="text-[10px] sm:text-xs mt-2 opacity-75">
                            Contract signed on: {new Date(existingContractData.contract_signed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between pt-4 gap-2 sm:gap-0">
                        <Button
                          variant="outline"
                          onClick={handlePrev}
                          className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto min-h-[44px]"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                        <Button
                          onClick={() => {
                            // Mark documents as uploaded using existing contract data
                            setDocumentFiles({
                              documentFront: null,
                              documentBack: null,
                              selfie: null,
                            });
                            setDocumentsUploaded(true);
                            handleNext();
                          }}
                          className="bg-gold-medium hover:bg-gold-light text-black w-full sm:w-auto min-h-[44px]"
                        >
                          Continue with Existing Contract
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div data-document-upload>
                        <DocumentUpload
                          onComplete={(files) => {
                            setDocumentFiles(files);
                            setDocumentsUploaded(true);
                            setStep2Errors({});
                          }}
                          onCancel={handlePrev}
                        />
                        {(step2Errors.documentFront || step2Errors.documentBack || step2Errors.selfie || step2Errors.documents) && (
                          <div className="mt-4 space-y-2">
                            {step2Errors.documents && (
                              <p className="text-red-400 text-xs sm:text-sm break-words">{step2Errors.documents}</p>
                            )}
                            {step2Errors.documentFront && (
                              <p className="text-red-400 text-xs sm:text-sm break-words">• Document Front: {step2Errors.documentFront}</p>
                            )}
                            {step2Errors.documentBack && (
                              <p className="text-red-400 text-xs sm:text-sm break-words">• Document Back: {step2Errors.documentBack}</p>
                            )}
                            {step2Errors.selfie && (
                              <p className="text-red-400 text-xs sm:text-sm break-words">• Selfie: {step2Errors.selfie}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {documentsUploaded && (
                        <div className="mt-4 flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                          <Button
                            variant="outline"
                            onClick={handlePrev}
                            className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto min-h-[44px]"
                          >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Back
                          </Button>
                          <Button
                            onClick={handleNext}
                            className="bg-gold-medium hover:bg-gold-light text-black w-full sm:w-auto min-h-[44px]"
                          >
                            Continue
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 3: Terms & Payment */}
            {currentStep === 3 && (
              <>
                {/* Terms & Conditions */}
                <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                  <CardHeader>
                    <CardTitle className="text-white text-lg sm:text-xl">Step 3: Terms & Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Contract Terms & Conditions */}
                    <div className="p-3 sm:p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
                      <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Terms & Conditions</h3>
                      {isAnnexRequired(productSlug) ? (
                        // Show ANNEX I for scholarship and i20-control products
                        <div 
                          className="text-xs sm:text-sm text-gray-300 space-y-2 max-h-96 overflow-y-auto prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: ANNEX_I_HTML }}
                        />
                      ) : loadingTemplate ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-gray-400 text-sm sm:text-base">Loading contract terms...</div>
                        </div>
                      ) : contractTemplate ? (
                        <div 
                          className="text-xs sm:text-sm text-gray-300 space-y-2 max-h-96 overflow-y-auto prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: contractTemplate.content }}
                        />
                      ) : (
                        <div className="text-xs sm:text-sm text-gray-400 space-y-2">
                          <p>No specific contract template found for this service.</p>
                          <p className="font-semibold text-yellow-300 mt-4">
                            By proceeding with payment, you acknowledge that chargebacks or payment disputes may result in legal action and 
                            additional fees. All transactions are final and non-refundable except as explicitly stated in our refund policy.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <Checkbox
                          id="terms-checkbox"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => {
                            setTermsAccepted(checked === true);
                            if (step3Errors.termsAccepted) {
                              setStep3Errors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.termsAccepted;
                                return newErrors;
                              });
                            }
                          }}
                          className={`min-w-[20px] min-h-[20px] ${step3Errors.termsAccepted ? 'border-2 border-red-500' : ''}`}
                        />
                        <Label htmlFor="terms-checkbox" className="text-white cursor-pointer text-sm sm:text-base break-words flex-1">
                          {isAnnexRequired(productSlug) ? (
                            <>I have read and agree to the ANNEX I – Payment Authorization & Non-Dispute Agreement above. *</>
                          ) : contractTemplate ? (
                            <>I have read and agree to the Terms & Conditions above. *</>
                          ) : (
                            <>
                              I have read and agree to the Terms & Conditions above and the{' '}
                              <Link to="/legal/visa-service-terms" target="_blank" className="text-gold-light hover:text-gold-medium underline">
                                Visa Service Terms & Conditions
                              </Link>
                              {' '}and the Payment Terms & Anti-Chargeback Policy. *
                            </>
                          )}
                        </Label>
                      </div>
                      {step3Errors.termsAccepted && (
                        <p className="text-red-400 text-xs sm:text-sm ml-6 sm:ml-8">{step3Errors.termsAccepted}</p>
                      )}

                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <Checkbox
                          id="data-auth-checkbox"
                          checked={dataAuthorization}
                          onCheckedChange={(checked) => {
                            setDataAuthorization(checked === true);
                            if (step3Errors.dataAuthorization) {
                              setStep3Errors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors.dataAuthorization;
                                return newErrors;
                              });
                            }
                          }}
                          className={`min-w-[20px] min-h-[20px] ${step3Errors.dataAuthorization ? 'border-2 border-red-500' : ''}`}
                        />
                        <Label htmlFor="data-auth-checkbox" className="text-white cursor-pointer text-xs sm:text-sm break-words flex-1">
                          I authorize the use of my data and images for anti-fraud validation and payment authorization proof. *
                        </Label>
                      </div>
                      {step3Errors.dataAuthorization && (
                        <p className="text-red-400 text-xs sm:text-sm ml-6 sm:ml-8">{step3Errors.dataAuthorization}</p>
                      )}
                    </div>

                    {/* Digital Signature - Only show after terms are accepted */}
                    {termsAccepted && (
                      <div className="space-y-4 pt-4 border-t border-gold-medium/30" data-signature-pad>
                        <div className="w-full max-w-full sm:max-w-[600px]">
                          <SignaturePadComponent
                            onSignatureChange={(dataUrl) => {
                              if (dataUrl) {
                                setSignatureImageDataUrl(dataUrl);
                                if (step3Errors.signature) {
                                  setStep3Errors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors.signature;
                                    return newErrors;
                                  });
                                }
                              } else {
                                setSignatureImageDataUrl(null);
                              }
                            }}
                            onSignatureConfirm={(dataUrl) => {
                              setSignatureImageDataUrl(dataUrl);
                              setSignatureConfirmed(true);
                              if (step3Errors.signature) {
                                setStep3Errors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.signature;
                                  return newErrors;
                                });
                              }
                            }}
                            savedSignature={signatureImageDataUrl}
                            isConfirmed={signatureConfirmed}
                            label="Digital Signature"
                            required={true}
                            width={typeof window !== 'undefined' && window.innerWidth > 640 ? 600 : Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 600, 600)}
                            height={typeof window !== 'undefined' && window.innerWidth > 640 ? 200 : 150}
                          />
                        </div>
                        {step3Errors.signature && (
                          <p className="text-red-400 text-xs sm:text-sm mt-1">{step3Errors.signature}</p>
                        )}
                      </div>
                    )}

                    {/* Payment Method Selection */}
                    <div className="space-y-4 pt-4 border-t border-gold-medium/30">
                      <Label className="text-white text-sm sm:text-base">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                        <SelectTrigger className="bg-white text-black min-h-[44px] w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">Credit/Debit Card (Stripe)</SelectItem>
                          <SelectItem value="pix">PIX (Stripe - BRL)</SelectItem>
                          <SelectItem value="zelle">Zelle</SelectItem>
                          <SelectItem value="wise">Wise (International Transfer)</SelectItem>
                          <SelectItem value="parcelow">Parcelow (Parcelamento em BRL)</SelectItem>
                        </SelectContent>
                      </Select>

                      {paymentMethod === 'zelle' && (
                        <div className="space-y-4 mt-4 p-3 sm:p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-md">
                          <div className="space-y-3">
                            <div className="bg-black/30 p-3 rounded-md border border-gold-medium/20">
                              <p className="text-xs sm:text-sm font-semibold text-yellow-200 mb-2">Zelle Payment Instructions:</p>
                              <ol className="text-xs sm:text-sm text-yellow-100 space-y-2 list-decimal list-inside">
                                <li>Transfer the total amount to our Zelle account</li>
                                <li className="font-semibold text-gold-light">Zelle Key: <span className="font-mono break-all">adm@migmainc.com</span></li>
                                <li>After completing the transfer, take a screenshot or photo of the payment confirmation</li>
                                <li>Upload the payment receipt below</li>
                              </ol>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="zelle-receipt" className="text-white text-sm sm:text-base">Upload Payment Receipt *</Label>
                              <div className={`border-2 border-dashed rounded-md p-3 sm:p-4 text-center hover:bg-white/10 transition cursor-pointer min-h-[120px] sm:min-h-[100px] flex flex-col items-center justify-center ${
                                step3Errors.zelleReceipt 
                                  ? 'border-red-500 bg-red-500/10' 
                                  : 'border-gold-medium/50'
                              }`}>
                                <input
                                  type="file"
                                  id="zelle-receipt"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setZelleReceipt(file);
                                      if (step3Errors.zelleReceipt) {
                                        setStep3Errors(prev => {
                                          const newErrors = { ...prev };
                                          delete newErrors.zelleReceipt;
                                          return newErrors;
                                        });
                                      }
                                    }
                                  }}
                                  className="hidden"
                                />
                                <label htmlFor="zelle-receipt" className="cursor-pointer w-full">
                                  <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-gold-light mx-auto mb-2" />
                                  {zelleReceipt ? (
                                    <p className="text-xs sm:text-sm text-gold-light break-words">✓ {zelleReceipt.name}</p>
                                  ) : (
                                    <p className="text-xs sm:text-sm text-white">Click to upload receipt</p>
                                  )}
                                </label>
                              </div>
                              {step3Errors.zelleReceipt && (
                                <p className="text-red-400 text-xs sm:text-sm mt-1">{step3Errors.zelleReceipt}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'wise' && (
                        <div className="space-y-4 mt-4 p-3 sm:p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
                          <div className="bg-black/30 p-3 rounded-md border border-gold-medium/20">
                            <p className="text-xs sm:text-sm font-semibold text-blue-200 mb-2">Wise Payment Instructions:</p>
                            <ol className="text-xs sm:text-sm text-blue-100 space-y-2 list-decimal list-inside">
                              <li>Click "Pay with Wise" below to proceed</li>
                              <li>You will be redirected to Wise to complete your payment</li>
                              <li>Complete the payment on the Wise platform</li>
                              <li>You will be redirected back to our site after payment</li>
                              <li>Your order will be confirmed automatically once payment is received</li>
                            </ol>
                            <p className="text-xs sm:text-sm text-blue-200 mt-3">
                              <span className="font-semibold">Note:</span> Wise offers competitive exchange rates and low fees for international transfers.
                            </p>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'parcelow' && (
                        <div className="space-y-4 mt-4 p-3 sm:p-4 bg-green-900/20 border border-green-500/30 rounded-md">
                          <div className="bg-black/30 p-3 rounded-md border border-gold-medium/20">
                            <p className="text-xs sm:text-sm font-semibold text-green-200 mb-2">Parcelow Payment Instructions:</p>
                            <ol className="text-xs sm:text-sm text-green-100 space-y-2 list-decimal list-inside">
                              <li>Click "Pay with Parcelow" below to proceed</li>
                              <li>You will be redirected to Parcelow checkout</li>
                              <li>Choose your payment method (Credit Card or PIX)</li>
                              <li>Select installment options if paying with credit card</li>
                              <li>Complete the payment on the Parcelow platform</li>
                              <li>You will be redirected back to our site after payment</li>
                              <li>Your order will be confirmed automatically once payment is received</li>
                            </ol>
                            <p className="text-xs sm:text-sm text-green-200 mt-3">
                              <span className="font-semibold">Note:</span> Parcelow allows you to pay in Brazilian Reais (BRL) with installment options for credit card payments.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={handlePrev}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto min-h-[44px]"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

          </div>

          {/* Order Summary - Only show on step 3 */}
          {currentStep === 3 && (
            <div className="lg:col-span-1">
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 lg:sticky lg:top-4">
                <CardHeader>
                  <CardTitle className="text-white text-lg sm:text-xl">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="space-y-2">
                    {product.calculation_type === 'base_plus_units' && (
                      <>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="text-gray-400">Base Price</span>
                          <span className="text-white">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                        </div>
                        {extraUnits > 0 && product.allow_extra_units && (
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400">{product.extra_unit_label} ({extraUnits})</span>
                            <span className="text-white">US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {product.calculation_type === 'units_only' && (
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-gray-400">Number of applicants ({extraUnits})</span>
                        <span className="text-white">US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-gold-medium/30 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-white font-bold text-sm sm:text-base">Total</span>
                        <span className="text-xl sm:text-2xl font-bold text-gold-light">
                          {paymentMethod === 'pix' && exchangeRate ? (
                            <>R$ {totalWithFees.toFixed(2)}</>
                          ) : (
                            <>US$ {totalWithFees.toFixed(2)}</>
                          )}
                        </span>
                      </div>
                      {paymentMethod === 'pix' && exchangeRate && (
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                          Includes processing fee
                        </p>
                      )}
                      {paymentMethod === 'card' && (
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                          Includes Stripe processing fee
                        </p>
                      )}
                      {paymentMethod === 'zelle' && (
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                          No processing fees
                        </p>
                      )}
                      {paymentMethod === 'wise' && (
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                          Wise fees included
                        </p>
                      )}
                      {paymentMethod === 'parcelow' && (
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                          Parcelow fees included
                        </p>
                      )}
                    </div>
                  </div>

                  {paymentMethod !== 'zelle' ? (
                    <div className="space-y-2">
                      {paymentMethod === 'card' && (
                        <Button
                          onClick={() => handleStripeCheckout('card')}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !signatureConfirmed || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium min-h-[48px] sm:min-h-[44px] text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-2"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with Card'}
                        </Button>
                      )}
                      {paymentMethod === 'pix' && (
                        <Button
                          onClick={() => handleStripeCheckout('pix')}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !signatureConfirmed || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium min-h-[48px] sm:min-h-[44px] text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-2"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with PIX'}
                        </Button>
                      )}
                      {paymentMethod === 'wise' && (
                        <Button
                          onClick={handleWisePayment}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !signatureConfirmed || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-500 text-white font-bold hover:from-blue-600 hover:via-blue-700 hover:to-blue-600 min-h-[48px] sm:min-h-[44px] text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-2"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with Wise'}
                        </Button>
                      )}
                      {paymentMethod === 'parcelow' && (
                        <Button
                          onClick={handleParcelowPayment}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !signatureConfirmed || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-green-500 via-green-600 to-green-500 text-white font-bold hover:from-green-600 hover:via-green-700 hover:to-green-600 min-h-[48px] sm:min-h-[44px] text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-2"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with Parcelow'}
                        </Button>
                      )}
                      {(!termsAccepted || !dataAuthorization) && (
                        <p className="text-xs sm:text-sm text-yellow-400 text-center">
                          Please accept both terms and conditions
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handleZellePayment}
                        disabled={submitting || !termsAccepted || !dataAuthorization || !signatureConfirmed || !zelleReceipt || !documentsUploaded}
                        className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium min-h-[48px] sm:min-h-[44px] text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-2"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {submitting ? 'Submitting...' : 'Submit Zelle Payment'}
                      </Button>
                      {(!termsAccepted || !dataAuthorization) && (
                        <p className="text-xs sm:text-sm text-yellow-400 text-center">
                          Please accept both terms and conditions
                        </p>
                      )}
                      {(!signatureConfirmed) && (
                        <p className="text-xs sm:text-sm text-yellow-400 text-center">
                          Please draw and confirm your digital signature
                        </p>
                      )}
                      {!zelleReceipt && (
                        <p className="text-xs sm:text-sm text-yellow-400 text-center">
                          Please upload Zelle receipt
                        </p>
                      )}
                    </>
                  )}

                  <p className="text-xs text-gray-400 text-center">
                    Secure payment processing
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Zelle Payment Processing Loading Overlay */}
      {isZelleProcessing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="loader-gold"></div>
            <p className="text-gold-light text-lg font-semibold tracking-tight">
              Processing Zelle payment...
            </p>
            <p className="text-gray-400 text-sm">
              Please wait while we validate your receipt
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

















