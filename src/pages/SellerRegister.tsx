import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const SellerRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    sellerIdPublic: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validations
      if (!formData.fullName || !formData.email || !formData.sellerIdPublic || !formData.password) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      // Validate seller_id_public format (alphanumeric, dashes, underscores only)
      const sellerIdRegex = /^[a-zA-Z0-9_-]+$/;
      if (!sellerIdRegex.test(formData.sellerIdPublic)) {
        setError('Seller ID can only contain letters, numbers, dashes, and underscores');
        setLoading(false);
        return;
      }

      // Check if seller_id_public is already taken
      const { data: existingSeller } = await supabase
        .from('sellers')
        .select('seller_id_public')
        .eq('seller_id_public', formData.sellerIdPublic)
        .single();

      if (existingSeller) {
        setError('This Seller ID is already taken. Please choose another one.');
        setLoading(false);
        return;
      }

      console.log('[SellerRegister] Creating user with signUp...');

      // 1. Create user in auth.users
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'seller',
            full_name: formData.fullName,
            phone: formData.phone,
            seller_id_public: formData.sellerIdPublic,
          },
        },
      });

      if (signUpError) {
        console.error('[SellerRegister] SignUp error:', signUpError);
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Failed to create user');
        setLoading(false);
        return;
      }

      console.log('[SellerRegister] User created:', data.user.id);

      // 2. Auto-confirm email via Edge Function
      console.log('[SellerRegister] Calling auto-confirm-seller-email...');
      
      const { error: confirmError } = await supabase.functions.invoke('auto-confirm-seller-email', {
        body: {
          userId: data.user.id,
          role: 'seller',
        },
      });

      if (confirmError) {
        console.error('[SellerRegister] Auto-confirm error:', confirmError);
        // Continue anyway - user can still login manually
      } else {
        console.log('[SellerRegister] Email confirmed successfully');
      }

      // 3. Auto-login
      console.log('[SellerRegister] Logging in automatically...');
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        console.error('[SellerRegister] SignIn error:', signInError);
        // User created but auto-login failed - redirect to login page
        navigate('/seller/login?message=Registration successful! Please login.');
        return;
      }

      console.log('[SellerRegister] Login successful, redirecting to dashboard...');
      
      // 4. Redirect to dashboard
      navigate('/seller/dashboard');
    } catch (err) {
      console.error('[SellerRegister] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardHeader>
          <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <CardTitle className="text-2xl migma-gold-text">Seller Registration</CardTitle>
          <CardDescription className="text-gray-400">
            Create your seller account to start generating sales links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white">Full Name *</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                className="bg-white text-black"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-white text-black"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">Phone (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone}
                onChange={handleChange}
                className="bg-white text-black"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerIdPublic" className="text-white">Seller ID *</Label>
              <Input
                id="sellerIdPublic"
                name="sellerIdPublic"
                type="text"
                placeholder="e.g., JOAO01, MATHEUS-SP"
                value={formData.sellerIdPublic}
                onChange={handleChange}
                className="bg-white text-black"
                required
              />
              <p className="text-xs text-gray-400">
                This will be your unique ID in sales links. Only letters, numbers, dashes, and underscores.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="bg-white text-black"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="bg-white text-black"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Register'
              )}
            </Button>

            <div className="text-center text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/seller/login" className="text-gold-light hover:text-gold-medium underline">
                Login here
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};


