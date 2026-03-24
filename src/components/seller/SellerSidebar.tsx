import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, ShoppingCart, Link as LinkIcon, Users, LogOut, BarChart3, X, Coins, CheckCircle, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

interface SellerSidebarProps {
  className?: string;
  sellerName?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  role?: string;
}

type MenuItem = {
  title: string;
  icon: LucideIcon;
  path: string;
  exact: boolean;
  badge?: number;
};

export function SellerSidebar({ className, sellerName, isMobileOpen = false, onMobileClose, role = 'seller' }: SellerSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingContractsCount, setPendingContractsCount] = useState(0);

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
          .select('id, seller_id_public')
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

          // Fetch team pending contracts if HoS
          if (role === 'head_of_sales') {
            const { data: teamMembers } = await supabase
              .from('sellers')
              .select('seller_id_public')
              .eq('head_of_sales_id', sellerData?.id || user.id); // Try both to be safe

            const teamPublicIds = teamMembers?.map(m => m.seller_id_public) || [];

            if (teamPublicIds.length > 0) {
              const { count: contractsCount } = await supabase
                .from('visa_orders')
                .select('*', { count: 'exact', head: true })
                .in('seller_id', teamPublicIds)
                .eq('is_hidden', false)
                .not('payment_status', 'eq', 'cancelled')
                .or('and(contract_pdf_url.not.is.null,or(contract_approval_status.eq.pending,contract_approval_status.is.null)),and(annex_pdf_url.not.is.null,or(annex_approval_status.eq.pending,annex_approval_status.is.null)),and(upsell_contract_pdf_url.not.is.null,or(upsell_contract_approval_status.eq.pending,upsell_contract_approval_status.is.null)),and(upsell_annex_pdf_url.not.is.null,or(upsell_annex_approval_status.eq.pending,upsell_annex_approval_status.is.null))');

              if (isMounted) {
                setPendingContractsCount(contractsCount || 0);
              }
            }
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


  const sellerMenuItems: MenuItem[] = [
    { title: 'Overview', icon: LayoutDashboard, path: '/seller/dashboard', exact: true },
    { title: 'Orders', icon: ShoppingCart, path: '/seller/dashboard/orders', exact: false },
    { title: 'Sales Links', icon: LinkIcon, path: '/seller/dashboard/links', exact: false },
    { title: 'Leads & Users', icon: Users, path: '/seller/dashboard/leads', exact: false },
    { title: 'Commissions', icon: Coins, path: '/seller/dashboard/commissions', exact: false },
    { title: 'Analytics', icon: BarChart3, path: '/seller/dashboard/analytics', exact: false },
    { title: 'Conversion Funnel', icon: TrendingUp, path: '/seller/dashboard/funnel', exact: false },
    { title: 'Zelle Approvals', icon: CheckCircle, path: '/seller/dashboard/zelle-approvals', exact: false, badge: pendingCount },
  ];


  const headOfSalesMenuItems: MenuItem[] = [
    { title: 'Overview', icon: LayoutDashboard, path: '/seller/dashboard', exact: true },
    { title: 'Sales Links', icon: LinkIcon, path: '/seller/dashboard/links', exact: false },
    { title: 'My Team', icon: Users, path: '/seller/dashboard/team', exact: false },
    { title: 'Team Orders', icon: ShoppingCart, path: '/seller/dashboard/team-orders', exact: false },
    { title: 'Team Overrides', icon: Coins, path: '/seller/dashboard/team-commissions', exact: false },
    { title: 'Team Analytics', icon: BarChart3, path: '/seller/dashboard/team-analytics', exact: false },
    { title: 'Contract Approvals', icon: FileCheck, path: '/seller/dashboard/team-contract-approval', exact: false, badge: pendingContractsCount },
    { title: 'Total Sales', icon: BarChart3, path: '/seller/dashboard/team-total-sales', exact: false },
  ];

  // HoS features available for both managers and admins
  const isManager = role === 'head_of_sales' || role === 'admin';
  const isHeadOfSalesView = isManager;
  const menuItems: MenuItem[] = isHeadOfSalesView ? headOfSalesMenuItems : sellerMenuItems;


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
            <h2 className="text-lg font-bold migma-gold-text">
              {role === 'head_of_sales' ? 'HoS Panel' : 'Seller Panel'}
            </h2>
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
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

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
