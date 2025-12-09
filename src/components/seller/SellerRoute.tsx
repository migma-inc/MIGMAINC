import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface SellerRouteProps {
  children: React.ReactNode;
}

export const SellerRoute = ({ children }: SellerRouteProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function verifyAccess() {
      try {
        // Check if user is authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }

        // Check if user is a seller
        const { data: sellerData, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (error || !sellerData) {
          console.error('[SellerRoute] Not a seller or inactive:', error);
          setIsAuthorized(false);
        } else {
          console.log('[SellerRoute] Seller authorized:', sellerData.email);
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('[SellerRoute] Error verifying access:', error);
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    }

    verifyAccess();
  }, [location.pathname]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authorized
  if (!isAuthorized) {
    return <Navigate to="/seller/login" state={{ from: location }} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
};




