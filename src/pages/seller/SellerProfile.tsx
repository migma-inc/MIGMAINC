import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Save, User, Mail, Phone, Hash, AlertCircle } from 'lucide-react';

interface SellerProfile {
    seller_id_public: string;
    full_name: string;
    email: string;
    phone: string | null;
    user_id: string;
    status: string;
    created_at: string;
}

export const SellerProfile = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [profile, setProfile] = useState<SellerProfile | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError('');

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            // Get seller profile
            const { data: sellerData, error: sellerError } = await supabase
                .from('sellers')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (sellerError) {
                console.error('[SellerProfile] Error loading profile:', sellerError);
                setError('Failed to load profile');
                setLoading(false);
                return;
            }

            setProfile(sellerData);
            setFormData({
                full_name: sellerData.full_name || '',
                email: sellerData.email || '',
                phone: sellerData.phone || '',
            });
        } catch (err) {
            console.error('[SellerProfile] Unexpected error:', err);
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
            if (!profile) {
                setError('Profile not loaded');
                setSaving(false);
                return;
            }

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

            // Update seller profile
            const { error: updateError } = await supabase
                .from('sellers')
                .update({
                    full_name: formData.full_name.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone.trim() || null,
                })
                .eq('user_id', profile.user_id);

            if (updateError) {
                console.error('[SellerProfile] Error updating profile:', updateError);
                setError('Failed to update profile');
                setSaving(false);
                return;
            }

            // If email changed, update auth email
            const emailChanged = formData.email !== profile.email;

            if (emailChanged) {
                const { error: authError } = await supabase.auth.updateUser(
                    { email: formData.email.trim() },
                    { emailRedirectTo: `${window.location.origin}/seller/login` }
                );

                if (authError) {
                    console.error('[SellerProfile] Error updating auth email:', authError);
                    setError('Profile updated but email change failed. Please contact support.');
                    setSaving(false);
                    return;
                }
            }

            if (emailChanged) {
                setSuccess('Profile updated! IMPORTANT: A confirmation email has been sent to your new address. After confirming, you will be redirected to the login page to sign in with your new email.');
            } else {
                setSuccess('Profile updated successfully!');
            }

            await loadProfile(); // Reload to get fresh data
        } catch (err) {
            console.error('[SellerProfile] Unexpected error:', err);
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

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="max-w-md w-full bg-gradient-to-br from-red-500/10 via-red-500/5 to-red-500/10 border border-red-500/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-6 h-6" />
                            <p>Failed to load profile. Please try again.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <CardTitle className="text-2xl migma-gold-text flex items-center gap-2">
                        <User className="w-6 h-6" />
                        Profile Settings
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        Update your personal information and contact details
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

                        {/* Seller ID (Read-only) */}
                        <div className="space-y-2">
                            <Label htmlFor="seller_id" className="text-white flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Seller ID
                            </Label>
                            <Input
                                id="seller_id"
                                value={profile.seller_id_public}
                                className="bg-gray-800 text-gray-400 cursor-not-allowed"
                                disabled
                                readOnly
                            />
                            <p className="text-xs text-gray-500">Your unique seller identifier (cannot be changed)</p>
                        </div>

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
                            <p className="text-xs text-gray-500">Changing your email will require verification</p>
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

                        {/* Account Status */}
                        <div className="space-y-2">
                            <Label className="text-white">Account Status</Label>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${profile.status === 'active'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                                    }`}>
                                    {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                                </span>
                            </div>
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
