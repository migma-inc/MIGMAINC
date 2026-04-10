/**
 * Etapa 1 — Confirmação do pagamento da Taxa de Processo Seletivo.
 * O aluno chega aqui após o checkout da StudentRegistration page.
 * Se já pagou: mostra tela de confirmação e botão para continuar.
 * Se não pagou: redireciona para a página de registro (não deve acontecer no fluxo normal).
 */
import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useStudentAuth } from '../../../../contexts/StudentAuthContext';
import type { StepProps } from '../../types';

export const SelectionFeeStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile } = useStudentAuth();
  const hasPaid = userProfile?.has_paid_selection_process_fee;

  if (!hasPaid) {
    return (
      <div className="space-y-6 pb-12 max-w-2xl mx-auto px-4 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <h2 className="text-2xl font-black text-amber-900 mb-2">Payment Required</h2>
          <p className="text-amber-700">
            The Selection Process Fee of <strong>$400</strong> has not been confirmed yet.
            Please complete the payment to continue.
          </p>
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
