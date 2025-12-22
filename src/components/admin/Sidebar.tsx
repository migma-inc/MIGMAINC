import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardList, LayoutDashboard, Phone, ShoppingCart, DollarSign, UserCircle2, Mail, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();

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

  return (
    <aside className={cn('w-64 bg-black/95 border-r border-gold-medium/30 min-h-screen', className)}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-8">
          <LayoutDashboard className="w-6 h-6 text-gold-medium" />
          <h2 className="text-lg font-bold migma-gold-text">Admin Panel</h2>
        </div>

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
    </aside>
  );
}

