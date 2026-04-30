import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TransactionAnimation from '../../components/TransactionAnimation';
import { supabase } from '../../lib/supabase';

type Stage = 'verifying' | 'success' | 'cancelled';

const PlacementFee2ndSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pfReturn = searchParams.get('pf_return');
  const [stage, setStage] = useState<Stage>('verifying');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (pfReturn === 'cancelled') {
      setStage('cancelled');
      return;
    }

    const verify = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setStudentName(profile.full_name.split(' ')[0]);
        }

        setStage('success');
      } catch {
        setStage('success');
      }
    };

    verify();
  }, [pfReturn, navigate]);

  // Redirect automático ao dashboard após 6s no estado success
  useEffect(() => {
    if (stage !== 'success') return;
    const timer = setTimeout(() => navigate('/student/dashboard'), 6000);
    return () => clearTimeout(timer);
  }, [stage, navigate]);

  // ── VERIFYING ────────────────────────────────────────────────────────────────
  if (stage === 'verifying') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Dark blur backdrop */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(5, 3, 0, 0.92)', backdropFilter: 'blur(20px)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-[#CE9F48]/15" />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#CE9F48]"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
          <div className="text-center space-y-1">
            <p className="text-white font-black text-lg uppercase tracking-widest">Confirmando pagamento</p>
            <p className="text-gray-600 text-sm">Aguarde um instante...</p>
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── CANCELLED ────────────────────────────────────────────────────────────────
  if (stage === 'cancelled') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(5, 0, 0, 0.92)', backdropFilter: 'blur(20px)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-3xl">✕</span>
          </div>
          <div>
            <h2 className="text-white font-black text-xl uppercase tracking-wide">Pagamento cancelado</h2>
            <p className="text-gray-500 mt-2 text-sm">Nenhum valor foi cobrado. Você pode tentar novamente.</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => navigate('/student/dashboard/payment/placement-fee-2nd')}
              className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-black transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #CE9F48, #d4a843)' }}
            >
              Tentar novamente
            </button>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full py-3 text-sm text-gray-500 hover:text-white transition-colors font-medium"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dark blur backdrop — same approach as MatriculaUSA PaymentStatusOverlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5, 3, 0, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      />

      {/* Soft golden glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(206,159,72,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Content — centered, full attention */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-md w-full">

        {/* Transaction card machine animation — the hero */}
        <div style={{ animation: 'popIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) both' }}>
          <TransactionAnimation isSuccess={true} />
        </div>

        {/* Text below animation */}
        <div className="space-y-2" style={{ animation: 'fadeUp 0.5s 0.3s both' }}>
          <h1 className="text-white font-black text-3xl uppercase tracking-widest">
            Pagamento confirmado!
          </h1>
          {studentName && (
            <p className="text-[#CE9F48] font-medium">
              Parabéns, {studentName}! 🎉
            </p>
          )}
        </div>

        {/* Subtle redirect hint */}
        <p
          className="text-gray-600 text-xs font-bold uppercase tracking-widest"
          style={{ animation: 'fadeUp 0.5s 0.6s both' }}
        >
          Redirecionando para o dashboard...
        </p>

        {/* Skip link */}
        <button
          onClick={() => navigate('/student/dashboard')}
          className="text-gray-500 hover:text-[#CE9F48] text-xs transition-colors underline underline-offset-4"
          style={{ animation: 'fadeUp 0.5s 0.8s both' }}
        >
          Ir agora
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          0%  { opacity: 0; transform: scale(0.6) translateY(20px); }
          100%{ opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeUp {
          0%  { opacity: 0; transform: translateY(12px); }
          100%{ opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default PlacementFee2ndSuccessPage;
