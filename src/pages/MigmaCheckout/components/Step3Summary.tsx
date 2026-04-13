import React from 'react';
import { CheckCircle2, Download, ExternalLink, ArrowRight, User, Package, FileCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  userData: {
    fullName: string;
    email: string;
    processType: string;
    totalPrice: number;
  };
  onFinish: () => void;
}

const INFO_BOX_CLASS = "bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4";

export const Step3Summary: React.FC<Props> = ({ userData, onFinish }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header de Sucesso ── */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-gold-dark/10 border border-gold-medium/20 rounded-3xl p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-gold-light to-gold-dark rounded-full flex items-center justify-center shadow-lg shadow-gold-medium/20 flex-shrink-0">
          <CheckCircle2 className="w-10 h-10 text-black" strokeWidth={3} />
        </div>
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
            {t('migma_checkout.step3.title', 'Revisão Final')}
          </h2>
          <p className="text-gold-light/80 font-medium text-lg italic uppercase tracking-widest text-sm">
            Tudo pronto para concluir seu processo?
          </p>
        </div>
      </div>

      {/* ── Grid de Resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção: Perfil */}
        <div className={INFO_BOX_CLASS}>
          <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
            <User className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-widest text-xs">Informações do Aluno</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Nome Completo</p>
              <p className="text-white font-medium">{userData.fullName}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">E-mail de Acesso</p>
              <p className="text-white font-medium">{userData.email}</p>
            </div>
          </div>
        </div>

        {/* Seção: Processo */}
        <div className={INFO_BOX_CLASS}>
          <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
            <Package className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-widest text-xs">Resumo do Pedido</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Programa</p>
              <p className="text-white font-medium capitalize">{userData.processType}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Valor Final (Com Dependentes)</p>
              <p className="text-gold-light font-black text-xl">U$ {userData.totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Section ── */}
      <div className="bg-[#111] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-medium/5 blur-3xl rounded-full -mr-16 -mt-16" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
            <FileCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Verificação Completa</h3>
            <p className="text-gray-500 text-sm">Documentos e pagamento processados com sucesso.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl">
            <span className="text-gray-400 text-sm font-medium">Contrato Particular de Prestação de Serviços</span>
            <span className="text-emerald-400 text-xs font-bold uppercase px-3 py-1 bg-emerald-400/10 rounded-full border border-emerald-400/20">Registrado</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl">
            <span className="text-gray-400 text-sm font-medium">Documentação de Identidade e Selfie</span>
            <span className="text-emerald-400 text-xs font-bold uppercase px-3 py-1 bg-emerald-400/10 rounded-full border border-emerald-400/20">Validado</span>
          </div>
        </div>
      </div>

      {/* ── Final Action ── */}
      <div className="max-w-md mx-auto pt-6 text-center space-y-6">
        <button
          onClick={onFinish}
          className="group w-full py-6 rounded-2xl bg-gradient-to-b from-gold-light via-gold-medium to-gold-dark text-black font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-gold-medium/30 hover:shadow-gold-medium/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          {t('migma_checkout.step3.finish_button', 'Confirmar Conclusão')}
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">
          Sua jornada começa agora • Migma Group
        </p>
      </div>
    </div>
  );
};
