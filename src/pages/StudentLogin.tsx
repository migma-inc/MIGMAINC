/**
 * Página de Login do Aluno — Migma
 * Autenticação Passwordless (OTP) via E-mail.
 * Restrito a alunos cadastrados na tabela user_profiles.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ShieldCheck, AlertCircle, Loader2, ArrowLeft, CheckCircle, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { supabase } from '../lib/supabase';
import { saveSellerRef } from '../lib/referral-tracking';

const StudentLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInOtp, verifyOtp } = useStudentAuth();
  
  // States
  const [view, setView] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const justRegistered = searchParams.get('registered') === '1';

  // Persist seller ref
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('seller_id');
    if (ref) saveSellerRef(ref);
  }, [searchParams]);

  // Resend timer logic
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Validar se o aluno existe na user_profiles via RPC (pula RLS)
      const { data: exists, error: profileError } = await supabase
        .rpc('check_student_exists', { email_to_check: email.trim().toLowerCase() });

      if (profileError) throw profileError;

      if (!exists) {
        setError('E-mail não encontrado. Apenas alunos cadastrados podem acessar.');
        setLoading(false);
        return;
      }

      // 2. Disparar OTP
      const { error: otpError } = await signInOtp(email.trim().toLowerCase());
      if (otpError) throw otpError;

      setView('otp');
      setResendTimer(60); // Aguardar 1 minuto para reenvio
    } catch (err: any) {
      console.error('[Login] Erro ao enviar código:', err);
      setError(err.message || 'Ocorreu um erro ao enviar o código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6 || loading) return;

    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: verifyError } = await verifyOtp(email.trim().toLowerCase(), otp);
      
      if (verifyError) {
        setError(verifyError.message || 'Código inválido ou expirado. Tente novamente.');
        setOtp(''); // Limpa o campo para nova tentativa
        setLoading(false);
        return;
      }

      if (authData?.user) {
        // 🚀 Busca o perfil para decidir o destino
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('source, migma_checkout_completed_at, service_type')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        const isMigma = profile?.source === 'migma';
        const isCompleted = !!profile?.migma_checkout_completed_at;

        if (isMigma && !isCompleted) {
          const service = profile?.service_type || 'transfer';
          navigate(`/student/checkout/${service}`);
        } else {
          navigate('/student/onboarding');
        }
      } else {
        navigate('/student/onboarding');
      }
    } catch (err: any) {
      console.error('[Login] Erro ao verificar código:', err);
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C9A84C]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#C9A84C]/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#C9A84C] transition-all text-sm mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar ao site
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <motion.img
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            src="/logo.png"
            alt="Migma"
            className="h-12 mx-auto mb-6 object-contain filter drop-shadow-[0_0_15px_rgba(201,168,76,0.3)]"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
            Portal do Aluno
          </h1>
          {view !== 'email' && (
            <p className="text-gray-400 font-medium">
              Confirme seu acesso
            </p>
          )}
        </div>

        {/* Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Subtle gold line on top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C]/50 to-transparent" />

          {justRegistered && view === 'email' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 text-[#C9A84C] text-sm bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-2xl p-4 mb-6"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              Conta identificada! Solicite seu código de acesso.
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {view === 'email' ? (
              <motion.form
                key="email-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSendCode}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="student-email" className="sr-only">
                    E-mail
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#C9A84C] transition-colors" />
                    <input
                      id="student-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl text-white text-base placeholder:text-gray-700 outline-none focus:border-[#C9A84C]/50 focus:ring-4 focus:ring-[#C9A84C]/5 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[#C9A84C] transition-transform duration-300 group-hover:scale-105" />
                  <div className="relative flex items-center justify-center gap-3 py-4 text-black font-black uppercase tracking-tighter text-base">
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Receber Código Acesso <Key className="w-4 h-4" /></>
                    )}
                  </div>
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyCode}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-[#C9A84C]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#C9A84C]/20 shadow-[0_0_20px_rgba(201,168,76,0.2)]">
                    <ShieldCheck className="w-8 h-8 text-[#C9A84C]" />
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Enviamos um código de 6 dígitos para:<br/>
                    <strong className="text-white">{email}</strong>
                  </p>
                </div>

                <div>
                  <label htmlFor="otp-code" className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest mb-3 block text-center">
                    Código de Acesso
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full py-5 bg-black/40 border border-white/5 rounded-2xl text-white text-2xl font-black tracking-[0.6em] text-center placeholder:text-gray-800 outline-none focus:border-[#C9A84C]/50 focus:ring-4 focus:ring-[#C9A84C]/5 transition-all"
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full relative group overflow-hidden disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-[#C9A84C]" />
                    <div className="relative flex items-center justify-center gap-3 py-4 text-black font-black uppercase tracking-tighter text-base">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Portal'}
                    </div>
                  </button>

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setView('email')}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Alterar e-mail
                    </button>
                    
                    <button
                      type="button"
                      disabled={resendTimer > 0 || loading}
                      onClick={handleSendCode}
                      className="text-sm font-bold text-[#C9A84C] hover:text-[#E5C46A] disabled:text-gray-600 transition-colors"
                    >
                      {resendTimer > 0 
                        ? `Reenviar código em ${resendTimer}s` 
                        : 'Não recebi o código'}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>


      </motion.div>
    </div>
  );
};

export default StudentLogin;
