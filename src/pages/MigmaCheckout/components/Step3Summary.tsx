import React, { useMemo } from 'react';
import { CheckCircle2, ArrowRight, User, Package, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  userData: {
    fullName: string;
    email: string;
    processType: string;
    totalPrice: number;
  };
  documents: {
    docFront: File | null;
    docBack: File | null;
    selfie: File | null;
  };
  personalInfo: {
    birthDate: string;
    docType: string;
    docNumber: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    nationality: string;
    civilStatus: string;
  };
  onFinish: () => void;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  passport: 'Passaporte',
  rg: 'RG',
  cnh: 'CNH',
};

const CIVIL_STATUS_LABEL: Record<string, string> = {
  single: 'Solteiro(a)',
  married: 'Casado(a)',
  divorced: 'Divorciado(a)',
  widowed: 'Viúvo(a)',
};

const INFO_BOX_CLASS = "bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4";

interface DocPreviewProps {
  file: File | null;
  label: string;
}

const DocPreview: React.FC<DocPreviewProps> = ({ file, label }) => {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{label}</p>
      {url ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[4/3] bg-black">
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-emerald-500/90 rounded-full p-1">
            <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 aspect-[4/3] bg-white/5 flex items-center justify-center">
          <p className="text-gray-600 text-xs">Não enviado</p>
        </div>
      )}
    </div>
  );
};

export const Step3Summary: React.FC<Props> = ({ userData, documents, personalInfo, onFinish }) => {
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
          <p className="text-gold-light/80 font-medium italic uppercase tracking-widest text-sm">
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
              <p className="text-white font-medium">{userData.processType}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Valor Final</p>
              <p className="text-gold-light font-black text-xl">U$ {userData.totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dados Pessoais ── */}
      <div className={INFO_BOX_CLASS}>
        <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
          <MapPin className="w-5 h-5" />
          <h3 className="font-black uppercase tracking-widest text-xs">Dados Pessoais</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {personalInfo.birthDate && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Data de Nascimento</p>
              <p className="text-white text-sm font-medium">{personalInfo.birthDate}</p>
            </div>
          )}
          {personalInfo.docNumber && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{DOC_TYPE_LABEL[personalInfo.docType] || personalInfo.docType}</p>
              <p className="text-white text-sm font-medium">{personalInfo.docNumber}</p>
            </div>
          )}
          {personalInfo.nationality && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Nacionalidade</p>
              <p className="text-white text-sm font-medium">{personalInfo.nationality}</p>
            </div>
          )}
          {personalInfo.civilStatus && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Estado Civil</p>
              <p className="text-white text-sm font-medium">{CIVIL_STATUS_LABEL[personalInfo.civilStatus] || personalInfo.civilStatus}</p>
            </div>
          )}
          {personalInfo.address && (
            <div className="col-span-2">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Endereço</p>
              <p className="text-white text-sm font-medium">
                {personalInfo.address}{personalInfo.city ? `, ${personalInfo.city}` : ''}{personalInfo.state ? ` - ${personalInfo.state}` : ''}{personalInfo.zipCode ? `, ${personalInfo.zipCode}` : ''}
              </p>
            </div>
          )}
          {personalInfo.country && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">País</p>
              <p className="text-white text-sm font-medium">{personalInfo.country}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Documentos Enviados ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4">
          <h3 className="font-black uppercase tracking-widest text-xs">Documentos Enviados</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <DocPreview file={documents.docFront} label="Frente" />
          <DocPreview file={documents.docBack} label="Verso" />
          <DocPreview file={documents.selfie} label="Selfie" />
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
