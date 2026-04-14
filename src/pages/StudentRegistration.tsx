/**
 * Página de cadastro + pagamento da taxa de processo seletivo ($400).
 * Substitui o QuickRegistration do Matricula USA, adaptado para a Migma.
 *
 * Fluxo:
 * 1. Aluno preenche formulário
 * 2. Migma chama /api/migma/create-student → salva user_id
 * 3. Aluno seleciona método de pagamento e paga $400
 * 4. Após pagamento: chama /api/migma/payment-completed { fee_type: "selection_process" }
 * 5. Redireciona para /student/onboarding?step=selection_fee&payment=success
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail, User, Lock, AlertCircle, Loader2,
  Eye, EyeOff, Shield, Phone, DollarSign,
} from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { matriculaApi } from '../lib/matriculaApi';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  termsAccepted: boolean;
}

const StudentRegistration: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, signIn } = useStudentAuth();

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    termsAccepted: false,
  });

  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savedUserId, setSavedUserId] = useState<string | null>(null);

  // Pegar referral code da URL (?ref=xxx)
  const searchParams = new URLSearchParams(location.search);
  const sellerRef = searchParams.get('ref') || searchParams.get('sref') || undefined;

  // Se já logado com taxa paga → redirecionar para onboarding
  useEffect(() => {
    if (user && userProfile?.has_paid_selection_process_fee) {
      navigate('/student/onboarding');
    }
  }, [user, userProfile?.has_paid_selection_process_fee]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Valid email is required';
    if (!formData.phone.trim()) errors.phone = 'Phone is required';
    if (!formData.password || formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirm_password) errors.confirm_password = 'Passwords do not match';
    if (!formData.termsAccepted) errors.terms = 'You must accept the Terms of Service';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Criar aluno no Matricula USA via Edge Function
      const result = await matriculaApi.createStudent({
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        country: 'Brazil',
        migma_seller_id: sellerRef,
        password: formData.password,
      });

      // 409 = já existe — tentar login
      const userId = result.user_id;
      setSavedUserId(userId);
      sessionStorage.setItem('migma_student_user_id', userId);

      // 2. Login do aluno contra o Supabase do Matricula USA
      const { error: signInError } = await signIn(formData.email.trim(), formData.password);
      if (signInError) {
        // Sign-in falhou após criação — redireciona para login com email pré-preenchido
        navigate(`/student/login?email=${encodeURIComponent(formData.email.trim())}&registered=1`);
        return;
      }

      setIsRegistered(true);
    } catch (err: any) {
      // Se aluno já existe (409), tentar login direto
      if (err.status === 409 && err.data?.user_id) {
        setSavedUserId(err.data.user_id);
        const { error: signInError } = await signIn(formData.email.trim(), formData.password);
        if (signInError) {
          setError('Account already exists. Please check your credentials.');
        } else {
          setIsRegistered(true);
        }
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Se já registrado e autenticado, mostrar tela de pagamento
  if (isRegistered || (user && !userProfile?.has_paid_selection_process_fee)) {
    return (
      <PaymentScreen
        userId={savedUserId || user?.id || ''}
        onSuccess={() => navigate('/student/onboarding?step=selection_fee&payment=success')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Migma" className="h-10 mx-auto mb-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Start Your Journey
          </h1>
          <p className="text-gray-500 mt-2">Study in the USA with a scholarship</p>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-white font-semibold text-sm mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="John Smith"
                  className={`w-full pl-10 pr-4 py-3 bg-[#0d0d0d] border-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-colors ${fieldErrors.full_name ? 'border-red-500/50' : 'border-white/10'}`}
                />
              </div>
              {fieldErrors.full_name && <p className="text-red-400 text-xs mt-1">{fieldErrors.full_name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-white font-semibold text-sm mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@email.com"
                  className={`w-full pl-10 pr-4 py-3 bg-[#0d0d0d] border-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-colors ${fieldErrors.email ? 'border-red-500/50' : 'border-white/10'}`}
                />
              </div>
              {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-white font-semibold text-sm mb-1.5">WhatsApp / Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+55 11 99999-9999"
                  className={`w-full pl-10 pr-4 py-3 bg-[#0d0d0d] border-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-colors ${fieldErrors.phone ? 'border-red-500/50' : 'border-white/10'}`}
                />
              </div>
              {fieldErrors.phone && <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-white font-semibold text-sm mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                  className={`w-full pl-10 pr-10 py-3 bg-[#0d0d0d] border-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-colors ${fieldErrors.password ? 'border-red-500/50' : 'border-white/10'}`}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-white font-semibold text-sm mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={e => setFormData(p => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Repeat password"
                  className={`w-full pl-10 pr-10 py-3 bg-[#0d0d0d] border-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium transition-colors ${fieldErrors.confirm_password ? 'border-red-500/50' : 'border-white/10'}`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirm_password && <p className="text-red-400 text-xs mt-1">{fieldErrors.confirm_password}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={formData.termsAccepted}
                onChange={e => setFormData(p => ({ ...p, termsAccepted: e.target.checked }))}
                className="mt-1 w-4 h-4 rounded border-white/20 bg-[#0d0d0d] text-gold-medium focus:ring-gold-medium"
              />
              <label htmlFor="terms" className="text-sm text-gray-400 cursor-pointer">
                I agree to the{' '}
                <a href="/legal/website-terms" target="_blank" className="text-gold-medium hover:underline font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/legal/privacy-policy" target="_blank" className="text-gold-medium hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </div>
            {fieldErrors.terms && <p className="text-red-400 text-xs">{fieldErrors.terms}</p>}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Fee notice */}
            <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-xl p-3 flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-gold-medium flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-gold-light">Selection Process Fee: $400</span>
                <span className="text-gray-500 ml-1">— paid after registration</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 rounded-xl font-black uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                : 'Create Account & Continue'
              }
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-2">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/student/login')}
              className="text-gold-medium font-semibold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-gray-600 text-sm">
          <Shield className="w-4 h-4" />
          Secure and encrypted platform
        </div>
      </div>
    </div>
  );
};

// ─── Payment Screen (tela de pagamento após cadastro) ────────────────────────
interface PaymentScreenProps {
  userId: string;
  onSuccess: () => void;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ userId, onSuccess }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src="/logo.png" alt="Migma" className="h-10 mx-auto mb-6 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="w-14 h-14 bg-gold-medium/10 border border-gold-medium/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-7 h-7 text-gold-medium" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Selection Process Fee
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            Pay $400 to start your scholarship application process.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Selection Process Fee</span>
            <span className="font-bold text-white">$400.00</span>
          </div>
          <div className="border-t border-white/10 pt-3 flex justify-between font-black text-white text-lg">
            <span>Total</span>
            <span className="text-gold-medium">$400.00</span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Shield className="w-4 h-4 text-gold-medium flex-shrink-0 mt-0.5" />
          Secure payment. Contact your advisor to complete payment.
        </div>

        <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-5 text-center space-y-2">
          <p className="text-gold-light font-semibold">Payment integration coming soon</p>
          <p className="text-gray-500 text-sm">Contact your advisor to proceed.</p>
        </div>

        {/* Dev bypass para testes */}
        {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <button
            onClick={async () => {
              if (!userId) return;
              try {
                await matriculaApi.paymentCompleted({
                  user_id: userId,
                  fee_type: 'selection_process',
                  amount: 400,
                  payment_method: 'manual',
                });
                onSuccess();
              } catch (err) {
                console.error('Dev bypass error:', err);
              }
            }}
            className="w-full border-2 border-dashed border-white/10 text-gray-600 py-3 rounded-xl text-sm font-medium hover:border-white/20 hover:text-gray-400 transition-all"
          >
            [DEV] Simulate Payment Success
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentRegistration;
