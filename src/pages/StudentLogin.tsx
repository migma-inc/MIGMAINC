/**
 * Página de Login do Aluno — Migma
 * Autentica diretamente no Auth do Supabase da Migma.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { supabase } from '../lib/supabase';

const StudentLogin: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useStudentAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email e senha são obrigatórios.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data: signInData, error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setError('Email ou senha incorretos. Por favor, tente novamente.');
    } else if (signInData?.user) {
      // 🚀 Busca o perfil para decidir o destino
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('source, migma_checkout_completed_at, service_type')
        .eq('user_id', signInData.user.id)
        .maybeSingle();

      const isMigma = profile?.source === 'migma';
      const isCompleted = !!profile?.migma_checkout_completed_at;

      if (isMigma && !isCompleted) {
        // Redireciona para o checkout (determinando o serviço pelo perfil ou padrão transfer)
        const service = profile?.service_type || 'transfer';
        navigate(`/student/checkout/${service}`);
      } else {
        navigate('/student/onboarding');
      }
    } else {
      navigate('/student/onboarding');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#C9A84C]/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao início
        </button>

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Migma"
            className="h-10 mx-auto mb-6 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Portal do Aluno
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Acesse sua conta para continuar o processo
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" id="student-login-form">

            {/* Email */}
            <div>
              <label htmlFor="student-email" className="text-sm font-semibold text-gray-300 mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  id="student-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/60 focus:ring-1 focus:ring-[#C9A84C]/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="student-password" className="text-sm font-semibold text-gray-300">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/student/forgot-password')}
                  className="text-xs text-[#C9A84C] hover:text-[#E5C46A] hover:underline transition-colors"
                >
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/60 focus:ring-1 focus:ring-[#C9A84C]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="student-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[#C9A84C] text-black py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#E5C46A] transition-all shadow-lg shadow-[#C9A84C]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
                : 'Entrar'
              }
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Register CTA */}
          <p className="text-center text-sm text-gray-500">
            Ainda não tem conta?{' '}
            <button
              onClick={() => navigate('/student/checkout/transfer')}
              className="text-[#C9A84C] font-semibold hover:text-[#E5C46A] hover:underline transition-colors"
            >
              Fazer inscrição
            </button>
          </p>
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-gray-600 mt-6">
          🔒 Conexão segura — seus dados estão protegidos
        </p>
      </div>
    </div>
  );
};

export default StudentLogin;
