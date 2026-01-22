import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';

export const SellerForgotPassword = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!email.trim()) {
                setError('Please enter your email address');
                setLoading(false);
                return;
            }

            // Get the base URL for redirect
            const baseUrl = window.location.origin;
            const redirectUrl = `${baseUrl}/seller/reset-password`;

            console.log('[SellerForgotPassword] Sending reset email to:', email);
            console.log('[SellerForgotPassword] Redirect URL:', redirectUrl);

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
            });

            if (resetError) {
                console.error('[SellerForgotPassword] Reset error:', resetError);
                setError(resetError.message);
                setLoading(false);
                return;
            }

            console.log('[SellerForgotPassword] Reset email sent successfully');
            setSuccess(true);
        } catch (err) {
            console.error('[SellerForgotPassword] Unexpected error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <Card className="max-w-md w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <Link to="/seller/login" className="inline-flex items-center text-gold-light hover:text-gold-medium transition mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Login
                    </Link>
                    {!success && (
                        <>
                            <CardTitle className="text-2xl migma-gold-text">Reset Password</CardTitle>
                            <CardDescription className="text-gray-400">
                                Enter your email address and we'll send you a link to reset your password
                            </CardDescription>
                        </>
                    )}
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center py-6">
                            <div className="flex justify-center mb-4">
                                <div className="bg-green-500/20 p-4 rounded-full">
                                    <CheckCircle className="w-12 h-12 text-green-400" />
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Check Your Email</h3>
                            <p className="text-gray-400 mb-6">
                                We've sent a password reset link to <span className="text-gold-light">{email}</span>.
                                Please check your inbox and click the link to reset your password.
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                Didn't receive the email? Check your spam folder or try again.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => setSuccess(false)}
                                    variant="outline"
                                    className="w-full border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white"
                                >
                                    Try Again
                                </Button>
                                <Link to="/seller/login">
                                    <Button className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium">
                                        Back to Login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-white text-black pl-10"
                                        placeholder="Enter your email address"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </Button>

                            <div className="text-center text-sm text-gray-400">
                                Remember your password?{' '}
                                <Link to="/seller/login" className="text-gold-light hover:text-gold-medium underline">
                                    Login here
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
