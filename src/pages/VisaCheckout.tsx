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
import { trackLinkClick, trackFormStarted, trackFormCompleted, trackPaymentStarted } from '@/lib/funnel-tracking';

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

// Terms version constant
const TERMS_VERSION = 'v1.0-2025-01-15';

// localStorage key for draft
const DRAFT_STORAGE_KEY = 'visa_checkout_draft';

export const VisaCheckout = () => {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get('seller') || '';

  const [product, setProduct] = useState<VisaProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | 'zelle'>('card');
  const [zelleReceipt, setZelleReceipt] = useState<File | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // Service request data (saved after step 1)
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
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
        setExtraUnits(parsed.extraUnits || 0);
        
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
        // Step 3: Terms & Payment (text/select only, no files)
        termsAccepted,
        dataAuthorization,
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
    // Step 3 fields (text/select only)
    termsAccepted,
    dataAuthorization,
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

  // Stripe fee constants (matching backend)
  const CARD_FEE_PERCENTAGE = 0.039; // 3.9%
  const CARD_FEE_FIXED = 0.30; // $0.30
  const PIX_FEE_PERCENTAGE = 0.0179; // 1.79% (1.19% processing + 0.6% conversion)

  // Calculate base total (before fees) based on calculation_type
  const calculateBaseTotal = () => {
    if (!product) return 0;
    
    const basePrice = parseFloat(product.base_price_usd);
    const extraUnitPrice = parseFloat(product.extra_unit_price);
    
    if (product.calculation_type === 'units_only') {
      // For units_only: total = extra_units * extra_unit_price
      return extraUnits * extraUnitPrice;
    } else {
      // For base_plus_units: total = base_price + (extra_units * extra_unit_price)
      return basePrice + (extraUnits * extraUnitPrice);
    }
  };

  const baseTotal = calculateBaseTotal();

  // Calculate total with fees based on payment method
  const calculateTotalWithFees = () => {
    if (paymentMethod === 'zelle') {
      // Zelle: no fees
      return baseTotal;
    } else if (paymentMethod === 'card') {
      // Card: 3.9% + $0.30
      return baseTotal + (baseTotal * CARD_FEE_PERCENTAGE) + CARD_FEE_FIXED;
    } else if (paymentMethod === 'pix') {
      // PIX: 1.79% fee (already includes conversion)
      if (!exchangeRate) return baseTotal; // Fallback if rate not loaded
      const netAmountBRL = baseTotal * exchangeRate;
      const grossAmountBRL = netAmountBRL / (1 - PIX_FEE_PERCENTAGE);
      return grossAmountBRL;
    }
    return baseTotal;
  };

  const totalWithFees = calculateTotalWithFees();

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

  // Get client IP and user agent
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

  const getUserAgent = (): string => {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  };

  // Validate Step 1
  const validateStep1 = (): boolean => {
    if (!clientName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setError('Valid email is required');
      return false;
    }
    if (!dateOfBirth) {
      setError('Date of birth is required');
      return false;
    }
    if (!documentType) {
      setError('Document type is required');
      return false;
    }
    if (!documentNumber.trim() || documentNumber.length < 5) {
      setError('Document number is required (minimum 5 characters)');
      return false;
    }
    if (!addressLine.trim()) {
      setError('Address is required');
      return false;
    }
    if (!city.trim()) {
      setError('City is required');
      return false;
    }
    if (!state.trim()) {
      setError('State is required');
      return false;
    }
    if (!postalCode.trim()) {
      setError('Postal code is required');
      return false;
    }
    if (!clientCountry.trim()) {
      setError('Country is required');
      return false;
    }
    if (!clientNationality.trim()) {
      setError('Nationality is required');
      return false;
    }
    if (!clientWhatsApp.trim() || !clientWhatsApp.startsWith('+')) {
      setError('WhatsApp with country code (e.g., +1) is required');
      return false;
    }
    if (!maritalStatus) {
      setError('Marital status is required');
      return false;
    }
    return true;
  };

  // Save Step 1 data to database
  const saveStep1 = async (): Promise<boolean> => {
    try {
      // Create or update client
      let clientIdToUse = clientId;
      if (!clientIdToUse) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .insert({
            full_name: clientName,
            email: clientEmail,
            phone: clientWhatsApp,
            date_of_birth: dateOfBirth,
            nationality: clientNationality,
            document_type: documentType,
            document_number: documentNumber,
            address_line: addressLine,
            city: city,
            state: state,
            postal_code: postalCode,
            country: clientCountry,
            marital_status: maritalStatus,
          })
          .select()
          .single();

        if (clientError) {
          console.error('Error creating client:', clientError);
          setError('Failed to save client information');
          return false;
        }

        clientIdToUse = clientData.id;
        setClientId(clientIdToUse);
      } else {
        // Update existing client
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            full_name: clientName,
            email: clientEmail,
            phone: clientWhatsApp,
            date_of_birth: dateOfBirth,
            nationality: clientNationality,
            document_type: documentType,
            document_number: documentNumber,
            address_line: addressLine,
            city: city,
            state: state,
            postal_code: postalCode,
            country: clientCountry,
            marital_status: maritalStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientIdToUse);

        if (updateError) {
          console.error('Error updating client:', updateError);
          setError('Failed to update client information');
          return false;
        }
      }

      // Create or update service request
      let serviceRequestIdToUse = serviceRequestId;
      if (!serviceRequestIdToUse) {
        const { data: serviceRequestData, error: serviceRequestError } = await supabase
          .from('service_requests')
          .insert({
            client_id: clientIdToUse,
            service_id: productSlug!,
            dependents_count: extraUnits,
            seller_id: sellerId || null,
            status: 'onboarding',
          })
          .select()
          .single();

        if (serviceRequestError) {
          console.error('Error creating service request:', serviceRequestError);
          setError('Failed to create service request');
          return false;
        }

        serviceRequestIdToUse = serviceRequestData.id;
        setServiceRequestId(serviceRequestIdToUse);
        
        // Save serviceRequestId to localStorage for restoration
        try {
          const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (draft) {
            const parsed = JSON.parse(draft);
            parsed.serviceRequestId = serviceRequestIdToUse;
            parsed.clientId = clientIdToUse;
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (err) {
          console.warn('Failed to save serviceRequestId to draft:', err);
        }
      } else {
        // Update existing service request
        const { error: updateError } = await supabase
          .from('service_requests')
          .update({
            dependents_count: extraUnits,
            updated_at: new Date().toISOString(),
          })
          .eq('id', serviceRequestIdToUse);

        if (updateError) {
          console.error('Error updating service request:', updateError);
          setError('Failed to update service request');
          return false;
        }
      }

      // Track form started
      if (sellerId && productSlug && !formStartedTracked) {
        await trackFormStarted(sellerId, productSlug);
        setFormStartedTracked(true);
      }

      return true;
    } catch (err) {
      console.error('Error saving step 1:', err);
      setError('Failed to save information. Please try again.');
      return false;
    }
  };

  // Save Step 2 documents to database
  const saveStep2 = async (): Promise<boolean> => {
    if (!documentFiles) {
      setError('Please upload all required documents (front, back, and selfie)');
      return false;
    }
    
    // Ensure all required documents are present
    if (!documentFiles.documentFront || !documentFiles.documentBack || !documentFiles.selfie) {
      setError('Please upload all required documents (front, back, and selfie)');
      return false;
    }
    
    // If serviceRequestId is missing, try to create it from Step 1 data
    // This handles cases where user returns and Step 1 data is restored but service_request wasn't created yet
    let serviceRequestIdToUse = serviceRequestId;
    if (!serviceRequestIdToUse) {
      // Check if we have client data to create service request
      if (!clientName || !clientEmail || !productSlug) {
        setError('Please complete Step 1 first');
        // Force user back to Step 1
        setCurrentStep(1);
        return false;
      }
      
      // Create service request on the fly
      try {
        // First, ensure client exists
        let clientIdToUse = clientId;
        if (!clientIdToUse) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .insert({
              full_name: clientName,
              email: clientEmail,
              whatsapp: clientWhatsApp || null,
              country_of_residence: clientCountry || null,
              nationality: clientNationality || null,
              date_of_birth: dateOfBirth || null,
              document_type: documentType || null,
              document_number: documentNumber || null,
              address_line: addressLine || null,
              city: city || null,
              state: state || null,
              postal_code: postalCode || null,
              marital_status: maritalStatus || null,
              observations: clientObservations || null,
            })
            .select()
            .single();
          
          if (clientError || !clientData) {
            console.error('Error creating client:', clientError);
            setError('Failed to create client record. Please complete Step 1 again.');
            setCurrentStep(1);
            return false;
          }
          
          clientIdToUse = clientData.id;
          setClientId(clientIdToUse);
        }
        
        // Create service request
        const { data: serviceRequestData, error: serviceRequestError } = await supabase
          .from('service_requests')
          .insert({
            client_id: clientIdToUse,
            service_id: productSlug,
            dependents_count: extraUnits,
            status: 'pending_documents',
          })
          .select()
          .single();
        
        if (serviceRequestError || !serviceRequestData) {
          console.error('Error creating service request:', serviceRequestError);
          setError('Failed to create service request. Please complete Step 1 again.');
          setCurrentStep(1);
          return false;
        }
        
        serviceRequestIdToUse = serviceRequestData.id;
        setServiceRequestId(serviceRequestIdToUse);
        
        // Save to localStorage
        try {
          const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (draft) {
            const parsed = JSON.parse(draft);
            parsed.serviceRequestId = serviceRequestIdToUse;
            parsed.clientId = clientIdToUse;
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (err) {
          console.warn('Failed to save serviceRequestId to draft:', err);
        }
      } catch (err) {
        console.error('Error creating service request on the fly:', err);
        setError('Failed to create service request. Please complete Step 1 again.');
        setCurrentStep(1);
        return false;
      }
    }

    try {
      const clientIP = await getClientIP();
      const userAgent = getUserAgent();

      // Save document front
      if (documentFiles.documentFront) {
        const { error: frontError } = await supabase
          .from('identity_files')
          .insert({
            service_request_id: serviceRequestIdToUse,
            file_type: 'document_front',
            file_path: documentFiles.documentFront.url,
            file_name: documentFiles.documentFront.file.name,
            file_size: documentFiles.documentFront.file.size,
            created_ip: clientIP,
            user_agent: userAgent,
          });

        if (frontError) {
          console.error('Error saving document front:', frontError);
          setError('Failed to save document');
          return false;
        }
      }

      // Save document back (required)
      if (!documentFiles.documentBack) {
        setError('Document back is required');
        return false;
      }
      
      const { error: backError } = await supabase
        .from('identity_files')
        .insert({
          service_request_id: serviceRequestIdToUse,
          file_type: 'document_back',
          file_path: documentFiles.documentBack.url,
          file_name: documentFiles.documentBack.file.name,
          file_size: documentFiles.documentBack.file.size,
          created_ip: clientIP,
          user_agent: userAgent,
        });

      if (backError) {
        console.error('Error saving document back:', backError);
        setError('Failed to save document back');
        return false;
      }

      // Save selfie
      if (documentFiles.selfie) {
        const { error: selfieError } = await supabase
          .from('identity_files')
          .insert({
            service_request_id: serviceRequestIdToUse,
            file_type: 'selfie_doc',
            file_path: documentFiles.selfie.url,
            file_name: documentFiles.selfie.file.name,
            file_size: documentFiles.selfie.file.size,
            created_ip: clientIP,
            user_agent: userAgent,
          });

        if (selfieError) {
          console.error('Error saving selfie:', selfieError);
          setError('Failed to save selfie');
          return false;
        }
      }

      // Update service request status
      await supabase
        .from('service_requests')
        .update({ status: 'pending_payment', updated_at: new Date().toISOString() })
        .eq('id', serviceRequestIdToUse);

      return true;
    } catch (err) {
      console.error('Error saving step 2:', err);
      setError('Failed to save documents. Please try again.');
      return false;
    }
  };

  // Save Step 3 terms acceptance
  const saveStep3 = async (): Promise<boolean> => {
    if (!serviceRequestId) {
      setError('Service request not found');
      return false;
    }

    if (!termsAccepted || !dataAuthorization) {
      setError('Please accept both terms and conditions');
      return false;
    }

    try {
      const clientIP = await getClientIP();
      const userAgent = getUserAgent();

      const { error: termsError } = await supabase
        .from('terms_acceptance')
        .insert({
          service_request_id: serviceRequestId,
          accepted: true,
          accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          accepted_ip: clientIP,
          user_agent: userAgent,
          data_authorization: true,
        });

      if (termsError) {
        console.error('Error saving terms acceptance:', termsError);
        setError('Failed to save terms acceptance');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving step 3:', err);
      setError('Failed to save terms acceptance. Please try again.');
      return false;
    }
  };

  // Handle step navigation
  const handleNext = async () => {
    setError('');

    if (currentStep === 1) {
      if (!validateStep1()) {
        return;
      }
      const saved = await saveStep1();
      if (saved) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (!documentsUploaded || !documentFiles) {
        setError('Please upload all required documents (front, back, and selfie)');
        return;
      }
      // Ensure all required documents are present
      if (!documentFiles.documentFront || !documentFiles.documentBack || !documentFiles.selfie) {
        setError('Please upload all required documents (front, back, and selfie)');
        return;
      }
      const saved = await saveStep2();
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

  // Handle Stripe checkout
  const handleStripeCheckout = async (method: 'card' | 'pix') => {
    if (!termsAccepted || !dataAuthorization) {
      alert('Please accept both terms and conditions');
      return;
    }

    if (!serviceRequestId) {
      alert('Please complete all steps first');
      return;
    }

    // Save terms acceptance
    const termsSaved = await saveStep3();
    if (!termsSaved) {
      return;
    }

    setSubmitting(true);
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: method,
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, method, {
          total_amount: totalWithFees,
          extra_units: extraUnits,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Get document URLs from documentFiles
      const documentFrontUrl = documentFiles?.documentFront?.url || '';
      const selfieUrl = documentFiles?.selfie?.url || '';

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
          termsAccepted,
          dataAuthorization,
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
          ip_address: clientIP,
          service_request_id: serviceRequestId, // Pass service request ID
        },
      });

      if (error) {
        console.error('Error creating checkout:', error);
        alert('Failed to create checkout session');
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
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Zelle payment
  const handleZellePayment = async () => {
    if (!termsAccepted || !dataAuthorization) {
      alert('Please accept both terms and conditions');
      return;
    }

    if (!serviceRequestId) {
      alert('Please complete all steps first');
      return;
    }

    if (!zelleReceipt) {
      alert('Please upload the Zelle payment receipt');
      return;
    }

    // Save terms acceptance
    const termsSaved = await saveStep3();
    if (!termsSaved) {
      return;
    }

    setSubmitting(true);
    try {
      // Track form completed
      if (sellerId && productSlug) {
        await trackFormCompleted(sellerId, productSlug, {
          extra_units: extraUnits,
          payment_method: 'zelle',
        });
      }

      // Track payment started
      if (sellerId && productSlug) {
        await trackPaymentStarted(sellerId, productSlug, 'zelle', {
          total_amount: baseTotal, // Zelle uses base total (no fees)
          extra_units: extraUnits,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Upload receipt to Supabase storage
      const fileExt = zelleReceipt.name.split('.').pop();
      const fileName = `zelle-receipts/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('visa-documents')
        .upload(fileName, zelleReceipt);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('visa-documents')
        .getPublicUrl(fileName);

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
      
      const documentFrontUrl = documentFiles?.documentFront?.url || '';
      const selfieUrl = documentFiles?.selfie?.url || '';

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
          payment_status: 'pending',
          zelle_proof_url: publicUrl,
          contract_document_url: documentFrontUrl,
          contract_selfie_url: selfieUrl,
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
          },
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Update payment with order reference
      await supabase
        .from('payments')
        .update({ external_payment_id: order.id })
        .eq('id', paymentData.id);

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
      window.location.href = `/checkout/success?order_id=${order.id}&method=zelle`;
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to process Zelle payment. Please try again.');
    } finally {
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
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold migma-gold-text">Visa Application Checkout</h1>
          {sellerId && (
            <p className="text-sm text-gray-400 mt-2">Seller ID: {sellerId}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm text-gold-light">
              {currentStep === 1 && 'Personal Information'}
              {currentStep === 2 && 'Documents & Selfie'}
              {currentStep === 3 && 'Terms & Payment'}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>1/3 Personal Information</span>
            <span>2/3 Documents</span>
            <span>3/3 Terms & Payment</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Summary - Always visible */}
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white">Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-bold text-gold-light">{product.name}</h3>
                <p className="text-gray-300 mt-2">{product.description}</p>
                {product.calculation_type === 'base_plus_units' && (
                  <>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-gray-400">Base Price:</span>
                      <span className="text-2xl font-bold text-gold-light">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                    </div>
                    {product.allow_extra_units && (
                      <div className="mt-2 flex justify-between items-center text-sm">
                        <span className="text-gray-400">Per {product.extra_unit_label.toLowerCase().replace('number of ', '')}:</span>
                        <span className="text-gold-light">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                {product.calculation_type === 'units_only' && product.allow_extra_units && (
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-gray-400">Price per unit:</span>
                    <span className="text-2xl font-bold text-gold-light">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* STEP 1: Personal Information */}
            {currentStep === 1 && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white">Step 1: Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Extra Units (Dependents) */}
                  {product.allow_extra_units && (
                    <div className="space-y-2">
                      <Label htmlFor="extra-units" className="text-white">
                        {product.extra_unit_label} {product.calculation_type === 'units_only' ? '(required)' : '(0-5)'}
                      </Label>
                      <Select
                        value={extraUnits.toString()}
                        onValueChange={(value) => setExtraUnits(parseInt(value))}
                      >
                        <SelectTrigger className="bg-white text-black">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4, 5].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Full Name *</Label>
                    <Input
                      id="name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-white text-black"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="bg-white text-black"
                      required
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label htmlFor="date-of-birth" className="text-white">Date of Birth *</Label>
                    <Input
                      id="date-of-birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="bg-white text-black"
                      required
                    />
                  </div>

                  {/* Document Type and Number */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="document-type" className="text-white">Document Type *</Label>
                      <Select value={documentType} onValueChange={(value: any) => setDocumentType(value)}>
                        <SelectTrigger className="bg-white text-black">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="id">ID</SelectItem>
                          <SelectItem value="driver_license">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document-number" className="text-white">Document Number *</Label>
                      <Input
                        id="document-number"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address-line" className="text-white">Address Line *</Label>
                    <Input
                      id="address-line"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="bg-white text-black"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-white">City *</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-white">State *</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal-code" className="text-white">Postal Code *</Label>
                      <Input
                        id="postal-code"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                  </div>

                  {/* Country and Nationality */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-white">Country of Residence *</Label>
                      <Input
                        id="country"
                        value={clientCountry}
                        onChange={(e) => setClientCountry(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality" className="text-white">Nationality *</Label>
                      <Input
                        id="nationality"
                        value={clientNationality}
                        onChange={(e) => setClientNationality(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone and Marital Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-white">WhatsApp (with country code) *</Label>
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={clientWhatsApp}
                        onChange={(e) => setClientWhatsApp(e.target.value)}
                        className="bg-white text-black"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marital-status" className="text-white">Marital Status *</Label>
                      <Select value={maritalStatus} onValueChange={(value: any) => setMaritalStatus(value)}>
                        <SelectTrigger className="bg-white text-black">
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
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="space-y-2">
                    <Label htmlFor="observations" className="text-white">Observations (optional)</Label>
                    <Textarea
                      id="observations"
                      value={clientObservations}
                      onChange={(e) => setClientObservations(e.target.value)}
                      className="bg-white text-black min-h-[100px]"
                      placeholder="Any additional information you'd like to share..."
                    />
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleNext}
                      className="bg-gold-medium hover:bg-gold-light text-black"
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
                  <CardTitle className="text-white">Step 2: Documents & Selfie</CardTitle>
                </CardHeader>
                <CardContent>
                  <DocumentUpload
                    onComplete={(files) => {
                      setDocumentFiles(files);
                      setDocumentsUploaded(true);
                    }}
                    onCancel={handlePrev}
                  />
                  {documentsUploaded && (
                    <div className="mt-4 flex justify-between">
                      <Button
                        variant="outline"
                        onClick={handlePrev}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <Button
                        onClick={handleNext}
                        className="bg-gold-medium hover:bg-gold-light text-black"
                      >
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
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
                    <CardTitle className="text-white">Step 3: Terms & Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Payment Terms & Anti-Chargeback Section */}
                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
                      <h3 className="text-white font-semibold mb-2">Payment Terms & Anti-Chargeback Policy</h3>
                      <div className="text-sm text-gray-300 space-y-2 max-h-48 overflow-y-auto">
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </p>
                        <p>
                          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
                          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                        </p>
                        <p>
                          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, 
                          eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                        </p>
                        <p className="font-semibold text-yellow-300">
                          By proceeding with payment, you acknowledge that chargebacks or payment disputes may result in legal action and 
                          additional fees. All transactions are final and non-refundable except as explicitly stated in our refund policy.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        />
                        <Label htmlFor="terms" className="text-white cursor-pointer">
                          I have read and agree to the{' '}
                          <Link to="/legal/visa-service-terms" target="_blank" className="text-gold-light hover:text-gold-medium underline">
                            Visa Service Terms & Conditions
                          </Link>
                          {' '}and the Payment Terms & Anti-Chargeback Policy above. *
                        </Label>
                      </div>

                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="data-authorization"
                          checked={dataAuthorization}
                          onCheckedChange={(checked) => setDataAuthorization(checked === true)}
                        />
                        <Label htmlFor="data-authorization" className="text-white cursor-pointer text-sm">
                          I authorize the use of my data and images for anti-fraud validation and payment authorization proof. *
                        </Label>
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div className="space-y-4 pt-4 border-t border-gold-medium/30">
                      <Label className="text-white">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                        <SelectTrigger className="bg-white text-black">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">Credit/Debit Card (Stripe)</SelectItem>
                          <SelectItem value="pix">PIX (Stripe - BRL)</SelectItem>
                          <SelectItem value="zelle">Zelle</SelectItem>
                        </SelectContent>
                      </Select>

                      {paymentMethod === 'zelle' && (
                        <div className="space-y-4 mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-md">
                          <div className="space-y-3">
                            <div className="bg-black/30 p-3 rounded-md border border-gold-medium/20">
                              <p className="text-sm font-semibold text-yellow-200 mb-2">Zelle Payment Instructions:</p>
                              <ol className="text-sm text-yellow-100 space-y-2 list-decimal list-inside">
                                <li>Transfer the total amount to our Zelle account</li>
                                <li className="font-semibold text-gold-light">Zelle Key: <span className="font-mono">adm@migmainc.com</span></li>
                                <li>After completing the transfer, take a screenshot or photo of the payment confirmation</li>
                                <li>Upload the payment receipt below</li>
                              </ol>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="zelle-receipt" className="text-white">Upload Payment Receipt *</Label>
                              <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-4 text-center hover:bg-white/10 transition cursor-pointer">
                                <input
                                  type="file"
                                  id="zelle-receipt"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setZelleReceipt(file);
                                    }
                                  }}
                                  className="hidden"
                                />
                                <label htmlFor="zelle-receipt" className="cursor-pointer">
                                  <Upload className="h-8 w-8 text-gold-light mx-auto mb-2" />
                                  {zelleReceipt ? (
                                    <p className="text-sm text-gold-light">✓ {zelleReceipt.name}</p>
                                  ) : (
                                    <p className="text-sm text-white">Click to upload receipt</p>
                                  )}
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={handlePrev}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
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
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {product.calculation_type === 'base_plus_units' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Base Price</span>
                          <span className="text-white">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                        </div>
                        {extraUnits > 0 && product.allow_extra_units && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{product.extra_unit_label} ({extraUnits})</span>
                            <span className="text-white">US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {product.calculation_type === 'units_only' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{product.extra_unit_label} ({extraUnits})</span>
                        <span className="text-white">US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-gold-medium/30 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-white font-bold">Total</span>
                        <span className="text-2xl font-bold text-gold-light">
                          {paymentMethod === 'pix' && exchangeRate ? (
                            <>R$ {totalWithFees.toFixed(2)}</>
                          ) : (
                            <>US$ {totalWithFees.toFixed(2)}</>
                          )}
                        </span>
                      </div>
                      {paymentMethod === 'pix' && exchangeRate && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          Includes processing fee
                        </p>
                      )}
                      {paymentMethod === 'card' && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          Includes Stripe processing fee
                        </p>
                      )}
                      {paymentMethod === 'zelle' && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          No processing fees
                        </p>
                      )}
                    </div>
                  </div>

                  {paymentMethod !== 'zelle' ? (
                    <div className="space-y-2">
                      {paymentMethod === 'card' && (
                        <Button
                          onClick={() => handleStripeCheckout('card')}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with Card'}
                        </Button>
                      )}
                      {paymentMethod === 'pix' && (
                        <Button
                          onClick={() => handleStripeCheckout('pix')}
                          disabled={submitting || !termsAccepted || !dataAuthorization || !documentsUploaded}
                          className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          {submitting ? 'Processing...' : 'Pay with PIX'}
                        </Button>
                      )}
                      {(!termsAccepted || !dataAuthorization) && (
                        <p className="text-xs text-yellow-400 text-center">
                          Please accept both terms and conditions
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handleZellePayment}
                        disabled={submitting || !termsAccepted || !dataAuthorization || !zelleReceipt || !documentsUploaded}
                        className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {submitting ? 'Submitting...' : 'Submit Zelle Payment'}
                      </Button>
                      {(!termsAccepted || !dataAuthorization) && (
                        <p className="text-xs text-yellow-400 text-center">
                          Please accept both terms and conditions
                        </p>
                      )}
                      {!zelleReceipt && (
                        <p className="text-xs text-yellow-400 text-center">
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
    </div>
  );
};




