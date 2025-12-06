import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface SellerRouteProps {
  children: React.ReactNode;
}

export const SellerRoute = ({ children }: SellerRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        // Check if user is a seller
        const { data: sellerData, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error || !sellerData) {
          console.error('[SellerRoute] Not a seller or inactive:', error);
          setIsAuthorized(false);
        } else {
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error('[SellerRoute] Auth check error:', err);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/seller/login" replace />;
  }

  return <>{children}</>;
};


