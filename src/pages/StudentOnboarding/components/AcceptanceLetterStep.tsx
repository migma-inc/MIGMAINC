import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle, AlertTriangle, FileText, ExternalLink, ArrowRight, Info, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

interface ApplicationData {
  id: string;
  placement_fee_installments: number | null;
  placement_fee_2nd_installment_paid_at: string | null;
  acceptance_letter_url: string | null;
  package_status: string | null;
  institutions: { name: string } | null;
}

export const AcceptanceLetterStep: React.FC<StepProps> = () => {
  const { userProfile } = useStudentAuth();
  const navigate = useNavigate();
  const [app, setApp] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);

  const isTransfer = userProfile?.student_process_type === 'transfer';

  useEffect(() => {
    if (!userProfile?.id) return;
    supabase
      .from('institution_applications')
      .select('id, placement_fee_installments, placement_fee_2nd_installment_paid_at, acceptance_letter_url, package_status, institutions(name)')
      .eq('profile_id', userProfile.id)
      .in('status', ['payment_confirmed', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setApp(data as ApplicationData | null);
        setLoading(false);
      });
  }, [userProfile?.id]);

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

      {/* Conteúdo principal — só exibe se gate liberado */}
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

          {/* Carta de aceite / I-20 */}
          {app?.acceptance_letter_url ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-white font-bold mb-1">Carta de Aceite disponível</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Sua carta de aceite foi emitida pela universidade. Faça o download abaixo.
                  </p>
                  <a
                    href={app.acceptance_letter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Baixar Carta de Aceite
                  </a>
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
              onClick={() => navigate('/student/rewards')}
              className="shrink-0 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-xs transition-colors"
            >
              Ver Rewards
            </button>
          </div>

          {/* Instruções Transfer Form — apenas para process_type = transfer */}
          {isTransfer && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-bold">Instruções — Transfer Form</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Como parte do processo de transfer F-1, você precisa entregar o Transfer Form
                à sua escola atual (escola de origem) para liberar o seu SEVIS.
              </p>
              <ol className="space-y-3">
                {[
                  'Receba o Transfer Form emitido pela nova universidade (incluso no seu pacote)',
                  'Leve o documento ao Designated School Official (DSO) da sua escola atual',
                  'Solicite que o DSO assine e processe o transfer no SEVIS',
                  'Aguarde a confirmação de release do SEVIS pela equipe Migma',
                  'Com o SEVIS liberado, seu I-20 final será emitido pela nova universidade',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-300 text-sm">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-300">
                Dúvidas? Entre em contato com a equipe Migma via WhatsApp.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
