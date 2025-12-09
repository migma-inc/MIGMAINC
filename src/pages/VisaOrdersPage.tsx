import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PdfModal } from '@/components/ui/pdf-modal';
import { FileText, Eye } from 'lucide-react';

interface VisaOrder {
  id: string;
  order_number: string;
  product_slug: string;
  seller_id: string | null;
  client_name: string;
  client_email: string;
  total_price_usd: string;
  payment_status: string;
  payment_method: string;
  contract_pdf_url: string | null;
  created_at: string;
}

export const VisaOrdersPage = () => {
  const [orders, setOrders] = useState<VisaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('visa_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error loading orders:', error);
          return;
        }

        setOrders(data || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold migma-gold-text mb-8">Visa Orders</h1>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <CardTitle className="text-white">All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold-medium/30">
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order #</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Seller</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Total</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Contract</th>
                      <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5">
                        <td className="py-3 px-4 text-sm text-white font-mono">{order.order_number}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-white">{order.client_name}</p>
                            <p className="text-gray-400 text-xs">{order.client_email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-white">{order.product_slug}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">{order.seller_id || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gold-light font-bold">
                          ${parseFloat(order.total_price_usd).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(order.payment_status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {order.contract_pdf_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPdfUrl(order.contract_pdf_url);
                                setSelectedPdfTitle(`Contract - ${order.order_number}`);
                              }}
                              className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View PDF
                            </Button>
                          ) : (
                            <span className="text-gray-500 text-xs">Not generated</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Link to={`/dashboard/visa-orders/${order.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PDF Modal */}
      {selectedPdfUrl && (
        <PdfModal
          isOpen={!!selectedPdfUrl}
          onClose={() => setSelectedPdfUrl(null)}
          pdfUrl={selectedPdfUrl}
          title={selectedPdfTitle}
        />
      )}
    </div>
  );
};




