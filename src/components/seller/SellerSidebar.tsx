import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, ShoppingCart, Link as LinkIcon, Users, LogOut, BarChart3, X, Coins, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

interface SellerSidebarProps {
  className?: string;
  sellerName?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SellerSidebar({ className, sellerName, isMobileOpen = false, onMobileClose }: SellerSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/seller/login');
  };

  useEffect(() => {
    let isMounted = true;
    const fetchPendingCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: sellerData } = await supabase
          .from('sellers')
          .select('seller_id_public')
          .eq('user_id', user.id)
          .single();

        if (sellerData) {
          const { count: ordersCount } = await supabase
            .from('visa_orders')
            .select('*', { count: 'exact', head: true })
            .eq('payment_method', 'zelle')
            .eq('payment_status', 'pending')
            .eq('seller_id', sellerData.seller_id_public)
            .eq('is_hidden', false);

          const { data: sellerRequests } = await supabase
            .from('service_requests')
            .select('client_id')
            .eq('seller_id', sellerData.seller_id_public);

          const clientIds = sellerRequests?.map(r => r.client_id) || [];

          let migmaCount = 0;
          if (clientIds.length > 0) {
            const { count } = await supabase
              .from('migma_payments')
              .select('*', { count: 'exact', head: true })
              .in('user_id', clientIds)
              .in('status', ['pending', 'pending_verification']);
            migmaCount = count || 0;
          }

          if (isMounted) {
            setPendingCount((ordersCount || 0) + migmaCount);
          }
        }
      } catch (err) {
        console.error('Error fetching pending count:', err);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000); // 30s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const menuItems = [
    { title: 'Overview', icon: LayoutDashboard, path: '/seller/dashboard', exact: true },
    { title: 'Orders', icon: ShoppingCart, path: '/seller/dashboard/orders', exact: false },
    { title: 'Sales Links', icon: LinkIcon, path: '/seller/dashboard/links', exact: false },
    { title: 'Leads & Users', icon: Users, path: '/seller/dashboard/leads', exact: false },
    { title: 'Commissions', icon: Coins, path: '/seller/dashboard/commissions', exact: false },
    { title: 'Analytics', icon: BarChart3, path: '/seller/dashboard/analytics', exact: false },
    { title: 'Conversion Funnel', icon: TrendingUp, path: '/seller/dashboard/funnel', exact: false },
    { title: 'Zelle Approvals', icon: CheckCircle, path: '/seller/dashboard/zelle-approvals', exact: false, badge: pendingCount },
  ];

  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const sidebarContent = (
    <>
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-gold-medium" />
            <h2 className="text-lg font-bold migma-gold-text">Seller Panel</h2>
          </div>
          <button onClick={onMobileClose} className="lg:hidden text-gray-400 hover:text-gold-light p-1" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sellerName && (
          <div className="mb-6 p-3 bg-gold-medium/10 rounded-lg border border-gold-medium/30">
            <p className="text-xs text-gray-400 mb-1">Logged in as</p>
            <p className="text-sm text-gold-light font-medium truncate">{sellerName}</p>
          </div>
        )}

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gold-medium/20 text-gold-light font-medium border border-gold-medium/50'
                    : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-gold-medium text-black rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gold-medium/30">
        <Button onClick={handleLogout} variant="outline" className="w-full border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      <aside className={cn('hidden lg:flex w-64 bg-black/95 border-r border-gold-medium/30 min-h-screen flex-col', className)}>
        {sidebarContent}
      </aside>
      {isMobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className={cn('fixed left-0 top-0 h-full w-64 bg-black/95 border-r border-gold-medium/30 z-50 flex flex-col lg:hidden transform transition-transform duration-300 ease-in-out', isMobileOpen ? 'translate-x-0' : '-translate-x-full')}>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
