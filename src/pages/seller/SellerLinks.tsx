import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkIcon, Copy, CheckCircle, DollarSign, Users, Info, ChevronDown, ChevronUp, FileEdit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface VisaProduct {
  slug: string;
  name: string;
  description?: string;
  base_price_usd: string;
  extra_unit_price: string;
  extra_unit_label?: string;
  calculation_type?: 'base_plus_units' | 'units_only';
  allow_extra_units?: boolean;
}

interface PrefillFormData {
  productSlug: string;
  extraUnits: number;
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
}

const PRODUCTS_CACHE_KEY = 'seller_products_cache';
const PRODUCTS_CACHE_TIMESTAMP_KEY = 'seller_products_cache_timestamp';
const PRODUCTS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos (produtos mudam menos frequentemente)

function getCachedProducts(): VisaProduct[] | null {
  try {
    const cached = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
    const timestamp = sessionStorage.getItem(PRODUCTS_CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > PRODUCTS_CACHE_DURATION) {
      // Cache expirado
      sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
      sessionStorage.removeItem(PRODUCTS_CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    return JSON.parse(cached);
  } catch (err) {
    console.error('[SellerLinks] Error reading products cache:', err);
    return null;
  }
}

function setCachedProducts(products: VisaProduct[]): void {
  try {
    sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    sessionStorage.setItem(PRODUCTS_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (err) {
    console.error('[SellerLinks] Error saving products cache:', err);
  }
}

export function SellerLinks() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();

  // Tenta carregar do cache imediatamente
  const cachedProducts = getCachedProducts();
  const hasCachedProducts = !!cachedProducts && cachedProducts.length > 0;

  const [products, setProducts] = useState<VisaProduct[]>(() => {
    // Sempre inicia com cache se disponível
    if (hasCachedProducts) {
      return cachedProducts;
    }
    return [];
  });
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasCachedProducts);
  const hasLoadedRef = useRef(hasCachedProducts);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Dropdown state for service groups
  const [expandedServices, setExpandedServices] = useState<{ [key: string]: boolean }>({
    initial: true,
    cos: true,
    transfer: true,
  });

  // Prefill form state
  const [prefillFormData, setPrefillFormData] = useState<PrefillFormData>({
    productSlug: '',
    extraUnits: 0,
    clientName: '',
    clientEmail: '',
    clientWhatsApp: '',
    clientCountry: '',
    clientNationality: '',
    dateOfBirth: '',
    documentType: '',
    documentNumber: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    maritalStatus: '',
    clientObservations: '',
  });
  const [generatedPrefillLink, setGeneratedPrefillLink] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState('');
  const [prefillFormExpanded, setPrefillFormExpanded] = useState(false);

  useEffect(() => {
    // Se já temos produtos no estado e já carregou, não precisa fazer nada
    if (products.length > 0 && hasLoadedRef.current) {
      return;
    }

    // Se temos cache mas não temos produtos no estado, restaura do cache
    if (hasCachedProducts && products.length === 0) {
      setProducts(cachedProducts);
      hasLoadedRef.current = true;
      setLoading(false);
      return;
    }

    // Se já carregou mas não tem produtos, pode ser que precisa recarregar
    if (hasLoadedRef.current && products.length === 0) {
      hasLoadedRef.current = false;
    }

    // Se já está marcado como carregado, não precisa recarregar
    if (hasLoadedRef.current) {
      return;
    }

    let isMounted = true;
    let isLoading = false;

    // Timeout de segurança: força parar o loading após 10 segundos
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        // Tenta restaurar do cache se disponível
        const cached = getCachedProducts();
        if (cached && cached.length > 0) {
          setProducts(cached);
          hasLoadedRef.current = true;
        }
      }
    }, 10000);

    const loadProducts = async () => {
      // Prevenir múltiplas chamadas simultâneas
      if (isLoading || hasLoadedRef.current) {
        return;
      }

      isLoading = true;

      try {
        setLoading(true);
        
        const { data: productsData, error } = await supabase
          .from('visa_products')
          .select('slug, name, description, base_price_usd, extra_unit_price, extra_unit_label, calculation_type, allow_extra_units')
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('[SellerLinks] Error loading products:', error);
        }

        // SEMPRE salva no cache, mesmo se desmontado
        if (productsData && productsData.length > 0) {
          setCachedProducts(productsData);
        }

        // Só atualiza o estado se ainda estiver montado
        if (isMounted) {
          if (productsData && productsData.length > 0) {
            setProducts(productsData);
            hasLoadedRef.current = true;
          }
          setLoading(false);
        } else {
          // Mesmo desmontado, marca como carregado para próxima montagem
          hasLoadedRef.current = true;
        }
      } catch (err) {
        console.error('[SellerLinks] Error loading products:', err);
        if (isMounted) {
          setLoading(false);
        }
      } finally {
        isLoading = false;
        clearTimeout(safetyTimeout);
      }
    };

    // Carrega produtos
    loadProducts();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      // Cleanup copy timeout on unmount
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyLink = (productSlug: string) => {
    if (!seller) return;
    
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    
    const siteUrl = window.location.origin;
    const link = `${siteUrl}/checkout/visa/${productSlug}?seller=${seller.seller_id_public}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedLink(null);
      copyTimeoutRef.current = null;
    }, 3000);
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gold-medium/20"
                >
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                  <Skeleton className="h-8 w-20 ml-4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Sales Links</h1>
        <p className="text-gray-400">Generate and copy your personalized checkout links</p>
      </div>

      {/* Prefill Client Data Form */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-8">
        <CardHeader>
          <button
            onClick={() => setPrefillFormExpanded(!prefillFormExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center">
              {prefillFormExpanded ? (
                <ChevronUp className="w-5 h-5 text-gold-light mr-2" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gold-light mr-2" />
              )}
              <CardTitle className="text-white flex items-center">
                <FileEdit className="w-5 h-5 mr-2" />
                Pre-fill Client Data
              </CardTitle>
            </div>
            <p className="text-sm text-gray-400">
              {prefillFormExpanded ? 'Click to collapse' : 'Click to expand'}
            </p>
          </button>
          {!prefillFormExpanded && (
            <p className="text-sm text-gray-400 mt-2 ml-7">
              Fill in the client's information and generate a pre-filled checkout link
            </p>
          )}
        </CardHeader>
        {prefillFormExpanded && (
          <CardContent>
            <div className="space-y-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="prefill-product" className="text-white">Select Product *</Label>
              <Select
                value={prefillFormData.productSlug}
                onValueChange={(value) => setPrefillFormData({ ...prefillFormData, productSlug: value })}
              >
                <SelectTrigger className="bg-white text-black">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.slug} value={product.slug}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Extra Units */}
            <div className="space-y-2">
              <Label htmlFor="prefill-extra-units" className="text-white">Number of Dependents</Label>
              <Select
                value={prefillFormData.extraUnits.toString()}
                onValueChange={(value) => setPrefillFormData({ ...prefillFormData, extraUnits: parseInt(value) })}
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

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="prefill-name" className="text-white">Full Name *</Label>
              <Input
                id="prefill-name"
                value={prefillFormData.clientName}
                onChange={(e) => setPrefillFormData({ ...prefillFormData, clientName: e.target.value })}
                className="bg-white text-black"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="prefill-email" className="text-white">Email *</Label>
              <Input
                id="prefill-email"
                type="email"
                value={prefillFormData.clientEmail}
                onChange={(e) => setPrefillFormData({ ...prefillFormData, clientEmail: e.target.value })}
                className="bg-white text-black"
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="prefill-dob" className="text-white">Date of Birth *</Label>
              <Input
                id="prefill-dob"
                type="date"
                value={prefillFormData.dateOfBirth}
                onChange={(e) => setPrefillFormData({ ...prefillFormData, dateOfBirth: e.target.value })}
                className="bg-white text-black"
              />
            </div>

            {/* Document Type and Number */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefill-doc-type" className="text-white">Document Type *</Label>
                <Select
                  value={prefillFormData.documentType}
                  onValueChange={(value: any) => setPrefillFormData({ ...prefillFormData, documentType: value })}
                >
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
                <Label htmlFor="prefill-doc-number" className="text-white">Document Number *</Label>
                <Input
                  id="prefill-doc-number"
                  value={prefillFormData.documentNumber}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, documentNumber: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="prefill-address" className="text-white">Address Line *</Label>
              <Input
                id="prefill-address"
                value={prefillFormData.addressLine}
                onChange={(e) => setPrefillFormData({ ...prefillFormData, addressLine: e.target.value })}
                className="bg-white text-black"
              />
            </div>

            {/* City, State, Postal Code */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefill-city" className="text-white">City *</Label>
                <Input
                  id="prefill-city"
                  value={prefillFormData.city}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, city: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefill-state" className="text-white">State *</Label>
                <Input
                  id="prefill-state"
                  value={prefillFormData.state}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, state: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefill-postal" className="text-white">Postal Code *</Label>
                <Input
                  id="prefill-postal"
                  value={prefillFormData.postalCode}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, postalCode: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
            </div>

            {/* Country and Nationality */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefill-country" className="text-white">Country of Residence *</Label>
                <Input
                  id="prefill-country"
                  value={prefillFormData.clientCountry}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, clientCountry: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefill-nationality" className="text-white">Nationality *</Label>
                <Input
                  id="prefill-nationality"
                  value={prefillFormData.clientNationality}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, clientNationality: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
            </div>

            {/* WhatsApp and Marital Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefill-whatsapp" className="text-white">WhatsApp (with country code) *</Label>
                <Input
                  id="prefill-whatsapp"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={prefillFormData.clientWhatsApp}
                  onChange={(e) => setPrefillFormData({ ...prefillFormData, clientWhatsApp: e.target.value })}
                  className="bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefill-marital" className="text-white">Marital Status *</Label>
                <Select
                  value={prefillFormData.maritalStatus}
                  onValueChange={(value: any) => setPrefillFormData({ ...prefillFormData, maritalStatus: value })}
                >
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
              <Label htmlFor="prefill-observations" className="text-white">Observations (optional)</Label>
              <Textarea
                id="prefill-observations"
                value={prefillFormData.clientObservations}
                onChange={(e) => setPrefillFormData({ ...prefillFormData, clientObservations: e.target.value })}
                className="bg-white text-black min-h-[100px]"
                placeholder="Any additional information..."
              />
            </div>

            {/* Error Message */}
            {prefillError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-md">
                {prefillError}
              </div>
            )}

            {/* Generated Link */}
            {generatedPrefillLink && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-300 p-4 rounded-md">
                <p className="font-semibold mb-2">Link Generated Successfully!</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedPrefillLink}
                    readOnly
                    className="bg-white text-black flex-1"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPrefillLink);
                      setCopiedLink(generatedPrefillLink);
                      copyTimeoutRef.current = setTimeout(() => {
                        setCopiedLink(null);
                        copyTimeoutRef.current = null;
                      }, 3000);
                    }}
                    className="bg-gold-medium hover:bg-gold-light text-black"
                  >
                    {copiedLink === generatedPrefillLink ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Generate Link Button */}
            <Button
              onClick={async () => {
                // Validate required fields
                if (!prefillFormData.productSlug) {
                  setPrefillError('Please select a product');
                  return;
                }
                if (!prefillFormData.clientName || !prefillFormData.clientEmail) {
                  setPrefillError('Please fill in at least client name and email');
                  return;
                }

                setPrefillError('');
                
                // Generate token and create prefill record
                try {
                  const token = crypto.randomUUID();
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

                  const { error: insertError } = await supabase
                    .from('checkout_prefill_tokens')
                    .insert({
                      token,
                      seller_id: seller.seller_id_public,
                      product_slug: prefillFormData.productSlug,
                      client_data: {
                        clientName: prefillFormData.clientName,
                        clientEmail: prefillFormData.clientEmail,
                        clientWhatsApp: prefillFormData.clientWhatsApp,
                        clientCountry: prefillFormData.clientCountry,
                        clientNationality: prefillFormData.clientNationality,
                        dateOfBirth: prefillFormData.dateOfBirth,
                        documentType: prefillFormData.documentType,
                        documentNumber: prefillFormData.documentNumber,
                        addressLine: prefillFormData.addressLine,
                        city: prefillFormData.city,
                        state: prefillFormData.state,
                        postalCode: prefillFormData.postalCode,
                        maritalStatus: prefillFormData.maritalStatus,
                        clientObservations: prefillFormData.clientObservations,
                        extraUnits: prefillFormData.extraUnits,
                      },
                      expires_at: expiresAt.toISOString(),
                    });

                  if (insertError) {
                    throw insertError;
                  }

                  // Generate link
                  const siteUrl = window.location.origin;
                  const link = `${siteUrl}/checkout/visa/${prefillFormData.productSlug}?seller=${seller.seller_id_public}&prefill=${token}`;
                  setGeneratedPrefillLink(link);
                } catch (err: any) {
                  console.error('Error generating prefill link:', err);
                  setPrefillError(err.message || 'Failed to generate link. Please try again.');
                }
              }}
              className="w-full bg-gold-medium hover:bg-gold-light text-black"
            >
              Generate Link for Client
            </Button>
          </div>
        </CardContent>
        )}
      </Card>

      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <LinkIcon className="w-5 h-5 mr-2" />
            Generate Your Sales Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No active products available</p>
            ) : (
              (() => {
                // Group products by service type
                const serviceGroups: { [key: string]: { name: string; products: VisaProduct[] } } = {
                  initial: { name: 'INITIAL Application', products: [] },
                  cos: { name: 'Change of Status (COS)', products: [] },
                  transfer: { name: 'TRANSFER', products: [] },
                  other: { name: 'Other Services', products: [] },
                };

                products.forEach((product) => {
                  if (product.slug.startsWith('initial-')) {
                    serviceGroups.initial.products.push(product);
                  } else if (product.slug.startsWith('cos-')) {
                    serviceGroups.cos.products.push(product);
                  } else if (product.slug.startsWith('transfer-')) {
                    serviceGroups.transfer.products.push(product);
                  } else {
                    serviceGroups.other.products.push(product);
                  }
                });

                // Sort products within each group
                const sortProducts = (products: VisaProduct[]) => {
                  const order = ['selection-process', 'scholarship', 'i20-control'];
                  return products.sort((a, b) => {
                    const aIndex = order.findIndex(o => a.slug.includes(o));
                    const bIndex = order.findIndex(o => b.slug.includes(o));
                    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                  });
                };

                const paymentLabels = ['Selection Process', 'Scholarship', 'I-20 Control'];

                return Object.entries(serviceGroups).map(([key, group]) => {
                  if (group.products.length === 0) return null;

                  const sortedProducts = sortProducts(group.products);
                  const isServiceGroup = ['initial', 'cos', 'transfer'].includes(key);
                  const isExpanded = expandedServices[key] ?? false;

                  // For INITIAL, COS, TRANSFER - use dropdown
                  if (isServiceGroup) {
                    return (
                      <div key={key} className="border border-gold-medium/30 rounded-lg overflow-hidden">
                        {/* Dropdown Header */}
                        <button
                          onClick={() => setExpandedServices({ ...expandedServices, [key]: !isExpanded })}
                          className="w-full flex items-center justify-between p-5 bg-black/50 hover:bg-black/70 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gold-light" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gold-light" />
                            )}
                            <div className="text-left">
                              <h3 className="text-lg font-bold text-gold-light">{group.name}</h3>
                              <p className="text-xs text-gray-400 mt-1">
                                {sortedProducts.length} sequential payments
                              </p>
                            </div>
                          </div>
                        </button>

                        {/* Dropdown Content */}
                        {isExpanded && (
                          <div className="border-t border-gold-medium/20 bg-black/30 p-4 space-y-3">
                            {sortedProducts.map((product, index) => {
                              const link = `${window.location.origin}/checkout/visa/${product.slug}?seller=${seller.seller_id_public}`;
                              const isCopied = copiedLink === link;
                              const paymentNumber = index + 1;
                              const paymentLabel = paymentLabels[index] || `Payment ${paymentNumber}`;
                              const basePrice = parseFloat(product.base_price_usd || '0');
                              const extraPrice = parseFloat(product.extra_unit_price || '0');
                              const hasExtraUnits = product.allow_extra_units && extraPrice > 0;

                              return (
                                <div
                                  key={product.slug}
                                  className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:border-gold-medium/40 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                      {/* Payment Label with Number */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gold-light bg-gold-medium/20 px-2 py-1 rounded">
                                          {paymentNumber}/{sortedProducts.length}
                                        </span>
                                        <h4 className="text-white font-semibold">{paymentLabel}</h4>
                                      </div>

                                      {/* Price Info */}
                                      <div className="flex flex-wrap gap-4 items-center">
                                        {basePrice > 0 && (
                                          <div className="flex items-center gap-2 text-gold-light">
                                            <DollarSign className="w-4 h-4" />
                                            <span className="text-sm font-medium">
                                              Base: <span className="text-white">${basePrice.toFixed(2)}</span>
                                            </span>
                                          </div>
                                        )}
                                        
                                        {hasExtraUnits && (
                                          <div className="flex items-center gap-2 text-gold-light">
                                            <Users className="w-4 h-4" />
                                            <span className="text-sm font-medium">
                                              Per dependent: <span className="text-white">${extraPrice.toFixed(2)}</span>
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Link */}
                                      <div className="pt-2 border-t border-gold-medium/10">
                                        <p className="text-xs text-gray-500 font-mono break-all">{link}</p>
                                      </div>
                                    </div>

                                    {/* Botão Copy */}
                                    <Button
                                      onClick={() => copyLink(product.slug)}
                                      size="sm"
                                      variant="outline"
                                      className={`shrink-0 ${
                                        isCopied
                                          ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                                          : 'bg-black/50 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium'
                                      }`}
                                    >
                                      {isCopied ? (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          Copied!
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-4 h-4 mr-1" />
                                          Copy
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // For other products - show normally
                  return (
                    <div key={key} className="space-y-3">
                      {sortedProducts.map((product) => {
                        const link = `${window.location.origin}/checkout/visa/${product.slug}?seller=${seller.seller_id_public}`;
                        const isCopied = copiedLink === link;
                        const basePrice = parseFloat(product.base_price_usd || '0');
                        const extraPrice = parseFloat(product.extra_unit_price || '0');
                        const hasExtraUnits = extraPrice > 0;
                        const isUnitsOnly = product.calculation_type === 'units_only';

                        return (
                          <div
                            key={product.slug}
                            className="p-5 bg-black/50 rounded-lg border border-gold-medium/20 hover:border-gold-medium/40 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-3">
                                {/* Nome do Produto */}
                                <div>
                                  <h3 className="text-white font-semibold text-lg mb-1">{product.name}</h3>
                                  {product.description && (
                                    <p className="text-sm text-gray-400 line-clamp-2">{product.description}</p>
                                  )}
                                </div>

                                {/* Informações de Preço */}
                                <div className="flex flex-wrap gap-4 items-center">
                                  {!isUnitsOnly && basePrice > 0 && (
                                    <div className="flex items-center gap-2 text-gold-light">
                                      <DollarSign className="w-4 h-4" />
                                      <span className="text-sm font-medium">
                                        Base: <span className="text-white">${basePrice.toFixed(2)}</span>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {hasExtraUnits && (
                                    <div className="flex items-center gap-2 text-gold-light">
                                      <Users className="w-4 h-4" />
                                      <span className="text-sm font-medium">
                                        {product.extra_unit_label || 'Per Unit'}: <span className="text-white">${extraPrice.toFixed(2)}</span>
                                      </span>
                                    </div>
                                  )}

                                  {isUnitsOnly && (
                                    <div className="flex items-center gap-2 text-gold-light">
                                      <Info className="w-4 h-4" />
                                      <span className="text-sm font-medium">
                                        Price per unit: <span className="text-white">${extraPrice.toFixed(2)}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Link */}
                                <div className="pt-2 border-t border-gold-medium/10">
                                  <p className="text-xs text-gray-500 font-mono break-all">{link}</p>
                                </div>
                              </div>

                              {/* Botão Copy */}
                              <Button
                                onClick={() => copyLink(product.slug)}
                                size="sm"
                                variant="outline"
                                className={`shrink-0 ${
                                  isCopied
                                    ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                                    : 'bg-black/50 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


