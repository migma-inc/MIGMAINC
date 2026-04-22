/**
 * Página de Recuperação de Senha — Migma
 * Envia link de reset diretamente pelo Auth do Supabase da Migma.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Por favor, informe seu email.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      setError(err.message || 'Ocorreu um erro ao enviar o link. Verifique o email informado.');
    } finally {
      setLoading(false);
    }
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
          onClick={() => navigate('/student/login')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar ao login
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
            Recuperar Senha
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            {success ? 'Link enviado com sucesso' : 'Informe seu email para receber o link de redefinição'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Verifique seu e-mail</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                Enviamos um link de recuperação para <span className="text-white font-medium">{email}</span>. 
                Por favor, verifique sua caixa de entrada e spam.
              </p>
              <button
                onClick={() => navigate('/student/login')}
                className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-all"
              >
                Voltar para o Portal
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="reset-email" className="text-sm font-semibold text-gray-300 mb-1.5 block">
                  Email de cadastro
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#C9A84C]/60 focus:ring-1 focus:ring-[#C9A84C]/30 transition-all"
                    required
                  />
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
                type="submit"
                disabled={loading}
                className="w-full bg-[#C9A84C] text-black py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#E5C46A] transition-all shadow-lg shadow-[#C9A84C]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de acesso'
                )}
              </button>
            </form>
          )}

          {/* Helper Footnote */}
          {!success && (
            <p className="text-center text-xs text-gray-600 mt-8">
              Lembrou sua senha?{' '}
              <button
                onClick={() => navigate('/student/login')}
                className="text-[#C9A84C] hover:underline transition-colors"
                type="button"
              >
                Fazer login
              </button>
            </p>
          )}
        </div>

        {/* Support */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Precisa de ajuda? Entre em contato com o suporte Migma.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
