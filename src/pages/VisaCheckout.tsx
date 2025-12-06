import { useState, useEffect } from 'react';
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

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

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

  // Service request data (saved after step 1)
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.productSlug === productSlug) {
          // Restore form data
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
          setExtraUnits(parsed.extraUnits || 0);
          setCurrentStep(parsed.currentStep || 1);
        }
      }
    } catch (err) {
      console.warn('Failed to load draft:', err);
    }
  }, [productSlug]);

  // Save draft to localStorage
  useEffect(() => {
    try {
      const draft = {
        productSlug,
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
        extraUnits,
        currentStep,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (err) {
      console.warn('Failed to save draft:', err);
    }
  }, [productSlug, clientName, clientEmail, clientWhatsApp, clientCountry, clientNationality, dateOfBirth, documentType, documentNumber, addressLine, city, state, postalCode, maritalStatus, extraUnits, currentStep]);

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

  // Calculate total based on calculation_type
  const calculateTotal = () => {
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

  const total = calculateTotal();

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
    if (!documentFiles || !serviceRequestId) {
      setError('Missing documents or service request');
      return false;
    }

    try {
      const clientIP = await getClientIP();
      const userAgent = getUserAgent();

      // Save document front
      if (documentFiles.documentFront) {
        const { error: frontError } = await supabase
          .from('identity_files')
          .insert({
            service_request_id: serviceRequestId,
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

      // Save document back (if provided)
      if (documentFiles.documentBack) {
        const { error: backError } = await supabase
          .from('identity_files')
          .insert({
            service_request_id: serviceRequestId,
            file_type: 'document_back',
            file_path: documentFiles.documentBack.url,
            file_name: documentFiles.documentBack.file.name,
            file_size: documentFiles.documentBack.file.size,
            created_ip: clientIP,
            user_agent: userAgent,
          });

        if (backError) {
          console.error('Error saving document back:', backError);
          setError('Failed to save document');
          return false;
        }
      }

      // Save selfie
      if (documentFiles.selfie) {
        const { error: selfieError } = await supabase
          .from('identity_files')
          .insert({
            service_request_id: serviceRequestId,
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
        .eq('id', serviceRequestId);

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
        setError('Please upload at least the front of your document and a selfie');
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
          total_amount: total,
          extra_units: extraUnits,
        });
      }

      // Get client IP
      const clientIP = await getClientIP();

      // Get document URLs from documentFiles
      const documentFrontUrl = documentFiles?.documentFront?.url || '';
      const selfieUrl = documentFiles?.selfie?.url || '';

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
        // Clear draft
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        window.location.href = data.checkout_url;
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
          total_amount: total,
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
          amount: total,
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
          total_price_usd: total,
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
            final_amount: total.toFixed(2),
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

      // Clear draft
      localStorage.removeItem(DRAFT_STORAGE_KEY);

      // Redirect to success page
      window.location.href = `/checkout/success?order_id=${order.id}&method=zelle`;
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to process Zelle payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  if (error || !product) {
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
            <span>1/3 Dados pessoais</span>
            <span>2/3 Documentos</span>
            <span>3/3 Termos e Pagamento</span>
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
                        className="border-gold-medium/50 text-white hover:bg-gold-medium/20"
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
                          <p className="text-sm text-yellow-200">
                            For Zelle payments, please transfer the amount to our Zelle account and upload the payment receipt below.
                          </p>
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
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={handlePrev}
                        className="border-gold-medium/50 text-white hover:bg-gold-medium/20"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Extra Units (Dependents, RFEs, Applicants, etc) */}
            {product.allow_extra_units && (
              <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                  <CardTitle className="text-white">{product.extra_unit_label}</CardTitle>
                </CardHeader>
                <CardContent>
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
                    {product.calculation_type === 'base_plus_units' && extraUnits > 0 && (
                      <p className="text-sm text-gray-400">
                        Additional cost: US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}
                      </p>
                    )}
                    {product.calculation_type === 'units_only' && (
                      <p className="text-sm text-gray-400">
                        Total cost: US$ {(extraUnits * parseFloat(product.extra_unit_price)).toFixed(2)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                        <span className="text-2xl font-bold text-gold-light">US$ {total.toFixed(2)}</span>
                      </div>
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


