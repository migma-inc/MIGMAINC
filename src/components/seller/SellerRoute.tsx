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
    let mounted = true;
    let initialCheckDone = false;

    const checkAuth = async () => {
      if (!mounted) return;

      try {
        // First check session (faster and more reliable)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError || !session) {
          console.log('[SellerRoute] No session found');
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        // Check if user is a seller
        const { data: sellerData, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (!mounted) return;

        if (error || !sellerData) {
          console.error('[SellerRoute] Not a seller or inactive:', error);
          setIsAuthorized(false);
        } else {
          console.log('[SellerRoute] Seller authorized:', sellerData.email);
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error('[SellerRoute] Auth check error:', err);
        if (mounted) {
          setIsAuthorized(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          initialCheckDone = true;
        }
      }
    };

    // Do initial check
    checkAuth();

    // Listen for auth state changes (only after initial check is done)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip if initial check hasn't completed yet
      if (!initialCheckDone) {
        return;
      }

      if (!mounted) return;

      console.log('[SellerRoute] Auth state changed:', event);

      if (session) {
        // Re-check seller status when auth state changes
        setLoading(true);
        try {
          const { data: sellerData, error } = await supabase
            .from('sellers')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .single();

          if (!mounted) return;

          if (error || !sellerData) {
            setIsAuthorized(false);
          } else {
            setIsAuthorized(true);
          }
        } catch (err) {
          console.error('[SellerRoute] Auth state change error:', err);
          if (mounted) {
            setIsAuthorized(false);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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




