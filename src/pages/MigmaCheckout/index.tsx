/**
 * Migma Visa Checkout — Página única com 3 steps.
 * Serviço determinado pela URL: /student/checkout/:service
 *
 * Step 1: Dados pessoais + termos + assinatura
 * Step 2: Documentos
 * Step 3: Pagamento + Confirmação
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CheckoutTopbar } from './components/CheckoutTopbar';
import { CheckoutProgressBar } from './components/CheckoutProgressBar';
import { Step1PersonalInfo } from './components/Step1PersonalInfo';
import { Step2Documents } from './components/Step2Documents';
import { Step3Confirmation } from './components/Step3Confirmation';
import { useIPDetection } from './hooks/useIPDetection';
import { getServiceConfig } from './serviceConfigs';
import { matriculaApi } from '../../lib/matriculaApi';
import { supabase } from '../../lib/supabase';
import type { Step1Data, Step2Data, CheckoutState, PaymentMethod, CardOwnership } from './types';

interface ExtendedState extends CheckoutState {
  matriculaUserId: string | null;
  serviceRequestId: string | null;
}

// What we persist to localStorage before Stripe redirect
interface StripeReturnState {
  userId: string;
  matriculaUserId: string | null;
  totalPrice: number;
  serviceType: string;
  serviceRequestId: string | null;
  step1Data: Omit<Step1Data, never>; // File-free — signature_data_url is a string, fine
  step2Meta: {
    birth_date: string;
    doc_type: string;
    doc_number: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    nationality: string;
    civil_status: string;
    notes: string;
  };
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
    userId: null,
    totalPrice: 0,
    matriculaUserId: null,
    serviceRequestId: crypto.randomUUID(),
  });

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const stripeHandledRef = useRef(false);

  // ── Handle Stripe return after redirect ─────────────────────
  useEffect(() => {
    const stripeSessionId = searchParams.get('stripe_session_id');
    const stripeCancelled = searchParams.get('stripe_cancelled');

    if (stripeSessionId) {
      // Guard against StrictMode double-invoke and re-renders
      if (stripeHandledRef.current) return;
      stripeHandledRef.current = true;
      handleStripeReturn(stripeSessionId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (stripeCancelled) {
      window.history.replaceState({}, '', window.location.pathname);
      // Stay on whatever step — Stripe state should restore
    } else {
      // If not returning from Stripe, attempt to restore draft
      restoreDraftSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreDraftSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // If no active session, nothing to restore

    // Immediate hydration: Tell Checkout that we are logged in
    setState(prev => ({ ...prev, userId: session.user.id }));

    let draftLoaded = false;
    const draftRaw = localStorage.getItem(getDraftKey(service));
    
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        // Only load draft if it belongs to the active user
        if (draft.state?.userId === session.user.id) {
          console.log('[MigmaCheckout] Restoring draft from local storage...');
          setStep1Data(draft.step1Data);
          if (draft.step2Data) setStep2Data(draft.step2Data);
          setState(prev => ({
            ...prev,
            ...draft.state,
            userId: session.user.id, // Enforce logged in ID
            // Restore directly to the current step (1, 2, or 3)
            currentStep: draft.state.currentStep || 1,
            step2Completed: draft.state.step2Completed || false 
          }));
          draftLoaded = true;
        }
      } catch (e) {
        console.warn('Failed to restore checkout draft', e);
      }
    }

    // If no specific step1 draft was found, pre-fill initial data from the Supabase session
    if (!draftLoaded) {
      // Fetch user profile to check for existing signature
      const { data: profile } = await supabase.from('user_profiles').select('signature_url').eq('user_id', session.user.id).maybeSingle();

      setStep1Data({
        full_name: session.user.user_metadata?.full_name || '',
        email: session.user.email || '',
        phone: session.user.user_metadata?.phone || '',
        password: '',
        confirm_password: '',
        num_dependents: 0,
        terms_accepted: false,
        data_accepted: false,
        signature_data_url: profile?.signature_url || null
      });
    }
  };

  // ── Auto-save Draft ──────────────────────────────────────────
  useEffect(() => {
    if (state.step1Completed && state.userId && step1Data) {
      
      // We can't save File() binary data in localStorage, so we mock 
      // the File object saving only the "name" property for Step 3 UI.
      const mockStep2Data = step2Data ? {
        ...step2Data,
        doc_front: step2Data.doc_front ? { name: step2Data.doc_front.name } : null,
        doc_back: step2Data.doc_back ? { name: step2Data.doc_back.name } : null,
        selfie: step2Data.selfie ? { name: step2Data.selfie.name } : null,
      } : null;

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
        step2Data: mockStep2Data
      }));
    }
  }, [state.step1Completed, state.step2Completed, state.userId, state.totalPrice, state.matriculaUserId, state.currentStep, step1Data, step2Data, service]);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.currentStep]);

  if (!config) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white mb-3">
            {t('migma_checkout.index.service_not_found', 'Service Not Found')}
          </h1>
          <p className="text-gray-400 mb-6">
            {t('migma_checkout.index.invalid_url', 'The checkout URL is not valid.')}
          </p>
          <button onClick={() => navigate('/')} className="text-gold-medium underline">
            {t('migma_checkout.index.back_to_home', 'Back to home')}
          </button>
        </div>
      </div>
    );
  }

  // ── Stripe return handler ────────────────────────────────────
  const handleStripeReturn = async (sessionId: string) => {
    setPaymentLoading(true);
    try {
      const raw = localStorage.getItem(STRIPE_LS_KEY);
      if (!raw) throw new Error('Sessão expirada. Por favor, comece novamente.');

      const saved: StripeReturnState = JSON.parse(raw);
      const { userId, matriculaUserId, totalPrice, step1Data: savedStep1, step2Meta } = saved;

      if (!userId) throw new Error('Dados de sessão inválidos. Por favor, comece novamente.');

      try {
        console.log('[Checkout] Confirming stripe payment via Edge Function...');
        await matriculaApi.paymentCompleted({
          user_id: userId,
          fee_type: 'selection_process',
          amount: totalPrice,
          payment_method: 'stripe',
          service_type: saved.serviceType,
          service_request_id: saved.serviceRequestId || undefined,
          ...(matriculaUserId ? { matricula_user_id: matriculaUserId } : {}),
        });
      } catch (apiErr: any) {
        // Se a Edge Function der timeout mas o usuário voltou do Stripe com sessionId, 
        // assumimos sucesso no pagamento e deixamos o sync acontecer em background/logs
        console.error('[MigmaCheckout] Background payment sync failed/timeout:', apiErr);
      }

      console.log('[Checkout] Stripe payment processing complete for session:', sessionId);
      localStorage.removeItem(STRIPE_LS_KEY);

      // Reconstruct step2Data from metadata (files already uploaded)
      const restoredStep2: Step2Data = {
        ...step2Meta,
        doc_type: step2Meta.doc_type as Step2Data['doc_type'],
        civil_status: step2Meta.civil_status as Step2Data['civil_status'],
        doc_front: null,
        doc_back: null,
        selfie: null,
      };

      setStep1Data(savedStep1);
      setStep2Data(restoredStep2);
      setState(prev => ({
        ...prev,
        userId,
        totalPrice,
        matriculaUserId,
        step1Completed: true,
        step2Completed: true,
        paymentConfirmed: true,
        currentStep: 3,
      }));

      // Redireciona para o onboarding após a confirmação visual no Step 3
      console.log('[Checkout] Redirecting to onboarding in 3s...');
      setTimeout(() => navigate('/student/onboarding'), 3000);

    } catch (err: any) {
      console.error('[MigmaCheckout] Stripe return critical error:', err);
      alert('Erro ao processar retorno do pagamento: ' + err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Register user (Step 1) ──────────────────────────────────
  const handleRegisterUser = async (
    data: Pick<Step1Data, 'full_name' | 'email' | 'phone' | 'password'>,
    numDependents?: number,
    total?: number,
  ) => {
    const email = data.email.trim();
    const password = data.password!;

    const phoneClean = data.phone.replace(/\D/g, '');

    // 1. Criar conta — com "Confirm email" desabilitado no Supabase, retorna sessão imediatamente
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: data.full_name.trim(), phone: phoneClean, source: 'migma' } },
    });

    let userId: string;

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        // Usuário já existe — fazer login
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

    // 2. Sync com Matricula USA — fire-and-forget, não bloqueia o fluxo
    matriculaApi.createStudent({
      migma_user_id: userId,
      email,
      full_name: data.full_name.trim(),
      phone: phoneClean,
      service_type: service ?? 'transfer',
      num_dependents: numDependents,
      total_price: total,
      migma_seller_id: sellerId || undefined,
      migma_agent_id: agentId || undefined,
    }).catch(err => console.warn('Background sync Matricula USA failed:', err));

    return userId;
  };

  // ── Step 1 complete — register only, advance to Step 2 ──────
  const handleStep1Complete = async (data: Step1Data, userId: string, total: number) => {
    console.log('[MigmaCheckout] Step 1 complete for user:', userId);
    
    // 1. Persist signature if provided and is a new data URL
    if (data.signature_data_url && data.signature_data_url.startsWith('data:')) {
      try {
        const signatureBase64 = data.signature_data_url.split(',')[1];
        const binaryString = atob(signatureBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const fileName = `${userId}/sig_${Date.now()}.png`;
        const { error: uploadErr } = await supabase.storage
          .from('visa-signatures')
          .upload(fileName, bytes, { contentType: 'image/png' });

        if (!uploadErr) {
          const { data: publicData } = supabase.storage.from('visa-signatures').getPublicUrl(fileName);
          console.log('[MigmaCheckout] Signature uploaded:', publicData.publicUrl);
          
          await supabase.from('user_profiles')
            .update({ signature_url: publicData.publicUrl })
            .eq('user_id', userId);
        } else {
          console.error('[MigmaCheckout] Signature upload failed:', uploadErr);
          // Fallback log to know if it's an RLS issue or something else
        }
      } catch (err) {
        console.error('[MigmaCheckout] Error processing signature:', err);
      }
    }

    setStep1Data(data);
    setState(prev => ({
      ...prev,
      userId,
      totalPrice: total,
      step1Completed: true,
      currentStep: 2,
    }));
  };

  // ── Step 2 complete — upload docs, advance to Step 3 ─────────
  const handleStep2Complete = async (data: Step2Data) => {
    console.log('[MigmaCheckout] Starting handleStep2Complete...', { userId: state.userId });
    
    let effectiveUserId = state.userId;
    if (!effectiveUserId) {
      console.warn('[MigmaCheckout] state.userId is null, attempting to get current session...');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        effectiveUserId = authUser.id;
        console.log('[MigmaCheckout] Found userId in session:', effectiveUserId);
        setState(prev => ({ ...prev, userId: effectiveUserId }));
      } else {
        console.error('[MigmaCheckout] No user found in state or session. Refusing to proceed.');
        alert('Sua sessão expirou. Por favor, faça login novamente para continuar.');
        return;
      }
    }

    setStep2Data(data);
    setPaymentLoading(true);

    try {
      const bucket = 'migma-student-documents';
      const prefix = effectiveUserId;
      console.log('[MigmaCheckout] Uploading documents to bucket:', bucket, 'with prefix:', prefix);
      
      const docsForApi: Array<{
        type: 'passport' | 'passport_back' | 'selfie_with_doc';
        file_url: string;
        original_filename?: string;
        file_size_bytes?: number;
      }> = [];

      const ts = Date.now();
      const uploads: Array<{ file: File; name: string; type: 'passport' | 'passport_back' | 'selfie_with_doc' }> = [
        { file: data.doc_front!, name: `${prefix}/passport_${ts}.jpg`, type: 'passport' },
        { file: data.doc_back!, name: `${prefix}/passport_back_${ts}.jpg`, type: 'passport_back' },
        { file: data.selfie!, name: `${prefix}/selfie_with_doc_${ts}.jpg`, type: 'selfie_with_doc' },
      ].filter((u): u is { file: File; name: string; type: 'passport' | 'passport_back' | 'selfie_with_doc' } => !!u.file);

      // Upload all 3 files in parallel
      const results = await Promise.all(
        uploads.map(async ({ file, name, type }) => {
          console.log(`[MigmaCheckout] Uploading ${type} (${file.size} bytes, ${file.type})...`);
          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(name, file, { upsert: true, contentType: file.type || 'image/jpeg' });

          if (uploadErr) {
            console.error(`[MigmaCheckout] Failed to upload ${type}:`, uploadErr);
            throw new Error(`Falha ao enviar documento (${type}): ${uploadErr.message}`);
          }

          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(name);
          return {
            type,
            file_url: publicData.publicUrl,
            original_filename: file.name,
            file_size_bytes: file.size,
          };
        })
      );

      docsForApi.push(...results);

      // Fire-and-forget — não bloqueia o avanço para o Step 3
      if (docsForApi.length > 0) {
        matriculaApi.saveDocuments({
          user_id: effectiveUserId,
          documents: docsForApi,
          service_request_id: state.serviceRequestId || undefined
        })
          .catch(e => console.warn('[MigmaCheckout] Docs sync failed (background):', e));
      }

      // Inserir em identity_files para aparecer no VisaContractApprovalPage
      if (state.serviceRequestId && docsForApi.length > 0) {
        const typeMap: Record<string, string> = {
          passport: 'document_front',
          passport_back: 'document_back',
          selfie_with_doc: 'selfie_doc',
        };
        const identityRows = docsForApi.map(doc => ({
          service_request_id: state.serviceRequestId,
          file_type: typeMap[doc.type] || doc.type,
          file_path: doc.file_url,
          file_name: doc.original_filename || doc.type,
          file_size: doc.file_size_bytes || 0,
        }));
        supabase.from('identity_files').insert(identityRows)
          .then(({ error: idErr }) => {
            if (idErr) console.warn('[MigmaCheckout] identity_files insert failed:', idErr.message);
          });
      }

      // ── Sync Perfil (Step 2) — Incluindo País e Nacionalidade ───────
      if (step1Data) {
        const phoneClean = step1Data.phone.replace(/\D/g, '');
        matriculaApi.createStudent({
          migma_user_id: effectiveUserId,
          email: step1Data.email,
          full_name: step1Data.full_name,
          phone: phoneClean,
          country: data.country,
          nationality: data.nationality,
          service_type: service ?? 'transfer',
          num_dependents: step1Data.num_dependents,
        }).catch(err => console.warn('[MigmaCheckout] Step 2 Sync failed:', err));
      }

      console.log('[MigmaCheckout] Documents saved successfully. Moving to Step 3...');
      setState(prev => ({ ...prev, step2Completed: true, currentStep: 3 }));
    } catch (err: any) {
      console.error('[MigmaCheckout] Step 2 failure:', err);
      alert(err.message || 'Erro ao salvar documentos. Verifique sua conexão e tente novamente.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── Step 3 payment handler ────────────────────────────────────
  const handleStep3Payment = async (
    method: PaymentMethod,
    extra: { receipt?: File | null; cardOwnership?: CardOwnership; cpf?: string }
  ) => {
    if (!state.userId || !step1Data || !step2Data) return;

    const { userId, totalPrice, matriculaUserId } = state;
    const methodMap: Record<PaymentMethod, 'stripe' | 'zelle' | 'manual' | 'parcelow'> = {
      stripe: 'stripe',
      square: 'stripe',
      parcelow: 'parcelow',
      pix: 'manual',
      zelle: 'zelle',
    };
    const apiMethod = methodMap[method];
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // STRIPE — redirect
    if (method === 'stripe') {
      setPaymentLoading(true);
      const result = await matriculaApi.stripeStudentCheckout({
        amount: totalPrice,
        user_id: userId!,
        email: step1Data.email,
        full_name: step1Data.full_name,
        service_type: service ?? 'transfer',
        service_request_id: state.serviceRequestId || undefined,
        origin: window.location.origin,
      });

      const stripeState: StripeReturnState = {
        userId: userId!,
        matriculaUserId,
        totalPrice,
        serviceType: service ?? 'transfer',
        serviceRequestId: state.serviceRequestId,
        step1Data,
        step2Meta: {
          birth_date: step2Data.birth_date,
          doc_type: step2Data.doc_type,
          doc_number: step2Data.doc_number,
          address: step2Data.address,
          city: step2Data.city,
          state: step2Data.state,
          zip_code: step2Data.zip_code,
          country: step2Data.country,
          nationality: step2Data.nationality,
          civil_status: step2Data.civil_status,
          notes: step2Data.notes,
        },
      };
      localStorage.setItem(STRIPE_LS_KEY, JSON.stringify(stripeState));
      window.location.href = result.url;
      return; // page navigates away
    }

    // ZELLE / PIX — upload receipt then register
    if (method === 'zelle' || method === 'pix') {
      let receiptUrl = '';
      if (extra.receipt) {
        const bucket = 'payment-receipts';
        const fileName = `${userId}/${Date.now()}_${extra.receipt.name}`;
        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(fileName, extra.receipt);
        if (uploadErr) throw new Error('Falha ao subir comprovante: ' + uploadErr.message);
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
        receiptUrl = publicData.publicUrl;
      }

      await matriculaApi.paymentCompleted({
        user_id: userId!,
        fee_type: 'selection_process',
        amount: totalPrice,
        payment_method: apiMethod,
        receipt_url: receiptUrl,
        service_type: service ?? 'transfer',
        service_request_id: state.serviceRequestId || undefined,
        ...(matriculaUserId ? { matricula_user_id: matriculaUserId } : {}),
      });

      setState(prev => ({ ...prev, paymentConfirmed: true }));
      setTimeout(() => navigate('/student/onboarding'), 4000);
      return;
    }

    // SQUARE / PARCELOW — localhost: auto-confirm; prod: TBD
    if (isLocal) {
      await matriculaApi.paymentCompleted({
        user_id: userId!,
        fee_type: 'selection_process',
        amount: totalPrice,
        payment_method: apiMethod,
        ...(matriculaUserId ? { matricula_user_id: matriculaUserId } : {}),
      });
    }

    setState(prev => ({ ...prev, paymentConfirmed: true }));
    setTimeout(() => navigate('/student/onboarding'), 4000);
  };

  // ── Step lock overlay ────────────────────────────────────────
  const StepLockOverlay: React.FC<{ message: string }> = ({ message }) => (
    <div className="bg-[#0d0d0d] border border-white/5 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-gray-500" />
      </div>
      <p className="text-gray-500 text-sm font-medium">{message}</p>
    </div>
  );

  const stepHeader = (
    step: number,
    label: string,
    sublabel: string,
    completed: boolean,
    active: boolean,
  ) => (
    <div className={`px-6 py-4 flex items-center gap-3 ${active ? 'bg-gold-dark/20' : completed ? 'bg-emerald-500/10' : 'bg-[#111]'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
        completed ? 'bg-emerald-500 border-emerald-500 text-white'
          : active ? 'bg-gold-medium border-gold-medium text-black'
          : 'bg-[#111] border-white/20 text-gray-500'
      }`}>
        {completed ? '✓' : step}
      </div>
      <div>
        <p className={`font-bold text-sm ${active ? 'text-gold-light' : completed ? 'text-emerald-400' : 'text-gray-500'}`}>
          {label}
        </p>
        <p className={`text-xs ${active ? 'text-gray-300' : 'text-gray-500'}`}>{sublabel}</p>
      </div>
    </div>
  );

  const completedBadge = (msg: string) => (
    <div className="flex items-center gap-2 text-emerald-400 text-sm">
      <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
      {msg}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black">
      <CheckoutTopbar serviceLabel={config.label} />
      <CheckoutProgressBar
        currentStep={state.currentStep}
        step1Completed={state.step1Completed}
        step2Completed={state.step2Completed}
      />

      {/* Global payment loading overlay */}
      {paymentLoading && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111] border border-gold-medium/30 rounded-2xl p-8 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-gold-medium animate-spin mx-auto" />
            <p className="text-white font-bold">
              {state.currentStep === 2 
                ? t('migma_checkout.index.saving_docs', 'Salvando documentos...') 
                : t('migma_checkout.index.processing_payment', 'Processando pagamento...')}
            </p>
            <p className="text-gray-400 text-sm">
              {t('migma_checkout.index.please_wait', 'Aguarde, não feche esta página.')}
            </p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-8 pb-20 space-y-6" style={{ marginTop: '112px' }}>

        {/* ── STEP 1 — Personal Info ── */}
        <section>
          <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
            state.currentStep === 1 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10'
              : state.step1Completed ? 'border-emerald-500/30'
              : 'border-white/5'
          }`}>
            {stepHeader(
              1, 
              t('migma_checkout.index.step_X_of_3', { step: 1 }, 'Step 1 of 3'), 
              t('migma_checkout.index.step1_title', 'Personal Information & Terms'), 
              state.step1Completed, 
              state.currentStep === 1
            )}
            <div className="bg-[#0d0d0d] px-6 py-8">
              {state.currentStep === 1 && regionLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gold-medium" />
                </div>
              )}
              {state.currentStep === 1 && !regionLoading && (
                <Step1PersonalInfo
                  config={config}
                  initialData={step1Data}
                  existingUserId={state.userId}
                  onComplete={handleStep1Complete}
                  onRegisterUser={handleRegisterUser}
                />
              )}
              {state.step1Completed && state.currentStep > 1 && completedBadge(t('migma_checkout.index.step1_completed_msg', 'Informações pessoais confirmadas — Step 1 concluído'))}
            </div>
          </div>
        </section>

        {/* ── STEP 2 — Documents ── */}
        {(state.step1Completed || state.currentStep >= 2) && (
          <section>
            <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
              state.currentStep === 2 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10'
                : state.step2Completed ? 'border-emerald-500/30'
                : 'border-white/5'
            }`}>
              {stepHeader(
                2, 
                t('migma_checkout.index.step_X_of_3', { step: 2 }, 'Step 2 of 3'), 
                t('migma_checkout.index.step2_title', 'Documents & Identity Verification'), 
                state.step2Completed, 
                state.currentStep === 2
              )}
              <div className="bg-[#0d0d0d] px-6 py-8">
                {state.currentStep === 2 && step1Data && (
                  <Step2Documents
                    isCompleted={state.step2Completed}
                    onComplete={handleStep2Complete}
                    onAdvance={() => setState(prev => ({ ...prev, currentStep: 3 }))}
                    onBack={() => setState(prev => ({ ...prev, currentStep: 1 }))}
                  />
                )}
                {state.step2Completed && state.currentStep > 2 && completedBadge(t('migma_checkout.index.step2_completed_msg', 'Documentos enviados — Step 2 concluído'))}
              </div>
            </div>
          </section>
        )}

        {/* ── STEP 3 — Payment ── */}
        {(state.step2Completed || state.currentStep >= 3) && (
          <section>
            <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
              state.currentStep === 3 ? 'border-gold-medium/50 shadow-lg shadow-gold-medium/10'
                : state.paymentConfirmed ? 'border-emerald-500/30'
                : 'border-white/5'
            }`}>
              {stepHeader(
                3, 
                t('migma_checkout.index.step_X_of_3', { step: 3 }, 'Step 3 of 3'), 
                t('migma_checkout.index.step3_title', 'Payment & Confirmation'), 
                state.paymentConfirmed, 
                state.currentStep === 3
              )}
              <div className="bg-[#0d0d0d] px-6 py-8">
                {state.currentStep === 3 && step1Data && step2Data && (
                  <Step3Confirmation
                    config={config}
                    step1={step1Data}
                    step2={step2Data}
                    total={state.totalPrice}
                    region={region}
                    paymentConfirmed={state.paymentConfirmed}
                    onPayment={handleStep3Payment}
                  />
                )}
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
};

export default MigmaCheckout;
