import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PdfModal } from '@/components/ui/pdf-modal';
import { ImageModal } from '@/components/ui/image-modal';
import { CheckCircle, XCircle, Eye, Clock, Brain, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { AlertModal } from '@/components/ui/alert-modal';

interface ZelleOrder {
  id: string;
  order_number: string;
  product_slug: string;
  seller_id: string | null;
  client_name: string;
  client_email: string;
  client_whatsapp: string | null;
  total_price_usd: string;
  payment_status: string;
  zelle_proof_url: string | null;
  contract_pdf_url: string | null;
  created_at: string;
  updated_at: string;
  payment_metadata?: {
    n8n_validation?: {
      response?: string;
      confidence?: number;
      status?: string;
    };
  };
}

interface ZellePayment {
  id: string;
  payment_id: string;
  order_id: string;
  status: 'pending_verification' | 'approved' | 'rejected';
  n8n_response: any;
  n8n_confidence: number | null;
  n8n_validated_at: string | null;
  admin_notes: string | null;
}

export const ZelleApprovalPage = () => {
  const [orders, setOrders] = useState<ZelleOrder[]>([]);
  const [zellePayments, setZellePayments] = useState<Record<string, ZellePayment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ZelleOrder | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');
  const [selectedZelleUrl, setSelectedZelleUrl] = useState<string | null>(null);
  const [selectedZelleTitle, setSelectedZelleTitle] = useState<string>('Zelle Receipt');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      // Load orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('payment_method', 'zelle')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading Zelle orders:', ordersError);
        setAlertData({
          title: 'Error',
          message: 'Failed to load orders',
          variant: 'error',
        });
        setShowAlert(true);
        return;
      }

      setOrders(ordersData || []);

      // Load zelle_payments for these orders
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('zelle_payments')
          .select('*')
          .in('order_id', orderIds);

        if (!paymentsError && paymentsData) {
          const paymentsMap: Record<string, ZellePayment> = {};
          paymentsData.forEach((payment: any) => {
            paymentsMap[payment.order_id] = payment;
          });
          setZellePayments(paymentsMap);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setAlertData({
        title: 'Error',
        message: 'An unexpected error occurred',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (order: ZelleOrder) => {
    setSelectedOrder(order);
    setShowApproveConfirm(true);
  };

  const confirmApprove = async () => {
    if (!selectedOrder) return;

    setShowApproveConfirm(false);
    setIsProcessing(true);

    try {
      // Update order status to completed
      const { error: updateError } = await supabase
        .from('visa_orders')
        .update({
          payment_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (updateError) {
        throw updateError;
      }

      // Update zelle_payment status if exists
      const zellePayment = zellePayments[selectedOrder.id];
      if (zellePayment) {
        await supabase
          .from('zelle_payments')
          .update({
            status: 'approved',
            admin_approved_at: new Date().toISOString(),
            admin_notes: 'Approved manually by admin',
            updated_at: new Date().toISOString(),
          })
          .eq('id', zellePayment.id);
      }

      // Track payment completed in funnel
      if (selectedOrder.seller_id) {
        try {
          await supabase
            .from('seller_funnel_events')
            .insert({
              seller_id: selectedOrder.seller_id,
              product_slug: selectedOrder.product_slug,
              event_type: 'payment_completed',
              session_id: `order_${selectedOrder.id}`,
              metadata: {
                order_id: selectedOrder.id,
                order_number: selectedOrder.order_number,
                payment_method: 'zelle',
                total_amount: selectedOrder.total_price_usd,
              },
            });
        } catch (trackError) {
          console.error('Error tracking payment completed:', trackError);
          // Continue - tracking is not critical
        }
      }

      // Send confirmation email to client
      try {
        await supabase.functions.invoke('send-payment-confirmation-email', {
          body: {
            clientName: selectedOrder.client_name,
            clientEmail: selectedOrder.client_email,
            orderNumber: selectedOrder.order_number,
            productSlug: selectedOrder.product_slug,
            totalAmount: selectedOrder.total_price_usd,
            paymentMethod: 'zelle',
            currency: 'USD', // Zelle is always USD
            finalAmount: selectedOrder.total_price_usd, // Zelle has no fees
          },
        });
      } catch (emailError) {
        console.error('Error sending payment confirmation email:', emailError);
        // Continue even if email fails
      }

      // Send notification to seller if exists
      if (selectedOrder.seller_id) {
        console.log('Seller notification:', selectedOrder.seller_id);
        // TODO: Implement seller notification
      }

      // Send webhook to client (n8n) after Zelle payment approval
      try {
        await supabase.functions.invoke('send-zelle-webhook', {
          body: {
            order_id: selectedOrder.id,
          },
        });
      } catch (webhookError) {
        console.error('Error sending webhook after Zelle approval:', webhookError);
        // Continue even if webhook fails - payment is already approved
      }

      setAlertData({
        title: 'Success',
        message: 'Payment approved successfully! Email sent to client.',
        variant: 'success',
      });
      setShowAlert(true);

      // Reload orders
      await loadOrders();
    } catch (error) {
      console.error('Error approving payment:', error);
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to approve payment',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setSelectedOrder(null);
    }
  };

  const handleReject = (order: ZelleOrder) => {
    setSelectedOrder(order);
    setShowRejectConfirm(true);
  };

  const confirmReject = async () => {
    if (!selectedOrder) return;

    setShowRejectConfirm(false);
    setIsProcessing(true);

    try {
      // Update order status to failed
      const { error: updateError } = await supabase
        .from('visa_orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (updateError) {
        throw updateError;
      }

      // Update zelle_payment status if exists
      const zellePayment = zellePayments[selectedOrder.id];
      if (zellePayment) {
        await supabase
          .from('zelle_payments')
          .update({
            status: 'rejected',
            admin_notes: 'Rejected manually by admin',
            updated_at: new Date().toISOString(),
          })
          .eq('id', zellePayment.id);
      }

      // Send rejection email to client
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: selectedOrder.client_email,
            subject: `Payment Verification Issue - Order ${selectedOrder.order_number}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #dc2626;">Payment Verification Issue</h1>
                <p>Dear ${selectedOrder.client_name},</p>
                <p>We were unable to verify your Zelle payment for order ${selectedOrder.order_number}.</p>
                <p>Please contact us at info@migma.com to resolve this issue.</p>
                <h2 style="color: #333;">Order Details:</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${selectedOrder.order_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Product:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${selectedOrder.product_slug}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total:</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">US$ ${parseFloat(selectedOrder.total_price_usd).toFixed(2)}</td>
                  </tr>
                </table>
                <p style="margin-top: 20px;">If you have already made the payment, please contact us with your payment confirmation details.</p>
                <p>Best regards,<br>MIGMA Team</p>
              </div>
            `,
          },
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Continue even if email fails
      }

      setAlertData({
        title: 'Payment Rejected',
        message: 'Payment has been rejected. Email sent to client.',
        variant: 'success',
      });
      setShowAlert(true);

      // Reload orders
      await loadOrders();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to reject payment',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setSelectedOrder(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading Zelle orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Zelle Payment Approval</h1>
        <p className="text-gray-400">Review and approve pending Zelle payments</p>
      </div>

      {orders.length === 0 ? (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="py-12 text-center">
            <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No pending Zelle payments</p>
            <p className="text-gray-500 text-sm mt-2">All Zelle payments have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg text-white break-words">Order {order.order_number}</CardTitle>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">
                      {order.client_name} • {order.client_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const zellePayment = zellePayments[order.id];
                      const n8nData = zellePayment?.n8n_response || order.payment_metadata?.n8n_validation;
                      const confidence = zellePayment?.n8n_confidence || n8nData?.confidence;
                      
                      if (confidence !== null && confidence !== undefined) {
                        const confidencePercent = Math.round(confidence * 100);
                        return (
                          <Badge 
                            className={`${
                              confidence >= 0.7 
                                ? 'bg-green-500/20 text-green-300 border-green-500/50' 
                                : confidence >= 0.4
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                                : 'bg-red-500/20 text-red-300 border-red-500/50'
                            } flex items-center gap-1`}
                          >
                            <Brain className="w-3 h-3" />
                            {confidencePercent}% Confidence
                          </Badge>
                        );
                      }
                      return (
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
                          Pending Approval
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-400">Product:</span>
                    <span className="text-white ml-2">{order.product_slug}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total:</span>
                    <span className="text-gold-light font-bold ml-2">
                      US$ {parseFloat(order.total_price_usd).toFixed(2)}
                    </span>
                  </div>
                  {order.seller_id && (
                    <div>
                      <span className="text-gray-400">Seller:</span>
                      <span className="text-white ml-2">{order.seller_id}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Date:</span>
                    <span className="text-white ml-2">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {(() => {
                  const zellePayment = zellePayments[order.id];
                  const n8nData = zellePayment?.n8n_response || order.payment_metadata?.n8n_validation;
                  
                  if (n8nData || zellePayment?.n8n_response) {
                    const response = n8nData?.response || zellePayment?.n8n_response?.response;
                    const confidence = zellePayment?.n8n_confidence || n8nData?.confidence;
                    
                    return (
                      <div className="border-t border-gold-medium/30 pt-4">
                        <div className="flex items-start gap-2 mb-2">
                          <Brain className="w-4 h-4 text-gold-light mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gold-light mb-1">n8n Validation</p>
                            {response && (
                              <p className="text-xs text-gray-400 mb-1">{response}</p>
                            )}
                            {confidence !== null && confidence !== undefined && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400">Confidence:</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      confidence >= 0.7 ? 'bg-green-500' :
                                      confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-300">{Math.round(confidence * 100)}%</span>
                              </div>
                            )}
                            {!response && !confidence && (
                              <p className="text-xs text-gray-500">No n8n validation data available</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {order.zelle_proof_url && (
                  <div className="border-t border-gold-medium/30 pt-4">
                    <p className="text-sm text-gray-400 mb-2">Payment Receipt:</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedZelleUrl(order.zelle_proof_url);
                          setSelectedZelleTitle(`Zelle Receipt - ${order.order_number}`);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Receipt
                      </Button>
                    </div>
                  </div>
                )}

                {order.contract_pdf_url && (
                  <div className="border-t border-gold-medium/30 pt-4">
                    <p className="text-sm text-gray-400 mb-2">Contract PDF:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPdfUrl(order.contract_pdf_url);
                        setSelectedPdfTitle(`Contract - ${order.order_number}`);
                      }}
                      className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                    >
                      View Contract PDF
                    </Button>
                  </div>
                )}

                <div className="border-t border-gold-medium/30 pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={() => handleApprove(order)}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                  >
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    Approve Payment
                  </Button>
                  <Button
                    onClick={() => handleReject(order)}
                    disabled={isProcessing}
                    variant="destructive"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    Reject Payment
                  </Button>
                  <Link to={`/dashboard/visa-orders`} className="flex-1 sm:flex-none">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto flex items-center justify-center border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/20 text-xs sm:text-sm"
                    >
                      View All Orders
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg p-6 border border-gold-medium/30">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
            <p className="mt-4 text-white">Processing...</p>
          </div>
        </div>
      )}

      {/* Confirm Approve Modal */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        onClose={() => {
          setShowApproveConfirm(false);
          setSelectedOrder(null);
        }}
        onConfirm={confirmApprove}
        title="Approve Payment"
        message={`Are you sure you want to approve the payment for order ${selectedOrder?.order_number}? This will mark the payment as completed and send a confirmation email to the client.`}
        confirmText="Approve"
        variant="default"
        isLoading={isProcessing}
      />

      {/* Confirm Reject Modal */}
      <ConfirmModal
        isOpen={showRejectConfirm}
        onClose={() => {
          setShowRejectConfirm(false);
          setSelectedOrder(null);
        }}
        onConfirm={confirmReject}
        title="Reject Payment"
        message={`Are you sure you want to reject the payment for order ${selectedOrder?.order_number}? This will mark the payment as failed and notify the client.`}
        confirmText="Reject"
        variant="danger"
        isLoading={isProcessing}
      />

      {/* Alert Modal */}
      {alertData && (
        <AlertModal
          isOpen={showAlert}
          onClose={() => {
            setShowAlert(false);
            setAlertData(null);
          }}
          title={alertData.title}
          message={alertData.message}
          variant={alertData.variant}
        />
      )}

      {/* PDF Modal */}
      {selectedPdfUrl && (
        <PdfModal
          isOpen={!!selectedPdfUrl}
          onClose={() => setSelectedPdfUrl(null)}
          pdfUrl={selectedPdfUrl}
          title={selectedPdfTitle}
        />
      )}

      {/* Zelle Receipt Modal */}
      {selectedZelleUrl && (
        <ImageModal
          isOpen={!!selectedZelleUrl}
          onClose={() => setSelectedZelleUrl(null)}
          imageUrl={selectedZelleUrl}
          title={selectedZelleTitle}
        />
      )}
    </div>
  );
};




