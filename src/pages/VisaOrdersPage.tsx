import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PdfModal } from '@/components/ui/pdf-modal';
import { FileText, Eye, Download, ChevronDown, Archive, Undo2, Ticket, Search, RefreshCcw, User } from 'lucide-react';
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
import { calculateOrderAmounts } from '@/lib/seller-commissions';
import { PeriodFilter, type PeriodOption, type CustomDateRange } from '@/components/seller/PeriodFilter';

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
  is_split_payment?: boolean;
  split_payment_id?: string | null;
  split_payment?: {
    id: string;
    split_count: number | null;
    overall_status: string | null;
    part1_payment_status: string | null;
    part2_payment_status: string | null;
  } | null;
}

type ExportFilterType = 'all' | 'completed' | 'pending' | 'real';
const VISA_ORDERS_SELECT = `
  *,
  split_payment:split_payments!visa_orders_split_payment_id_fkey(
    id,
    split_count,
    overall_status,
    part1_payment_status,
    part2_payment_status
  )
`;

// Helper function to calculate net amount and fee
// Helper function to calculate net amount and fee
const calculateNetAmountAndFee = (order: VisaOrder) => calculateOrderAmounts(order);

const isPendingParcelowOrder = (order: VisaOrder) =>
  order.payment_method === 'parcelow' &&
  order.payment_status === 'pending' &&
  (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');

const shouldDisplayOrder = (order: VisaOrder) => {
  const isCancelled = order.payment_status === 'cancelled';

  return !order.is_hidden && !isPendingParcelowOrder(order) && !isCancelled;
};

const matchesActiveTab = (order: VisaOrder, tab: 'real' | 'signatures') => {
  const isManualOrder = order.payment_method === 'manual';

  if (tab === 'signatures') {
    return isManualOrder;
  }

  return !isManualOrder;
};

const getSplitPaymentPartsPaid = (order: VisaOrder) => {
  const splitPayment = order.split_payment;
  if (!order.is_split_payment || !splitPayment) return 0;

  return [splitPayment.part1_payment_status, splitPayment.part2_payment_status].filter(
    (status) => status === 'completed'
  ).length;
};

const getSplitPaymentProgressData = (order: VisaOrder) => {
  const splitPayment = order.split_payment;
  if (!order.is_split_payment || !splitPayment) return null;

  const paidParts = getSplitPaymentPartsPaid(order);
  const splitCount = splitPayment.split_count ?? 2;
  const isComplete =
    splitPayment.overall_status === 'fully_completed' ||
    (splitPayment.part1_payment_status === 'completed' && splitPayment.part2_payment_status === 'completed');

  return {
    fraction: `${paidParts}/${splitCount}`,
    isComplete,
  };
};

// Internal component for the order list to avoid duplication between tabs
const OrderTable = ({
  orders,
  calculateNetAmountAndFee,
  getStatusBadge,
  getSplitPaymentProgressData,
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
  getSplitPaymentProgressData: (order: VisaOrder) => { fraction: string; isComplete: boolean } | null,
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
            const splitProgress = getSplitPaymentProgressData(order);
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
                    {order.payment_method === 'manual'
                      ? 'Manual by Seller'
                      : order.payment_method === 'square_card'
                        ? 'Square Card'
                        : order.payment_method}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(order)}
                    {splitProgress && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex min-w-[34px] items-center justify-center rounded-md border border-gold-medium/30 bg-gold-medium/12 px-2 py-0.5 text-[11px] font-extrabold leading-none tracking-tight text-gold-light">
                          {splitProgress.fraction}
                        </span>
                        {splitProgress.isComplete && (
                          <span className="text-[11px] font-semibold text-gold-light whitespace-nowrap">
                            Complete
                          </span>
                        )}
                      </div>
                    )}
                  </div>
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
                      onClick={() => toggleHideOrder(order.id, !!order.is_hidden, order.payment_status)}
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
        const splitProgress = getSplitPaymentProgressData(order);

        return (
          <Card key={order.id} className="bg-[#0f0f0f] border border-gold-medium/20 rounded-xl overflow-hidden shadow-lg shadow-black/50">
            <CardContent className="p-4 sm:p-5">
              
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border border-gold-medium/30 flex items-center justify-center bg-black text-gray-400 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-black text-sm sm:text-base leading-tight uppercase truncate">
                    {order.client_name}
                  </h3>
                </div>
              </div>

              {/* Sub Info Row */}
              <div className="mt-3 flex items-center justify-between gap-2 overflow-hidden">
                <span className="text-[10px] sm:text-xs text-gray-400 font-bold truncate uppercase tracking-normal min-w-0 flex-1">
                  {order.client_email}
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-gray-300 whitespace-nowrap shrink-0 border border-white/5">
                  {order.product_slug.substring(0, 15)}
                </span>
              </div>
              
              <div className="mt-1.5 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                DATE: {new Date(order.paid_at ?? order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                <span className="ml-1 opacity-70 border-l border-gray-700 pl-1">{order.order_number}</span>
              </div>

              {/* Status Row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {getStatusBadge(order)}
                {splitProgress && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-gold-medium/30 bg-gold-medium/10 text-[10px] font-extrabold text-gold-light">
                    SPLIT: {splitProgress.fraction}
                    {splitProgress.isComplete && <span className="text-green-400">✓</span>}
                  </span>
                )}
                {order.coupon_code && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-green-500/20 bg-green-500/10 text-[9px] font-bold text-green-400 uppercase max-w-full truncate">
                    <Ticket className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{order.coupon_code}</span>
                  </span>
                )}
              </div>

              {/* Information Inner Box - Mimicking "LEGAL RECORDS" */}
              <div className="mt-4 p-3.5 rounded-lg bg-zinc-950 border border-white/5 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-gold-medium text-[10px] font-black tracking-widest uppercase mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  ORDER DETAILS
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0"></div>
                  <span className="text-gray-500 font-bold uppercase w-16 shrink-0 text-[10px] tracking-wider">TOTAL</span>
                  <span className="text-white font-bold">${totalPrice.toFixed(2)}</span>
                  {order.extra_units && order.extra_units > 0 ? (
                    <span className="text-[9px] text-blue-400 font-bold tracking-wide italic ml-1">+{order.extra_units} Dep.</span>
                  ) : null}
                </div>

                {!isSignatureOnly && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0"></div>
                    <span className="text-gray-500 font-bold uppercase w-16 shrink-0 text-[10px] tracking-wider">NET + FEE</span>
                    <span className="text-white font-semibold">${netAmount.toFixed(2)} <span className="text-red-400/80 font-normal">(-${feeAmount.toFixed(2)})</span></span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0"></div>
                  <span className="text-gray-500 font-bold uppercase w-16 shrink-0 text-[10px] tracking-wider">METHOD</span>
                  <span className="text-white uppercase text-[10px] font-bold truncate">
                    {order.payment_method === 'manual' ? 'MANUAL' : order.payment_method === 'square_card' ? 'SQUARE' : order.payment_method}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/40 shrink-0"></div>
                  <span className="text-gray-500 font-bold uppercase w-16 shrink-0 text-[10px] tracking-wider">SELLER</span>
                  <span className="text-gray-300 text-[10px] uppercase font-bold truncate">{(order.seller_id && sellersMap[order.seller_id]) || order.seller_id || 'UNKNOWN'}</span>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {/* PDF Buttons */}
                {order.annex_pdf_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfUrl(order.annex_pdf_url);
                      setSelectedPdfTitle(`${order.client_name} - ANNEX I`);
                    }}
                    className="flex items-center gap-1.5 bg-[#121212] border border-white/5 hover:bg-[#1a1a1a] hover:border-gold-medium/30 text-gold-light text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">ANNEX</span>
                  </Button>
                )}
                {order.contract_pdf_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfUrl(order.contract_pdf_url);
                      setSelectedPdfTitle(`${order.client_name} - Contract`);
                    }}
                    className="flex items-center gap-1.5 bg-[#121212] border border-white/5 hover:bg-[#1a1a1a] hover:border-gold-medium/30 text-gold-light text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">CONTRACT</span>
                  </Button>
                )}
                {(order.payment_metadata as any)?.invoice_pdf_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfUrl((order.payment_metadata as any).invoice_pdf_url);
                      setSelectedPdfTitle(`${order.client_name} - Invoice`);
                    }}
                    className="flex items-center justify-center col-span-2 sm:col-span-1 gap-1.5 bg-[#121212] border border-white/5 hover:bg-[#1a1a1a] hover:border-gold-medium/30 text-white text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    INVOICE
                  </Button>
                )}

                {/* View Details Box spanning what is available */}
                <Link to={`/dashboard/visa-orders/${order.id}`} className="col-span-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2 bg-[#121212] border border-white/5 hover:bg-[#1a1a1a] hover:border-gold-medium/30 text-gold-medium text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2 w-full"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">VIEW FULL DETAILS</span>
                  </Button>
                </Link>

                {/* Upsells */}
                {order.upsell_annex_pdf_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfUrl(order.upsell_annex_pdf_url);
                      setSelectedPdfTitle(`ANNEX I (Upsell)`);
                    }}
                    className="flex items-center gap-1.5 bg-[#121212] border border-green-500/10 hover:bg-[#1a1a1a] hover:border-green-500/30 text-green-400 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">UP. ANNEX</span>
                  </Button>
                )}
                {order.upsell_contract_pdf_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfUrl(order.upsell_contract_pdf_url);
                      setSelectedPdfTitle(`Contract (Upsell)`);
                    }}
                    className="flex items-center gap-1.5 bg-[#121212] border border-green-500/10 hover:bg-[#1a1a1a] hover:border-green-500/30 text-green-400 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase h-10 px-2"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">UP. CONTRACT</span>
                  </Button>
                )}
              </div>

              {/* Admin specific buttons */}
              {isLocal && (
                <div className="pt-4 mt-4 border-t border-white/5 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUpdating === order.id}
                    onClick={() => toggleHideOrder(order.id, !!order.is_hidden, order.payment_status)}
                    className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider h-8 ${order.is_hidden ? 'text-green-400' : 'text-gray-500 hover:text-red-400'}`}
                  >
                    {order.is_hidden ? <Undo2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    {order.is_hidden ? 'SHOW' : 'HIDE'}
                  </Button>
                </div>
              )}
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
  
  // Persist activeTab in URL
  const activeTab = (searchParams.get('tab') as 'real' | 'signatures') || 'real';
  const setActiveTab = (val: 'real' | 'signatures') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', val);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  };

  const initialSearch = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
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
  
  // Period filter states (synced with URL)
  const periodFilter = (searchParams.get('period') as PeriodOption) || 'all_time';
  const customRange: CustomDateRange = {
    start: searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: searchParams.get('end') || new Date().toISOString().split('T')[0]
  };

  const setPeriodFilter = (val: PeriodOption) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('period', val);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  };

  const setCustomDateRange = (range: CustomDateRange) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('start', range.start);
    newParams.set('end', range.end);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  };

  const [totalCount, setTotalCount] = useState(0);

  const buildOrdersQuery = ({
    search,
    exportFilterType = 'all',
  }: {
    search: string;
    exportFilterType?: ExportFilterType;
  }) => {
    let query = supabase
      .from('visa_orders')
      .select(VISA_ORDERS_SELECT);

    if (!isLocal) {
      query = query.eq('is_test', false);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        query = query.in('payment_status', ['completed', 'paid']);
      } else if (statusFilter === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (statusFilter === 'failed') {
        query = query.eq('payment_status', 'failed');
      }
    }

    if (sellerFilter !== 'all') {
      query = query.eq('seller_id', sellerFilter);
    }

    if (methodFilter !== 'all') {
      query = query.ilike('payment_method', `%${methodFilter}%`);
    }

    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      query = query.or(`client_name.ilike.%${normalizedSearch}%,client_email.ilike.%${normalizedSearch}%,order_number.ilike.%${normalizedSearch}%,product_slug.ilike.%${normalizedSearch}%`);
    }

    if (exportFilterType === 'completed') {
      query = query.in('payment_status', ['completed', 'paid']);
    } else if (exportFilterType === 'pending') {
      query = query.eq('payment_status', 'pending');
    }

    // Apply Period Filter
    if (periodFilter !== 'all_time') {
      let start: Date | null = null;
      let end: Date | null = null;
      const now = new Date();

      if (periodFilter === 'thismonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (periodFilter === 'lastmonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else if (periodFilter === 'custom') {
        start = new Date(customRange.start + 'T00:00:00');
        end = new Date(customRange.end + 'T23:59:59');
      }

      if (start && end) {
        // Filter by paid_at if available, otherwise created_at
        // Using or because some orders might not have paid_at yet
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }
    }

    return query;
  };

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
          const { data } = await supabase
            .from('visa_orders')
            .select(VISA_ORDERS_SELECT)
            .eq('id', orderId)
            .single();
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
    const loadData = async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        const batchSize = 1000;
        const allFilteredOrders: VisaOrder[] = [];
        let from = 0;

        while (true) {
          const { data, error } = await buildOrdersQuery({
            search: searchTerm,
          })
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);

          if (error) throw error;

          const currentBatch = data || [];
          allFilteredOrders.push(...currentBatch);

          if (currentBatch.length < batchSize) {
            break;
          }

          from += batchSize;
        }

        const visibleFilteredOrders = allFilteredOrders
          .filter(order => matchesActiveTab(order, activeTab))
          .filter(order => {
            if (statusFilter === 'failed') return !order.is_hidden;
            return shouldDisplayOrder(order);
          })
          .sort((a, b) => {
            const dateA = new Date(a.paid_at ?? a.created_at).getTime();
            const dateB = new Date(b.paid_at ?? b.created_at).getTime();
            return dateB - dateA;
          });
        const totalVisibleOrders = visibleFilteredOrders.length;
        const currentPageSafe = Math.max(currentPage, 1);
        const startIndex = (currentPageSafe - 1) * itemsPerPage;

        setTotalCount(totalVisibleOrders);
        setOrders(visibleFilteredOrders.slice(startIndex, startIndex + itemsPerPage));

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

    loadData(orders.length === 0);
  }, [statusFilter, sellerFilter, methodFilter, searchTerm, currentPage, activeTab]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
    if (currentPage > totalPages) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', totalPages.toString());
      setSearchParams(newParams, { replace: true });
    }
  }, [currentPage, totalCount, itemsPerPage, searchParams, setSearchParams]);

  // Keep seller filter independent from the current search results.
  useEffect(() => {
    if (Object.keys(sellersMap).length > 0) {
      const sellersList = Object.entries(sellersMap)
        .map(([id, name]) => ({
          id,
          name: name || id
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setAvailableSellers(sellersList);
    }
  }, [sellersMap]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const normalizedSearch = searchInput.trim();
      setSearchTerm(normalizedSearch);

      const currentSearchParam = searchParams.get('search') || '';
      if (normalizedSearch === currentSearchParam) return;

      const newParams = new URLSearchParams(searchParams);
      if (normalizedSearch) {
        newParams.set('search', normalizedSearch);
      } else {
        newParams.delete('search');
      }
      newParams.set('page', '1');
      setSearchParams(newParams, { replace: true });
    }, 800); // Increased debounce to be less aggressive

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchParams, setSearchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    setSearchTerm(urlSearch);
    setSearchInput(urlSearch);
  }, [searchParams]);


  // Helper to get product name
  const getProductName = (slug: string) => {
    return products.find(p => p.slug === slug)?.name || slug;
  };

  // Function updated to accept filter type
  const handleExportExcel = async (filterType: ExportFilterType = 'all') => {
    try {
      const batchSize = 1000;
      const allFilteredOrders: VisaOrder[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await buildOrdersQuery({
          search: searchTerm,
          exportFilterType: filterType,
        })
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        const currentBatch = data || [];
        allFilteredOrders.push(...currentBatch);

        if (currentBatch.length < batchSize) {
          break;
        }

        from += batchSize;
      }

      const filteredOrders = allFilteredOrders
        .filter(order => matchesActiveTab(order, activeTab))
        .filter(order => {
          if (statusFilter === 'failed') return !order.is_hidden;
          return shouldDisplayOrder(order);
        });

      const { exportVisaOrdersToExcel } = await import('@/lib/visaOrdersExport');
      await exportVisaOrdersToExcel(filteredOrders);
    } catch (error) {
      console.error('Failed to export excel:', error);
    }
  };

  const toggleHideOrder = async (orderId: string, currentStatus: boolean, paymentStatus?: string) => {
    const isHiding = !currentStatus;
    if (isHiding && paymentStatus === 'completed') {
      const confirmed = window.confirm(
        'Atenção: este pedido já foi pago (completed). Tem certeza que deseja ocultá-lo do painel?'
      );
      if (!confirmed) return;
    }
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

  const displayOrders = orders.filter(order => {
    if (statusFilter === 'failed') return !order.is_hidden;

    // Definimos como "abandonado" ou "em espera" pedidos Parcelow que não foram concluídos
    const isPendingParcelow = order.payment_method === 'parcelow' &&
      order.payment_status === 'pending' &&
      (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');

    // Filtra para remover cancelados da visualização padrão
    const isCancelled = order.payment_status === 'cancelled';

    return !order.is_hidden && !isPendingParcelow && !isCancelled;
  });

  const realOrders = activeTab === 'real' ? displayOrders : [];
  const signatureOrders = activeTab === 'signatures' ? displayOrders : [];

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

  if (loading && orders.length === 0) {
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto">
        {/* Full Header Row (Title + Filters + Actions) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 sm:mb-6 w-full">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text whitespace-nowrap">Visa Orders</h1>
          
          {/* Controls Wrapper */}
          <div className="flex flex-col sm:flex-row flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
            
            {/* Search */}
            <div className="relative w-full sm:flex-1 xl:w-[260px] shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by name, email, or order..."
                className="pl-10 bg-black/50 border-gold-medium/30 text-white placeholder:text-gray-500 w-full"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Selects */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-2 w-full sm:w-auto shrink-0">
              <Select
                value={sellerFilter}
                onValueChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all') newParams.delete('seller');
                  else newParams.set('seller', val);
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
              >
                <SelectTrigger className="bg-black/50 border-gold-medium/30 text-white w-full sm:w-auto sm:min-w-[130px]">
                  <SelectValue placeholder="All Sellers" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All Sellers</SelectItem>
                  {availableSellers.map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={methodFilter}
                onValueChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all') newParams.delete('method');
                  else newParams.set('method', val);
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
              >
                <SelectTrigger className="bg-black/50 border-gold-medium/30 text-white w-full sm:w-auto sm:min-w-[130px]">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="parcelow">Parcelow</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                </SelectContent>
              </Select>

              <div className="col-span-2 sm:col-span-1 w-full sm:w-auto">
                <PeriodFilter
                  value={periodFilter}
                  onChange={setPeriodFilter}
                  showLabel={false}
                  customDateRange={customRange}
                  onCustomDateRangeChange={setCustomDateRange}
                  locale="en"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full sm:w-auto items-center gap-2 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white border-none gap-2 text-sm font-medium h-9">
                    <Download className="w-4 h-4" />
                    Export Excel
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl">
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal" onClick={() => handleExportExcel('all')}>
                      Exportar Todos
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal" onClick={() => handleExportExcel('completed')}>
                      Apenas Pagos
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 text-sm font-normal" onClick={() => handleExportExcel('pending')}>
                      Apenas Pendentes
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as 'real' | 'signatures');
          }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-start sm:flex-wrap mt-2">
            <TabsList className="bg-black/50 border border-gold-medium/30 p-1 h-auto grid grid-cols-2 w-full sm:w-auto sm:flex sm:flex-wrap">
              <TabsTrigger
                value="real"
                className="data-[state=active]:bg-gold-medium data-[state=active]:text-black text-gray-400 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold truncate"
              >
                Real Orders {realOrders.length !== undefined ? `(${realOrders.length})` : ''}
              </TabsTrigger>
              <TabsTrigger
                value="signatures"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold truncate"
              >
                Manual / Signature Only {signatureOrders.length !== undefined ? `(${signatureOrders.length})` : ''}
              </TabsTrigger>
            </TabsList>
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (statusFilter === 'completed') newParams.delete('status');
                  else newParams.set('status', 'completed');
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
                className={`h-9 border-gold-medium/30 text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-all px-0.5 sm:px-3 ${statusFilter === 'completed'
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
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
                className={`h-9 border-gold-medium/30 text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-all px-0.5 sm:px-3 ${statusFilter === 'pending'
                    ? 'bg-gold-medium text-black border-gold-medium shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                    : 'bg-black/50 text-gold-light hover:bg-gold-medium/20'
                  }`}
              >
                Pending
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  if (statusFilter === 'failed') newParams.delete('status');
                  else newParams.set('status', 'failed');
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
                className={`h-9 text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-all px-0.5 sm:px-3 ${statusFilter === 'failed'
                    ? 'bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                    : 'bg-black/50 text-red-400 border-red-500/30 hover:bg-red-500/20'
                  }`}
              >
                Failed
              </Button>
            </div>
          </div>

          <TabsContent value="real">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-white">Real Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {realOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm sm:text-base">No real orders found.</p>
                  </div>
                ) : (
                  <OrderTable
                    orders={realOrders}
                    calculateNetAmountAndFee={calculateNetAmountAndFee}
            getStatusBadge={getStatusBadge}
            getSplitPaymentProgressData={getSplitPaymentProgressData}
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
            getSplitPaymentProgressData={getSplitPaymentProgressData}
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
