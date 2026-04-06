import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkIcon, Copy, CheckCircle, DollarSign, Users, Info, ChevronDown, ChevronUp, FileEdit, ChevronLeft, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSortedCountries, getPhoneCodeFromCountry } from '@/lib/visa-checkout-constants';
import { getProductsWithContracts } from '@/lib/contract-templates';
import { generateUUID, copyToClipboard } from '@/lib/utils';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
  role?: string;
  head_of_sales_id?: string | null;
  team_id?: string | null;
  is_test?: boolean;
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
}

interface PrefillValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
  firstErrorField?: string;
}

// Lista de países ordenada alfabeticamente com "Other" por último
const countries = getSortedCountries();

const PRODUCTS_CACHE_KEY = 'seller_products_cache_v5';
const PRODUCTS_CACHE_TIMESTAMP_KEY = 'seller_products_cache_timestamp_v5';
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
  const context = useOutletContext<{ seller?: SellerInfo }>();
  const [seller, setSeller] = useState<SellerInfo | null>(context?.seller || null);
  const [isSearchingSeller, setIsSearchingSeller] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isSharedInAdmin = !context?.seller;

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
  const [productsWithContracts, setProductsWithContracts] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasCachedProducts);
  const hasLoadedRef = useRef(hasCachedProducts);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [targetSeller, setTargetSeller] = useState<SellerInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<SellerInfo[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('direct');

  // Dropdown state for service groups
  const [expandedServices, setExpandedServices] = useState<{ [key: string]: boolean }>({
    initial: false,
    cos: false,
    transfer: false,
  });

  // Prefill form state
  const [prefillFormData, setPrefillFormData] = useState<PrefillFormData>({
    productSlug: '',
    extraUnits: 0,
    dependentNames: [],
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
  const [prefillFieldErrors, setPrefillFieldErrors] = useState<Record<string, string>>({});
  const [prefillFormExpanded, setPrefillFormExpanded] = useState(false);
  const [prefillFormStep, setPrefillFormStep] = useState(1);

  // Estado para armazenar links gerados com prefill (associando contrato)
  const [productGeneratedLinks, setProductGeneratedLinks] = useState<Record<string, string>>({});

  // Scroll helper for first field with error
  function scrollToPrefillFirstError(fieldName: string) {
    const fieldIdMap: Record<string, string> = {
      productSlug: 'prefill-product',
      extraUnits: 'prefill-extra-units',
      dependentNames: 'prefill-dependent-name-0',
      clientName: 'prefill-name',
      clientEmail: 'prefill-email',
      dateOfBirth: 'prefill-dob',
      documentType: 'prefill-doc-type',
      documentNumber: 'prefill-doc-number',
      addressLine: 'prefill-address',
      city: 'prefill-city',
      state: 'prefill-state',
      postalCode: 'prefill-postal',
      clientCountry: 'prefill-country',
      clientNationality: 'prefill-nationality',
      clientWhatsApp: 'prefill-whatsapp',
      maritalStatus: 'prefill-marital',
    };

    setTimeout(() => {
      const elementId = fieldIdMap[fieldName] || fieldName;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
          (element as HTMLElement).focus();
        }
      }
    }, 100);
  }

  // Step 1 validation (basic info) - All fields are now optional
  function validatePrefillStep1(formData: PrefillFormData): PrefillValidationResult {
    const errors: Record<string, string> = {};

    // Validate email format only if provided
    const email = formData.clientEmail.trim();
    if (email) {
      if (email.includes(' ')) {
        errors.clientEmail = 'Email cannot contain spaces';
      } else if (!email.includes('@')) {
        errors.clientEmail = 'Email must contain @';
      } else {
        const emailParts = email.split('@');
        if (emailParts.length !== 2) {
          errors.clientEmail = 'Invalid email format';
        } else {
          const [localPart, domainPart] = emailParts;
          if (!localPart || localPart.length === 0) {
            errors.clientEmail = 'Email must have characters before @';
          } else if (!domainPart || domainPart.length === 0) {
            errors.clientEmail = 'Email must have characters after @';
          } else if (!domainPart.includes('.')) {
            errors.clientEmail = 'Email must have a dot after @';
          } else {
            const domainParts = domainPart.split('.');
            const lastPart = domainParts[domainParts.length - 1];
            if (!lastPart || lastPart.length === 0) {
              errors.clientEmail = 'Email must have characters after the dot';
            }
          }
        }
      }
    }

    // Validate date of birth format only if provided
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        errors.dateOfBirth = 'Invalid date of birth';
      } else {
        const year = birthDate.getFullYear();
        if (year < 1900) {
          errors.dateOfBirth = 'Date of birth year must be 1900 or later';
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const birthDateNormalized = new Date(birthDate);
          birthDateNormalized.setHours(0, 0, 0, 0);
          if (birthDateNormalized >= today) {
            errors.dateOfBirth = 'Date of birth must be in the past';
          }
        }
      }
    }

    // Validate document number format only if provided
    if (formData.documentNumber.trim() && formData.documentNumber.length < 5) {
      errors.documentNumber = 'Document number must have at least 5 characters';
    }

    // Dependent names validation - only if extraUnits > 0 and names are provided
    if (formData.extraUnits > 0) {
      if (formData.dependentNames.length !== formData.extraUnits) {
        // Only error if some names are provided but not all
        const providedNames = formData.dependentNames.filter(name => name && name.trim() !== '').length;
        if (providedNames > 0 && providedNames < formData.extraUnits) {
          errors.dependentNames = 'Please provide names for all dependents or leave all empty';
        }
      }
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      errors: valid ? undefined : errors,
      firstErrorField: valid ? undefined : Object.keys(errors)[0],
    };
  }

  // Full validation (all steps) - All fields are now optional
  function validatePrefillForm(formData: PrefillFormData): PrefillValidationResult {
    // First validate basic info (format only)
    const step1Result = validatePrefillStep1(formData);
    if (!step1Result.valid) {
      return step1Result;
    }

    const errors: Record<string, string> = {};

    // Validate city format only if provided
    const city = formData.city.trim();
    if (city) {
      const cityRegex = /^[a-zA-Z\s\-']+$/;
      if (!cityRegex.test(city)) {
        errors.city = 'City must contain only letters, spaces, hyphens, and apostrophes';
      }
    }

    // Validate state format only if provided
    const state = formData.state.trim();
    if (state) {
      const stateRegex = /^[a-zA-Z\s\-']+$/;
      if (!stateRegex.test(state)) {
        errors.state = 'State must contain only letters, spaces, hyphens, and apostrophes';
      }
    }

    // Validate WhatsApp format only if provided
    const whatsapp = formData.clientWhatsApp.trim();
    if (whatsapp && !whatsapp.startsWith('+')) {
      errors.clientWhatsApp = 'WhatsApp must start with country code (e.g., +1)';
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      errors: valid ? undefined : errors,
      firstErrorField: valid ? undefined : Object.keys(errors)[0],
    };
  }

  useEffect(() => {
    async function loadSellerInfo() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsSearchingSeller(false);
          return;
        }

        const userIsAdmin = session.user.user_metadata?.role === 'admin';
        setIsAdmin(userIsAdmin);

        let currentSeller: SellerInfo | null = seller;

        if (!currentSeller) {
          // 1. Tenta carregar o vendedor específico do usuário
          const { data: sellerData } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .single();

          if (sellerData) {
            currentSeller = sellerData as SellerInfo;
            setSeller(currentSeller);
          } else if (userIsAdmin) {
            // 2. Se não encontrou e é Admin, busca por "Migma"
            const { data: migmaSeller } = await supabase
              .from('sellers')
              .select('*')
              .ilike('full_name', '%Migma%')
              .eq('status', 'active')
              .limit(1)
              .maybeSingle();

            if (migmaSeller) {
              currentSeller = migmaSeller as SellerInfo;
              setSeller(currentSeller);
            } else {
              // Create virtual Admin seller instead of picking a random one
              currentSeller = {
                id: session.user.id,
                seller_id_public: 'MIGMA',
                full_name: 'Migma Admin',
                email: session.user.email || '',
                status: 'active',
                role: 'admin'
              } as SellerInfo;
              setSeller(currentSeller);
            }
          }
        }

        // Check for sellerId in URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const sellerIdFromUrl = urlParams.get('sellerId');
        
        // Em desenvolvimento/localhost, permitimos que Admin e HoS vejam todos os vendedores
        const shouldShowAllSellers = userIsAdmin || (!import.meta.env.PROD && currentSeller?.role === 'head_of_sales');

        if (shouldShowAllSellers) {
          // No caso de admin ou HoS em dev, carregamos a lista de todos os vendedores
          setTargetSeller(null);
          setSelectedSellerId('direct');
          
          try {
            setLoadingTeam(true);
            let query = supabase
              .from('sellers')
              .select('*')
              .eq('status', 'active');
            
            // Only hide test sellers if in production and current user is not a test user
            if (import.meta.env.PROD && !currentSeller?.is_test) {
              query = query.eq('is_test', false);
            }

            const { data: allSellers } = await query.order('full_name');
            
            if (allSellers) {
              setTeamMembers(allSellers as SellerInfo[]);
              
              // If sellerId provided in URL, select it
              if (sellerIdFromUrl) {
                const target = allSellers.find(m => m.id === sellerIdFromUrl);
                if (target) {
                  setTargetSeller(target as SellerInfo);
                  setSelectedSellerId(sellerIdFromUrl);
                }
              } else if (!userIsAdmin && currentSeller) {
                // Se for HoS em dev, já pré-seleciona a si mesmo
                setTargetSeller(currentSeller);
                setSelectedSellerId(currentSeller.id);
              }
            }
          } catch (teamErr) {
            console.error('[SellerLinks] Error loading all sellers:', teamErr);
          } finally {
            setLoadingTeam(false);
          }
        } else if (currentSeller?.role === 'head_of_sales') {
          // Se for HoS (em produção), carrega apenas os membros da sua equipe
          setTargetSeller(currentSeller);
          setSelectedSellerId(currentSeller.id);
          
          try {
            setLoadingTeam(true);

            // Fetch team members by team_id (or just self if no team)
            let query = supabase
              .from('sellers')
              .select('*')
              .eq('status', 'active');
            
            if (currentSeller.team_id) {
              query = query.eq('team_id', currentSeller.team_id);
            } else {
              query = query.eq('id', currentSeller.id);
            }

            // In production, respect test filter
            if (import.meta.env.PROD && !currentSeller?.is_test) {
              query = query.eq('is_test', false);
            }
            
            const { data: myTeam } = await query.order('full_name');
            
            if (myTeam) {
              // Garante que o próprio HoS está na lista mesmo que o filtro exclua
              const members = myTeam.some(m => m.id === currentSeller.id) 
                ? myTeam 
                : [currentSeller, ...myTeam];
                
              setTeamMembers(members as SellerInfo[]);

              // If sellerId provided in URL, select it
              if (sellerIdFromUrl) {
                const target = members.find(m => m.id === sellerIdFromUrl);
                if (target) {
                  setTargetSeller(target as SellerInfo);
                  setSelectedSellerId(sellerIdFromUrl);
                }
              }
            } else {
              setTeamMembers([currentSeller]);
            }
          } catch (teamErr) {
            console.error('[SellerLinks] Error loading team members:', teamErr);
            setTeamMembers([currentSeller]);
          } finally {
            setLoadingTeam(false);
          }
        } else if (currentSeller && !targetSeller) {
          setTeamMembers([currentSeller]);
          setTargetSeller(currentSeller);
          setSelectedSellerId(currentSeller.id);
        }
      } catch (err) {
        console.error('[SellerLinks] Error loading seller info:', err);
      } finally {
        setIsSearchingSeller(false);
      }
    }

    loadSellerInfo();
  }, [seller]);

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

        // Load products and contract templates in parallel
        console.log('[SellerLinks] Starting to load products and contracts...');

        let contractsResult: Set<string> = new Set();
        try {
          console.log('[SellerLinks] Calling getProductsWithContracts...');
          contractsResult = await getProductsWithContracts();
          console.log('[SellerLinks] getProductsWithContracts returned:', contractsResult);
        } catch (contractError) {
          console.error('[SellerLinks] Error calling getProductsWithContracts:', contractError);
          contractsResult = new Set();
        }

        const productsResult = await supabase
          .from('visa_products')
          .select('slug, name, description, base_price_usd, extra_unit_price, extra_unit_label, calculation_type, allow_extra_units')
          .eq('is_active', true)
          .order('name');

        const { data: productsData, error } = productsResult;

        if (error) {
          console.error('[SellerLinks] Error loading products:', error);
        }

        console.log('[SellerLinks] Products loaded:', productsData?.length || 0);

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

          // Ensure contractsResult is a Set
          const contractsSet = contractsResult instanceof Set ? contractsResult : new Set<string>();
          setProductsWithContracts(contractsSet);

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
  if (loading || (isSearchingSeller && !seller)) {
    return (
      <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8" : ""}>
        <div className={isSharedInAdmin ? "max-w-7xl mx-auto" : ""}>
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
      </div>
    );
  }

  if (!seller && !isAdmin) {
    return (
      <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center p-12 text-center" : "flex flex-col items-center justify-center p-12 text-center"}>
        <div className={isSharedInAdmin ? "max-w-7xl mx-auto" : ""}>
          <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Vendedor não configurado</h2>
          <p className="text-gray-400 max-w-md">
            Não foi possível encontrar um perfil de vendedor para gerar os links.
            Entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={isSharedInAdmin ? "p-4 sm:p-6 lg:p-8" : ""}>
      <div className={isSharedInAdmin ? "max-w-7xl mx-auto space-y-6" : "space-y-6"}>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Sales Links</h1>
          <p className="text-gray-400 mt-1">Generate and share your personalized sales links.</p>
        </div>

        {/* Target Seller Selector (Admin and Head of Sales only) */}
        {(isAdmin || seller?.role === 'head_of_sales') && (
          <Card className="bg-black/40 border-gold-medium/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2 text-gold-light shrink-0">
                  <Users className="w-5 h-5" />
                  <span className="font-semibold text-sm">Commission for:</span>
                </div>
                <Select
                  value={selectedSellerId}
                  disabled={loadingTeam}
                  onValueChange={(id) => {
                    setSelectedSellerId(id);
                    if (id === 'direct') {
                      setTargetSeller(null);
                    } else {
                      const member = teamMembers.find(m => m.id === id);
                      if (member) setTargetSeller(member);
                    }
                  }}
                >
                  <SelectTrigger className="bg-zinc-900 border-gold-medium/30 text-white h-10 w-full sm:max-w-xs">
                    <SelectValue placeholder="Select a seller" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-gold-medium/30 text-white">
                    {(isAdmin || seller?.role === 'head_of_sales') && (
                      <SelectItem value="direct">Direct Sale / Migma (No Seller)</SelectItem>
                    )}
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name} ({member.seller_id_public})
                        {member.id === seller?.id ? ' (You)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetSeller ? (
                  <p className="text-xs text-gray-500 italic">
                    All links generated below will be attributed to <strong>{targetSeller.full_name}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    All links generated below will be <strong>Direct Sales</strong> (No Seller ID in URL)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Client Setup Form */}
        <Card
          className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 overflow-hidden cursor-pointer hover:border-gold-medium/50 transition-colors"
          onClick={() => {
            if (!prefillFormExpanded) {
              setPrefillFormExpanded(true);
            }
          }}
        >
          <CardHeader
            onClick={(e) => {
              e.stopPropagation();
              setPrefillFormExpanded(!prefillFormExpanded);
              // Reset to step 1 when closing
              if (prefillFormExpanded) {
                setPrefillFormStep(1);
              }
            }}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {prefillFormExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gold-light mr-2" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gold-light mr-2" />
                )}
                <CardTitle className="text-white flex items-center">
                  <FileEdit className="w-5 h-5 mr-2" />
                  Quick Client Setup
                </CardTitle>
              </div>
              <p className="text-sm text-gray-400">
                {prefillFormExpanded ? 'Click to collapse' : 'Click to expand'}
              </p>
            </div>
            {!prefillFormExpanded && (
              <p className="text-sm text-gray-400 mt-2 ml-7">
                Pre-fill client information to generate a personalized checkout link
              </p>
            )}
          </CardHeader>
          {prefillFormExpanded && (
            <CardContent onClick={(e) => e.stopPropagation()}>
              {/* Step Indicator */}
              <div className="mb-6 flex items-center justify-center gap-2">
                <div className={`flex items-center gap-2 ${prefillFormStep === 1 ? 'text-gold-light' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${prefillFormStep === 1 ? 'bg-gold-medium/20 border-2 border-gold-medium' : 'bg-gray-700 border-2 border-gray-600'}`}>
                    1
                  </div>
                  <span className="text-sm font-medium">Basic Info</span>
                </div>
                <div className="w-12 h-0.5 bg-gray-600"></div>
                <div className={`flex items-center gap-2 ${prefillFormStep === 2 ? 'text-gold-light' : 'text-gray-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${prefillFormStep === 2 ? 'bg-gold-medium/20 border-2 border-gold-medium' : 'bg-gray-700 border-2 border-gray-600'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Address & Details</span>
                </div>
              </div>

              <div className="space-y-4 max-w-4xl mx-auto" onClick={(e) => e.stopPropagation()}>
                {/* STEP 1: Basic Info */}
                {prefillFormStep === 1 && (
                  <>
                    {/* Product Selection - full width row */}
                    <div className="space-y-1.5">
                      <Label htmlFor="prefill-product" className="text-white text-sm">Select Product</Label>
                      <Select
                        value={prefillFormData.productSlug}
                        onValueChange={(value) => {
                          setPrefillFormData({ ...prefillFormData, productSlug: value });
                          if (prefillFieldErrors.productSlug) {
                            setPrefillFieldErrors(prev => {
                              const next = { ...prev };
                              delete next.productSlug;
                              return next;
                            });
                          }
                        }}
                      >
                        <SelectTrigger
                          id="prefill-product"
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.productSlug ? 'border-2 border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => {
                            // Debug: log contracts set on first render
                            if (products.length > 0 && productsWithContracts.size > 0 && product.slug === products[0].slug) {
                              console.log('[SellerLinks] Render - Contracts Set size:', productsWithContracts.size);
                              console.log('[SellerLinks] Render - Contracts Set values:', Array.from(productsWithContracts));
                            }

                            const hasContract = productsWithContracts.has(product.slug);

                            // Debug log for specific products
                            if (product.slug === 'cos-selection-process' || product.slug === 'transfer-selection-process') {
                              console.log(`[SellerLinks] Product ${product.slug}: hasContract=${hasContract}, contractsSet has:`, productsWithContracts.has(product.slug));
                            }

                            // Check if this is a scholarship or i20-control product that inherits from selection-process
                            const isScholarshipOrI20 = product.slug.includes('-scholarship') || product.slug.includes('-i20-control');
                            let inheritsContract = false;

                            if (isScholarshipOrI20 && hasContract) {
                              // Extract the prefix (initial, cos, or transfer)
                              const prefix = product.slug.split('-')[0];
                              const selectionProcessSlug = `${prefix}-selection-process`;
                              // If selection-process also has contract, this product inherits it
                              inheritsContract = productsWithContracts.has(selectionProcessSlug);
                            }

                            return (
                              <SelectItem key={product.slug} value={product.slug}>
                                <div className="flex items-center justify-between w-full pr-6">
                                  <span className="flex-1">{product.name}</span>
                                  {hasContract ? (
                                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                      {inheritsContract ? (
                                        <>
                                          <Info className="w-4 h-4 text-blue-500" />
                                          <span className="text-xs text-gray-600 dark:text-gray-400" title="Inherits contract from Selection Process">Inherits contract</span>
                                        </>
                                      ) : (
                                        <>
                                          <FileText className="w-4 h-4 text-green-500" />
                                          <span className="text-xs text-gray-600 dark:text-gray-400" title="Has contract template">Contract</span>
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                                      <span className="text-xs text-gray-600 dark:text-gray-400">No contract yet</span>
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {prefillFieldErrors.productSlug && (
                        <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.productSlug}</p>
                      )}
                    </div>

                    {/* Dependents & Full Name */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Number of Dependents */}
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-extra-units" className="text-white text-sm">Number of Dependents</Label>
                        <div className="relative">
                          <Select
                            value={prefillFormData.extraUnits.toString()}
                            onValueChange={(value) => {
                              const newExtraUnits = parseInt(value);
                              setPrefillFormData((prev) => {
                                let newDependentNames = prev.dependentNames;
                                if (newExtraUnits === 0) {
                                  newDependentNames = [];
                                } else if (newExtraUnits < prev.dependentNames.length) {
                                  newDependentNames = prev.dependentNames.slice(0, newExtraUnits);
                                } else if (newExtraUnits > prev.dependentNames.length) {
                                  newDependentNames = [...prev.dependentNames];
                                  while (newDependentNames.length < newExtraUnits) {
                                    newDependentNames.push('');
                                  }
                                }
                                return { ...prev, extraUnits: newExtraUnits, dependentNames: newDependentNames };
                              });
                              if (prefillFieldErrors.dependentNames) {
                                setPrefillFieldErrors(prev => {
                                  const next = { ...prev };
                                  delete next.dependentNames;
                                  return next;
                                });
                              }
                            }}
                          >
                            <SelectTrigger
                              id="prefill-extra-units"
                              className="bg-white text-black h-9 text-sm"
                            >
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
                          {/* Overlay para garantir que "0" seja sempre exibido */}
                          {prefillFormData.extraUnits === 0 && (
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

                      {/* Client Name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-name" className="text-white text-sm">Full Name</Label>
                        <Input
                          id="prefill-name"
                          value={prefillFormData.clientName}
                          onChange={(e) => {
                            setPrefillFormData({ ...prefillFormData, clientName: e.target.value });
                            if (prefillFieldErrors.clientName) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.clientName;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.clientName ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.clientName && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.clientName}</p>
                        )}
                      </div>
                    </div>

                    {/* Dependent Names - Dynamic inputs */}
                    {prefillFormData.extraUnits > 0 && (
                      <div className="space-y-2">
                        {Array.from({ length: prefillFormData.extraUnits }, (_, i) => (
                          <div key={i} className="space-y-1.5">
                            <Label htmlFor={`prefill-dependent-name-${i}`} className="text-white text-sm">
                              Dependent Name {i + 1}
                            </Label>
                            <Input
                              id={`prefill-dependent-name-${i}`}
                              value={prefillFormData.dependentNames[i] || ''}
                              onChange={(e) => {
                                const newNames = [...prefillFormData.dependentNames];
                                newNames[i] = e.target.value;
                                setPrefillFormData({ ...prefillFormData, dependentNames: newNames });
                                if (prefillFieldErrors.dependentNames) {
                                  setPrefillFieldErrors(prev => {
                                    const next = { ...prev };
                                    delete next.dependentNames;
                                    return next;
                                  });
                                }
                              }}
                              className="bg-white text-black h-9 text-sm"
                              required
                            />
                          </div>
                        ))}
                        {prefillFieldErrors.dependentNames && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.dependentNames}</p>
                        )}
                      </div>
                    )}

                    {/* Email & Date of Birth */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-email" className="text-white text-sm">Email</Label>
                        <Input
                          id="prefill-email"
                          type="email"
                          value={prefillFormData.clientEmail}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\s/g, '');
                            setPrefillFormData({ ...prefillFormData, clientEmail: value });
                            if (prefillFieldErrors.clientEmail) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.clientEmail;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.clientEmail ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.clientEmail && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.clientEmail}</p>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-dob" className="text-white text-sm">Date of Birth</Label>
                        <Input
                          id="prefill-dob"
                          type="date"
                          min="1900-01-01"
                          value={prefillFormData.dateOfBirth}
                          onChange={(e) => {
                            setPrefillFormData({ ...prefillFormData, dateOfBirth: e.target.value });
                            if (prefillFieldErrors.dateOfBirth) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.dateOfBirth;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.dateOfBirth ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.dateOfBirth && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.dateOfBirth}</p>
                        )}
                      </div>
                    </div>

                    {/* Document Type and Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-doc-type" className="text-white text-sm">Document Type</Label>
                        <Select
                          value={prefillFormData.documentType}
                          onValueChange={(value: any) => {
                            setPrefillFormData({ ...prefillFormData, documentType: value });
                            if (prefillFieldErrors.documentType) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.documentType;
                                return next;
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            id="prefill-doc-type"
                            className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.documentType ? 'border-2 border-red-500' : ''}`}
                          >
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="id">ID</SelectItem>
                            <SelectItem value="driver_license">Driver's License</SelectItem>
                          </SelectContent>
                        </Select>
                        {prefillFieldErrors.documentType && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.documentType}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-doc-number" className="text-white text-sm">Document Number</Label>
                        <Input
                          id="prefill-doc-number"
                          value={prefillFormData.documentNumber}
                          onChange={(e) => {
                            setPrefillFormData({ ...prefillFormData, documentNumber: e.target.value });
                            if (prefillFieldErrors.documentNumber) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.documentNumber;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.documentNumber ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.documentNumber && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.documentNumber}</p>
                        )}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => {
                          setPrefillError('');
                          // Only validate format, not required fields
                          const result = validatePrefillStep1(prefillFormData);
                          if (!result.valid && result.errors) {
                            setPrefillFieldErrors(result.errors);
                            if (result.firstErrorField) {
                              scrollToPrefillFirstError(result.firstErrorField);
                            }
                            return;
                          }
                          setPrefillFieldErrors({});
                          setPrefillFormStep(2);
                        }}
                        className="bg-gold-medium hover:bg-gold-light text-black h-9 text-sm"
                      >
                        Next: Address & Details
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </>
                )}

                {/* STEP 2: Address & Details */}
                {prefillFormStep === 2 && (
                  <>
                    {/* Address */}
                    <div className="space-y-1.5">
                      <Label htmlFor="prefill-address" className="text-white text-sm">Address Line</Label>
                      <Input
                        id="prefill-address"
                        value={prefillFormData.addressLine}
                        onChange={(e) => {
                          setPrefillFormData({ ...prefillFormData, addressLine: e.target.value });
                          if (prefillFieldErrors.addressLine) {
                            setPrefillFieldErrors(prev => {
                              const next = { ...prev };
                              delete next.addressLine;
                              return next;
                            });
                          }
                        }}
                        className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.addressLine ? 'border-2 border-red-500' : ''}`}
                      />
                      {prefillFieldErrors.addressLine && (
                        <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.addressLine}</p>
                      )}
                    </div>

                    {/* City, State, Postal Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-city" className="text-white text-sm">City</Label>
                        <Input
                          id="prefill-city"
                          value={prefillFormData.city}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^a-zA-Z\s\-']/g, '');
                            setPrefillFormData({ ...prefillFormData, city: value });
                            if (prefillFieldErrors.city) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.city;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.city ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.city && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.city}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-state" className="text-white text-sm">State</Label>
                        <Input
                          id="prefill-state"
                          value={prefillFormData.state}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^a-zA-Z\s\-']/g, '');
                            setPrefillFormData({ ...prefillFormData, state: value });
                            if (prefillFieldErrors.state) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.state;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.state ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.state && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.state}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-postal" className="text-white text-sm">Postal Code</Label>
                        <Input
                          id="prefill-postal"
                          value={prefillFormData.postalCode}
                          onChange={(e) => {
                            setPrefillFormData({ ...prefillFormData, postalCode: e.target.value });
                            if (prefillFieldErrors.postalCode) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.postalCode;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.postalCode ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.postalCode && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.postalCode}</p>
                        )}
                      </div>
                    </div>

                    {/* Country and Nationality */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-country" className="text-white text-sm">Country of Residence</Label>
                        <Select
                          value={prefillFormData.clientCountry}
                          onValueChange={(value) => {
                            const phoneCode = getPhoneCodeFromCountry(value);
                            let newWhatsApp = prefillFormData.clientWhatsApp;
                            if (newWhatsApp) {
                              const withoutCode = newWhatsApp.replace(/^\+\d{1,4}\s*/, '');
                              newWhatsApp = phoneCode + (withoutCode ? ' ' + withoutCode : '');
                            } else {
                              newWhatsApp = phoneCode;
                            }
                            setPrefillFormData({
                              ...prefillFormData,
                              clientCountry: value,
                              clientWhatsApp: newWhatsApp
                            });
                            if (prefillFieldErrors.clientCountry) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.clientCountry;
                                return next;
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            id="prefill-country"
                            className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.clientCountry ? 'border-2 border-red-500' : ''}`}
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
                        {prefillFieldErrors.clientCountry && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.clientCountry}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-nationality" className="text-white text-sm">Nationality *</Label>
                        <Select
                          value={prefillFormData.clientNationality}
                          onValueChange={(value) => {
                            setPrefillFormData({ ...prefillFormData, clientNationality: value });
                            if (prefillFieldErrors.clientNationality) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.clientNationality;
                                return next;
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            id="prefill-nationality"
                            className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.clientNationality ? 'border-2 border-red-500' : ''}`}
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
                        {prefillFieldErrors.clientNationality && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.clientNationality}</p>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp and Marital Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-whatsapp" className="text-white text-sm">WhatsApp (with country code)</Label>
                        <Input
                          id="prefill-whatsapp"
                          type="tel"
                          placeholder="+55 11 98765 4321"
                          value={prefillFormData.clientWhatsApp}
                          onChange={(e) => {
                            setPrefillFormData({ ...prefillFormData, clientWhatsApp: e.target.value });
                            if (prefillFieldErrors.clientWhatsApp) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.clientWhatsApp;
                                return next;
                              });
                            }
                          }}
                          className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.clientWhatsApp ? 'border-2 border-red-500' : ''}`}
                        />
                        {prefillFieldErrors.clientWhatsApp && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.clientWhatsApp}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prefill-marital" className="text-white text-sm">Marital Status</Label>
                        <Select
                          value={prefillFormData.maritalStatus}
                          onValueChange={(value: any) => {
                            setPrefillFormData({ ...prefillFormData, maritalStatus: value });
                            if (prefillFieldErrors.maritalStatus) {
                              setPrefillFieldErrors(prev => {
                                const next = { ...prev };
                                delete next.maritalStatus;
                                return next;
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            id="prefill-marital"
                            className={`bg-white text-black h-9 text-sm ${prefillFieldErrors.maritalStatus ? 'border-2 border-red-500' : ''}`}
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
                        {prefillFieldErrors.maritalStatus && (
                          <p className="text-red-400 text-xs mt-1">{prefillFieldErrors.maritalStatus}</p>
                        )}
                      </div>
                    </div>

                    {/* Observations */}
                    <div className="space-y-1.5">
                      <Label htmlFor="prefill-observations" className="text-white text-sm">Observations (optional)</Label>
                      <Textarea
                        id="prefill-observations"
                        value={prefillFormData.clientObservations}
                        onChange={(e) => setPrefillFormData({ ...prefillFormData, clientObservations: e.target.value })}
                        className="bg-white text-black min-h-[80px] text-sm"
                        placeholder="Any additional information..."
                      />
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-2">
                      <Button
                        onClick={() => setPrefillFormStep(1)}
                        variant="outline"
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 h-9 text-sm"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </>
                )}

                {/* Error Message */}
                {prefillError && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
                    {prefillError}
                  </div>
                )}

                {/* Generated Link */}
                {generatedPrefillLink && (
                  <div className="bg-green-500/10 border border-green-500/50 text-green-300 p-3 rounded-md">
                    <p className="font-semibold mb-2 text-sm">Link Generated Successfully!</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generatedPrefillLink || ''}
                        readOnly
                        className="bg-white text-black flex-1 h-9 text-xs"
                      />
                      <Button
                        onClick={() => {
                          copyToClipboard(generatedPrefillLink);
                          setCopiedLink(generatedPrefillLink);
                          copyTimeoutRef.current = setTimeout(() => {
                            setCopiedLink(null);
                            copyTimeoutRef.current = null;
                          }, 3000);
                        }}
                        className="bg-gold-medium hover:bg-gold-light text-black h-9 text-sm"
                      >
                        {copiedLink === generatedPrefillLink ? (
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
                )}

                {/* Generate Link Button - Only show on Step 2 */}
                {prefillFormStep === 2 && (
                  <Button
                    onClick={async () => {
                      // Check if product is selected (required for URL)
                      if (!prefillFormData.productSlug.trim()) {
                        setPrefillError('Please select a product to generate the link');
                        setPrefillFieldErrors({ productSlug: 'Product is required to generate link' });
                        return;
                      }

                      // Only validate format, not required fields
                      const validation = validatePrefillForm(prefillFormData);
                      if (!validation.valid) {
                        setPrefillFieldErrors(validation.errors || {});
                        if (validation.firstErrorField) {
                          scrollToPrefillFirstError(validation.firstErrorField);
                        }
                        return;
                      }

                      setPrefillError('');
                      setPrefillFieldErrors({});

                      // Generate token and create prefill record
                      try {
                        const token = generateUUID();
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

                        const targetSellerId = targetSeller?.seller_id_public;

                        const { error: insertError } = await supabase
                          .from('checkout_prefill_tokens')
                          .insert({
                            token,
                            seller_id: targetSellerId,
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
                              dependentNames: prefillFormData.dependentNames.length > 0 ? prefillFormData.dependentNames : null,
                            },
                            expires_at: expiresAt.toISOString(),
                          });

                        if (insertError) {
                          throw insertError;
                        }

                        // Generate link
                        const siteUrl = window.location.origin;
                        const sellerParam = targetSellerId ? `&seller=${targetSellerId}` : '';
                        const link = `${siteUrl}/checkout/visa/${prefillFormData.productSlug}?prefill=${token}${sellerParam}`;
                        setGeneratedPrefillLink(link);

                        // Auto-copy to clipboard
                        copyToClipboard(link);
                        setCopiedLink(link);
                        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                        copyTimeoutRef.current = setTimeout(() => {
                          setCopiedLink(null);
                          copyTimeoutRef.current = null;
                        }, 3000);
                      } catch (err: any) {
                        console.error('Error generating prefill link:', err);
                        setPrefillError(err.message || 'Failed to generate link. Please try again.');
                      }
                    }}
                    className="w-full bg-gold-medium hover:bg-gold-light text-black h-9 text-sm"
                  >
                    Generate Link for Client
                  </Button>
                )}
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
                    eb2: { name: 'EB-2 Program', products: [] },
                    eb3: { name: 'EB-3 Program', products: [] },
                    other: { name: 'Other Services', products: [] },
                  };

                  products.forEach((product) => {
                    if (product.slug.startsWith('initial-') || product.slug === 'INITIAL Application - Full Process Payment') {
                      serviceGroups.initial.products.push(product);
                    } else if (product.slug.startsWith('cos-') || product.slug === 'Change of Status - Full Process Payment') {
                      serviceGroups.cos.products.push(product);
                    } else if (product.slug.startsWith('transfer-') || product.slug === 'TRANSFER - Full Process Payment') {
                      serviceGroups.transfer.products.push(product);
                    } else if (product.slug.startsWith('eb2-')) {
                      serviceGroups.eb2.products.push(product);
                    } else if (product.slug.startsWith('eb3-')) {
                      serviceGroups.eb3.products.push(product);
                    } else {
                      serviceGroups.other.products.push(product);
                    }
                  });

                  // Sort products within each group
                  const sortProducts = (products: VisaProduct[], groupKey: string) => {
                    // Specific sorting logic for EB-3
                    if (groupKey === 'eb3') {
                      const eb3Order = [
                        'step-initial',
                        'step-catalog',
                        'installment-initial',
                        'installment-catalog',
                        'installment-monthly'
                      ];
                      return products.sort((a, b) => {
                        const aIndex = eb3Order.findIndex(o => a.slug.includes(o));
                        const bIndex = eb3Order.findIndex(o => b.slug.includes(o));
                        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                      });
                    }

                    // Specific sorting logic for EB-2
                    // Goal (EB-2):
                    // 1) Full Process Payment
                    // 2) Initial Payment (1 step)
                    // 3) I-140 (2 step)
                    // 4) I-485 (3 step) / Consular
                    // 5) Monthly Installment (Annex) / Installment plan entry
                    if (groupKey === 'eb2') {
                      const score = (p: VisaProduct) => {
                        if (p.slug === 'eb2-niw-initial-payment') return 0;
                        if (p.slug === 'eb2-i140-step') return 1;
                        if (p.slug === 'eb2-i485-step') return 2;
                        if (p.slug === 'eb2-annex-installment') return 3;
                        if (p.slug === 'eb2-visa') return 4;

                        return 999;
                      };

                      return products
                        .sort((a, b) => {
                          const diff = score(a) - score(b);
                          if (diff !== 0) return diff;
                          // Tie-breaker: keep deterministic ordering
                          return (a.name || a.slug).localeCompare((b.name || b.slug), undefined, { sensitivity: 'base' });
                        });
                    }

                    const order = [
                      // Priority for "Other"/General services
                      'rfe-defense',
                      'scholarship-maintenance-fee',
                      'b1-premium',
                      'b1-revolution',
                      'e2-l1-visa',
                      'o1-visa',
                      // Standard process order
                      'selection-process', 
                      'scholarship', 
                      'i20-control', 
                      'total-process', 
                      'INITIAL Application - Full Process Payment', 
                      'Change of Status - Full Process Payment', 
                      'TRANSFER - Full Process Payment'
                    ];
                    return products.sort((a, b) => {
                      const aIndex = order.findIndex(o => a.slug.includes(o) || a.slug === o);
                      const bIndex = order.findIndex(o => b.slug.includes(o) || b.slug === o);
                      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
                    });
                  };

                  const paymentLabels = ['Selection Process', 'Scholarship', 'I-20 Control'];
                  const getDisplayProductName = (product: VisaProduct, groupKey: string) => {
                    if (groupKey === 'eb2') {
                      return product.name.replace(/\s*\([^()]*\)\s*$/u, '').trim();
                    }

                    return product.name;
                  };

                  return Object.entries(serviceGroups).map(([key, group]) => {
                    if (group.products.length === 0) return null;

                    const sortedProducts = sortProducts(group.products, key);
                    const isFullProcessPayment = (product: VisaProduct) => {
                      const text = `${product.slug} ${product.name}`.toLowerCase();
                      return (
                        text.includes('total-process') ||
                        text.includes('full process payment') ||
                        text.includes('full process') ||
                        product.slug === 'eb3-visa'
                      );
                    };
                    const stepDenominator = sortedProducts.filter((p) => !isFullProcessPayment(p)).length;

                    const isServiceGroup = ['initial', 'cos', 'transfer', 'eb2', 'eb3'].includes(key);
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
                                  {`${stepDenominator} Step Payments or Full Process Payment`}
                                </p>
                              </div>
                            </div>
                          </button>

                          {/* Dropdown Content */}
                          {isExpanded && (
                            <div className="border-t border-gold-medium/20 bg-black/30 p-4 space-y-3">
                              {sortedProducts.map((product, index) => {
                                const isCopied = copiedLink === productGeneratedLinks[product.slug];
                                const isTotalProcess = isFullProcessPayment(product);
                                const paymentNumber = isTotalProcess
                                  ? 0
                                  : sortedProducts.slice(0, index + 1).filter((p) => !isFullProcessPayment(p)).length;
                                // Use mapped label for Initial/COS/Transfer, but actual names for EB-3 and others
                                const paymentLabel = (key === 'eb2' || key === 'eb3' || key === 'other' || isTotalProcess)
                                  ? getDisplayProductName(product, key)
                                  : (paymentLabels[index] || `Payment ${paymentNumber}`);
                                const basePrice = parseFloat(product.base_price_usd || '0');
                                const extraPrice = parseFloat(product.extra_unit_price || '0');
                                const hasExtraUnits = product.allow_extra_units && extraPrice > 0;


                                return (
                                  <div
                                    key={product.slug}
                                    className="p-4 bg-black/50 rounded-lg border border-gold-medium/20 hover:border-gold-medium/40 transition-colors"
                                  >
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                      <div className="flex-1 space-y-2 w-full">
                                        {/* Payment Label with Number */}
                                        <div className="flex items-center gap-2">
                                          {!isTotalProcess && (
                                            <span className="text-xs font-semibold text-gold-light bg-gold-medium/20 px-2 py-1 rounded">
                                              {paymentNumber}/{stepDenominator}
                                            </span>
                                          )}
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

                                      </div>

                                      {/* Botões Generate Link */}
                                      <div className="flex gap-2 shrink-0">
                                        <Button
                                          onClick={async () => {
                                            try {
                                              const token = generateUUID();
                                              const expiresAt = new Date();
                                              expiresAt.setDate(expiresAt.getDate() + 30);

                                              const targetSellerId = targetSeller?.seller_id_public;

                                              const { error: insertError } = await supabase
                                                .from('checkout_prefill_tokens')
                                                .insert({
                                                  token,
                                                  seller_id: targetSellerId,
                                                  product_slug: product.slug,
                                                  client_data: {},
                                                  expires_at: expiresAt.toISOString(),
                                                });

                                              if (insertError) throw insertError;

                                              const siteUrl = window.location.origin;
                                              const sellerParam = targetSellerId ? `&seller=${targetSellerId}` : '';
                                              const link = `${siteUrl}/checkout/visa/${product.slug}?prefill=${token}${sellerParam}`;
                                              setProductGeneratedLinks({
                                                ...productGeneratedLinks,
                                                [product.slug]: link,
                                              });

                                              // Copy to clipboard automatically
                                              copyToClipboard(link);
                                              setCopiedLink(link);
                                              setTimeout(() => setCopiedLink(null), 3000);

                                              setPrefillError('');
                                            } catch (err: any) {
                                              console.error('Error generating prefill link:', err);
                                              setPrefillError(err.message || 'Erro ao gerar link');
                                            }
                                          }}
                                          size="sm"
                                          variant="outline"
                                          className="bg-gold-medium/20 border-gold-medium/50 text-gold-light hover:bg-gold-medium/30 hover:border-gold-medium"
                                        >
                                          <DollarSign className="w-4 h-4 mr-1" />
                                          Get Pay Link
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            try {
                                              const token = generateUUID();
                                              const expiresAt = new Date();
                                              expiresAt.setDate(expiresAt.getDate() + 30);

                                              const targetSellerId = targetSeller?.seller_id_public;

                                              const { error: insertError } = await supabase
                                                .from('checkout_prefill_tokens')
                                                .insert({
                                                  token,
                                                  seller_id: targetSellerId,
                                                  product_slug: product.slug,
                                                  client_data: {},
                                                  expires_at: expiresAt.toISOString(),
                                                });

                                              if (insertError) throw insertError;

                                              const siteUrl = window.location.origin;
                                              const sellerParam = targetSellerId ? `&seller=${targetSellerId}` : '';
                                              const link = `${siteUrl}/checkout/contract/${product.slug}?prefill=${token}${sellerParam}`;
                                              setProductGeneratedLinks({
                                                ...productGeneratedLinks,
                                                [product.slug]: link,
                                              });

                                              // Copy to clipboard automatically
                                              copyToClipboard(link);
                                              setCopiedLink(link);
                                              setTimeout(() => setCopiedLink(null), 3000);

                                              setPrefillError('');
                                            } catch (err: any) {
                                              console.error('Error generating contract link:', err);
                                              setPrefillError(err.message || 'Erro ao gerar link');
                                            }
                                          }}
                                          size="sm"
                                          variant="outline"
                                          className="bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                                        >
                                          <FileText className="w-4 h-4 mr-1" />
                                          Sign Link
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Link gerado */}
                                    {productGeneratedLinks[product.slug] && (
                                      <div className="mt-4 pt-4 border-t border-gold-medium/20">
                                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                          <p className="text-sm text-green-300 font-medium mb-2">Link gerado com sucesso!</p>
                                          <p className="text-xs text-gray-400 font-mono break-all mb-3">{productGeneratedLinks[product.slug]}</p>
                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => {
                                                copyToClipboard(productGeneratedLinks[product.slug]);
                                                setCopiedLink(productGeneratedLinks[product.slug]);
                                                setTimeout(() => setCopiedLink(null), 3000);
                                              }}
                                              size="sm"
                                              variant="outline"
                                              className={`${isCopied
                                                ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                                                : 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
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
                                                  Copy Link
                                                </>
                                              )}
                                            </Button>
                                            <Button
                                              onClick={() => {
                                                setProductGeneratedLinks(prev => {
                                                  const next = { ...prev };
                                                  delete next[product.slug];
                                                  return next;
                                                });
                                              }}
                                              size="sm"
                                              variant="outline"
                                              className="bg-black/50 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium"
                                            >
                                              Close
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {prefillError && (
                                      <div className="mt-2">
                                        <p className="text-xs text-red-400">{prefillError}</p>
                                      </div>
                                    )}
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
                          const isCopied = copiedLink === productGeneratedLinks[product.slug];
                          const basePrice = parseFloat(product.base_price_usd || '0');
                          const extraPrice = parseFloat(product.extra_unit_price || '0');
                          const monthlyInstallmentAnnex = (() => {
                            const t = `${product.slug} ${product.name}`.toLowerCase();
                            return t.includes('monthly installment') && (t.includes('annex') || t.includes('anexo'));
                          })();
                          const hasExtraUnits = !monthlyInstallmentAnnex && extraPrice > 0;
                          const isUnitsOnly = product.calculation_type === 'units_only';

                          return (
                            <div
                              key={product.slug}
                              className="p-5 bg-black/50 rounded-lg border border-gold-medium/20 hover:border-gold-medium/40 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="flex-1 space-y-3 w-full">
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

                                </div>

                                {/* Botões Generate Link */}
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    onClick={async () => {
                                      try {
                                        const token = generateUUID();
                                        const expiresAt = new Date();
                                        expiresAt.setDate(expiresAt.getDate() + 30);

                                        const targetSellerId = targetSeller?.seller_id_public;

                                        const { error: insertError } = await supabase
                                          .from('checkout_prefill_tokens')
                                          .insert({
                                            token,
                                            seller_id: targetSellerId,
                                            product_slug: product.slug,
                                            client_data: {},
                                            expires_at: expiresAt.toISOString(),
                                          });

                                        if (insertError) throw insertError;

                                        const siteUrl = window.location.origin;
                                        const sellerParam = targetSellerId ? `&seller=${targetSellerId}` : '';
                                        const link = `${siteUrl}/checkout/visa/${product.slug}?prefill=${token}${sellerParam}`;
                                        setProductGeneratedLinks({
                                          ...productGeneratedLinks,
                                          [product.slug]: link,
                                        });

                                        // Copy to clipboard automatically
                                        copyToClipboard(link);
                                        setCopiedLink(link);
                                        setTimeout(() => setCopiedLink(null), 3000);

                                        setPrefillError('');
                                      } catch (err: any) {
                                        console.error('Error generating prefill link:', err);
                                        setPrefillError(err.message || 'Erro ao gerar link');
                                      }
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="bg-gold-medium/20 border-gold-medium/50 text-gold-light hover:bg-gold-medium/30 hover:border-gold-medium"
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Get Pay Link
                                  </Button>
                                  <Button
                                    onClick={async () => {
                                      try {
                                        const token = generateUUID();
                                        const expiresAt = new Date();
                                        expiresAt.setDate(expiresAt.getDate() + 30);

                                        const targetSellerId = targetSeller?.seller_id_public;

                                        const { error: insertError } = await supabase
                                          .from('checkout_prefill_tokens')
                                          .insert({
                                            token,
                                            seller_id: targetSellerId,
                                            product_slug: product.slug,
                                            client_data: {},
                                            expires_at: expiresAt.toISOString(),
                                          });

                                        if (insertError) throw insertError;

                                        const siteUrl = window.location.origin;
                                        const sellerParam = targetSellerId ? `&seller=${targetSellerId}` : '';
                                        const link = `${siteUrl}/checkout/contract/${product.slug}?prefill=${token}${sellerParam}`;
                                        setProductGeneratedLinks({
                                          ...productGeneratedLinks,
                                          [product.slug]: link,
                                        });

                                        // Copy to clipboard automatically
                                        copyToClipboard(link);
                                        setCopiedLink(link);
                                        setTimeout(() => setCopiedLink(null), 3000);

                                        setPrefillError('');
                                      } catch (err: any) {
                                        console.error('Error generating contract link:', err);
                                        setPrefillError(err.message || 'Erro ao gerar link');
                                      }
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Sign Link
                                  </Button>
                                </div>
                              </div>

                              {/* Link gerado */}
                              {productGeneratedLinks[product.slug] && (
                                <div className="mt-4 pt-4 border-t border-gold-medium/20">
                                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <p className="text-sm text-green-300 font-medium mb-2">Link gerado com sucesso!</p>
                                    <p className="text-xs text-gray-400 font-mono break-all mb-3">{productGeneratedLinks[product.slug]}</p>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => {
                                          copyToClipboard(productGeneratedLinks[product.slug]);
                                          setCopiedLink(productGeneratedLinks[product.slug]);
                                          setTimeout(() => setCopiedLink(null), 3000);
                                        }}
                                        size="sm"
                                        variant="outline"
                                        className={`${isCopied
                                          ? 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
                                          : 'bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30'
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
                                            Copy Link
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setProductGeneratedLinks(prev => {
                                            const next = { ...prev };
                                            delete next[product.slug];
                                            return next;
                                          });
                                        }}
                                        size="sm"
                                        variant="outline"
                                        className="bg-black/50 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium"
                                      >
                                        Close
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {prefillError && (
                                <div className="mt-2">
                                  <p className="text-xs text-red-400">{prefillError}</p>
                                </div>
                              )}
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
    </div>
  );
}


