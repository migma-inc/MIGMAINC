import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Eye, ExternalLink, Clock } from 'lucide-react';
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
}

export const ZelleApprovalPage = () => {
  const [orders, setOrders] = useState<ZelleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ZelleOrder | null>(null);
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
      const { data, error } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('payment_method', 'zelle')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading Zelle orders:', error);
        setAlertData({
          title: 'Error',
          message: 'Failed to load orders',
          variant: 'error',
        });
        setShowAlert(true);
        return;
      }

      setOrders(data || []);
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
        await supabase.functions.invoke('send-email', {
          body: {
            to: selectedOrder.client_email,
            subject: `Payment Confirmed - Order ${selectedOrder.order_number}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #D4AF37;">Payment Confirmed</h1>
                <p>Dear ${selectedOrder.client_name},</p>
                <p>We have received and verified your Zelle payment for your visa application.</p>
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
                <p style="margin-top: 20px;">Our team will contact you shortly to begin the visa application process.</p>
                <p>Best regards,<br>MIGMA Team</p>
              </div>
            `,
          },
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Continue even if email fails
      }

      // Send notification to seller if exists
      if (selectedOrder.seller_id) {
        console.log('Seller notification:', selectedOrder.seller_id);
        // TODO: Implement seller notification
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Zelle Payment Approval</h1>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Order {order.order_number}</CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      {order.client_name} • {order.client_email}
                    </p>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
                    Pending Approval
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
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

                {order.zelle_proof_url && (
                  <div className="border-t border-gold-medium/30 pt-4">
                    <p className="text-sm text-gray-400 mb-2">Payment Receipt:</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={order.zelle_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-gold-light hover:text-gold-medium"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Receipt
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                    {order.zelle_proof_url.match(/\.(jpg|jpeg|png|gif)$/i) && (
                      <div className="mt-3">
                        <img
                          src={order.zelle_proof_url}
                          alt="Payment receipt"
                          className="max-w-md rounded-md border border-gold-medium/30"
                        />
                      </div>
                    )}
                  </div>
                )}

                {order.contract_pdf_url && (
                  <div className="border-t border-gold-medium/30 pt-4">
                    <p className="text-sm text-gray-400 mb-2">Contract PDF:</p>
                    <a
                      href={order.contract_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-gold-light hover:text-gold-medium"
                    >
                      View Contract PDF
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}

                <div className="border-t border-gold-medium/30 pt-4 flex gap-3">
                  <Button
                    onClick={() => handleApprove(order)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Payment
                  </Button>
                  <Button
                    onClick={() => handleReject(order)}
                    disabled={isProcessing}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Payment
                  </Button>
                  <Link to={`/dashboard/visa-orders`}>
                    <Button
                      variant="outline"
                      className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/20"
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
    </div>
  );
};


