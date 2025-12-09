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

const SELLER_CACHE_KEY = 'seller_cache';
const SELLER_CACHE_TIMESTAMP_KEY = 'seller_cache_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function getCachedSeller(): SellerInfo | null {
  try {
    const cached = sessionStorage.getItem(SELLER_CACHE_KEY);
    const timestamp = sessionStorage.getItem(SELLER_CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > CACHE_DURATION) {
      // Cache expirado
      sessionStorage.removeItem(SELLER_CACHE_KEY);
      sessionStorage.removeItem(SELLER_CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    return JSON.parse(cached);
  } catch (err) {
    console.error('[SellerDashboardLayout] Error reading cache:', err);
    return null;
  }
}

function setCachedSeller(seller: SellerInfo): void {
  try {
    sessionStorage.setItem(SELLER_CACHE_KEY, JSON.stringify(seller));
    sessionStorage.setItem(SELLER_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (err) {
    console.error('[SellerDashboardLayout] Error saving cache:', err);
  }
}

function clearCachedSeller(): void {
  try {
    sessionStorage.removeItem(SELLER_CACHE_KEY);
    sessionStorage.removeItem(SELLER_CACHE_TIMESTAMP_KEY);
  } catch (err) {
    console.error('[SellerDashboardLayout] Error clearing cache:', err);
  }
}

export function SellerDashboardLayout() {
  // Tenta carregar do cache imediatamente para evitar loading
  const cachedSeller = getCachedSeller();
  const [seller, setSeller] = useState<SellerInfo | null>(cachedSeller);
  const [loading, setLoading] = useState(!cachedSeller);

  useEffect(() => {
    async function loadSeller() {
      try {
        // First check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setSeller(null);
          setLoading(false);
          clearCachedSeller();
          return;
        }

        // Fetch seller from database
        const { data: sellerData, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (error || !sellerData) {
          console.error('[SellerDashboardLayout] Not a seller or inactive:', error);
          setSeller(null);
          setLoading(false);
          clearCachedSeller();
          return;
        }

        // Save to cache and state
        setCachedSeller(sellerData);
        setSeller(sellerData);
      } catch (err) {
        console.error('[SellerDashboardLayout] Error loading seller:', err);
        setSeller(null);
        clearCachedSeller();
      } finally {
        setLoading(false);
      }
    }

    // If we have cache, restore immediately and validate in background
    if (cachedSeller) {
      // Restore from cache immediately if not already in state
      if (!seller) {
        setSeller(cachedSeller);
        setLoading(false);
      }
      // Validate in background without blocking UI
      loadSeller();
    } else {
      // If no cache, load normally
      loadSeller();
    }
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


