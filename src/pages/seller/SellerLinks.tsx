import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkIcon, Copy, CheckCircle, DollarSign, Users, Info } from 'lucide-react';

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
          .select('slug, name, description, base_price_usd, extra_unit_price, extra_unit_label, calculation_type')
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
              products.map((product) => {
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
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


