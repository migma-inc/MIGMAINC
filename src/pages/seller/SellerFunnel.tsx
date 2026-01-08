import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, MousePointerClick, FileEdit, CheckCircle, CreditCard, DollarSign, ChevronDown, ChevronUp, Eye, Globe, Calendar, User } from 'lucide-react';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

interface FunnelStats {
  linkClicks: number;
  formStarted: number;
  formCompleted: number;
  paymentStarted: number;
  paymentCompleted: number;
  conversionRate: number;
}

interface FunnelEvent {
  id: string;
  event_type: string;
  session_id: string;
  product_slug: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  metadata: any;
  created_at: string;
  // For payment_completed, we'll enrich with order data
  order?: {
    id: string;
    order_number: string;
    client_name: string;
    client_email: string;
    client_whatsapp?: string | null;
    total_price_usd: string;
    payment_status: string;
  };
  // Client info from form or metadata
  clientInfo?: {
    name: string;
    email: string;
    whatsapp?: string | null;
  };
}

interface FunnelStepDetails {
  eventType: string;
  events: FunnelEvent[];
  expanded: boolean;
}

export function SellerFunnel() {
  const { seller } = useOutletContext<{ seller: SellerInfo }>();
  const [funnelStats, setFunnelStats] = useState<FunnelStats>({
    linkClicks: 0,
    formStarted: 0,
    formCompleted: 0,
    paymentStarted: 0,
    paymentCompleted: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [stepDetails, setStepDetails] = useState<Record<string, FunnelStepDetails>>({
    link_click: { eventType: 'link_click', events: [], expanded: false },
    form_started: { eventType: 'form_started', events: [], expanded: false },
    form_completed: { eventType: 'form_completed', events: [], expanded: false },
    payment_started: { eventType: 'payment_started', events: [], expanded: false },
    payment_completed: { eventType: 'payment_completed', events: [], expanded: false },
  });

  useEffect(() => {
    const loadFunnelStats = async () => {
      if (!seller) return;

      try {
        // Load all funnel events with full details
        const { data: funnelData, error } = await supabase
          .from('seller_funnel_events')
          .select('*')
          .eq('seller_id', seller.seller_id_public)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading funnel events:', error);
          return;
        }

        if (funnelData) {
          // Calculate stats
          const linkClicks = funnelData.filter(e => e.event_type === 'link_click').length;
          const formStarted = funnelData.filter(e => e.event_type === 'form_started').length;
          const formCompleted = funnelData.filter(e => e.event_type === 'form_completed').length;
          const paymentStarted = funnelData.filter(e => e.event_type === 'payment_started').length;
          const paymentCompleted = funnelData.filter(e => e.event_type === 'payment_completed').length;
          
          const conversionRate = linkClicks > 0 
            ? parseFloat(((paymentCompleted / linkClicks) * 100).toFixed(1))
            : 0;

          setFunnelStats({
            linkClicks,
            formStarted,
            formCompleted,
            paymentStarted,
            paymentCompleted,
            conversionRate,
          });

          // Group events by type
          const eventsByType: Record<string, FunnelEvent[]> = {
            link_click: [],
            form_started: [],
            form_completed: [],
            payment_started: [],
            payment_completed: [],
          };

          funnelData.forEach((event: any) => {
            if (eventsByType[event.event_type]) {
              eventsByType[event.event_type].push(event as FunnelEvent);
            }
          });

          // First, enrich payment_completed events with order data
          const paymentCompletedEvents = eventsByType.payment_completed;
          const sessionIdToOrderMap: Record<string, any> = {};
          
          if (paymentCompletedEvents.length > 0) {
            const orderIds = paymentCompletedEvents
              .map(e => e.metadata?.order_id)
              .filter(Boolean);

            if (orderIds.length > 0) {
              const { data: ordersData } = await supabase
                .from('visa_orders')
                .select('id, order_number, client_name, client_email, client_whatsapp, total_price_usd, payment_status')
                .in('id', orderIds)
                .eq('seller_id', seller.seller_id_public);

              if (ordersData) {
                const ordersMap = ordersData.reduce((acc, order) => {
                  acc[order.id] = order;
                  return acc;
                }, {} as Record<string, any>);

                paymentCompletedEvents.forEach(event => {
                  const orderId = event.metadata?.order_id;
                  if (orderId && ordersMap[orderId]) {
                    event.order = ordersMap[orderId];
                    // Map session_id to order for other events
                    if (event.session_id) {
                      sessionIdToOrderMap[event.session_id] = ordersMap[orderId];
                    }
                  }
                });
              }
            }
          }

          // Try to find orders for payment_started events that might have order_id in metadata
          // (some payment_started events might be created after order creation)
          const paymentStartedEvents = eventsByType.payment_started;
          const paymentStartedOrderIds = paymentStartedEvents
            .map(e => e.metadata?.order_id)
            .filter(Boolean);

          if (paymentStartedOrderIds.length > 0) {
            const { data: ordersData } = await supabase
              .from('visa_orders')
              .select('id, order_number, client_name, client_email, client_whatsapp, total_price_usd, payment_status')
              .in('id', paymentStartedOrderIds)
              .eq('seller_id', seller.seller_id_public);

            if (ordersData) {
              const ordersMap = ordersData.reduce((acc, order) => {
                acc[order.id] = order;
                return acc;
              }, {} as Record<string, any>);

              paymentStartedEvents.forEach(event => {
                const orderId = event.metadata?.order_id;
                if (orderId && ordersMap[orderId] && !event.order) {
                  event.order = ordersMap[orderId];
                  // Also map session_id for future lookups
                  if (event.session_id) {
                    sessionIdToOrderMap[event.session_id] = ordersMap[orderId];
                  }
                }
              });
            }
          }

          // Try to enrich with client info from form_completed events (same session_id)
          const formCompletedEvents = eventsByType.form_completed;
          const sessionIdToClientInfoMap: Record<string, any> = {};

          formCompletedEvents.forEach(event => {
            if (event.session_id && event.metadata) {
              const clientInfo: any = {};
              if (event.metadata.client_name || event.metadata.name) {
                clientInfo.name = event.metadata.client_name || event.metadata.name;
              }
              if (event.metadata.client_email || event.metadata.email) {
                clientInfo.email = event.metadata.client_email || event.metadata.email;
              }
              if (event.metadata.client_whatsapp || event.metadata.whatsapp) {
                clientInfo.whatsapp = event.metadata.client_whatsapp || event.metadata.whatsapp;
              }
              if (clientInfo.name || clientInfo.email) {
                sessionIdToClientInfoMap[event.session_id] = clientInfo;
              }
            }
          });

          // Now enrich all other events by matching session_id
          // If an event has the same session_id as a payment_completed event, it's the same user
          const enrichEventWithOrder = (event: FunnelEvent) => {
            if (event.order) return; // Already has order
            
            // Try to match by session_id
            if (event.session_id && sessionIdToOrderMap[event.session_id]) {
              event.order = sessionIdToOrderMap[event.session_id];
              return;
            }

            // For events that might have order_id or service_request_id in metadata
            if (event.metadata?.order_id) {
              // Try to find the order from payment_completed events
              const relatedPaymentCompleted = paymentCompletedEvents.find(
                pc => pc.metadata?.order_id === event.metadata.order_id
              );
              if (relatedPaymentCompleted?.order) {
                event.order = relatedPaymentCompleted.order;
                // Also map the session_id for future lookups
                if (event.session_id) {
                  sessionIdToOrderMap[event.session_id] = relatedPaymentCompleted.order;
                }
              }
            }

            // If no order found, try to get client info from form_completed (same session)
            if (!event.order && event.session_id && sessionIdToClientInfoMap[event.session_id]) {
              event.clientInfo = sessionIdToClientInfoMap[event.session_id];
            }

            // Also try to get client info from metadata if available
            if (!event.order && !event.clientInfo && event.metadata) {
              const clientInfo: any = {};
              if (event.metadata.client_name || event.metadata.name) {
                clientInfo.name = event.metadata.client_name || event.metadata.name;
              }
              if (event.metadata.client_email || event.metadata.email) {
                clientInfo.email = event.metadata.client_email || event.metadata.email;
              }
              if (event.metadata.client_whatsapp || event.metadata.whatsapp) {
                clientInfo.whatsapp = event.metadata.client_whatsapp || event.metadata.whatsapp;
              }
              if (clientInfo.name || clientInfo.email) {
                event.clientInfo = clientInfo;
              }
            }
          };

          // Enrich all events
          Object.values(eventsByType).flat().forEach(enrichEventWithOrder);

          // Update step details
          setStepDetails({
            link_click: { eventType: 'link_click', events: eventsByType.link_click, expanded: false },
            form_started: { eventType: 'form_started', events: eventsByType.form_started, expanded: false },
            form_completed: { eventType: 'form_completed', events: eventsByType.form_completed, expanded: false },
            payment_started: { eventType: 'payment_started', events: eventsByType.payment_started, expanded: false },
            payment_completed: { eventType: 'payment_completed', events: paymentCompletedEvents, expanded: false },
          });
        }
      } catch (err) {
        console.error('Error loading funnel stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFunnelStats();
  }, [seller]);

  const toggleStepDetails = (eventType: string) => {
    setStepDetails(prev => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        expanded: !prev[eventType].expanded,
      },
    }));
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>

        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-8">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Conversion Rate Skeleton */}
              <div className="text-center p-6 bg-black/50 rounded-lg border border-gold-medium/20">
                <Skeleton className="h-4 w-40 mx-auto mb-3" />
                <Skeleton className="h-12 w-24 mx-auto mb-2" />
                <Skeleton className="h-3 w-32 mx-auto" />
              </div>

              {/* Funnel Steps Skeleton */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-gold-medium/20">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-6 w-6 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-8 w-12 mb-1" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Conversion Funnel</h1>
        <p className="text-sm sm:text-base text-gray-400">Track your sales funnel performance</p>
      </div>

      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Conversion Rate */}
            <div className="text-center p-6 bg-black/50 rounded-lg border border-gold-medium/20">
              <p className="text-sm text-gray-400 mb-2">Overall Conversion Rate</p>
              <p className="text-4xl font-bold text-gold-light">{funnelStats.conversionRate}%</p>
              <p className="text-xs text-gray-500 mt-2">
                {funnelStats.paymentCompleted} completed / {funnelStats.linkClicks} clicks
              </p>
            </div>

            {/* Funnel Steps */}
            <div className="space-y-4">
              {/* Step 1: Link Clicks */}
              <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <MousePointerClick className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">Link Clicks</p>
                      <p className="text-xs text-gray-400">Users who clicked your checkout link</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-300">{funnelStats.linkClicks}</p>
                      <p className="text-xs text-gray-500">100%</p>
                    </div>
                    {stepDetails.link_click.events.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStepDetails('link_click')}
                        className="border-blue-500/50 bg-black/50 text-blue-300 hover:bg-black hover:border-blue-500 hover:text-blue-200"
                      >
                        {stepDetails.link_click.expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details ({stepDetails.link_click.events.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {stepDetails.link_click.expanded && (
                  <div className="border-t border-blue-500/30 p-4 bg-black/30">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stepDetails.link_click.events.map((event) => (
                        <div key={event.id} className="p-3 bg-black/50 rounded border border-blue-500/20">
                          {event.order ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                <p className="text-white font-semibold">{event.order.client_name}</p>
                                <p className="text-gray-400 text-sm">{event.order.client_email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Order Details
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-white font-mono text-sm">#{event.order.order_number}</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.order.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-gold-light font-bold">${parseFloat(event.order.total_price_usd).toFixed(2)}</p>
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-center flex-wrap">
                                <Link to={`/seller/orders/${event.order.id}`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Order
                                  </Button>
                                </Link>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Clicked: {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Date & Time</p>
                                <p className="text-white">{new Date(event.created_at).toLocaleString()}</p>
                              </div>
                              {event.ip_address && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    IP Address
                                  </p>
                                  <p className="text-white font-mono text-xs">{event.ip_address}</p>
                                </div>
                              )}
                              {event.product_slug && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Product</p>
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 text-xs">
                                    {event.product_slug}
                                  </Badge>
                                </div>
                              )}
                              {event.referer && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <p className="text-gray-400 text-xs mb-1">Referer</p>
                                  <p className="text-white text-xs truncate">{event.referer}</p>
                                </div>
                              )}
                              {event.user_agent && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <p className="text-gray-400 text-xs mb-1">User Agent</p>
                                  <p className="text-white text-xs truncate">{event.user_agent}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Form Started */}
              <div className="bg-purple-500/10 rounded-lg border border-purple-500/30 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <FileEdit className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">Form Started</p>
                      <p className="text-xs text-gray-400">Users who started filling the form</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-300">{funnelStats.formStarted}</p>
                      <p className="text-xs text-gray-500">
                        {funnelStats.linkClicks > 0 
                          ? `${((funnelStats.formStarted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    {stepDetails.form_started.events.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStepDetails('form_started')}
                        className="border-purple-500/50 bg-black/50 text-purple-300 hover:bg-black hover:border-purple-500 hover:text-purple-200"
                      >
                        {stepDetails.form_started.expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details ({stepDetails.form_started.events.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {stepDetails.form_started.expanded && (
                  <div className="border-t border-purple-500/30 p-4 bg-black/30">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stepDetails.form_started.events.map((event) => (
                        <div key={event.id} className="p-3 bg-black/50 rounded border border-purple-500/20">
                          {event.order ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                <p className="text-white font-semibold">{event.order.client_name}</p>
                                <p className="text-gray-400 text-sm">{event.order.client_email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Order Details
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-white font-mono text-sm">#{event.order.order_number}</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.order.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-gold-light font-bold">${parseFloat(event.order.total_price_usd).toFixed(2)}</p>
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-center flex-wrap">
                                <Link to={`/seller/orders/${event.order.id}`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Order
                                  </Button>
                                </Link>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Started: {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Date & Time</p>
                                <p className="text-white">{new Date(event.created_at).toLocaleString()}</p>
                              </div>
                              {event.ip_address && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    IP Address
                                  </p>
                                  <p className="text-white font-mono text-xs">{event.ip_address}</p>
                                </div>
                              )}
                              {event.product_slug && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Product</p>
                                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-xs">
                                    {event.product_slug}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Form Completed */}
              <div className="bg-indigo-500/10 rounded-lg border border-indigo-500/30 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">Form Completed</p>
                      <p className="text-xs text-gray-400">Users who completed the form</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-300">{funnelStats.formCompleted}</p>
                      <p className="text-xs text-gray-500">
                        {funnelStats.linkClicks > 0 
                          ? `${((funnelStats.formCompleted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    {stepDetails.form_completed.events.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStepDetails('form_completed')}
                        className="border-indigo-500/50 bg-black/50 text-indigo-300 hover:bg-black hover:border-indigo-500 hover:text-indigo-200"
                      >
                        {stepDetails.form_completed.expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details ({stepDetails.form_completed.events.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {stepDetails.form_completed.expanded && (
                  <div className="border-t border-indigo-500/30 p-4 bg-black/30">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stepDetails.form_completed.events.map((event) => (
                        <div key={event.id} className="p-3 bg-black/50 rounded border border-indigo-500/20">
                          {event.order ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                <p className="text-white font-semibold">{event.order.client_name}</p>
                                <p className="text-gray-400 text-sm">{event.order.client_email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Order Details
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-white font-mono text-sm">#{event.order.order_number}</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.order.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-gold-light font-bold">${parseFloat(event.order.total_price_usd).toFixed(2)}</p>
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-center flex-wrap">
                                <Link to={`/seller/orders/${event.order.id}`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Order
                                  </Button>
                                </Link>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Completed: {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Date & Time</p>
                                <p className="text-white">{new Date(event.created_at).toLocaleString()}</p>
                              </div>
                              {event.ip_address && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    IP Address
                                  </p>
                                  <p className="text-white font-mono text-xs">{event.ip_address}</p>
                                </div>
                              )}
                              {event.product_slug && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Product</p>
                                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/50 text-xs">
                                    {event.product_slug}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Payment Started */}
              <div className="bg-orange-500/10 rounded-lg border border-orange-500/30 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400 shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">Payment Started</p>
                      <p className="text-xs text-gray-400">Users who initiated payment</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-orange-300">{funnelStats.paymentStarted}</p>
                      <p className="text-xs text-gray-500">
                        {funnelStats.linkClicks > 0 
                          ? `${((funnelStats.paymentStarted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    {stepDetails.payment_started.events.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStepDetails('payment_started')}
                        className="border-orange-500/50 bg-black/50 text-orange-300 hover:bg-black hover:border-orange-500 hover:text-orange-200"
                      >
                        {stepDetails.payment_started.expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details ({stepDetails.payment_started.events.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {stepDetails.payment_started.expanded && (
                  <div className="border-t border-orange-500/30 p-4 bg-black/30">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stepDetails.payment_started.events.map((event) => (
                        <div key={event.id} className="p-3 bg-black/50 rounded border border-orange-500/20">
                          {event.order ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                <p className="text-white font-semibold">{event.order.client_name}</p>
                                <p className="text-gray-400 text-sm">{event.order.client_email}</p>
                                {event.order.client_whatsapp && (
                                  <p className="text-gray-400 text-xs mt-1">WhatsApp: {event.order.client_whatsapp}</p>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Order Details
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-white font-mono text-sm">#{event.order.order_number}</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.order.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-gold-light font-bold">${parseFloat(event.order.total_price_usd).toFixed(2)}</p>
                                {event.metadata?.payment_method && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Method: {event.metadata.payment_method}
                                  </p>
                                )}
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-center">
                                <Link to={`/seller/orders/${event.order.id}`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Order
                                  </Button>
                                </Link>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Started: {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : event.clientInfo ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                {event.clientInfo.name && (
                                  <p className="text-white font-semibold">{event.clientInfo.name}</p>
                                )}
                                {event.clientInfo.email && (
                                  <p className="text-gray-400 text-sm">{event.clientInfo.email}</p>
                                )}
                                {event.clientInfo.whatsapp && (
                                  <p className="text-gray-400 text-xs mt-1">WhatsApp: {event.clientInfo.whatsapp}</p>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Payment Details
                                </p>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(event.created_at).toLocaleString()}
                                </div>
                                {event.metadata?.payment_method && (
                                  <div className="mb-2">
                                    <p className="text-gray-400 text-xs mb-1">Payment Method</p>
                                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                      {event.metadata.payment_method}
                                    </Badge>
                                  </div>
                                )}
                                {event.product_slug && (
                                  <div>
                                    <p className="text-gray-400 text-xs mb-1">Product</p>
                                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                      {event.product_slug}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Date & Time</p>
                                <p className="text-white">{new Date(event.created_at).toLocaleString()}</p>
                              </div>
                              {event.metadata?.payment_method && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Payment Method</p>
                                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                    {event.metadata.payment_method}
                                  </Badge>
                                </div>
                              )}
                              {event.product_slug && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Product</p>
                                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                    {event.product_slug}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 5: Payment Completed */}
              <div className="bg-green-500/10 rounded-lg border border-green-500/30 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">Payment Completed</p>
                      <p className="text-xs text-gray-400">Successful payments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-300">{funnelStats.paymentCompleted}</p>
                      <p className="text-xs text-gray-500">
                        {funnelStats.linkClicks > 0 
                          ? `${((funnelStats.paymentCompleted / funnelStats.linkClicks) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                    {stepDetails.payment_completed.events.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStepDetails('payment_completed')}
                        className="border-green-500/50 bg-black/50 text-green-300 hover:bg-black hover:border-green-500 hover:text-green-200"
                      >
                        {stepDetails.payment_completed.expanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            View Details ({stepDetails.payment_completed.events.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {stepDetails.payment_completed.expanded && (
                  <div className="border-t border-green-500/30 p-4 bg-black/30">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stepDetails.payment_completed.events.map((event) => (
                        <div key={event.id} className="p-3 bg-black/50 rounded border border-green-500/20">
                          {event.order ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Client Information
                                </p>
                                <p className="text-white font-semibold">{event.order.client_name}</p>
                                <p className="text-gray-400 text-sm">{event.order.client_email}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Order Details
                                </p>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-white font-mono text-sm">#{event.order.order_number}</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.order.payment_status}
                                  </Badge>
                                </div>
                                <p className="text-gold-light font-bold">${parseFloat(event.order.total_price_usd).toFixed(2)}</p>
                              </div>
                              <div className="sm:col-span-2 flex gap-2">
                                <Link to={`/seller/orders/${event.order.id}`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Order
                                  </Button>
                                </Link>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(event.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Date & Time</p>
                                <p className="text-white">{new Date(event.created_at).toLocaleString()}</p>
                              </div>
                              {event.product_slug && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Product</p>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {event.product_slug}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


