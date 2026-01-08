import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, ShoppingCart, Link as LinkIcon, Users, LogOut, BarChart3, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface SellerSidebarProps {
  className?: string;
  sellerName?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SellerSidebar({ className, sellerName, isMobileOpen = false, onMobileClose }: SellerSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/seller/login');
  };

  const menuItems = [
    {
      title: 'Overview',
      icon: LayoutDashboard,
      path: '/seller/dashboard',
      exact: true,
    },
    {
      title: 'Analytics',
      icon: BarChart3,
      path: '/seller/dashboard/analytics',
      exact: false,
    },
    {
      title: 'Conversion Funnel',
      icon: TrendingUp,
      path: '/seller/dashboard/funnel',
      exact: false,
    },
    {
      title: 'Orders',
      icon: ShoppingCart,
      path: '/seller/dashboard/orders',
      exact: false,
    },
    {
      title: 'Sales Links',
      icon: LinkIcon,
      path: '/seller/dashboard/links',
      exact: false,
    },
    {
      title: 'Leads & Users',
      icon: Users,
      path: '/seller/dashboard/leads',
      exact: false,
    },
  ];

  // Close mobile menu when route changes
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
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden text-gray-400 hover:text-gold-light p-1"
            aria-label="Close menu"
          >
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

      <div className="p-4 border-t border-gold-medium/30">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
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
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className={cn(
            'fixed left-0 top-0 h-full w-64 bg-black/95 border-r border-gold-medium/30 z-50 flex flex-col lg:hidden',
            'transform transition-transform duration-300 ease-in-out',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}


