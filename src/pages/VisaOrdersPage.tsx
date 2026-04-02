import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PdfModal } from '@/components/ui/pdf-modal';
import { FileText, Eye, Download, ChevronDown, EyeOff, Archive, Undo2, Ticket, Search, RefreshCcw } from 'lucide-react';
import { regenerateVisaDocuments } from '@/lib/visa-utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from "@/components/ui/pagination";
import { AlertModal } from '@/components/ui/alert-modal';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

interface VisaOrder {
  id: string;
  order_number: string;
  product_slug: string;
  upsell_product_slug?: string | null;
  upsell_price_usd?: string | null;
  upsell_contract_pdf_url?: string | null;
  upsell_annex_pdf_url?: string | null;
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
  paid_at?: string | null;
  is_hidden?: boolean;
  parcelow_status?: string;
  coupon_code?: string | null;
  extra_units?: number;
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
  getProductName,
  isSignatureOnly = false,
  setActiveNote,
  setShowNoteModal,
  isRegenerating,
  handleRegenerate,
  sellersMap
}: {
  orders: VisaOrder[],
  calculateNetAmountAndFee: any,
  getStatusBadge: any,
  setSelectedPdfUrl: any,
  setSelectedPdfTitle: any,
  isUpdating: string | null,
  toggleHideOrder: any,
  getProductName: (slug: string) => string,
  isSignatureOnly?: boolean,
  setActiveNote: (note: string | null) => void,
  setShowNoteModal: (show: boolean) => void,
  isRegenerating: string | null,
  handleRegenerate: (orderId: string) => Promise<void>,
  sellersMap: Record<string, string>
}) => (
  <>
    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-medium/30">
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Order # / Date</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Client</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Product</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Seller</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">{isSignatureOnly ? 'Contract Value' : 'Total / Fee'}</th>
            {!isSignatureOnly && <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Net Amount</th>}
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Method</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Status</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Contract</th>
            <th className="text-left py-3 px-4 text-sm text-gray-400 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const { netAmount, feeAmount, totalPrice } = calculateNetAmountAndFee(order);
            return (
              <tr key={order.id} className="border-b border-gold-medium/10 hover:bg-white/5">
                <td className="py-3 px-4">
                  <p className="text-sm text-white font-mono">{order.order_number}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(order.paid_at ?? order.created_at).toLocaleDateString()}
                  </p>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <p className="text-white">{order.client_name}</p>
                      {(order.payment_metadata as any)?.admin_note && (
                        <button
                          onClick={() => {
                            setActiveNote((order.payment_metadata as any).admin_note);
                            setShowNoteModal(true);
                          }}
                          className="bg-gold-medium/20 p-1 rounded hover:bg-gold-medium/40 transition-colors"
                          title="View Admin Note"
                        >
                          <FileText className="w-3 h-3 text-gold-light" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs">{order.client_email}</p>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-white">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate max-w-[120px]" title={getProductName(order.product_slug)}>
                      {getProductName(order.product_slug)}
                    </span>
                    {order.upsell_product_slug && (
                      <span
                        className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded whitespace-nowrap font-semibold"
                        title={`+ ${order.upsell_product_slug} ($${parseFloat(order.upsell_price_usd || '0').toFixed(2)})`}
                      >
                        +${parseFloat(order.upsell_price_usd || '0').toFixed(0)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">{(order.seller_id && sellersMap[order.seller_id]) || order.seller_id || '-'}</td>
                <td className={`py-3 px-4 text-sm font-bold ${isSignatureOnly ? 'text-blue-400' : 'text-gold-light'}`}>
                  <div>${totalPrice.toFixed(2)}</div>
                  {!isSignatureOnly && (
                    <div className="text-[10px] font-normal mt-0.5 flex flex-col gap-0.5">
                      {feeAmount > 0 ? (
                        <span className="text-red-400">-${feeAmount.toFixed(2)} fee</span>
                      ) : (
                        <span className="text-gray-500">$0.00 fee</span>
                      )}

                      {order.coupon_code && (
                        <div className="flex items-center gap-1 text-green-400" title={`Cupom: ${order.coupon_code}`}>
                          <Ticket className="w-3 h-3" />
                          <span className="text-[10px] uppercase font-bold tracking-wider">{order.coupon_code}</span>
                        </div>
                      )}

                      {order.extra_units && order.extra_units > 0 ? (
                        <span className="text-blue-400">+{order.extra_units} dependent{order.extra_units > 1 ? 's' : ''}</span>
                      ) : null}
                    </div>
                  )}
                </td>
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
                  {getStatusBadge(order)}
                </td>

                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    {order.annex_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.annex_pdf_url);
                          const productName = getProductName(order.product_slug);
                          setSelectedPdfTitle(`${order.client_name} - ${productName} - ANNEX I`);
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
                          const productName = getProductName(order.product_slug);
                          setSelectedPdfTitle(`${order.client_name} - ${productName} - Contract`);
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
                          const productName = getProductName(order.product_slug);
                          // Pattern: Client Name - Service Name - Invoice
                          setSelectedPdfTitle(`${order.client_name} - ${productName} - Invoice`);
                        }}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Invoice
                      </Button>
                    )}
                    {/* Upsell PDFs */}
                    {order.upsell_annex_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.upsell_annex_pdf_url);
                          setSelectedPdfTitle(`ANNEX I (Upsell) - ${order.order_number}`);
                        }}
                        className="border-green-500/50 bg-black/50 text-green-400 hover:bg-black hover:border-green-500 hover:text-green-500 text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        ANNEX I (Upsell)
                      </Button>
                    )}
                    {order.upsell_contract_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.upsell_contract_pdf_url);
                          setSelectedPdfTitle(`Contract (Upsell) - ${order.order_number}`);
                        }}
                        className="border-green-500/50 bg-black/50 text-green-400 hover:bg-black hover:border-green-500 hover:text-green-500 text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Contract (Upsell)
                      </Button>
                    )}
                    {!order.annex_pdf_url && !order.contract_pdf_url && !(order.payment_metadata as any)?.invoice_pdf_url && (
                      <div className="flex flex-col gap-2">
                        <span className="text-amber-500/70 text-[10px] font-medium italic">
                          {order.payment_method === 'manual' ? 'Awaiting Approval' : 'Generating...'}
                        </span>
                        {(order.payment_status === 'completed' || order.payment_status === 'paid') && order.payment_method !== 'manual' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerate(order.id)}
                            disabled={isRegenerating === order.id}
                            className="h-7 border-gold-medium/30 bg-gold-medium/10 text-gold-light hover:bg-gold-medium/20 text-[10px] px-2 py-0"
                          >
                            {isRegenerating === order.id ? (
                              <RefreshCcw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCcw className="w-3 h-3 mr-1" />
                            )}
                            Retry Generation
                          </Button>
                        )}
                      </div>
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
                  {getStatusBadge(order)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div>
                  <p className="text-gray-400">Product</p>
                  <p className="text-white break-words">{order.product_slug}</p>
                  {order.upsell_product_slug && (
                    <p className="text-xs text-green-400 mt-0.5">
                      + {order.upsell_product_slug} (${parseFloat(order.upsell_price_usd || '0').toFixed(2)})
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-gray-400">{isSignatureOnly ? 'Value' : 'Total (with fee)'}</p>
                  <p className="text-gold-light font-bold">${totalPrice.toFixed(2)}</p>

                  {order.coupon_code && (
                    <div className="flex items-center gap-1 text-green-400 mt-1" title={`Cupom: ${order.coupon_code}`}>
                      <Ticket className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">{order.coupon_code}</span>
                    </div>
                  )}
                  {order.extra_units && order.extra_units > 0 ? (
                    <div className="text-[10px] text-blue-400 mt-1">+{order.extra_units} dependent{order.extra_units > 1 ? 's' : ''}</div>
                  ) : null}
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
                  <p className="text-white">{new Date(order.paid_at ?? order.created_at).toLocaleDateString()}</p>
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
                        const productName = getProductName(order.product_slug);
                        setSelectedPdfTitle(`${order.client_name} - ${productName} - ANNEX I`);
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
                        const productName = getProductName(order.product_slug);
                        setSelectedPdfTitle(`${order.client_name} - ${productName} - Contract`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-xs"
                    >
                      <FileText className="w-3 h-3" />
                      Contract
                    </Button>
                  )}
                </div>
                {/* Upsell PDFs Row */}
                {(order.upsell_annex_pdf_url || order.upsell_contract_pdf_url) && (
                  <div className="flex gap-2">
                    {order.upsell_annex_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.upsell_annex_pdf_url);
                          setSelectedPdfTitle(`ANNEX I (Upsell) - ${order.order_number}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 border-green-500/50 bg-black/50 text-green-400 hover:bg-black hover:border-green-500 hover:text-green-500 text-xs"
                      >
                        <FileText className="w-3 h-3" />
                        ANNEX I (Upsell)
                      </Button>
                    )}
                    {order.upsell_contract_pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPdfUrl(order.upsell_contract_pdf_url);
                          setSelectedPdfTitle(`Contract (Upsell) - ${order.order_number}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 border-green-500/50 bg-black/50 text-green-400 hover:bg-black hover:border-green-500 hover:text-green-500 text-xs"
                      >
                        <FileText className="w-3 h-3" />
                        Contract (Upsell)
                      </Button>
                    )}
                  </div>
                )}
                {!order.annex_pdf_url && !order.contract_pdf_url && !(order.payment_metadata as any)?.invoice_pdf_url && (
                  <div className="flex items-center justify-between p-2 bg-amber-500/5 rounded border border-amber-500/20">
                    <span className="text-amber-500/70 text-[10px] font-medium italic">
                      {order.payment_method === 'manual' ? 'Awaiting Approval' : 'Documents Generation Pending...'}
                    </span>
                    {(order.payment_status === 'completed' || order.payment_status === 'paid') && order.payment_method !== 'manual' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerate(order.id)}
                        disabled={isRegenerating === order.id}
                        className="h-7 border-gold-medium/30 bg-gold-medium/10 text-gold-light text-[10px]"
                      >
                        {isRegenerating === order.id ? <RefreshCcw className="animate-spin w-3 h-3 mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                        Retry
                      </Button>
                    )}
                  </div>
                )}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<VisaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('Contract PDF');
  const [products, setProducts] = useState<any[]>([]);
  const [sellersMap, setSellersMap] = useState<Record<string, string>>({});
  const [availableSellers, setAvailableSellers] = useState<{ id: string, name: string }[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const itemsPerPage = 30;
  const statusFilter = searchParams.get('status') || 'all';
  const sellerFilter = searchParams.get('seller') || 'all';
  const methodFilter = searchParams.get('method') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [totalCount, setTotalCount] = useState(0);

  const handleRegenerate = async (orderId: string) => {
    if (isRegenerating) return;
    setIsRegenerating(orderId);
    try {
      const result = await regenerateVisaDocuments(orderId);
      if (result.success) {
        setAlertData({
          title: 'Regeneration Started',
          message: 'Document generation has been requested. It may take a few moments to appear.',
          variant: 'success'
        });

        // Refresh orders after a short delay
        setTimeout(async () => {
          const { data } = await supabase.from('visa_orders').select('*').eq('id', orderId).single();
          if (data) {
            setOrders(prev => prev.map(o => o.id === orderId ? data : o));
          }
        }, 3000);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to regenerate documents',
          variant: 'error'
        });
      }
    } catch (err: any) {
      setAlertData({
        title: 'Error',
        message: err.message || 'An unexpected error occurred',
        variant: 'error'
      });
    } finally {
      setIsRegenerating(null);
      setShowAlert(true);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Build base query
        let query = supabase
          .from('visa_orders')
          .select('*', { count: 'exact' });

        // Apply filters
        if (!isLocal) {
          query = query.eq('is_test', false);
        }

        if (statusFilter !== 'all') {
          if (statusFilter === 'completed') {
            query = query.in('payment_status', ['completed', 'paid']);
          } else if (statusFilter === 'pending') {
            query = query.eq('payment_status', 'pending');
          }
        }

        if (sellerFilter !== 'all') {
          query = query.eq('seller_id', sellerFilter);
        }

        if (methodFilter !== 'all') {
          query = query.ilike('payment_method', `%${methodFilter}%`);
        }

        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,order_number.ilike.%${search}%,product_slug.ilike.%${search}%`);
        }

        // Add sorting and pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setOrders(data || []);
        setTotalCount(count || 0);

        // Load Products naming (cache manually for later)
        if (products.length === 0) {
          const { data: productsData } = await supabase
            .from('visa_products')
            .select('slug, name');
          setProducts(productsData || []);
        }

        // Load Sellers for identification (cache manually for later)
        if (Object.keys(sellersMap).length === 0) {
          const { data: sellersData } = await supabase
            .from('sellers')
            .select('seller_id_public, full_name');

          if (sellersData) {
            const sMap: Record<string, string> = {};
            sellersData.forEach(s => {
              sMap[s.seller_id_public] = s.full_name;
            });
            setSellersMap(sMap);
          }
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [statusFilter, sellerFilter, methodFilter, searchTerm, currentPage]);

  // Effect to update available sellers list based on current orders
  useEffect(() => {
    if (orders.length > 0 && Object.keys(sellersMap).length > 0) {
      const uniqueSellerIds = Array.from(new Set(orders.map(o => o.seller_id).filter(id => id)));
      const sellersList = uniqueSellerIds.map(id => ({
        id: id as string,
        name: sellersMap[id as string] || id as string
      })).sort((a, b) => a.name.localeCompare(b.name));

      setAvailableSellers(sellersList);
    }
  }, [orders, sellersMap]);

  // Effect to sync search term with URL and reset page
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);
      if (searchTerm) {
        newParams.set('search', searchTerm);
      } else {
        newParams.delete('search');
      }
      // Se mudar a busca, sempre volta pra página 1
      if (currentPage !== 1 && searchTerm !== (searchParams.get('search') || '')) {
        newParams.set('page', '1');
      }
      setSearchParams(newParams, { replace: true });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Helper to get product name
  const getProductName = (slug: string) => {
    return products.find(p => p.slug === slug)?.name || slug;
  };

  // Function updated to accept filter type
  const handleExportExcel = async (filterType: 'all' | 'completed' | 'pending' | 'real' = 'all') => {
    try {
      let filteredOrders = orders;

      if (filterType === 'completed') {
        filteredOrders = orders.filter(order => order.payment_status === 'completed' || order.payment_status === 'paid');
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

    // Filtra para remover cancelados e failed da visualização padrão
    const isCancelledOrFailed = order.payment_status === 'cancelled' || order.payment_status === 'failed';

    if (showHidden) return true;
    return !order.is_hidden && !isPendingParcelow && !isCancelledOrFailed;
  });

  const realOrders = visibleOrders.filter(order => order.payment_method !== 'manual');
  const signatureOrders = visibleOrders.filter(order => order.payment_method === 'manual');

  const getStatusBadge = (order: VisaOrder) => {
    const status = order.payment_status;

    // Detect abandoned Parcelow checkouts
    const isAbandonedParcelow = order.payment_method === 'parcelow' &&
      status === 'pending' &&
      (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');

    if (isAbandonedParcelow) {
      return (
        <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
          Abandoned
        </Badge>
      );
    }

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
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96 hidden md:block" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex gap-2 border-b border-white/5 pb-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>

          {/* Desktop Skeleton Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-white/5">
            <div className="bg-zinc-900/40 p-4 border-b border-white/5 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-4 bg-zinc-900/20 border-b border-white/5 flex gap-4 items-center">
                  <Skeleton className="h-6 w-24" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Skeleton Cards */}
          <div className="md:hidden space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-zinc-900/40 border-white/5 p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Visa Orders</h1>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar por nome, email ou pedido..."
                className="pl-10 bg-black/50 border-gold-medium/30 text-white placeholder:text-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="w-full md:w-64">
              <Select
                value={sellerFilter}
                onValueChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all') newParams.delete('seller');
                  else newParams.set('seller', val);
                  newParams.set('page', '1'); // Reset to page 1
                  setSearchParams(newParams);
                }}
              >
                <SelectTrigger className="bg-black/50 border-gold-medium/30 text-white">
                  <SelectValue placeholder="Filtrar por Vendedor" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">Todos os Vendedores</SelectItem>
                  {availableSellers.map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-48">
              <Select
                value={methodFilter}
                onValueChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all') newParams.delete('method');
                  else newParams.set('method', val);
                  newParams.set('page', '1'); // Reset to page 1
                  setSearchParams(newParams);
                }}
              >
                <SelectTrigger className="bg-black/50 border-gold-medium/30 text-white">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">Todos Métodos</SelectItem>
                  <SelectItem value="parcelow">Parcelow</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {isLocal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHidden(!showHidden)}
                  className={`border-gold-medium/30 bg-black/50 text-gold-light hover:bg-gold-medium/20 text-xs md:text-sm ${showHidden ? 'bg-gold-medium/40' : ''}`}
                >
                  {showHidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                  {showHidden ? 'Ver Apenas Reais' : 'Ver Todos'}
                </Button>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white border-none gap-2 text-sm font-medium h-9"
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
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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

            <div className="flex items-center gap-2 ml-auto px-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (statusFilter === 'completed') newParams.delete('status');
                  else newParams.set('status', 'completed');
                  newParams.set('page', '1'); // Reset to page 1
                  setSearchParams(newParams);
                }}
                className={`h-9 border-gold-medium/30 text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === 'completed'
                    ? 'bg-gold-medium text-black border-gold-medium shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                    : 'bg-black/50 text-gold-light hover:bg-gold-medium/20'
                  }`}
              >
                Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (statusFilter === 'pending') newParams.delete('status');
                  else newParams.set('status', 'pending');
                  newParams.set('page', '1'); // Reset to page 1
                  setSearchParams(newParams);
                }}
                className={`h-9 border-gold-medium/30 text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === 'pending'
                    ? 'bg-gold-medium text-black border-gold-medium shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                    : 'bg-black/50 text-gold-light hover:bg-gold-medium/20'
                  }`}
              >
                Pending
              </Button>
            </div>
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
                    getProductName={getProductName}
                    isUpdating={isUpdating}
                    toggleHideOrder={toggleHideOrder}
                    setActiveNote={setActiveNote}
                    setShowNoteModal={setShowNoteModal}
                    isRegenerating={isRegenerating}
                    handleRegenerate={handleRegenerate}
                    sellersMap={sellersMap}
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
                    getProductName={getProductName}
                    setActiveNote={setActiveNote}
                    setShowNoteModal={setShowNoteModal}
                    isSignatureOnly={true}
                    isRegenerating={isRegenerating}
                    handleRegenerate={handleRegenerate}
                    sellersMap={sellersMap}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        {totalCount > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / itemsPerPage)}
            onPageChange={(page) => {
              const newParams = new URLSearchParams(searchParams);
              newParams.set('page', page.toString());
              setSearchParams(newParams);
            }}
            itemsPerPage={itemsPerPage}
            totalItems={totalCount}
          />
        )}
      </div>

      {/* PDF Modal */}
      {selectedPdfUrl && (
        <PdfModal
          isOpen={!!selectedPdfUrl}
          onClose={() => setSelectedPdfUrl(null)}
          pdfUrl={selectedPdfUrl || ''}
          title={selectedPdfTitle}
        />
      )}

      <AlertModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Internal Admin Note"
        message={activeNote || ''}
        variant="info"
      />

      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertData?.title || ''}
        message={alertData?.message || ''}
        variant={alertData?.variant || 'info'}
      />
    </div>
  );
};
