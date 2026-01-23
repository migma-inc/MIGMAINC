import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PdfModal } from '@/components/ui/pdf-modal';
import { FileText, Eye, Download, ChevronDown, EyeOff, Archive, Undo2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

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
  payment_metadata?: { fee_amount?: string | number, total_usd?: string | number, final_amount?: string | number, order_amount?: string | number } | null; // Include payment_metadata to access fee_amount and real total
  contract_pdf_url: string | null;
  annex_pdf_url: string | null;
  created_at: string;
  is_hidden?: boolean;
  parcelow_status?: string;
}

// Helper function to calculate net amount and fee
// Helper function to calculate net amount and fee
const calculateNetAmountAndFee = (order: VisaOrder) => {
  let dbPrice = parseFloat(order.total_price_usd || '0');

  // Fix for total_price_usd being in cents (Heuristic: > 10000 means likely cents for values > $100)
  // However, for values < $100 stored as cents (e.g. 2900), this stays 2900 if threshold is 10000.
  // We'll keep this but improve metadata checks.
  if (dbPrice > 10000) {
    dbPrice = dbPrice / 100;
  }

  const metadata = order.payment_metadata;
  let feeAmount = 0;
  let totalPrice = dbPrice;
  let netAmount = dbPrice;

  // Parcelow Logic: Fees are added ON TOP of the base price
  // DB Price = Net Amount (Base)
  // Metadata Total = Gross Amount (Total Paid)
  if (order.payment_method === 'parcelow') {
    let paidTotal = dbPrice; // Fallback

    if (metadata?.total_usd) {
      let val = parseFloat(metadata.total_usd.toString());
      // Heuristic: If metadata total is > 5x the DB price, it's likely in cents (e.g. 29.00 vs 3387)
      // This handles both old (cents) and new (decimal) data.
      if (val > (dbPrice * 5) && val > 100) val = val / 100;
      if (val > 0) paidTotal = val;
    } else if (metadata?.final_amount) {
      let val = parseFloat(metadata.final_amount.toString());
      if (val > (dbPrice * 5) && val > 100) val = val / 100;
      if (val > 0) paidTotal = val;
    }

    totalPrice = paidTotal;
    netAmount = dbPrice;
    feeAmount = Math.max(totalPrice - netAmount, 0);
  }
  // Stripe Logic (Card/Pix) / Default: Fees are DEDUCTED from the total
  // DB Price = Gross Amount (Total Paid)
  // Metadata Fee = Fee Amount
  // Net Amount = Total - Fee
  else {
    totalPrice = dbPrice;

    if (metadata?.fee_amount) {
      let val = parseFloat(metadata.fee_amount.toString());
      // If fee is suspiciously high (e.g. > total/2), it might be in cents
      if (val > (totalPrice / 2) && val > 100) val = val / 100;
      feeAmount = val;
    }

    netAmount = totalPrice - feeAmount;
  }

  return {
    netAmount: Math.max(netAmount, 0),
    feeAmount: feeAmount,
    totalPrice: totalPrice
  };
};

// Internal component for the order list to avoid duplication between tabs
const OrderTable = ({
  orders,
  calculateNetAmountAndFee,
  getStatusBadge,
  setSelectedPdfUrl,
  setSelectedPdfTitle,
  isUpdating,
  toggleHideOrder,
  isSignatureOnly = false
}: {
  orders: VisaOrder[],
  calculateNetAmountAndFee: any,
  getStatusBadge: any,
  setSelectedPdfUrl: any,
  setSelectedPdfTitle: any,
  isUpdating: string | null,
  toggleHideOrder: any,
  isSignatureOnly?: boolean
}) => (
  <>
    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-medium/30">
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order #</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Seller</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">{isSignatureOnly ? 'Contract Value' : 'Total (with fee)'}</th>
            {!isSignatureOnly && <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Fee</th>}
            {!isSignatureOnly && <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Net Amount</th>}
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Method</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Date</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Contract</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
            return (
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
                <td className={`py-3 px-4 text-sm font-bold ${isSignatureOnly ? 'text-blue-400' : 'text-gold-light'}`}>
                  ${totalPrice.toFixed(2)}
                </td>
                {!isSignatureOnly && (
                  <td className="py-3 px-4 text-sm text-gray-400">
                    {feeAmount > 0 ? (
                      <span className="text-red-400">-${feeAmount.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-500">$0.00</span>
                    )}
                  </td>
                )}
                {!isSignatureOnly && (
                  <td className="py-3 px-4 text-sm text-white font-semibold">
                    ${netAmount.toFixed(2)}
                  </td>
                )}
                <td className="py-3 px-4">
                  <Badge
                    variant="outline"
                    className={`whitespace-nowrap px-3 py-1 font-medium border-gold-medium/30 ${order.payment_method === 'manual'
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      : isSignatureOnly ? 'text-blue-400' : 'text-gold-light'
                      }`}
                  >
                    {order.payment_method === 'manual' ? 'Manual by Seller' : order.payment_method}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  {getStatusBadge(order.payment_status)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    {order.annex_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.annex_pdf_url);
                          setSelectedPdfTitle(`ANNEX I - ${order.order_number}`);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        ANNEX I
                      </Button>
                    )}
                    {order.contract_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.contract_pdf_url);
                          setSelectedPdfTitle(`Contract - ${order.order_number}`);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Contract
                      </Button>
                    )}
                    {(order.payment_metadata as any)?.invoice_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl((order.payment_metadata as any).invoice_pdf_url);
                          setSelectedPdfTitle(`Invoice - ${order.order_number}`);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Invoice
                      </Button>
                    )}
                    {!order.annex_pdf_url && !order.contract_pdf_url && !(order.payment_metadata as any)?.invoice_pdf_url && (
                      <span className="text-amber-500/70 text-[10px] font-medium italic">
                        {order.payment_method === 'manual' ? 'Awaiting Approval' : 'Generating...'}
                      </span>
                    )}
                  </div>
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
                  {isLocal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isUpdating === order.id}
                      onClick={() => toggleHideOrder(order.id, !!order.is_hidden)}
                      className={`mt-1 w-full flex items-center gap-2 text-xs ${order.is_hidden ? 'text-green-400' : 'text-gray-500 hover:text-red-400'}`}
                    >
                      {order.is_hidden ? <Undo2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      {order.is_hidden ? 'Mostrar' : 'Ocultar'}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Mobile Cards */}
    <div className="md:hidden space-y-4">
      {orders.map((order) => {
        const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);

        return (
          <Card key={order.id} className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gold-light font-semibold">{order.order_number}</p>
                  <p className="text-base font-semibold text-white mt-1 break-words">{order.client_name}</p>
                  <p className="text-xs text-gray-400 truncate">{order.client_email}</p>
                </div>
                <div className="ml-2">
                  {getStatusBadge(order.payment_status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div>
                  <p className="text-gray-400">Product</p>
                  <p className="text-white break-words">{order.product_slug}</p>
                </div>
                <div>
                  <p className="text-gray-400">{isSignatureOnly ? 'Value' : 'Total (with fee)'}</p>
                  <p className="text-gold-light font-bold">${totalPrice.toFixed(2)}</p>
                </div>
                {!isSignatureOnly && (
                  <div>
                    <p className="text-gray-400">Net Amount</p>
                    <p className="text-white font-semibold">${netAmount.toFixed(2)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400">Method</p>
                  <Badge
                    variant="outline"
                    className={`whitespace-nowrap px-2 py-0 text-[10px] font-medium border-gold-medium/30 ${order.payment_method === 'manual'
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      : 'text-gold-light'
                      }`}
                  >
                    {order.payment_method === 'manual' ? 'Manual by Seller' : order.payment_method}
                  </Badge>
                </div>
                {!isSignatureOnly && (
                  <div>
                    <p className="text-gray-400">Fee</p>
                    <p className="text-red-400">${feeAmount > 0 ? `-${feeAmount.toFixed(2)}` : '0.00'}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400">Seller</p>
                  <p className="text-white">{order.seller_id || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Date</p>
                  <p className="text-white">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-gold-medium/20">
                <div className="flex gap-2">
                  {order.annex_pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPdfUrl(order.annex_pdf_url);
                        setSelectedPdfTitle(`ANNEX I - ${order.order_number}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                    >
                      <FileText className="w-3 h-3" />
                      ANNEX I
                    </Button>
                  )}
                  {order.contract_pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPdfUrl(order.contract_pdf_url);
                        setSelectedPdfTitle(`Contract - ${order.order_number}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                    >
                      <FileText className="w-3 h-3" />
                      Contract
                    </Button>
                  )}
                </div>
                <Link to={`/dashboard/visa-orders/${order.id}`} className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs"
                  >
                    <Eye className="w-3 h-3" />
                    View Details
                  </Button>
                </Link>
                {isLocal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUpdating === order.id}
                    onClick={() => toggleHideOrder(order.id, !!order.is_hidden)}
                    className={`w-full flex items-center justify-center gap-2 text-xs ${order.is_hidden ? 'text-green-400' : 'text-gray-500'}`}
                  >
                    {order.is_hidden ? <Undo2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    {order.is_hidden ? 'Mostrar na Lista' : 'Ocultar Pedido'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  </>
);

export const VisaOrdersPage = () => {
  const [orders, setOrders] = useState<VisaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
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

  // Function updated to accept filter type
  const handleExportExcel = async (filterType: 'all' | 'completed' | 'pending' | 'real' = 'all') => {
    try {
      let filteredOrders = orders;

      if (filterType === 'completed') {
        filteredOrders = orders.filter(order => order.payment_status === 'completed');
      } else if (filterType === 'pending') {
        filteredOrders = orders.filter(order => order.payment_status === 'pending');
      } else if (filterType === 'real') {
        filteredOrders = orders.filter(order => !order.is_hidden);
      }

      const { exportVisaOrdersToExcel } = await import('@/lib/visaOrdersExport');
      await exportVisaOrdersToExcel(filteredOrders);
    } catch (error) {
      console.error('Failed to export excel:', error);
    }
  };

  const toggleHideOrder = async (orderId: string, currentStatus: boolean) => {
    try {
      setIsUpdating(orderId);
      const { error } = await supabase
        .from('visa_orders')
        .update({ is_hidden: !currentStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(o => o.id === orderId ? { ...o, is_hidden: !currentStatus } : o));
    } catch (err) {
      console.error('Error updating order visibility:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  const visibleOrders = orders.filter(order => {
    // Definimos como "abandonado" ou "em espera" pedidos Parcelow que não foram concluídos
    const isPendingParcelow = order.payment_method === 'parcelow' &&
      order.payment_status === 'pending' &&
      (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');

    if (showHidden) return true;
    return !order.is_hidden && !isPendingParcelow;
  });

  const realOrders = visibleOrders.filter(order => order.payment_method !== 'manual');
  const signatureOrders = visibleOrders.filter(order => order.payment_method === 'manual');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>;
      case 'manual_pending':
        return (
          <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/50 animate-pulse whitespace-nowrap">
            Awaiting Approval
          </Badge>
        );
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Cancelled</Badge>;
      default:
        return <Badge className="capitalize">{status.replace('_', ' ')}</Badge>;
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
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Visa Orders</h1>

          <div className="flex flex-wrap items-center gap-2">
            {isLocal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
                className={`border-gold-medium/30 bg-black/50 text-gold-light hover:bg-gold-medium/20 text-xs md:text-sm ${showHidden ? 'bg-gold-medium/40' : ''}`}
              >
                {showHidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showHidden ? 'Ver Apenas Reais' : 'Ver Todos (Incluindo Ocultos)'}
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white border-none gap-2 text-sm font-medium h-9 sm:h-10 px-4"
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal"
                    onClick={() => handleExportExcel('all')}
                  >
                    Exportar Todos
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal"
                    onClick={() => handleExportExcel('completed')}
                  >
                    Apenas Pagos
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal"
                    onClick={() => handleExportExcel('pending')}
                  >
                    Apenas Pendentes
                  </Button>
                  {isLocal && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal"
                      onClick={() => handleExportExcel('real')}
                    >
                      Exportar Reais (Sem Ocultos)
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs defaultValue="real" className="space-y-6">
          <TabsList className="bg-black/50 border border-gold-medium/30 p-1 h-auto flex-wrap">
            <TabsTrigger
              value="real"
              className="data-[state=active]:bg-gold-medium data-[state=active]:text-black text-gray-400 px-4 py-2"
            >
              Real Orders ({realOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="signatures"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 px-4 py-2"
            >
              Manual / Signature Only ({signatureOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="real">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-white">
                  {showHidden ? 'All Orders (Including Hidden)' : 'Real Orders'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {realOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm sm:text-base">
                      {showHidden ? 'No orders found' : 'No real orders found.'}
                    </p>
                  </div>
                ) : (
                  <OrderTable
                    orders={realOrders}
                    calculateNetAmountAndFee={calculateNetAmountAndFee}
                    getStatusBadge={getStatusBadge}
                    setSelectedPdfUrl={setSelectedPdfUrl}
                    setSelectedPdfTitle={setSelectedPdfTitle}
                    isUpdating={isUpdating}
                    toggleHideOrder={toggleHideOrder}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatures">
            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 border border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-white">
                  Manual Payments & Signature Only
                </CardTitle>
                <p className="text-sm text-blue-200/70 mt-1">
                  Orders generated via "Sign Link" or with manual payment. These contracts require manual approval to be processed.
                </p>
              </CardHeader>
              <CardContent>
                {signatureOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm sm:text-base">No signature-only contracts found.</p>
                  </div>
                ) : (
                  <OrderTable
                    orders={signatureOrders}
                    calculateNetAmountAndFee={calculateNetAmountAndFee}
                    getStatusBadge={getStatusBadge}
                    setSelectedPdfUrl={setSelectedPdfUrl}
                    setSelectedPdfTitle={setSelectedPdfTitle}
                    isUpdating={isUpdating}
                    toggleHideOrder={toggleHideOrder}
                    isSignatureOnly={true}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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




