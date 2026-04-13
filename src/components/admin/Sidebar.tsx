import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardList, LayoutDashboard, Phone, ShoppingCart, DollarSign, UserCircle2, UserRound, Mail, FileCode, Calendar, X, Activity, Ticket, LinkIcon, ChevronDown, ChevronRight, GraduationCap, UserPlus, Crown, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface SidebarItemProps {
  icon: any;
  label: string;
  to: string;
  count?: number;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, to, count, onClick }: SidebarItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg transition-colors group',
        isActive
          ? 'bg-gold-medium/20 text-gold-light font-medium border border-gold-medium/50'
          : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[1.25rem] text-center",
          isActive ? "bg-gold-medium text-black" : "bg-gold-medium/20 text-gold-light group-hover:bg-gold-medium group-hover:text-black"
        )}>
          {count}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ className, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(
    location.pathname.includes('eb3-recurring') || location.pathname.includes('eb2-recurring') || location.pathname.includes('scholarship-recurring')
  );

  const [isLinksOpen, setIsLinksOpen] = useState(
    location.pathname.includes('/dashboard/links') || location.pathname.includes('/dashboard/create-service') || location.pathname.includes('/dashboard/tracking')
  );
  const [isCrmOpen, setIsCrmOpen] = useState(
    location.pathname.includes('/dashboard/users') ||
    location.pathname.includes('/dashboard/crm')
  );

  const [counts, setCounts] = useState<{
    applications: number;
    partnerContracts: number;
    visaApprovals: number;
    zelle: number;
    orphanSales: number;
    tracking: number;
    users: number;
  }>({
    applications: 0,
    partnerContracts: 0,
    visaApprovals: 0,
    zelle: 0,
    orphanSales: 0,
    tracking: 0,
    users: 0
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

      // 3. Visa Approvals Count
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const visaQuery = supabase
        .from('visa_orders')
        .select('payment_method, payment_status, parcelow_status, is_hidden, contract_pdf_url, annex_pdf_url, contract_approval_status, annex_approval_status')
        .or('contract_approval_status.eq.pending,annex_approval_status.eq.pending');
      const { data: visaData } = await (isLocal ? visaQuery : visaQuery.eq('is_test', false));

      const visaApprovalsCount = (visaData || []).filter(order => {
        if (order.is_hidden || order.payment_status === 'cancelled') return false;
        if (order.payment_method === 'zelle' && order.payment_status !== 'completed') return false;
        const isAbandonedParcelow = order.payment_method === 'parcelow' && order.payment_status === 'pending' && (order.parcelow_status === 'Open' || order.parcelow_status === 'Waiting Payment');
        if (isAbandonedParcelow) return false;
        const hasPendingContract = order.contract_pdf_url && (order.contract_approval_status === 'pending' || !order.contract_approval_status);
        const hasPendingAnnex = order.annex_pdf_url && (order.annex_approval_status === 'pending' || !order.annex_approval_status);
        return hasPendingContract || hasPendingAnnex;
      }).length;

      // 4. Zelle Approvals (Full Logic)
      const { data: zelleOrdersRaw } = await supabase
        .from('visa_orders')
        .select('client_email, product_slug, payment_status, zelle_proof_url')
        .eq('payment_method', 'zelle')
        .eq('is_hidden', false)
        .in('payment_status', ['pending', 'completed']);

      const { data: migmaPaymentsRaw } = await supabase
        .from('migma_payments')
        .select('user_id, fee_type_global, status')
        .in('status', ['pending', 'pending_verification']);

      const unifiedPendingKeys = new Set<string>();
      (zelleOrdersRaw || []).forEach(o => {
        if (o.payment_status === 'pending' && o.zelle_proof_url) {
          const key = `${(o.client_email || '').trim().toLowerCase()}_${(o.product_slug || '').trim().toLowerCase().replace(/-/g, '_')}`;
          unifiedPendingKeys.add(key);
        }
      });

      if (migmaPaymentsRaw && migmaPaymentsRaw.length > 0) {
        const userIds = [...new Set(migmaPaymentsRaw.map(p => p.user_id))];
        const { data: clientsData } = await supabase.from('clients').select('id, email').in('id', userIds);
        const clientsMap = new Map((clientsData || []).map(c => [c.id, c.email]));
        const completedKeys = new Set((zelleOrdersRaw || []).filter(o => o.payment_status === 'completed').map(o => `${(o.client_email || '').trim().toLowerCase()}_${(o.product_slug || '').trim().toLowerCase().replace(/-/g, '_')}`));
        migmaPaymentsRaw.forEach(p => {
          const email = (clientsMap.get(p.user_id) || '').trim().toLowerCase();
          const product = (p.fee_type_global || '').trim().toLowerCase().replace(/-/g, '_');
          const key = `${email}_${product}`;
          if (!completedKeys.has(key)) unifiedPendingKeys.add(key);
        });
      }

      // 5. Orphan Sales Count
      const { count: orphanCount } = await supabase
        .from('visa_orders')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'completed')
        .or('seller_id.is.null,seller_id.eq.""');

      const { count: usersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'migma');

      setCounts({
        applications: appCount || 0,
        partnerContracts: partnerCount || 0,
        visaApprovals: visaApprovalsCount,
        zelle: unifiedPendingKeys.size,
        orphanSales: orphanCount || 0,
        tracking: 0,
        users: usersCount || 0
      });
    } catch (err) {
      console.error('Error loading sidebar counts:', err);
    }
  };

  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
    loadCounts();
  }, [location.pathname]);

  const sidebarContent = (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 pb-0 flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-gold-medium" />
          <h2 className="text-lg font-bold migma-gold-text">Admin Panel</h2>
        </div>
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

      <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-1 custom-scrollbar min-h-0">
        <SidebarItem icon={ClipboardList} label="Partner Applications" to="/dashboard" count={counts.applications} onClick={onMobileClose} />
        <SidebarItem icon={Phone} label="Book a Call" to="/dashboard/book-a-call" onClick={onMobileClose} />
        <SidebarItem icon={Calendar} label="Schedule Meeting" to="/dashboard/schedule-meeting" onClick={onMobileClose} />
        <SidebarItem icon={FileText} label="Partner Contracts" to="/dashboard/contracts" count={counts.partnerContracts} onClick={onMobileClose} />
        <SidebarItem icon={ShoppingCart} label="Visa Orders" to="/dashboard/visa-orders" onClick={onMobileClose} />
        <SidebarItem icon={DollarSign} label="Zelle Approval" to="/dashboard/zelle-approval" count={counts.zelle} onClick={onMobileClose} />
        
        {/* NEW Tracking item below Zelle */}
        <SidebarItem icon={Activity} label="Payment Tracking" to="/dashboard/tracking" count={counts.tracking} onClick={onMobileClose} />

        <div className="space-y-1">
          <button
            onClick={() => setIsCrmOpen(!isCrmOpen)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors group border border-transparent',
              (location.pathname.includes('/dashboard/users') || location.pathname.includes('/dashboard/crm'))
                ? 'bg-gold-medium/5 text-gold-light font-medium'
                : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
            )}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span>CRM</span>
            </div>
            <div className="flex items-center gap-2">
              {counts.users > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[1.25rem] text-center bg-gold-medium/20 text-gold-light">
                  {counts.users}
                </span>
              )}
              {isCrmOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </button>

          {isCrmOpen && (
            <div className="pl-6 space-y-1 mt-1">
              <Link
                to="/dashboard/users"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === '/dashboard/users'
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <div className="flex items-center gap-3">
                  <UserRound className="w-4 h-4" />
                  <span>All</span>
                </div>
                {counts.users > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[1.25rem] text-center bg-gold-medium/20 text-gold-light">
                    {counts.users}
                  </span>
                )}
              </Link>
              <Link
                to="/dashboard/crm/cos"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === '/dashboard/crm/cos'
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <UserRound className="w-4 h-4" />
                <span>COS</span>
              </Link>
              <Link
                to="/dashboard/crm/transfer"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === '/dashboard/crm/transfer'
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <UserRound className="w-4 h-4" />
                <span>Transfer</span>
              </Link>
            </div>
          )}
        </div>

        <SidebarItem icon={FileText} label="Client Contract Approval" to="/dashboard/visa-contract-approval" count={counts.visaApprovals} onClick={onMobileClose} />

        <div className="space-y-1">
          <button
            onClick={() => setIsRecurrenceOpen(!isRecurrenceOpen)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors group border border-transparent',
              (location.pathname.includes('eb3-recurring') || location.pathname.includes('eb2-recurring') || location.pathname.includes('scholarship-recurring'))
                ? 'bg-gold-medium/5 text-gold-light font-medium'
                : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
            )}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <span>Service Recurrence</span>
            </div>
            {isRecurrenceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isRecurrenceOpen && (
            <div className="pl-6 space-y-1 mt-1">
              <Link
                to="/dashboard/eb3-recurring"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname.includes('eb3-recurring')
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <Calendar className="w-4 h-4" />
                <span>EB-3 Recurring</span>
              </Link>
              <Link
                to="/dashboard/eb2-recurring"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname.includes('eb2-recurring')
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <Calendar className="w-4 h-4" />
                <span>EB-2 Recurring</span>
              </Link>
              <Link
                to="/dashboard/scholarship-recurring"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname.includes('scholarship-recurring')
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Scholarship Recurring</span>
              </Link>
            </div>
          )}
        </div>

        <SidebarItem icon={UserCircle2} label="Sellers & Sales" to="/dashboard/sellers" onClick={onMobileClose} />
        <SidebarItem icon={Crown} label="Head of Sales" to="/dashboard/head-of-sales" onClick={onMobileClose} />
        <SidebarItem icon={UserPlus} label="Sync Sales" to="/dashboard/sync-sales" count={counts.orphanSales} onClick={onMobileClose} />

        <div className="space-y-1">
          <button
            onClick={() => setIsLinksOpen(!isLinksOpen)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors group border border-transparent',
              (location.pathname.includes('/dashboard/links') || location.pathname.includes('/dashboard/create-service') || location.pathname.includes('/dashboard/tracking'))
                ? 'bg-gold-medium/5 text-gold-light font-medium'
                : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
            )}
          >
            <div className="flex items-center gap-3">
              <LinkIcon className="w-5 h-5" />
              <span>Sales Links</span>
            </div>
            {isLinksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isLinksOpen && (
            <div className="pl-6 space-y-1 mt-1">
              <Link
                to="/dashboard/links"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === '/dashboard/links'
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Generate Links</span>
              </Link>
              <Link
                to="/dashboard/create-service"
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === '/dashboard/create-service'
                    ? 'text-gold-light font-medium'
                    : 'text-gray-500 hover:text-gold-light'
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Service Link</span>
              </Link>
            </div>
          )}
        </div>

        <SidebarItem icon={Ticket} label="Vouchers & Coupons" to="/dashboard/coupons" onClick={onMobileClose} />
        <SidebarItem icon={FileCode} label="Contract Templates" to="/dashboard/contract-templates" onClick={onMobileClose} />
        <SidebarItem icon={Activity} label="Slack Reports" to="/dashboard/slack-reports" onClick={onMobileClose} />
        <SidebarItem icon={Mail} label="Contact Messages" to="/dashboard/contact-messages" onClick={onMobileClose} />
        <SidebarItem icon={UserCircle2} label="Profile" to="/dashboard/profile" onClick={onMobileClose} />
      </nav>
    </div>
  );

  return (
    <>
      <aside className={cn('hidden lg:flex w-64 bg-black/95 border-r border-gold-medium/30 min-h-screen flex-col', className)}>
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[100] lg:hidden"
            onClick={onMobileClose}
          />
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
