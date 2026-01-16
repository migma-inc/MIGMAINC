import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';

export const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  const method = searchParams.get('method');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!sessionId && !orderId) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase.from('visa_orders').select('*');

        if (sessionId) {
          query = query.eq('stripe_session_id', sessionId);
        } else if (orderId) {
          query = query.eq('id', orderId);
        }

        const { data, error } = await query.single();

        if (error) {
          console.error('Error loading order:', error);
        } else {
          setOrder(data);
          // Clear localStorage draft only when payment is confirmed
          try {
            localStorage.removeItem('visa_checkout_draft');
          } catch (err) {
            console.warn('Failed to clear draft:', err);
          }
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [sessionId, orderId]);

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
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold migma-gold-text mb-2">
              {method === 'zelle' ? 'Payment Submitted!' : 'Payment Successful!'}
            </h1>
            <p className="text-gray-300">
              {method === 'zelle'
                ? 'Your Zelle payment receipt has been submitted successfully.'
                : 'Your payment has been processed successfully.'}
            </p>
          </div>

          {order && (
            <div className="bg-black/50 rounded-lg p-6 mb-6 text-left">
              <h2 className="text-xl font-bold text-gold-light mb-4">Order Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order Number:</span>
                  <span className="text-white font-mono">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Product:</span>
                  <span className="text-white">{order.product_slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dependents:</span>
                  <span className="text-white">{order.number_of_dependents || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-white font-bold">
                    {(() => {
                      // Get currency and final amount from payment_metadata
                      const metadata = order.payment_metadata as any;
                      const currency = metadata?.currency || 'USD';
                      let finalAmount = parseFloat(order.total_price_usd);

                      if (metadata?.final_amount) {
                        finalAmount = parseFloat(metadata.final_amount);
                      } else if (metadata?.total_usd) {
                        finalAmount = parseFloat(metadata.total_usd);
                      }

                      if (currency === 'BRL' || currency === 'brl') {
                        return `R$ ${finalAmount.toFixed(2)}`;
                      } else {
                        // USD - show with fees (final_amount already includes fees)
                        return `US$ ${finalAmount.toFixed(2)}`;
                      }
                    })()}
                  </span>
                </div>
                {order.payment_status === 'completed' && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="font-bold text-green-400">
                      Completed
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-gray-300">
              {method === 'zelle'
                ? 'Our team will review your payment and contact you shortly to confirm and begin the visa application process.'
                : 'A confirmation email has been sent to your email address.'}
            </p>
            <p className="text-gray-300">
              Our team will contact you soon to begin the visa application process.
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium">
                Back to Home
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};




