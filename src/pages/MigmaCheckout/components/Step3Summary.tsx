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
  documentUrls?: {
    docFront: string | null;
    docBack: string | null;
    selfie: string | null;
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

const INFO_BOX_CLASS = "bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4";

const CIVIL_STATUS_KEY: Record<string, string> = {
  single: 'single',
  married: 'married',
  divorced: 'divorced',
  widowed: 'widowed',
};

interface DocPreviewProps {
  file: File | null;
  label: string;
  fallbackUrl?: string | null;
  emptyLabel: string;
}

const DocPreview: React.FC<DocPreviewProps> = ({ file, label, fallbackUrl, emptyLabel }) => {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const url = objectUrl ?? fallbackUrl ?? null;

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
          <p className="text-gray-600 text-xs">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
};

export const Step3Summary: React.FC<Props> = ({ userData, documents, documentUrls, personalInfo, onFinish }) => {
  const { t } = useTranslation();
  const docTypeLabel = t(`docs.${personalInfo.docType}`, personalInfo.docType);
  const civilStatusLabel = t(`checkout.${CIVIL_STATUS_KEY[personalInfo.civilStatus] || personalInfo.civilStatus}`, personalInfo.civilStatus);
  const emptyDocLabel = t('migma_checkout.step3.not_sent', 'Not sent');

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
            {t('migma_checkout.step3.ready_subtitle', 'Ready to complete your process?')}
          </p>
        </div>
      </div>

      {/* ── Grid de Resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção: Perfil */}
        <div className={INFO_BOX_CLASS}>
          <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
            <User className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-widest text-xs">{t('migma_checkout.step3.student_info', 'Student Information')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.full_name', 'Full Name')}</p>
              <p className="text-white font-medium">{userData.fullName}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.access_email', 'Access Email')}</p>
              <p className="text-white font-medium">{userData.email}</p>
            </div>
          </div>
        </div>

        {/* Seção: Processo */}
        <div className={INFO_BOX_CLASS}>
          <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
            <Package className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-widest text-xs">{t('migma_checkout.step3.order_summary', 'Order Summary')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.program', 'Program')}</p>
              <p className="text-white font-medium">{userData.processType}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.final_amount', 'Final Amount')}</p>
              <p className="text-gold-light font-black text-xl">U$ {userData.totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dados Pessoais ── */}
      <div className={INFO_BOX_CLASS}>
        <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4 mb-4">
          <MapPin className="w-5 h-5" />
          <h3 className="font-black uppercase tracking-widest text-xs">{t('migma_checkout.step3.personal_data', 'Personal Data')}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {personalInfo.birthDate && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.birth_date', 'Date of Birth')}</p>
              <p className="text-white text-sm font-medium">{personalInfo.birthDate}</p>
            </div>
          )}
          {personalInfo.docNumber && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{docTypeLabel}</p>
              <p className="text-white text-sm font-medium">{personalInfo.docNumber}</p>
            </div>
          )}
          {personalInfo.nationality && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.nationality', 'Nationality')}</p>
              <p className="text-white text-sm font-medium">{personalInfo.nationality}</p>
            </div>
          )}
          {personalInfo.civilStatus && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.marital_status', 'Marital Status')}</p>
              <p className="text-white text-sm font-medium">{civilStatusLabel}</p>
            </div>
          )}
          {personalInfo.address && (
            <div className="col-span-2">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.address', 'Address')}</p>
              <p className="text-white text-sm font-medium">
                {personalInfo.address}{personalInfo.city ? `, ${personalInfo.city}` : ''}{personalInfo.state ? ` - ${personalInfo.state}` : ''}{personalInfo.zipCode ? `, ${personalInfo.zipCode}` : ''}
              </p>
            </div>
          )}
          {personalInfo.country && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">{t('migma_checkout.step3.country', 'Country')}</p>
              <p className="text-white text-sm font-medium">{personalInfo.country}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Documentos Enviados ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 text-gold-medium border-b border-white/5 pb-4">
          <h3 className="font-black uppercase tracking-widest text-xs">{t('migma_checkout.step3.sent_documents', 'Uploaded Documents')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <DocPreview file={documents.docFront} label={t('migma_checkout.step3.doc_front', 'Front')} fallbackUrl={documentUrls?.docFront} emptyLabel={emptyDocLabel} />
          <DocPreview file={documents.docBack} label={t('migma_checkout.step3.doc_back', 'Back')} fallbackUrl={documentUrls?.docBack} emptyLabel={emptyDocLabel} />
          <DocPreview file={documents.selfie} label={t('migma_checkout.step3.doc_selfie', 'Selfie')} fallbackUrl={documentUrls?.selfie} emptyLabel={emptyDocLabel} />
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
          {t('migma_checkout.step3.footer_note', 'Your journey starts now • Migma Group')}
        </p>
      </div>
    </div>
  );
};
