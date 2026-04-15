/**
 * Migma Visa Checkout — Página única com 2 steps.
 * Serviço determinado pela URL: /student/checkout/:service
 *
 * Step 1: Dados pessoais + Contrato + Pagamento
 * Step 2: Documentos -> Onboarding
 */
import React, { useState, useEffect, useRef } from 'react';
import { saveSellerRef, getSellerRef, clearSellerRef } from '../../lib/referral-tracking';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Clock, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { CheckoutTopbar } from './components/CheckoutTopbar';
import { Step3Summary } from './components/Step3Summary';
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
  dbServiceType: string | null;
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
  const { refreshProfile } = useStudentAuth();

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
    dbServiceType: null,
  });

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processMessage, setProcessMessage] = useState('');
  const stripeHandledRef = useRef(false);
  // Ref para capturar order_id de createStudent de forma síncrona (evita race condition com setState)
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Persist seller ref to localStorage so it survives auth redirects
    const refParam = searchParams.get('ref') || searchParams.get('seller_id');
    if (refParam) saveSellerRef(refParam);

    const success = searchParams.get('success');
    const failed = searchParams.get('failed');
    const stripeSessionId = searchParams.get('stripe_session_id');
    const stripeCancelled = searchParams.get('stripe_cancelled');

    if (success === 'true') {
      handleVerifyAndAdvance();
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (stripeSessionId) {
      if (stripeHandledRef.current) return;
      stripeHandledRef.current = true;
      handleStripeReturn(stripeSessionId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeCancelled || failed === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      restoreDraftSession();
    }
  }, [searchParams]);

  useEffect(() => {
    // Se estiver no Passo 3 mas o valor estiver zerado, força um refresh para garantir dados corretos
    if (state.currentStep === 3 && state.totalPrice === 0 && !regionLoading) {
      refreshProfile();
    }
  }, [state.currentStep, state.totalPrice, regionLoading]);

  const handleVerifyAndAdvance = async () => {
    setPaymentLoading(true);
    setProcessMessage('Verificando confirmação do pagamento...');

    // Restaurar step1Data e totalPrice do draft salvo antes do redirect Parcelow
    const draftRaw = localStorage.getItem(getDraftKey(service));
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        if (draft.step1Data) setStep1Data(draft.step1Data);
        if (draft.state?.totalPrice) {
          setState(prev => ({
            ...prev,
            totalPrice: draft.state.totalPrice,
            serviceRequestId: draft.state.serviceRequestId || prev.serviceRequestId,
          }));
        }
      } catch (e) {
        console.warn('[handleVerifyAndAdvance] Failed to restore draft:', e);
      }
    }

    try {
      let finalUserId: string | null = null;

      // Tentar verificar até 3 vezes com intervalo de 2 segundos
      for (let i = 0; i < 3; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        finalUserId = session?.user.id || null;

        if (finalUserId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('has_paid_selection_process_fee, total_price_usd, full_name, email, phone, signature_url')
            .eq('user_id', finalUserId)
            .maybeSingle();

          if (profile?.has_paid_selection_process_fee) {
            console.log('[MigmaCheckout] ✅ Pagamento verificado no banco! Avançando.');
            // Complementar step1Data com dados do perfil se draft não tinha
            if (profile.full_name || profile.email) {
              setStep1Data(prev => prev ? {
                ...prev,
                full_name: prev.full_name || profile.full_name || '',
                email: prev.email || profile.email || '',
                phone: prev.phone || profile.phone || '',
              } : {
                full_name: profile.full_name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                password: '', confirm_password: '', num_dependents: null,
                terms_accepted: true, data_accepted: true,
                signature_data_url: profile.signature_url || null,
              });
            }
            setState(prev => ({
              ...prev,
              userId: finalUserId,
              step1Completed: true,
              paymentConfirmed: true,
              currentStep: 2,
              ...(profile.total_price_usd ? { totalPrice: profile.total_price_usd } : {}),
            }));
            await refreshProfile();
            setPaymentLoading(false);
            return;
          }
        }

        console.log(`[MigmaCheckout] ⏳ Aguardando webhook (tentativa ${i + 1}/3)...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Se após 3 tentativas ainda não confirmou no banco, forçamos o avanço
      // pois o usuário foi redirecionado com success=true do gateway.
      if (finalUserId) {
        console.log('[MigmaCheckout] ⏩ Forçando avanço para Step 2 (Webhook em atraso, mas redirecionamento confirmou sucesso).');
        setState(prev => ({
          ...prev,
          userId: finalUserId,
          step1Completed: true,
          paymentConfirmed: true,
          currentStep: 2,
        }));
      }

    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleFinalFinish = async () => {
    setProcessing(true);
    setProcessMessage('Finalizando seu processo...');
    setProgress(50);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id) {
        await supabase
          .from('user_profiles')
          .update({
            migma_checkout_completed_at: new Date().toISOString(),
            onboarding_current_step: 'selection_survey'
          })
          .eq('user_id', session.user.id);
      }

      setProgress(100);
      clearSellerRef();
      await refreshProfile(); // Importante: Garante que o contexto local seja atualizado antes de navegar
      navigate('/student/onboarding');
    } catch (err) {
      console.error("Error finalizing checkout:", err);
      navigate('/student/onboarding');
    }
  };

  const restoreDraftSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setState(prev => ({ ...prev, userId: session.user.id }));

    // 🚀 Verificação de "Status Real" no banco (Recuperação Pós-Login)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('has_paid_selection_process_fee, identity_verified, full_name, email, phone, signature_url, migma_checkout_completed_at, total_price_usd, service_type')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profile) {
      if (profile.migma_checkout_completed_at) {
        navigate('/student/onboarding');
        return;
      }

      // Se já pagou e tem identidade/v5 doc flow (identificado pelo flag identity_verified ou presença de arquivos)
      // No fluxo Migma, identity_verified é setado após o Step 2
      if (profile.has_paid_selection_process_fee && profile.identity_verified) {
        console.log('[MigmaCheckout] 🔄 Recuperando sessão: Identificado progresso até o Passo 3.');
        
        // 🔍 Tentar recuperar service_request_id e preço da ordem existente
        const { data: latestOrder } = await supabase
          .from('visa_orders')
          .select('service_request_id, total_price_usd')
          .eq('client_email', profile.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fallback em cascata: perfil → visa_orders → individual_fee_payments → 0
        let resolvedPrice = profile.total_price_usd || latestOrder?.total_price_usd || 0;
        if (!resolvedPrice) {
          const { data: feePayment } = await supabase
            .from('individual_fee_payments')
            .select('amount')
            .eq('user_id', session.user.id)
            .eq('fee_type', 'selection_process')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          resolvedPrice = feePayment?.amount || 0;
        }

        const resolvedName = profile.full_name
          || session.user.user_metadata?.full_name
          || session.user.user_metadata?.name
          || '';

        setStep1Data({
          full_name: resolvedName,
          email: profile.email || session.user.email || '',
          phone: profile.phone || '',
          password: '',
          confirm_password: '',
          num_dependents: null,
          terms_accepted: true,
          data_accepted: true,
          signature_data_url: profile.signature_url || null
        });

        setState(prev => ({
          ...prev,
          userId: session.user.id,
          totalPrice: resolvedPrice,
          dbServiceType: profile.service_type || null,
          serviceRequestId: latestOrder?.service_request_id || prev.serviceRequestId,
          step1Completed: true,
          step2Completed: true,
          paymentConfirmed: true,
          currentStep: 3
        }));
        return;
      }
    }

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
            serviceRequestId: draft.state.serviceRequestId || state.serviceRequestId,
            currentStep: draft.state.currentStep || 1,
          }));
          draftLoaded = true;
        }
      } catch (e) {
        console.warn('Failed to restore checkout draft', e);
      }
    }

    if (!draftLoaded) {
      setStep1Data({
        full_name: profile?.full_name || session.user.user_metadata?.full_name || '',
        email: profile?.email || session.user.email || '',
        phone: profile?.phone || session.user.user_metadata?.phone || '',
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
          serviceRequestId: state.serviceRequestId,
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
    // Como agora usamos OTP no portal do aluno, geramos uma senha aleatória forte
    // para o cadastro inicial, visto que o signUp do Supabase exige uma senha.
    const password = data.password || crypto.randomUUID() + 'Migma!@';
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

    const sellerId = searchParams.get('ref') || searchParams.get('seller_id') || getSellerRef();
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
          // Salvar draft ANTES do redirect — sem isso totalPrice = 0 ao voltar
          localStorage.setItem(getDraftKey(service), JSON.stringify({
            state: {
              userId,
              totalPrice: total,
              matriculaUserId: state.matriculaUserId,
              step1Completed: true,
              step2Completed: false,
              serviceRequestId: state.serviceRequestId,
              currentStep: 2,
            },
            step1Data: data,
            step2Data: null,
          }));
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

              processZellePaymentWithN8n(payment.receipt, total, config?.label || 'Migma Selection Fee', userId)
                .then(nResult => {
                  supabase.from('migma_checkout_zelle_pending')
                    .update({
                      n8n_payment_id: nResult.paymentId,
                      image_path: nResult.imagePath,
                      receipt_url: nResult.imageUrl || receiptUrl
                    })
                    .eq('migma_user_id', userId)
                    .eq('status', 'pending_verification')
                    .then(() => console.log('Zelle updated with n8n info'))
                    .then(undefined, (e: unknown) => console.error('Error updating zelle with n8n:', e));
                })
                .catch(err => console.error('n8n background processing failed:', err));
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

      processPayment();

      setProgress(75);
      await new Promise(r => setTimeout(r, 200));
      setProgress(100);
      setStep1Data({ ...data, payment_method: payment.method });
      setState(prev => ({
        ...prev,
        userId,
        totalPrice: total,
        step1Completed: true,
        currentStep: 2,
        paymentConfirmed: false,
        zelleProcessing: payment.method === 'zelle'
      }));
      // Parcelow e Stripe retornam antes de chegar aqui (window.location.href).
      // Para Zelle (e outros métodos sem redirect), deixa o modal em 100% por um momento antes de fechar.
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setProcessing(false);

    } catch (err: any) {
      console.error('[Step1] Error:', err);
      alert(err.message || 'Erro ao processar Passo 1. Tente novamente.');
      setProcessing(false);
    } finally {
      // Modal fechado explicitamente nos paths acima
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
      // SR ID garantido não-nulo (Postgres não detecta conflito em NULL no upsert)
      const srId = state.serviceRequestId || crypto.randomUUID();

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

        // identity_files é populado pelo backend (migma-payment-completed) após garantir FK de service_request

        // 🚀 Marca identidate como verificada (enviada) para o fluxo Migma
        await supabase.from('user_profiles').update({ identity_verified: true }).eq('user_id', effectiveUserId);
        
        // Sincroniza o perfil global antes de avançar para o Passo 3
        await refreshProfile();
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

      // DISPARAR FINALIZAÇÃO DE CONTRATO (BACKEND - SEM AGUARDAR)
      // Passa o método real do pagamento para que migma-payment-completed saiba se pode
      // setar has_paid_selection_process_fee (Zelle/manual requer aprovação manual do admin)
      const realPaymentMethod = step1Data?.payment_method || 'parcelow_card';
      matriculaApi.paymentCompleted({
        user_id: effectiveUserId,
        fee_type: 'selection_process',
        amount: state.totalPrice,
        payment_method: realPaymentMethod as any,
        service_type: service ?? 'transfer',
        service_request_id: srId,
        finalize_contract_only: true
      }).catch(err => console.error('[Background Contract Sync] Error:', err));

      setState(prev => ({ ...prev, step2Completed: true, currentStep: 3 }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Step 2] Error:', err);
      alert('Erro ao salvar documentos.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <CheckoutTopbar serviceLabel={config?.label || ''} />
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
        {state.currentStep <= 2 && (
          <>
            <section>
              <div className={`rounded-2xl border-2 overflow-hidden ${state.currentStep === 1 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10' : state.step1Completed ? 'border-emerald-500/30' : 'border-white/5'
                }`}>
                <div className={`px-6 py-4 flex items-center gap-3 ${state.currentStep === 1 ? 'bg-gold-dark/20' : 'bg-[#111]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${state.step1Completed ? 'bg-emerald-500 border-emerald-500 text-white' : state.currentStep === 1 ? 'bg-gold-medium border-gold-medium text-black' : 'bg-[#111] border-white/20 text-gray-500'
                    }`}>
                    {state.step1Completed ? '✓' : '1'}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${state.currentStep === 1 ? 'text-gold-light' : 'text-gray-500'}`}>{t('migma_checkout.index.step1_title', 'Informações & Pagamento')}</p>
                  </div>
                </div>
                <div className="bg-[#0d0d0d] px-6 py-8">
                  {state.currentStep === 1 && !regionLoading && config && (
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
                <div className={`rounded-2xl border-2 overflow-hidden ${state.currentStep === 2 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10' : 'border-white/5'
                  }`}>
                  <div className={`px-6 py-4 flex items-center gap-3 ${state.currentStep === 2 ? 'bg-gold-dark/20' : 'bg-[#111]'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${state.currentStep === 2 ? 'bg-gold-medium border-gold-medium text-black' : 'bg-[#111] border-white/20 text-gray-500'
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
                        onAdvance={() => setState(prev => ({ ...prev, currentStep: 3 }))}
                        onBack={() => setState(prev => ({ ...prev, currentStep: 1 }))}
                      />
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {state.currentStep === 3 && (
          <Step3Summary
            userData={{
              fullName: step1Data?.full_name || '',
              email: step1Data?.email || '',
              processType: (state.dbServiceType === 'cos' || service === 'cos') ? 'Change of Status' :
                (state.dbServiceType === 'transfer' || service === 'transfer') ? 'Visa Transfer' :
                  config?.label || 'F1 Visa',
              totalPrice: state.totalPrice
            }}
            documents={{
              docFront: step2Data?.doc_front ?? null,
              docBack: step2Data?.doc_back ?? null,
              selfie: step2Data?.selfie ?? null,
            }}
            personalInfo={{
              birthDate: step2Data?.birth_date ?? '',
              docType: step2Data?.doc_type ?? '',
              docNumber: step2Data?.doc_number ?? '',
              address: step2Data?.address ?? '',
              city: step2Data?.city ?? '',
              state: step2Data?.state ?? '',
              zipCode: step2Data?.zip_code ?? '',
              country: step2Data?.country ?? '',
              nationality: step2Data?.nationality ?? '',
              civilStatus: step2Data?.civil_status ?? '',
            }}
            onFinish={handleFinalFinish}
          />
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
