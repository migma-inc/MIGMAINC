import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Play } from 'lucide-react';
import TransactionAnimation from '../../components/TransactionAnimation';

type ViewState = 'success' | 'cancelled' | 'verifying';

const PaymentSuccessPreview: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('success');
  const [animationKey, setAnimationKey] = useState(0);
  const [autoLoop, setAutoLoop] = useState(false);

  useEffect(() => {
    if (!autoLoop) return;
    const interval = setInterval(() => setAnimationKey(k => k + 1), 5000);
    return () => clearInterval(interval);
  }, [autoLoop]);

  const restart = useCallback(() => setAnimationKey(k => k + 1), []);

  return (
    <div className="fixed inset-0 bg-[#050300]">

      {/* Glow radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(206,159,72,0.07) 0%, transparent 70%)' }}
      />

      {/* Dev toolbar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2.5 flex-wrap"
        style={{ background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(206,159,72,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-xs font-bold">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <div className="w-px h-4 bg-white/10" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[#CE9F48]">Preview — Animação de Sucesso</span>
        <div className="w-px h-4 bg-white/10" />
        {(['success', 'verifying', 'cancelled'] as ViewState[]).map(s => (
          <button key={s} onClick={() => { setView(s); setAnimationKey(k => k + 1); }}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === s ? 'bg-[#CE9F48] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {s === 'success' ? '✅ Sucesso' : s === 'verifying' ? '⏳ Verificando' : '❌ Cancelado'}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10" />
        <button onClick={restart} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-bold transition-all">
          <RotateCcw className="w-3 h-3" /> Reiniciar
        </button>
        <button onClick={() => setAutoLoop(l => !l)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${autoLoop ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          <Play className="w-3 h-3" /> {autoLoop ? '🔁 Loop ativo' : 'Loop'}
        </button>
      </div>

      {/* ── VERIFYING ─────────────────────────────────────────────────────── */}
      {view === 'verifying' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-[#CE9F48]/15" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#CE9F48]" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-black text-lg uppercase tracking-widest">Confirmando pagamento</p>
              <p className="text-gray-600 text-sm">Aguarde um instante...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCELLED ─────────────────────────────────────────────────────── */}
      {view === 'cancelled' && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-3xl">✕</span>
            </div>
            <div>
              <h2 className="text-white font-black text-xl uppercase tracking-wide">Pagamento cancelado</h2>
              <p className="text-gray-500 mt-2 text-sm">Nenhum valor foi cobrado. Você pode tentar novamente.</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-black" style={{ background: 'linear-gradient(135deg, #CE9F48, #d4a843)' }}>
                Tentar novamente
              </button>
              <button className="w-full py-3 text-sm text-gray-500 hover:text-white transition-colors font-medium">
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
      {view === 'success' && (
        <div key={animationKey} className="absolute inset-0 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-8 text-center max-w-md w-full">

            {/* Hero: animação da máquina */}
            <div style={{ animation: 'popIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55) both' }}>
              <TransactionAnimation isSuccess={true} />
            </div>

            {/* Texto mínimo */}
            <div className="space-y-2" style={{ animation: 'fadeUp 0.5s 0.3s both' }}>
              <h1 className="text-white font-black text-3xl uppercase tracking-widest">Pagamento confirmado!</h1>
              <p className="text-[#CE9F48] font-medium">Parabéns, Caroline! 🎉</p>
            </div>

            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest" style={{ animation: 'fadeUp 0.5s 0.6s both' }}>
              Redirecionando para o dashboard...
            </p>

            <button className="text-gray-500 hover:text-[#CE9F48] text-xs transition-colors underline underline-offset-4" style={{ animation: 'fadeUp 0.5s 0.8s both' }}>
              Ir agora
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin   { from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }
        @keyframes popIn  { 0%{ opacity:0; transform: scale(0.6) translateY(20px); } 100%{ opacity:1; transform: scale(1) translateY(0); } }
        @keyframes fadeUp { 0%{ opacity:0; transform: translateY(12px); } 100%{ opacity:1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default PaymentSuccessPreview;
