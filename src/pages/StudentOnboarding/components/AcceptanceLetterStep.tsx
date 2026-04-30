import React, { useEffect, useRef, useState } from 'react';
import { Lock, CheckCircle, AlertTriangle, FileText, ExternalLink, ArrowRight, Info, Gift, Upload, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { getSecureUrl } from '../../../lib/storage';
import { DocumentViewerModal } from '../../../components/DocumentViewerModal';
import type { StepProps } from '../types';

interface ApplicationData {
  id: string;
  placement_fee_installments: number | null;
  placement_fee_2nd_installment_paid_at: string | null;
  acceptance_letter_url: string | null;
  transfer_form_url: string | null;
  transfer_form_filled_url: string | null;
  transfer_form_student_status: string | null;
  package_status: string | null;
  institutions: { name: string } | null;
}

export const AcceptanceLetterStep: React.FC<StepProps> = () => {
  const { userProfile } = useStudentAuth();
  const navigate = useNavigate();
  const [app, setApp] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [acceptanceLetterUrl, setAcceptanceLetterUrl] = useState<string | null>(null);
  const [transferTemplateUrl, setTransferTemplateUrl] = useState<string | null>(null);
  const [transferFilledUrl, setTransferFilledUrl] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const openViewer = (url: string | null, title: string) => {
    if (!url) return;
    setViewerUrl(url);
    setViewerTitle(title);
    setIsViewerOpen(true);
  };

  const isTransfer = userProfile?.student_process_type === 'transfer';

  useEffect(() => {
    if (!userProfile?.id) return;
    supabase
      .from('institution_applications')
      .select('id, placement_fee_installments, placement_fee_2nd_installment_paid_at, acceptance_letter_url, transfer_form_url, transfer_form_filled_url, transfer_form_student_status, package_status, institutions(name)')
      .eq('profile_id', userProfile.id)
      .in('status', ['payment_confirmed', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        setApp(data as ApplicationData | null);
        if (data) {
          const [letter, template, filled] = await Promise.all([
            getSecureUrl(data.acceptance_letter_url),
            getSecureUrl(data.transfer_form_url),
            getSecureUrl(data.transfer_form_filled_url)
          ]);
          setAcceptanceLetterUrl(letter);
          setTransferTemplateUrl(template);
          setTransferFilledUrl(filled);
        }
        setLoading(false);
      });
  }, [userProfile?.id]);

  const handleTransferFormUpload = async (file: File) => {
    if (!app?.id || !userProfile?.id) return;
    setUploadingForm(true);
    try {
      const ext = file.name.split('.').pop() ?? 'pdf';
      const path = `${userProfile.id}/transfer-form-filled/${Date.now()}_transfer_form_filled.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('institution-forms')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('institution-forms')
        .createSignedUrl(uploadData.path, TEN_YEARS);
      if (signedErr) throw signedErr;
      const publicUrl = signedData.signedUrl;

      const { error: updateErr } = await supabase
        .from('institution_applications')
        .update({
          transfer_form_filled_url: publicUrl,
          transfer_form_student_status: 'submitted',
        })
        .eq('id', app.id);
      if (updateErr) throw updateErr;

      // Notify MatriculaUSA
      await supabase.functions.invoke('notify-matriculausa-transfer-form', {
        body: {
          student_email: userProfile.email,
          student_name: userProfile.full_name,
          filled_form_url: publicUrl,
          migma_application_id: app.id,
        },
      }).catch(() => { /* non-fatal */ });

      setApp(prev => prev ? { ...prev, transfer_form_filled_url: publicUrl, transfer_form_student_status: 'submitted' } : prev);
      setUploadSuccess(true);
    } catch (err) {
      console.error('[AcceptanceLetterStep] upload error:', err);
      alert('Erro ao enviar o formulário. Tente novamente.');
    } finally {
      setUploadingForm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-8 h-8 border-2 border-gold-medium border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const is2xPending =
    app?.placement_fee_installments === 2 &&
    !app?.placement_fee_2nd_installment_paid_at;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-medium/10 border border-gold-medium/20 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gold-medium" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Carta de Aceite
        </h2>
        <p className="text-gray-400 mt-2 text-sm">
          {app?.institutions?.name ?? 'Universidade'}
        </p>
      </div>

      {/* Gate financeiro — 2ª parcela pendente */}
      {is2xPending && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base mb-1">Acesso bloqueado</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Seu Placement Fee foi pago em 2 parcelas. A 2ª parcela ainda está pendente.
                Após a confirmação do pagamento, sua carta de aceite será liberada automaticamente.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-2 w-fit">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Aguardando confirmação da 2ª parcela</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      {!is2xPending && (
        <>
          {/* Status do pacote */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Pacote enviado ao MatriculaUSA</p>
                <p className="text-gray-500 text-xs mt-0.5">Seus formulários e documentos foram enviados para processamento</p>
              </div>
            </div>
          </div>

          {/* Carta de aceite */}
          {app?.acceptance_letter_url ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-white font-bold mb-1">Carta de Aceite disponível</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Sua carta de aceite foi emitida pela universidade. Faça o download abaixo.
                  </p>
                  <Button
                    onClick={() => openViewer(acceptanceLetterUrl, 'Carta de Aceite')}
                    disabled={!acceptanceLetterUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors text-sm border-none"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Baixar Carta de Aceite
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gold-medium/20 bg-gold-medium/5 p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-gold-medium" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">I-20 em processamento</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Seu pacote foi enviado ao MatriculaUSA. Assim que a universidade emitir
                    seu I-20 e a Carta de Aceite, você será notificado por e-mail e WhatsApp.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gold-medium bg-gold-medium/10 rounded-xl px-4 py-2 w-fit">
                    <div className="w-2 h-2 rounded-full bg-gold-medium animate-pulse" />
                    <span>Aguardando emissão pela universidade</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Form — apenas para transfer students */}
          {isTransfer && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-bold">Transfer Form</h3>
              </div>

              {/* Step 1: Download template */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Passo 1 — Baixar o formulário</p>
                {app?.transfer_form_url ? (
                  <Button
                    onClick={() => openViewer(transferTemplateUrl, 'Transfer Form - Modelo')}
                    disabled={!transferTemplateUrl}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 font-semibold rounded-xl transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Baixar Transfer Form
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4" />
                    <span>Aguardando envio do Transfer Form pela equipe MatriculaUSA</span>
                  </div>
                )}
              </div>

              {/* Step 2: Upload filled form */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Passo 2 — Entregar na escola atual e reenviar preenchido</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Leve o Transfer Form ao DSO da sua escola atual, solicite a assinatura e o envio do SEVIS release, depois faça o upload do formulário preenchido aqui.
                </p>

                {app?.transfer_form_filled_url || uploadSuccess ? (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-300 text-sm font-semibold">Formulário enviado com sucesso</p>
                      <button
                        onClick={() => openViewer(transferFilledUrl, 'Transfer Form Enviado')}
                        className="text-xs text-emerald-400 hover:underline mt-0.5 block text-left"
                      >
                        Ver formulário enviado
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleTransferFormUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingForm || !app?.transfer_form_url}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      {uploadingForm ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                      ) : (
                        <><Upload className="w-4 h-4" />Enviar formulário preenchido</>
                      )}
                    </button>
                    {!app?.transfer_form_url && (
                      <p className="text-xs text-gray-600 mt-2">Disponível após receber o Transfer Form</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rewards CTA */}
          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Indique amigos e reduza sua tuition</p>
                <p className="text-gray-400 text-xs mt-0.5">10 indicações = mensalidade Migma zerada</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/student/dashboard/rewards')}
              className="shrink-0 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-xs transition-colors"
            >
              Ver Rewards
            </button>
          </div>
        </>
      )}

      <DocumentViewerModal 
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        url={viewerUrl}
        title={viewerTitle}
      />
    </div>
  );
};
