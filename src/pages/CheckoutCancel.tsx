import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

export const CheckoutCancel = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('visa_orders')
          .select('product_slug, seller_id')
          .eq('id', orderId)
          .single();

        if (error) {
          console.error('Error loading order:', error);
        } else if (data) {
          // Build checkout URL
          const sellerParam = data.seller_id ? `?seller=${data.seller_id}` : '';
          setCheckoutUrl(`/checkout/visa/${data.product_slug}${sellerParam}`);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

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

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Payment Cancelled</h1>
            <p className="text-gray-300">
              Your payment was cancelled. No charges were made.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-gray-300">
              If you encountered any issues or have questions, please contact our support team.
            </p>
            <div className="flex gap-4 justify-center">
              {checkoutUrl && (
                <Link to={checkoutUrl}>
                  <Button variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Checkout
                  </Button>
                </Link>
              )}
              <Link to="/contact">
                <Button className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium">
                  Contact Support
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};




























