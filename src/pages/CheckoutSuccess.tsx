import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';

export const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  const method = searchParams.get('method');

  const [order, setOrder] = useState<any>(null);
  const [splitPayment, setSplitPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);

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

        const { data: orderData, error } = await query.single();

        if (error) {
          console.error('Error loading order:', error);
        } else {
          // Fetch Product Details for receipt
          let productDetails = null;
          if (orderData.product_slug) {
            const { data: pData } = await supabase
              .from('visa_products')
              .select('name, base_price_usd')
              .eq('slug', orderData.product_slug)
              .single();
            productDetails = pData;
          }

          // Fetch Upsell Details for receipt
          let upsellDetails = null;
          if (orderData.upsell_product_slug) {
            const { data: uData } = await supabase
              .from('visa_products')
              .select('name')
              .eq('slug', orderData.upsell_product_slug)
              .single();
            upsellDetails = uData;
          }

          setOrder({
            ...orderData,
            product_details: productDetails,
            upsell_details: upsellDetails
          });

          // Clear localStorage draft only when payment is confirmed or started
          try {
            localStorage.removeItem('visa_checkout_draft');
          } catch (err) {
            console.warn('Failed to clear draft:', err);
          }

          // Load Split Payment detail if applicable
          if (orderData.is_split_payment && orderData.split_payment_id) {
            const { data: splitData } = await supabase
              .from('split_payments')
              .select('*')
              .eq('id', orderData.split_payment_id)
              .single();

            if (splitData) {
              setSplitPayment(splitData);
            }
          }
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [sessionId, orderId]); // Fix: use orderId from state/scope

  // Lógica de redirecionamento automático para Parte 2
  useEffect(() => {
    if (splitPayment && splitPayment.overall_status === 'part1_completed' && splitPayment.part2_parcelow_checkout_url && !isRedirecting) {
      if (redirectCountdown > 0) {
        const timer = setTimeout(() => setRedirectCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        handleRedirectToPart2();
      }
    }
  }, [splitPayment, redirectCountdown, isRedirecting]);

  const handleRedirectToPart2 = () => {
    if (splitPayment?.part2_parcelow_checkout_url) {
      setIsRedirecting(true);
      window.location.href = splitPayment.part2_parcelow_checkout_url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="loader-gold mx-auto mb-8"></div>
          <p className="text-gray-400">Loading your order details...</p>
        </div>
      </div>
    );
  }

  const isPartiallyPaid = splitPayment && splitPayment.overall_status === 'part1_completed';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 py-12">
      <Card className="max-w-2xl w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            {isPartiallyPaid ? (
              <div className="relative mb-4 mx-auto w-20 h-20 flex items-center justify-center">
                <CheckCircle className="w-20 h-20 text-blue-500" />
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-lg">1/2 PAID</span>
              </div>
            ) : (
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            )}

            <h1 className="text-3xl font-bold migma-gold-text mb-2">
              {isPartiallyPaid
                ? 'Part 1 Confirmed!'
                : (method === 'zelle' ? 'Payment Submitted!' : method === 'manual' ? 'Contract Signed!' : 'Payment Successful!')}
            </h1>
            <p className="text-gray-300">
              {isPartiallyPaid
                ? 'Great! We received the first part of your payment. We will now redirect you to complete the second part.'
                : (method === 'zelle'
                  ? 'Your Zelle payment receipt has been submitted successfully.'
                  : method === 'manual'
                    ? 'Your contract has been signed and submitted successfully.'
                    : 'Everything is set! Your application is now in progress.')}
            </p>
          </div>

          {isPartiallyPaid && (
            <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl animate-pulse">
              <div className="flex items-center justify-center gap-3 text-blue-400 mb-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="font-bold">Redirecting to Part 2 in {redirectCountdown}s...</span>
              </div>
              <Button
                onClick={handleRedirectToPart2}
                disabled={isRedirecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRedirecting ? 'Redirecting...' : 'Pay Part 2 Now'}
              </Button>
            </div>
          )}

          {order && (
            <div className="bg-black/50 rounded-lg p-6 mb-6 text-left border border-white/5">
              <h2 className="text-xl font-bold text-gold-light mb-4 flex items-center gap-2">
                Order Summary
                {splitPayment && <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded uppercase tracking-tighter">Split Payment</span>}
              </h2>

              <div className="space-y-4 text-sm">
                <div className="space-y-2 pb-4 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Order Reference:</span>
                    <span className="text-white font-mono font-medium">{order.order_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Product:</span>
                    <span className="text-white font-medium text-right max-w-[60%]">
                      {order.product_details?.name || order.product_slug?.toUpperCase()}
                    </span>
                  </div>

                  {order.product_details?.base_price_usd && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Base Price:</span>
                      <span className="text-white font-medium">US$ {parseFloat(order.product_details.base_price_usd).toFixed(2)}</span>
                    </div>
                  )}

                  {order.extra_units > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Dependents:</span>
                      <span className="text-white font-medium">{order.extra_units}</span>
                    </div>
                  )}

                  {order.upsell_product_slug && (
                    <div className="flex justify-between items-start pt-2 mt-2 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-gray-400">Combo Copa / Upsell:</span>
                        <span className="text-green-400 font-medium text-xs">
                          {order.upsell_details?.name || order.upsell_product_slug?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-medium">US$ {parseFloat(order.upsell_price_usd || '0').toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Price:</span>
                    <span className="text-white font-bold text-lg">US$ {parseFloat(order.total_price_usd).toFixed(2)}</span>
                  </div>
                </div>

                {/* Split Status Details */}
                {splitPayment && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-gold-light/60 text-[10px] font-bold uppercase tracking-widest pl-1">Payment Distribution</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Part 1 Status */}
                      <div className={`p-3 rounded-lg border ${splitPayment.part1_payment_status === 'completed' ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex flex-col h-full justify-between gap-1">
                          <span className="text-gray-400 text-[10px] font-bold uppercase">PART 1 ({splitPayment.part1_payment_method})</span>
                          <span className="text-white font-bold text-base">US$ {parseFloat(splitPayment.part1_amount_usd).toFixed(2)}</span>
                          <span className={`text-[10px] font-bold mt-1 ${splitPayment.part1_payment_status === 'completed' ? 'text-green-400' : 'text-gray-400'}`}>
                            {splitPayment.part1_payment_status === 'completed' ? '✓ PAID' : '○ PENDING'}
                          </span>
                        </div>
                      </div>

                      {/* Part 2 Status */}
                      <div className={`p-3 rounded-lg border ${splitPayment.part2_payment_status === 'completed' ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex flex-col h-full justify-between gap-1">
                          <span className="text-gray-400 text-[10px] font-bold uppercase">PART 2 ({splitPayment.part2_payment_method})</span>
                          <span className="text-white font-bold text-base">US$ {parseFloat(splitPayment.part2_amount_usd).toFixed(2)}</span>
                          <span className={`text-[10px] font-bold mt-1 ${splitPayment.part2_payment_status === 'completed' ? 'text-green-400' : 'text-gray-400'}`}>
                            {splitPayment.part2_payment_status === 'completed' ? '✓ PAID' : '○ PENDING'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isPartiallyPaid && (
                      <div className="pt-4 flex flex-col items-center gap-3">
                        <p className="text-xs text-blue-400 font-medium">Wait! You still need to pay the second part to finalize.</p>
                        <Link to={`/checkout/split-payment/redirect?split_payment_id=${splitPayment.id}`} className="w-full">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-tight py-6">
                            Pay Part 2 Now
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {!splitPayment && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-400">Payment Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.payment_status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-gold-medium/20 text-gold-light'}`}>
                      {order.payment_status === 'completed' ? 'COMPLETED' : (order.payment_status === 'manual_pending' ? 'SIGNED' : order.payment_status?.toUpperCase())}
                    </span>
                  </div>
                )}

                {/* Additional Parcelow Info (No Split only) */}
                {!splitPayment && order.payment_method === 'parcelow' && (() => {
                  const metadata = order.payment_metadata as any;
                  if (metadata?.total_brl) {
                    const brlAmount = typeof metadata.total_brl === 'string' ? parseFloat(metadata.total_brl) : (metadata.total_brl > 10000 ? metadata.total_brl / 100 : metadata.total_brl);
                    return (
                      <div className="border-t border-white/5 pt-4 mt-2">
                        <div className="flex justify-between items-center text-lg">
                          <span className="text-gray-400">Paid in BRL:</span>
                          <span className="text-gold-light font-bold">R$ {brlAmount.toFixed(2)}</span>
                        </div>
                        {metadata.installments && <p className="text-[10px] text-gray-500 text-right mt-1">Split in {metadata.installments} installments</p>}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          <div className="space-y-6 mt-8">
            <div className="space-y-2">
              <p className="text-sm text-gray-300">
                {isPartiallyPaid
                  ? 'Your application progress is saved. Once Part 2 is received, we will generate your legal contracts.'
                  : (method === 'zelle'
                    ? 'Our team will review your payment and contact you shortly to confirm and begin the process.'
                    : 'A confirmation email with your order details has been sent to your inbox.')}
              </p>
              {!isPartiallyPaid && (
                <p className="text-sm text-gray-400">
                  Our legal team will contact you within 24 hours to begin the visa application steps.
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-white/5">
              <Link to="/">
                <Button variant="ghost" className="text-gold-light font-bold hover:bg-gold-light/10">
                  Back to Homepage
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
