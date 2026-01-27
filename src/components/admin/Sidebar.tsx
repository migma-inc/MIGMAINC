import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardList, LayoutDashboard, Phone, ShoppingCart, DollarSign, UserCircle2, Mail, FileCode, Calendar, X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ className, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();

  const [counts, setCounts] = useState<{
    applications: number;
    partnerContracts: number;
    visaApprovals: number;
    zelleApprovals: number;
  }>({
    applications: 0,
    partnerContracts: 0,
    visaApprovals: 0,
    zelleApprovals: 0
  });

  const loadCounts = async () => {
    try {
      const { supabase } = await import('@/lib/supabase');

      // 1. Applications Count
      const { count: appCount } = await supabase
        .from('global_partner_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 2. Partner Contracts Count
      const { count: partnerCount } = await supabase
        .from('partner_terms_acceptances')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending')
        .not('accepted_at', 'is', null);

      // 3. Visa Approvals Count (with real document check)
      const { data: visaData } = await supabase
        .from('visa_orders')
        .select('payment_method, payment_status, parcelow_status, is_hidden, contract_pdf_url, annex_pdf_url, contract_approval_status, annex_approval_status')
        .or('contract_approval_status.eq.pending,annex_approval_status.eq.pending');

      const visaApprovalsCount = (visaData || []).filter(order => {
        // 1. Ignorar ocultos ou cancelados
        if (order.is_hidden || order.payment_status === 'cancelled') return false;

        // 2. Filtro Zelle
        if (order.payment_method === 'zelle' && order.payment_status !== 'completed') return false;

        // 3. Filtro Parcelow abandonado
        const isAbandonedParcelow = order.payment_method === 'parcelow' &&
          order.payment_status === 'pending' &&
          (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');
        if (isAbandonedParcelow) return false;

        // 4. Só conta se houver de fato um documento pendente para revisar
        const hasPendingContract = order.contract_pdf_url && (order.contract_approval_status === 'pending' || !order.contract_approval_status);
        const hasPendingAnnex = order.annex_pdf_url && (order.annex_approval_status === 'pending' || !order.annex_approval_status);

        return hasPendingContract || hasPendingAnnex;
      }).length;

      // 4. Zelle Approvals Count
      const { count: zelleCount } = await supabase
        .from('visa_orders')
        .select('*', { count: 'exact', head: true })
        .eq('payment_method', 'zelle')
        .eq('payment_status', 'pending')
        .not('zelle_proof_url', 'is', null);

      setCounts({
        applications: appCount || 0,
        partnerContracts: partnerCount || 0,
        visaApprovals: visaApprovalsCount,
        zelleApprovals: zelleCount || 0
      });
    } catch (err) {
      console.error('Error loading sidebar counts:', err);
    }
  };

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
    loadCounts();
  }, [location.pathname]);

  const menuItems = [
    {
      title: 'Applications',
      icon: ClipboardList,
      path: '/dashboard',
      exact: true,
      badge: counts.applications
    },
    {
      title: 'Book a Call',
      icon: Phone,
      path: '/dashboard/book-a-call',
      exact: true,
    },
    {
      title: 'Schedule Meeting',
      icon: Calendar,
      path: '/dashboard/schedule-meeting',
      exact: false,
    },
    {
      title: 'Accepted Contracts',
      icon: FileText,
      path: '/dashboard/contracts',
      exact: false,
      badge: counts.partnerContracts
    },
    {
      title: 'Visa Orders',
      icon: ShoppingCart,
      path: '/dashboard/visa-orders',
      exact: false,
    },
    {
      title: 'Visa Approvals',
      icon: FileText,
      path: '/dashboard/visa-contract-approval',
      exact: false,
      badge: counts.visaApprovals
    },
    {
      title: 'Zelle Approval',
      icon: DollarSign,
      path: '/dashboard/zelle-approval',
      exact: false,
      badge: counts.zelleApprovals
    },
    {
      title: 'Sellers & Sales',
      icon: UserCircle2,
      path: '/dashboard/sellers',
      exact: false,
    },
    // PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE
    // {
    //   title: 'Payment Requests',
    //   icon: Wallet,
    //   path: '/dashboard/payment-requests',
    //   exact: false,
    // },
    {
      title: 'Contact Messages',
      icon: Mail,
      path: '/dashboard/contact-messages',
      exact: false,
    },
    {
      title: 'Contract Templates',
      icon: FileCode,
      path: '/dashboard/contract-templates',
      exact: false,
    },
    {
      title: 'Slack Reports',
      icon: Activity,
      path: '/dashboard/slack-reports',
      exact: false,
    },
    {
      title: 'Profile',
      icon: UserCircle2,
      path: '/dashboard/profile',
      exact: false,
    },
  ];

  const sidebarContent = (
    <div className="p-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-gold-medium" />
          <h2 className="text-lg font-bold migma-gold-text">Admin Panel</h2>
        </div>
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden text-gray-400 hover:text-gold-light p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-lg transition-colors group',
                isActive
                  ? 'bg-gold-medium/20 text-gold-light font-medium border border-gold-medium/50'
                  : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{(item as any).title}</span>
              </div>
              {(item as any).badge > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[1.25rem] text-center",
                  isActive ? "bg-gold-medium text-black" : "bg-gold-medium/20 text-gold-light group-hover:bg-gold-medium group-hover:text-black"
                )}>
                  {(item as any).badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn('hidden lg:flex w-64 bg-black/95 border-r border-gold-medium/30 min-h-screen flex-col', className)}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-[100] lg:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className={cn(
            'fixed left-0 top-0 h-full w-64 bg-black/95 border-r border-gold-medium/30 z-[101] flex flex-col lg:hidden',
            'transform transition-transform duration-300 ease-in-out translate-x-0'
          )}>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

