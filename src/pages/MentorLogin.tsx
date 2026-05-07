import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const MentorLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Invalid credentials');
        setLoading(false);
        return;
      }

      if (data.user.user_metadata?.role !== 'mentor') {
        setError('This account is not registered as a mentor');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!profile?.id) {
        setError('Mentor profile not found');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const { data: mentor } = await supabase
        .from('referral_mentors')
        .select('id')
        .eq('profile_id', profile.id)
        .eq('active', true)
        .maybeSingle();

      if (!mentor) {
        setError('This account is not active as a mentor');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      navigate('/dashboard/users', { replace: true });
    } catch (err) {
      console.error('[MentorLogin] Unexpected error:', err);
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
          <CardTitle className="text-2xl migma-gold-text">Mentor Login</CardTitle>
          <CardDescription className="text-gray-400">
            Login to access the mentor CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-300 p-3 rounded-md text-sm mb-4">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-white text-black"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="bg-white text-black"
                required
                autoComplete="current-password"
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
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>

            <div className="text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/mentor/register" className="text-gold-light hover:text-gold-medium underline">
                Register here
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
