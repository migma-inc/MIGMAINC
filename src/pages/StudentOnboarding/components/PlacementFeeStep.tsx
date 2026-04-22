import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Building, Shield, Loader2, Award, DollarSign,
  Clock, ExternalLink, AlertCircle, MapPin
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

interface InstitutionApplication {
  id: string;
  status: string;
  payment_link_url: string | null;
  placement_fee_paid_at: string | null;
  admin_approved_at: string | null;
  institutions: {
    name: string;
    city: string;
    state: string;
  } | null;
  institution_scholarships: {
    scholarship_level: string | null;
    placement_fee_usd: number;
    discount_percent: number;
    tuition_annual_usd: number;
  } | null;
}

export const PlacementFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { userProfile } = useStudentAuth();
  const [applications, setApplications] = useState<InstitutionApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from('institution_applications')
        .select(`
          id, status, payment_link_url, placement_fee_paid_at, admin_approved_at,
          institutions ( name, city, state ),
          institution_scholarships ( scholarship_level, placement_fee_usd, discount_percent, tuition_annual_usd )
        `)
        .eq('profile_id', userProfile.id);
      
      if (error) throw error;
      setApplications((data as unknown as InstitutionApplication[]) || []);
    } catch (err) {
      console.error('[PlacementFeeStep]', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    fetchApplications();

    // Inscrição em tempo real para atualizações de status
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'institution_applications',
          filter: `profile_id=eq.${userProfile?.id}`
        },
        () => {
          console.log('[PlacementFeeStep] Mudança detectada, recarregando...');
          fetchApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchApplications, userProfile?.id]);

  // Encontrar a aplicação que está progredindo (aprovada ou paga)
  const activeApp = useMemo(() => {
    return applications.find(a => 
      ['payment_pending', 'payment_confirmed', 'approved'].includes(a.status)
    ) || applications.find(a => a.status === 'pending_admin_approval');
  }, [applications]);

  const isPaid = activeApp?.status === 'payment_confirmed';
  const isPendingApproval = activeApp?.status === 'pending_admin_approval';
  const isAwaitingPayment = activeApp?.status === 'payment_pending' || activeApp?.status === 'approved';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
      </div>
    );
  }

  // Estado: Usuário ainda não escolheu universidades
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <Building className="w-12 h-12 text-gray-600 mx-auto opacity-20" />
        <p className="text-gray-500">Nenhuma aplicação encontrada. Selecione suas faculdades primeiro.</p>
      </div>
    );
  }

  // Estado: Pago
  if (isPaid) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tight">
            Pagamento Confirmado!
          </h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            Sua vaga na <strong>{activeApp?.institutions?.name}</strong> está garantida. 
            Nossa equipe entrará em contato para iniciar o processo do I-20.
          </p>
          <button
            onClick={onNext}
            className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 px-8 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-gold-medium/20"
          >
            Continuar para Próximos Passos
          </button>
        </div>
      </div>
    );
  }

  // Estado: Aguardando Aprovação do Admin
  if (isPendingApproval) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="border border-white/5 bg-white/[0.02] rounded-3xl p-10 text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight leading-tight">
            Perfil em Revisão pela Banca Migma
          </h3>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            Nossa equipe de especialistas está revisando sua escolha da <strong>{activeApp?.institutions?.name}</strong>.
            Assim que aprovado, você receberá o link para pagamento do Placement Fee aqui.
          </p>
          <div className="flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-left">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Sua Seleção:</p>
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">{activeApp?.institutions?.name}</span>
              <span className="text-xs bg-gold-medium/10 text-gold-medium px-2 py-0.5 rounded-full font-bold">
                {activeApp?.institution_scholarships?.scholarship_level || `${activeApp?.institution_scholarships?.discount_percent}% OFF`}
              </span>
            </div>
          </div>
          <p className="mt-8 text-gray-600 text-xs">Aprovação costuma ocorrer em até 24h úteis.</p>
        </div>
      </div>
    );
  }

  // Estado: Aguardando Pagamento
  const scholar = activeApp?.institution_scholarships;
  const placementFee = scholar?.placement_fee_usd ?? 0;

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Próximo Passo — Step 4</p>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Garantia da Vaga</h2>
        <p className="text-gray-400 font-medium">
          Sua bolsa foi aprovada! Agora, realize o pagamento do Placement Fee para garantir sua vaga e benefícios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gold-medium/10 border border-gold-medium/20 flex items-center justify-center shrink-0">
                <Building className="w-7 h-7 text-gold-medium" />
              </div>
              <div>
                <h4 className="font-black text-white uppercase tracking-tight">{activeApp?.institutions?.name}</h4>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {activeApp?.institutions?.city}, {activeApp?.institutions?.state}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Bolsa Concedida</span>
                <span className="text-emerald-400 font-black">
                  {scholar?.scholarship_level || `${scholar?.discount_percent}% OFF`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Tuition Anual (Bolsista)</span>
                <span className="text-white font-bold">${scholar?.tuition_annual_usd.toLocaleString()}/yr</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black text-white uppercase tracking-widest">Proteção Migma</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Sua vaga está pré-reservada. Após o pagamento do Placement Fee, o valor da sua tuition anual é congelado por contrato.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col h-full ring-1 ring-white/10">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-6 h-6 text-gold-medium" />
            <h3 className="font-black text-white uppercase tracking-widest text-sm">Investimento Único</h3>
          </div>

          <div className="space-y-1 mb-8">
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Valor do Placement Fee</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">${placementFee.toLocaleString()}</span>
              <span className="text-gray-500 text-sm font-bold">USD</span>
            </div>
          </div>

          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Garantia vitalícia da bolsa negociada</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Suporte prioritário na emissão do I-20</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-gray-400">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Redução drástica no custo total da graduação</span>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            {activeApp?.payment_link_url ? (
              <a
                href={activeApp.payment_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-gold-medium hover:bg-gold-light text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-gold-medium/10 group"
              >
                Pagar com Parcelow
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <div className="flex flex-col items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-center">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                <p className="text-xs text-amber-200/70 font-medium">Gerando link seguro de pagamento...</p>
              </div>
            )}
            
            <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-tighter">
              🔒 Pagamento 100% Seguro via Parcelow (Cartão ou Pix)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
