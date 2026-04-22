import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LanguageSelector } from '../../../components/LanguageSelector';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from 'react-i18next';

interface Props {
  serviceLabel: string;
}

export const CheckoutTopbar: React.FC<Props> = ({ serviceLabel }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Limpa o draft local caso o usuário decida deslogar
    const storageKeys = Object.keys(localStorage).filter(k => k.startsWith('migma_checkout_draft_'));
    storageKeys.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gold-medium/20">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo (Left) */}
        <div className="flex items-center">
          <img
            src="/favicon.png"
            alt="Migma"
            className="h-8 w-8 object-contain cursor-pointer rounded-lg"
            onClick={() => navigate('/')}
          />
        </div>

        {/* Title (Center) */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <h1 className="text-white font-bold text-sm tracking-[0.2em] uppercase whitespace-nowrap">
            Visa Checkout - {serviceLabel}
          </h1>
        </div>

        {/* Language & Actions (Right) */}
        <div className="flex items-center gap-4">
          <LanguageSelector />
          
          {session && (
            <button
              onClick={handleLogout}
              title={t('common.logout', 'Sair')}
              className="px-3 py-1.5 flex items-center gap-2 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.logout', 'Sair')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
