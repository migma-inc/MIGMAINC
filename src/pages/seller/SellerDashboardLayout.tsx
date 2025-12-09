import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SellerSidebar } from '@/components/seller/SellerSidebar';

interface SellerInfo {
  id: string;
  seller_id_public: string;
  full_name: string;
  email: string;
  status: string;
}

export function SellerDashboardLayout() {
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialCheckDone = false;

    const loadSeller = async () => {
      if (!mounted) return;

      try {
        // First check session (faster and more reliable)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError || !session) {
          console.log('[SellerDashboardLayout] No session found');
          setLoading(false);
          return;
        }

        const { data: sellerData, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (!mounted) return;

        if (error || !sellerData) {
          console.error('[SellerDashboardLayout] Not a seller or inactive:', error);
          setLoading(false);
          return;
        }

        console.log('[SellerDashboardLayout] Seller loaded:', sellerData.email);
        setSeller(sellerData);
      } catch (err) {
        console.error('[SellerDashboardLayout] Error loading seller:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          initialCheckDone = true;
        }
      }
    };

    // Do initial load
    loadSeller();

    // Listen for auth state changes (only after initial check is done)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip if initial check hasn't completed yet
      if (!initialCheckDone) {
        return;
      }

      if (!mounted) return;

      console.log('[SellerDashboardLayout] Auth state changed:', event);

      if (session) {
        // Re-load seller when auth state changes
        loadSeller();
      } else {
        setSeller(null);
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

  if (!seller) {
    return <Navigate to="/seller/login" replace />;
  }

  return (
    <div className="min-h-screen bg-black flex">
      <SellerSidebar sellerName={seller.full_name} />
      <main className="flex-1 overflow-auto bg-gradient-to-b from-black via-[#1a1a1a] to-black">
        <div className="p-8">
          <Outlet context={{ seller }} />
        </div>
      </main>
    </div>
  );
}

