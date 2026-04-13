/**
 * Etapa 1 — Confirmação do pagamento da Taxa de Processo Seletivo.
 * O aluno chega aqui após o checkout da StudentRegistration page.
 * Se já pagou: mostra tela de confirmação e botão para continuar.
 * Se tem Zelle pendente: mostra tela de "em processamento".
 * Se não pagou: mostra tela de pagamento requerido.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../../../contexts/StudentAuthContext';
import { supabase } from '../../../../lib/supabase';
import type { StepProps } from '../../types';

export const SelectionFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const navigate = useNavigate();
  const { userProfile, user, loading: authLoading } = useStudentAuth();
  const hasPaid = userProfile?.has_paid_selection_process_fee;
  const isMigma = userProfile?.source === 'migma';
  const migmaCompleted = !!userProfile?.migma_checkout_completed_at;
  const [zellePending, setZellePending] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return; // Espera o perfil carregar
    
    if (isMigma && !migmaCompleted) {
      const service = userProfile?.service_type || 'transfer';
      navigate(`/student/checkout/${service}`);
    }
  }, [isMigma, migmaCompleted, userProfile?.service_type, navigate, authLoading]);

  useEffect(() => {
    if (hasPaid || !user?.id) {
      setZellePending(false);
      return;
    }
    supabase
      .from('migma_checkout_zelle_pending')
      .select('id')
      .eq('migma_user_id', user.id)
      .eq('status', 'pending_verification')
      .limit(1)
      .then(({ data }) => setZellePending((data?.length ?? 0) > 0));
  }, [hasPaid, user?.id]);

  if (!hasPaid && zellePending === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!hasPaid && zellePending) {
    return (
      <div className="space-y-10 pb-12 max-w-4xl mx-auto px-4">
        <div className="text-center md:text-left space-y-4">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">
            Almost there!
          </h2>
        </div>

        <div className="bg-white border border-gold-medium/30 ring-1 ring-gold-medium/20 rounded-[2.5rem] p-8 md:p-14 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-medium/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative z-10 text-center py-6">
            <div className="w-24 h-24 bg-gold-medium/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-gold-medium/20">
              <Clock className="w-14 h-14 text-gold-medium animate-pulse" />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-4 uppercase tracking-tight">
              Payment Processing
            </h3>
            <p className="text-gray-500 max-w-lg mx-auto mb-10 text-lg font-medium leading-relaxed">
              We received your payment receipt and it is currently being verified by our financial team.
              <br />
              <strong className="text-gold-dark">This process may take up to 48 business hours.</strong>
            </p>
            <div className="inline-flex items-center gap-3 bg-slate-50 text-slate-400 py-4 px-10 rounded-2xl font-black uppercase tracking-widest text-sm border border-slate-100">
              <span className="w-2 h-2 bg-gold-medium rounded-full animate-ping" />
              Waiting for Approval
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPaid) {
    return (
      <div className="space-y-10 pb-12 max-w-4xl mx-auto px-4">
        <div className="text-center md:text-left space-y-4">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">
            Payment Required
          </h2>
        </div>

        <div className="bg-white border border-red-500/10 ring-1 ring-red-500/5 rounded-[2.5rem] p-8 md:p-14 shadow-2xl text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative z-10">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
              <Clock className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-4 uppercase">Pending Selection Fee</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-10 text-lg font-medium leading-relaxed">
              The Selection Process Fee of <strong>$400</strong> has not been confirmed yet. <br />
              Please complete the payment to continue.
            </p>
            <a 
              href="/student/checkout/transfer" 
              className="inline-flex items-center gap-3 bg-blue-600 text-white py-5 px-12 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/30 hover:scale-105"
            >
              Go to Checkout <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12 max-w-4xl mx-auto px-4">
      <div className="text-center md:text-left space-y-4">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">
          Welcome to Migma!
        </h2>
      </div>

      <div className="bg-white border border-emerald-500/30 ring-1 ring-emerald-500/20 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10 text-center py-4">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-black text-gray-900 mb-3 uppercase tracking-tight">
            Payment Confirmed!
          </h3>
          <p className="text-gray-500 mb-8 font-medium">
            Your Selection Process Fee of <strong>$400</strong> has been received.
            Let's continue your journey to study in the USA.
          </p>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 bg-blue-600 text-white py-4 px-8 rounded-xl hover:bg-blue-700 transition-all font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Benefícios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Full Support', desc: 'Dedicated team guiding you throughout the process' },
          { title: 'Top Universities', desc: 'Access to scholarships at accredited US institutions' },
          { title: 'Guaranteed Results', desc: 'Our process ensures your acceptance' },
        ].map(item => (
          <div key={item.title} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="font-bold text-slate-900 mb-1">{item.title}</div>
            <div className="text-sm text-slate-500">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
