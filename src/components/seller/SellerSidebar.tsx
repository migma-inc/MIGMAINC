import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, ShoppingCart, Link as LinkIcon, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SellerSidebarProps {
  className?: string;
  sellerName?: string;
}

export function SellerSidebar({ className, sellerName }: SellerSidebarProps) {
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

  return (
    <aside className={cn('w-64 bg-black/95 border-r border-gold-medium/30 min-h-screen flex flex-col', className)}>
      <div className="p-4 flex-1">
        <div className="flex items-center gap-2 mb-8">
          <LayoutDashboard className="w-6 h-6 text-gold-medium" />
          <h2 className="text-lg font-bold migma-gold-text">Seller Panel</h2>
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
    </aside>
  );
}

