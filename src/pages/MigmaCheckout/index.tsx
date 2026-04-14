/**
 * Migma Visa Checkout — Página única com 2 steps.
 * Serviço determinado pela URL: /student/checkout/:service
 *
 * Step 1: Dados pessoais + Contrato + Pagamento
 * Step 2: Documentos -> Onboarding
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Clock, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CheckoutTopbar } from './components/CheckoutTopbar';
import { CheckoutProgressBar } from './components/CheckoutProgressBar';
import { Step1PersonalInfo } from './components/Step1PersonalInfo';
import { Step2Documents } from './components/Step2Documents';
import { ProcessingModal } from './components/ProcessingModal';
import { useIPDetection } from './hooks/useIPDetection';
import { getServiceConfig } from './serviceConfigs';
import { matriculaApi } from '../../lib/matriculaApi';
import { supabase } from '../../lib/supabase';
import { processZellePaymentWithN8n } from '../../lib/zelle-n8n-integration';
import type { Step1Data, Step2Data, CheckoutState, PaymentMethod, CardOwnership, IPRegion, PayerInfo } from './types';

interface ExtendedState extends CheckoutState {
  matriculaUserId: string | null;
  serviceRequestId: string | null;
  orderId: string | null;
}

interface StripeReturnState {
  userId: string;
  matriculaUserId: string | null;
  totalPrice: number;
  serviceType: string;
  serviceRequestId: string | null;
  step1Data: Step1Data;
}

const STRIPE_LS_KEY = 'migma_stripe_checkout_state';
const getDraftKey = (service: string | undefined) => `migma_checkout_draft_${service || 'default'}`;

const MigmaCheckout: React.FC = () => {
  const { t } = useTranslation();
  const { service } = useParams<{ service: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const config = service ? getServiceConfig(service) : null;
  const { region, loading: regionLoading } = useIPDetection();

  const [state, setState] = useState<ExtendedState>({
    currentStep: 1,
    step1Completed: false,
    step2Completed: false,
    paymentConfirmed: false,
    zelleProcessing: false,
    userId: null,
    totalPrice: 0,
    matriculaUserId: null,
    serviceRequestId: crypto.randomUUID(),
    orderId: null,
  });

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [, setStep2Data] = useState<Step2Data | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processMessage, setProcessMessage] = useState('');
  const stripeHandledRef = useRef(false);
  // Ref para capturar order_id de createStudent de forma síncrona (evita race condition com setState)
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stripeSessionId = searchParams.get('stripe_session_id');
    const stripeCancelled = searchParams.get('stripe_cancelled');

    if (stripeSessionId) {
      if (stripeHandledRef.current) return;
      stripeHandledRef.current = true;
      handleStripeReturn(stripeSessionId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeCancelled) {
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      restoreDraftSession();
    }

    // Detect Parcelow Success
    const success = searchParams.get('success');
    const orderId = searchParams.get('order_id');
    if (success === 'true' && orderId) {
       handlePaymentSuccess(orderId);
    }
  }, [searchParams]);

  const handlePaymentSuccess = async (_orderId: string) => {
    setPaymentLoading(true);
    try {
      // Pequeno delay para garantir que o webhook processou (opcional, mas seguro)
      await new Promise(r => setTimeout(r, 1500));
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;

      if (userId) {
        setState(prev => ({
          ...prev,
          userId,
          step1Completed: true,
          paymentConfirmed: true,
          currentStep: 2,
        }));
        
        // Limpar URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      console.error('Error handling payment success:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  const restoreDraftSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setState(prev => ({ ...prev, userId: session.user.id }));

    let draftLoaded = false;
    const draftRaw = localStorage.getItem(getDraftKey(service));
    
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        if (draft.state?.userId === session.user.id) {
          setStep1Data(draft.step1Data);
          if (draft.step2Data) setStep2Data(draft.step2Data);
          setState(prev => ({
            ...prev,
            ...draft.state,
            userId: session.user.id,
            currentStep: draft.state.currentStep || 1,
          }));
          draftLoaded = true;
        }
      } catch (e) {
        console.warn('Failed to restore checkout draft', e);
      }
    }

    if (!draftLoaded) {
      const { data: profile } = await supabase.from('user_profiles').select('signature_url').eq('user_id', session.user.id).maybeSingle();
      setStep1Data({
        full_name: session.user.user_metadata?.full_name || '',
        email: session.user.email || '',
        phone: session.user.user_metadata?.phone || '',
        password: '',
        confirm_password: '',
        num_dependents: null,
        terms_accepted: false,
        data_accepted: false,
        signature_data_url: profile?.signature_url || null
      });
    }
  };

  useEffect(() => {
    if (state.step1Completed && state.userId && step1Data) {
      localStorage.setItem(getDraftKey(service), JSON.stringify({
        state: {
          userId: state.userId,
          totalPrice: state.totalPrice,
          matriculaUserId: state.matriculaUserId,
          step1Completed: state.step1Completed,
          step2Completed: state.step2Completed,
          currentStep: state.currentStep
        },
        step1Data,
        step2Data: null 
      }));
    }
  }, [state.step1Completed, state.step2Completed, state.userId, state.totalPrice, state.matriculaUserId, state.currentStep, step1Data, service]);

  const handleStripeReturn = async (_sessionId: string) => {
    setPaymentLoading(true);
    try {
      const raw = localStorage.getItem(STRIPE_LS_KEY);
      if (!raw) throw new Error('Sessão expirada. Por favor, comece novamente.');

      const saved: StripeReturnState = JSON.parse(raw);
      const { userId, matriculaUserId, totalPrice, step1Data: savedStep1 } = saved;

      await matriculaApi.paymentCompleted({
        user_id: userId,
        fee_type: 'selection_process',
        amount: totalPrice,
        payment_method: 'stripe',
        service_type: saved.serviceType,
        service_request_id: saved.serviceRequestId || undefined,
        ...(matriculaUserId ? { matricula_user_id: matriculaUserId } : {}),
      });

      localStorage.removeItem(STRIPE_LS_KEY);
      setStep1Data(savedStep1);
      setState(prev => ({
        ...prev,
        userId,
        totalPrice,
        matriculaUserId,
        step1Completed: true,
        paymentConfirmed: true,
        currentStep: 2,
      }));

    } catch (err: any) {
      console.error('[MigmaCheckout] Stripe return critical error:', err);
      alert('Erro ao processar retorno do pagamento: ' + err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRegisterUser = async (
    data: Pick<Step1Data, 'full_name' | 'email' | 'phone' | 'password'>,
    numDependents?: number | null,
    total?: number,
  ): Promise<string> => {
    const email = data.email.trim();
    const password = data.password!;
    const phoneClean = data.phone.replace(/\D/g, '');

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: data.full_name.trim(), phone: phoneClean, source: 'migma' } },
    });

    let userId: string;
    if (authErr) {
      if (authErr.message.includes('already registered')) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw new Error('Usuário já cadastrado, mas a senha está incorreta.');
        userId = signInData.user!.id;
      } else {
        throw new Error(authErr.message);
      }
    } else {
      if (!authData.user?.id) throw new Error('Falha ao registrar usuário.');
      userId = authData.user.id;
    }

    const sellerId = searchParams.get('ref') || searchParams.get('seller_id');
    const agentId = searchParams.get('agent') || searchParams.get('agent_id');

    const slugMap: Record<string, string> = {
      'cos': 'cos-selection-process',
      'transfer': 'transfer-selection-process',
      'initial': 'initial-selection-process',
    };
    const finalServiceType = service ? (slugMap[service] || service) : 'transfer-selection-process';

    // Chama createStudent de forma síncrona para garantir order_id antes do Parcelow
    try {
      const res = await matriculaApi.createStudent({
        migma_user_id: userId,
        email,
        full_name: data.full_name.trim(),
        phone: phoneClean,
        service_type: finalServiceType,
        num_dependents: numDependents ?? 0,
        total_price: total,
        migma_seller_id: sellerId || undefined,
        migma_agent_id: agentId || undefined,
        // Sem service_request_id — evita FK violation
      });
      if (res?.order_id) {
        orderIdRef.current = res.order_id;
        setState(prev => ({ ...prev, orderId: res.order_id! }));
      }
    } catch (err) {
      console.warn('[MigmaCheckout] createStudent failed (non-blocking):', err);
    }

    return userId;
  };

  const handleStep1Complete = async (
    data: Step1Data,
    registeredUserId: string,  // já vem do onRegisterUser — não chama de novo
    total: number,
    payment: { method: PaymentMethod; receipt: File | null; cardOwnership?: CardOwnership; cpf?: string; payerInfo?: PayerInfo }
  ) => {
    setProcessing(true);
    setProgress(10);
    setProcessMessage('Iniciando registro...');

    try {
      const userId = registeredUserId;
      // Para Parcelow precisamos do order_id de forma síncrona — usa o ref
      const orderId = orderIdRef.current;
      
      setProgress(25);
      setProcessMessage('Salvando assinatura digital...');
      
      if (data.signature_data_url && data.signature_data_url.startsWith('data:')) {
        const signatureBase64 = data.signature_data_url.split(',')[1];
        const binaryString = atob(signatureBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fileName = `${userId}/sig_${Date.now()}.png`;
        const { error: uploadErr } = await supabase.storage.from('visa-signatures').upload(fileName, bytes, { contentType: 'image/png' });
        if (!uploadErr) {
          const { data: publicData } = supabase.storage.from('visa-signatures').getPublicUrl(fileName);
          await supabase.from('user_profiles').update({ signature_url: publicData.publicUrl }).eq('user_id', userId);
        }
      }

      if (payment.method === 'stripe') {
        setProgress(60);
        setProcessMessage('Preparando pagamento via Stripe...');
        const result = await matriculaApi.stripeStudentCheckout({
          amount: total,
          user_id: userId,
          email: data.email,
          full_name: data.full_name,
          service_type: service ?? 'transfer',
          service_request_id: state.serviceRequestId || undefined,
          origin: window.location.origin,
        });
        const stripeState: StripeReturnState = {
          userId,
          matriculaUserId: state.matriculaUserId,
          totalPrice: total,
          serviceType: service ?? 'transfer',
          serviceRequestId: state.serviceRequestId,
          step1Data: data,
        };
        localStorage.setItem(STRIPE_LS_KEY, JSON.stringify(stripeState));
        setProcessMessage('Redirecionando para o Stripe...');
        setProgress(100);
        window.location.href = result.url;
        return;
      }

      if (payment.method.startsWith('parcelow')) {
        setProgress(60);
        setProcessMessage('Iniciando integração com Parcelow...');

        // Garante que order_id nunca seja null para o Parcelow
        const finalOrderId = orderIdRef.current ?? orderId ?? crypto.randomUUID();

        console.log('[MigmaCheckout] 🛠️ DEBUG PARCELOW PAYLOAD:', {
          amount: total,
          user_id: userId,
          order_id: finalOrderId,
          payment_method: payment.method,
          cpf: (payment.method === 'parcelow_card' && payment.cardOwnership === 'third_party') 
                 ? payment.payerInfo?.cpf 
                 : payment.cpf,
        });

        const parcelowResult = await matriculaApi.migmaParcelowCheckout({
          amount: total,
          user_id: userId,
          order_id: finalOrderId,
          email: data.email,
          full_name: data.full_name,
          payment_method: payment.method,
          service_type: service ?? 'transfer',
          service_request_id: state.serviceRequestId || undefined,
          origin: window.location.origin,
          cpf: (payment.method === 'parcelow_card' && payment.cardOwnership === 'third_party') 
                 ? payment.payerInfo?.cpf 
                 : payment.cpf,
          card_ownership: payment.cardOwnership,
          payer_info: payment.payerInfo
        });
        
        const finalUrl = parcelowResult.checkout_url || parcelowResult.url_checkout || parcelowResult.url;
        
        if (finalUrl) {
          setProcessMessage('Redirecionando para a Parcelow...');
          setProgress(100);
          window.location.href = finalUrl;
        } else {
          console.error('[MigmaCheckout] Resposta completa da Parcelow:', parcelowResult);
          const errorMsg = parcelowResult.error || (parcelowResult.details && JSON.stringify(parcelowResult.details));
          throw new Error(errorMsg ? `Erro Parcelow: ${errorMsg}` : 'Não foi possível gerar o link de pagamento. Verifique seus dados.');
        }
        return;
      }

      const processPayment = async () => {
        try {
          if (payment.method === 'zelle') {
            if (payment.receipt) {
              const tempPath = `${userId}/zelle_receipt_${Date.now()}.png`;
              const { data: uploadData } = await supabase.storage.from('payment-receipts').upload(tempPath, payment.receipt);
              const receiptUrl = uploadData ? supabase.storage.from('payment-receipts').getPublicUrl(tempPath).data.publicUrl : '';

              await supabase.from('migma_checkout_zelle_pending').insert({
                migma_user_id: userId,
                migma_user_name: data.full_name,
                migma_user_email: data.email,
                service_request_id: state.serviceRequestId || null,
                service_type: config?.label || service || 'transfer',
                amount: total,
                receipt_url: receiptUrl,
                status: 'pending_verification',
              });

              void processZellePaymentWithN8n(payment.receipt, total, config?.label || 'Migma Selection Fee', userId)
                .then((nResult) => {
                  void supabase.from('migma_checkout_zelle_pending')
                    .update({ 
                      n8n_payment_id: nResult.paymentId,
                      image_path: nResult.imagePath,
                      receipt_url: nResult.imageUrl || receiptUrl
                    })
                    .eq('migma_user_id', userId)
                    .eq('status', 'pending_verification')
                    .then(
                      () => console.log('Zelle updated with n8n info'),
                      (e: unknown) => console.error('Error updating zelle with n8n:', e)
                    );
                }, (err) => console.error('n8n background processing failed:', err));
            }
          } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            await matriculaApi.paymentCompleted({
              user_id: userId,
              fee_type: 'selection_process',
              amount: total,
              payment_method: payment.method as any,
              service_type: service ?? 'transfer',
            });
          }
        } catch (paymentErr) {
          console.error('[Step1] Payment Background Error:', paymentErr);
        }
      };

      void processPayment();

      setProgress(100);
      setStep1Data(data);
      setState(prev => ({
        ...prev,
        userId,
        totalPrice: total,
        step1Completed: true,
        currentStep: 2,
        paymentConfirmed: false,
        zelleProcessing: payment.method === 'zelle'
      }));

    } catch (err: any) {
      console.error('[Step1] Error:', err);
      alert(err.message || 'Erro ao processar Passo 1. Tente novamente.');
      setProcessing(false); // Só fecha se der erro
    } finally {
      // Removido o setProcessing(false) daqui para manter o modal durante o redirecionamento
    }
  };

  const handleStep2Complete = async (data: Step2Data) => {
    const effectiveUserId = state.userId;
    if (!effectiveUserId) return;

    setStep2Data(data);
    setPaymentLoading(true);

    try {
      const bucket = 'migma-student-documents';
      const ts = Date.now();
      const docsForApi: any[] = [];

      const uploads = [
        { file: data.doc_front!, type: 'passport', name: `${effectiveUserId}/passport_${ts}.jpg` },
        { file: data.doc_back!, type: 'passport_back', name: `${effectiveUserId}/passport_back_${ts}.jpg` },
        { file: data.selfie!, type: 'selfie_with_doc', name: `${effectiveUserId}/selfie_with_doc_${ts}.jpg` },
      ].filter(u => !!u.file);

      const results = await Promise.all(uploads.map(async u => {
        const { error } = await supabase.storage.from(bucket).upload(u.name, u.file, { upsert: true });
        if (error) throw error;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(u.name);
        return { type: u.type, file_url: pub.publicUrl, original_filename: u.file.name, file_size_bytes: u.file.size };
      }));
      
      docsForApi.push(...results);

      if (docsForApi.length > 0) {
        await matriculaApi.saveDocuments({
          user_id: effectiveUserId,
          documents: docsForApi,
          service_request_id: state.serviceRequestId || undefined
        });

        const typeMap: any = { passport: 'document_front', passport_back: 'document_back', selfie_with_doc: 'selfie_doc' };
        const identityRows = docsForApi.map(doc => ({
          service_request_id: state.serviceRequestId,
          file_type: typeMap[doc.type] || doc.type,
          file_path: doc.file_url,
          file_name: doc.original_filename,
          file_size: doc.file_size_bytes,
        }));
        await supabase.from('identity_files').insert(identityRows);
      }

      if (step1Data) {
        await matriculaApi.createStudent({
          migma_user_id: effectiveUserId,
          email: step1Data.email,
          full_name: step1Data.full_name,
          phone: step1Data.phone.replace(/\D/g, ''),
          country: data.country,
          nationality: data.nationality,
          service_type: service ?? 'transfer',
        });
      }

      setState(prev => ({ ...prev, step2Completed: true }));
      navigate('/student/onboarding');
    } catch (err: any) {
      console.error('[Step 2] Error:', err);
      alert('Erro ao salvar documentos.');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Serviço de checkout inválido.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <CheckoutTopbar serviceLabel={config.label} />
      <CheckoutProgressBar
        currentStep={state.currentStep}
        step1Completed={state.step1Completed}
        step2Completed={state.step2Completed}
      />

      {paymentLoading && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111] border border-gold-medium/30 rounded-2xl p-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-gold-medium animate-spin mx-auto" />
            <p className="text-white font-bold">{t('migma_checkout.index.processing', 'Processando...')}</p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-8 pb-20 space-y-6" style={{ marginTop: '112px' }}>
        <section>
          <div className={`rounded-2xl border-2 overflow-hidden ${
            state.currentStep === 1 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10' : state.step1Completed ? 'border-emerald-500/30' : 'border-white/5'
          }`}>
            <div className={`px-6 py-4 flex items-center gap-3 ${state.currentStep === 1 ? 'bg-gold-dark/20' : 'bg-[#111]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                state.step1Completed ? 'bg-emerald-500 border-emerald-500 text-white' : state.currentStep === 1 ? 'bg-gold-medium border-gold-medium text-black' : 'bg-[#111] border-white/20 text-gray-500'
              }`}>
                {state.step1Completed ? '✓' : '1'}
              </div>
              <div>
                <p className={`font-bold text-sm ${state.currentStep === 1 ? 'text-gold-light' : 'text-gray-500'}`}>{t('migma_checkout.index.step1_title', 'Informações & Pagamento')}</p>
              </div>
            </div>
            <div className="bg-[#0d0d0d] px-6 py-8">
              {state.currentStep === 1 && !regionLoading && (
                <Step1PersonalInfo
                  config={config}
                  initialData={step1Data}
                  existingUserId={state.userId}
                  region={region as IPRegion}
                  onComplete={handleStep1Complete}
                  onRegisterUser={handleRegisterUser}
                />
              )}
              {state.step1Completed && state.currentStep > 1 && (
                <div className={`text-sm py-1 px-3 rounded-lg flex items-center gap-2 ${state.paymentConfirmed ? 'text-emerald-400 bg-emerald-500/5' : 'text-gold-medium bg-gold-medium/5'}`}>
                  {state.paymentConfirmed ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t('migma_checkout.index.payment_confirmed', 'Pagamento confirmado')}
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-bold">{t('migma_checkout.index.payment_processing', 'Pagamento em processamento')}</span>
                        <span className="text-[10px] opacity-70 italic">{t('migma_checkout.index.processing_notice', 'A confirmação pode levar até 48 horas úteis.')}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {(state.step1Completed || state.currentStep >= 2) && (
          <section>
            <div className={`rounded-2xl border-2 overflow-hidden ${
              state.currentStep === 2 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10' : 'border-white/5'
            }`}>
              <div className={`px-6 py-4 flex items-center gap-3 ${state.currentStep === 2 ? 'bg-gold-dark/20' : 'bg-[#111]'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  state.currentStep === 2 ? 'bg-gold-medium border-gold-medium text-black' : 'bg-[#111] border-white/20 text-gray-500'
                }`}>2</div>
                <div>
                  <p className={`font-bold text-sm ${state.currentStep === 2 ? 'text-gold-light' : 'text-gray-500'}`}>{t('migma_checkout.index.step2_title', 'Documentação')}</p>
                </div>
              </div>
              <div className="bg-[#0d0d0d] px-6 py-8">
                {state.currentStep === 2 && (
                  <Step2Documents
                    isCompleted={state.step2Completed}
                    onComplete={handleStep2Complete}
                    onAdvance={() => navigate('/student/onboarding')}
                    onBack={() => setState(prev => ({ ...prev, currentStep: 1 }))}
                  />
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      <ProcessingModal 
        isOpen={processing} 
        progress={progress} 
        message={processMessage} 
      />
    </div>
  );
};

export default MigmaCheckout;
