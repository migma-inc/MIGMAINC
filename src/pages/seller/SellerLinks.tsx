import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkIcon, Copy, CheckCircle } from 'lucide-react';

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
  base_price_usd: string;
  extra_unit_price: string;
}

export function SellerLinks() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [products, setProducts] = useState<VisaProduct[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data: productsData } = await supabase
          .from('visa_products')
          .select('slug, name, base_price_usd, extra_unit_price')
          .eq('is_active', true)
          .order('name');

        if (productsData) {
          setProducts(productsData);
        }
      } catch (err) {
        console.error('Error loading products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const copyLink = (productSlug: string) => {
    if (!seller) return;
    
    const siteUrl = window.location.origin;
    const link = `${siteUrl}/checkout/visa/${productSlug}?seller=${seller.seller_id_public}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    
    setTimeout(() => setCopiedLink(null), 3000);
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

                return (
                  <div
                    key={product.slug}
                    className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gold-medium/20"
                  >
                    <div className="flex-1">
                      <p className="text-white font-semibold">{product.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-1 break-all">{link}</p>
                    </div>
                    <Button
                      onClick={() => copyLink(product.slug)}
                      size="sm"
                      variant="outline"
                      className={`ml-4 ${
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
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

