import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';

export const MentorRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    calendarBookingUrl: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const ensureMentorProfile = async (userId: string) => {
    const profilePayload = {
      full_name: formData.fullName.trim(),
      phone: formData.phone.trim() || null,
      calendar_booking_url: formData.calendarBookingUrl.trim(),
      status: 'active',
    };

    const { data: existingProfile, error: profileLoadError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileLoadError) {
      throw profileLoadError;
    }

    let profileId = existingProfile?.id;

    if (profileId) {
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update(profilePayload)
        .eq('id', profileId);

      if (profileUpdateError) {
        throw profileUpdateError;
      }
    } else {
      const { data: createdProfile, error: profileInsertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: formData.email.trim(),
          source: 'migma',
          ...profilePayload,
        })
        .select('id')
        .single();

      if (profileInsertError) {
        throw profileInsertError;
      }

      profileId = createdProfile.id;
    }

    const { error: mentorError } = await supabase
      .from('referral_mentors')
      .upsert({
        profile_id: profileId,
        display_name: formData.fullName.trim(),
        calendar_booking_url: formData.calendarBookingUrl.trim(),
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });

    if (mentorError) {
      throw mentorError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.fullName || !formData.email || !formData.calendarBookingUrl || !formData.password) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (!/^https?:\/\//i.test(formData.calendarBookingUrl.trim())) {
        setError('Calendar URL must start with http:// or https://');
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            role: 'mentor',
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            calendar_booking_url: formData.calendarBookingUrl.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Failed to create user');
        setLoading(false);
        return;
      }

      const { error: confirmError } = await supabase.functions.invoke('auto-confirm-seller-email', {
        body: {
          userId: data.user.id,
          role: 'mentor',
        },
      });

      if (confirmError) {
        console.error('[MentorRegister] Auto-confirm error:', confirmError);
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (signInError || !signInData.user) {
        navigate('/mentor/login?message=Registration successful! Please login.');
        return;
      }

      await ensureMentorProfile(signInData.user.id);

      navigate('/dashboard/users', { replace: true });
    } catch (err) {
      console.error('[MentorRegister] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
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
          <CardTitle className="text-2xl migma-gold-text">Mentor Registration</CardTitle>
          <CardDescription className="text-gray-400">
            Create your mentor account to access the CRM
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
              <Label htmlFor="calendarBookingUrl" className="text-white">Calendar URL *</Label>
              <Input
                id="calendarBookingUrl"
                name="calendarBookingUrl"
                type="url"
                placeholder="https://calendar.google.com/calendar/appointments/..."
                value={formData.calendarBookingUrl}
                onChange={handleChange}
                className="bg-white text-black"
                required
              />
              <p className="text-xs text-gray-400">
                Public Google Calendar appointment scheduling link used for student meetings.
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
              <Link to="/mentor/login" className="text-gold-light hover:text-gold-medium underline">
                Login here
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
