import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardList, LayoutDashboard, Phone, ShoppingCart, DollarSign, UserCircle2, Mail, FileCode, Calendar, X, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ className, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const menuItems = [
    {
      title: 'Applications',
      icon: ClipboardList,
      path: '/dashboard',
      exact: true,
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
    },
    {
      title: 'Visa Orders',
      icon: ShoppingCart,
      path: '/dashboard/visa-orders',
      exact: false,
    },
    {
      title: 'Zelle Approval',
      icon: DollarSign,
      path: '/dashboard/zelle-approval',
      exact: false,
    },
    {
      title: 'Sellers & Sales',
      icon: UserCircle2,
      path: '/dashboard/sellers',
      exact: false,
    },
    {
      title: 'Payment Requests',
      icon: Wallet,
      path: '/dashboard/payment-requests',
      exact: false,
    },
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
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-gold-medium/20 text-gold-light font-medium border border-gold-medium/50'
                  : 'text-gray-400 hover:bg-gold-medium/10 hover:text-gold-light'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.title}</span>
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

