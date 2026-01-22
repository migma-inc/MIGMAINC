import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, User, Mail, Phone, Shield } from 'lucide-react';

export const AdminProfile = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userId, setUserId] = useState('');
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
    });
    const [initialEmail, setInitialEmail] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError('');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            setUserId(user.id);
            const metadata = user.user_metadata || {};

            setFormData({
                full_name: metadata.full_name || '',
                email: user.email || '',
                phone: metadata.phone || '',
            });
            setInitialEmail(user.email || '');
        } catch (err) {
            console.error('[AdminProfile] Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Validate
            if (!formData.full_name.trim()) {
                setError('Full name is required');
                setSaving(false);
                return;
            }

            if (!formData.email.trim()) {
                setError('Email is required');
                setSaving(false);
                return;
            }

            const emailChanged = formData.email !== initialEmail;

            // Update auth user data
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const currentMetadata = currentUser?.user_metadata || {};

            const updatePayload: any = {
                data: {
                    ...currentMetadata,
                    full_name: formData.full_name.trim(),
                    phone: formData.phone.trim() || null,
                }
            };

            if (emailChanged) {
                updatePayload.email = formData.email.trim();
            }

            const { error: updateError } = await supabase.auth.updateUser(
                updatePayload,
                emailChanged ? { emailRedirectTo: `${window.location.origin}/dashboard` } : undefined
            );

            if (updateError) {
                console.error('[AdminProfile] Error updating profile:', updateError);
                setError(updateError.message);
                setSaving(false);
                return;
            }

            if (emailChanged) {
                setSuccess('Profile updated! IMPORTANT: A confirmation email has been sent to your new address. After confirming, you will be redirected to the login page to sign in with your new email.');
            } else {
                setSuccess('Profile updated successfully!');
            }

            // Reload profile data
            await loadProfile();
        } catch (err) {
            console.error('[AdminProfile] Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold-medium mx-auto mb-4" />
                    <p className="text-gray-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <CardTitle className="text-2xl migma-gold-text flex items-center gap-2">
                        <Shield className="w-6 h-6" />
                        Admin Profile Settings
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Update your administrator account details
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Success Message */}
                        {success && (
                            <div className={`border p-3 rounded-md text-sm ${success.includes('IMPORTANT')
                                ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'
                                : 'bg-green-500/10 border-green-500/50 text-green-300'
                                }`}>
                                {success}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="full_name" className="text-white flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Full Name
                            </Label>
                            <Input
                                id="full_name"
                                name="full_name"
                                type="text"
                                value={formData.full_name}
                                onChange={handleChange}
                                className="bg-white text-black"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="bg-white text-black"
                                required
                            />
                            <p className="text-xs text-gray-500">Changing your email will require verification and logout</p>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-white flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Phone Number
                            </Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                className="bg-white text-black"
                                placeholder="+1 (555) 000-0000"
                            />
                            <p className="text-xs text-gray-500">Optional - for contact purposes</p>
                        </div>

                        {/* Submit Button */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
