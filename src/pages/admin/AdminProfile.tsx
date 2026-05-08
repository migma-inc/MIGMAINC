import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Loader2, Mail, Phone, Plus, RefreshCw, Save, Shield, Trash2, Unplug, User } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

type DashboardOutletContext = {
    accessRole: 'admin' | 'mentor';
    mentorProfileId: string | null;
};

type GoogleConnectionStatus = {
    connected: boolean;
    account_email: string | null;
    connected_at: string | null;
    status: 'active' | 'revoked' | 'disconnected' | string;
};

type ScheduleConfigForm = {
    timezone: string;
    slot_duration_minutes: number;
    booking_lead_hours: number;
    booking_window_business_days: number;
};

type AvailabilityBlock = {
    id: string;
    mentor_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
};

type ScheduleConfigResponse = {
    timezone?: string | null;
    slot_duration_minutes?: number | null;
    booking_lead_hours?: number | null;
    booking_window_business_days?: number | null;
};

const WEEKDAYS = [
    { value: 0, label: 'Dom' },
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sab' },
];

const TIMEZONE_OPTIONS = [
    'America/Sao_Paulo',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/Lisbon',
    'UTC',
];

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfigForm = {
    timezone: 'America/Sao_Paulo',
    slot_duration_minutes: 30,
    booking_lead_hours: 2,
    booking_window_business_days: 7,
};

function normalizeTime(value: string | null | undefined) {
    return (value ?? '').slice(0, 5);
}

function timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatDateTime(value: string | null) {
    if (!value) return 'Data indisponivel';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

export const AdminProfile = () => {
    const dashboardContext = useOutletContext<DashboardOutletContext | undefined>();
    const [accountRole, setAccountRole] = useState<'admin' | 'mentor'>('admin');
    const [profileId, setProfileId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
    });
    const [initialEmail, setInitialEmail] = useState('');
    const [calendarBookingUrl, setCalendarBookingUrl] = useState('');
    const [savingCalendar, setSavingCalendar] = useState(false);
    const [calendarMsg, setCalendarMsg] = useState('');
    const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
    const [loadingScheduling, setLoadingScheduling] = useState(false);
    const [connectingGoogle, setConnectingGoogle] = useState(false);
    const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
    const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfigForm>(DEFAULT_SCHEDULE_CONFIG);
    const [savingScheduleConfig, setSavingScheduleConfig] = useState(false);
    const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
    const [availabilityDrafts, setAvailabilityDrafts] = useState<Record<number, { start: string; end: string }>>(
        Object.fromEntries(WEEKDAYS.map((day) => [day.value, { start: '09:00', end: '12:00' }]))
    );
    const [schedulingMsg, setSchedulingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadMentorScheduling = async (mentorProfileId: string) => {
        setLoadingScheduling(true);

        try {
            const [
                statusResult,
                configResult,
                availabilityResult,
            ] = await Promise.all([
                supabase.rpc('mentor_google_status', { p_mentor: mentorProfileId }),
                supabase.rpc('get_mentor_schedule_config', { p_mentor: mentorProfileId }),
                supabase
                    .from('mentor_availability')
                    .select('id, mentor_id, weekday, start_time, end_time')
                    .order('weekday')
                    .order('start_time'),
            ]);

            if (statusResult.error) throw statusResult.error;
            if (configResult.error) throw configResult.error;
            if (availabilityResult.error) throw availabilityResult.error;

            const statusRows = Array.isArray(statusResult.data) ? statusResult.data : [];
            setGoogleStatus((statusRows[0] as GoogleConnectionStatus | undefined) ?? {
                connected: false,
                account_email: null,
                connected_at: null,
                status: 'disconnected',
            });

            const config = (configResult.data ?? {}) as ScheduleConfigResponse;
            setScheduleConfig({
                timezone: config.timezone ?? DEFAULT_SCHEDULE_CONFIG.timezone,
                slot_duration_minutes: config.slot_duration_minutes ?? DEFAULT_SCHEDULE_CONFIG.slot_duration_minutes,
                booking_lead_hours: config.booking_lead_hours ?? DEFAULT_SCHEDULE_CONFIG.booking_lead_hours,
                booking_window_business_days: config.booking_window_business_days ?? DEFAULT_SCHEDULE_CONFIG.booking_window_business_days,
            });

            setAvailability((availabilityResult.data ?? []).map((block) => ({
                ...block,
                start_time: normalizeTime(block.start_time),
                end_time: normalizeTime(block.end_time),
            })) as AvailabilityBlock[]);
        } catch (err) {
            console.error('[AdminProfile] Error loading mentor scheduling:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel carregar a configuracao de agenda.',
            });
        } finally {
            setLoadingScheduling(false);
        }
    };

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

            const metadata = user.user_metadata || {};
            const role = metadata.role === 'mentor' ? 'mentor' : 'admin';
            setAccountRole(role);

            setFormData({
                full_name: metadata.full_name || '',
                email: user.email || '',
                phone: metadata.phone || '',
            });
            setInitialEmail(user.email || '');

            // Load mentor calendar URL from the explicit mentor registry first.
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('id, calendar_booking_url')
                .eq('user_id', user.id)
                .maybeSingle();

            if (profile?.id) {
                const effectiveProfileId = dashboardContext?.mentorProfileId ?? profile.id;
                setProfileId(effectiveProfileId);

                const { data: mentor } = await supabase
                    .from('referral_mentors')
                    .select('calendar_booking_url')
                    .eq('profile_id', effectiveProfileId)
                    .maybeSingle();

                setCalendarBookingUrl(mentor?.calendar_booking_url ?? profile.calendar_booking_url ?? '');

                if (role === 'mentor') {
                    await loadMentorScheduling(effectiveProfileId);
                }
            }
        } catch (err) {
            console.error('[AdminProfile] Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            // Pequeno delay para suavizar a transição do skeleton
            setTimeout(() => setLoading(false), 300);
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

            const updatePayload: { data: Record<string, string | null>; email?: string } = {
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

    const handleSaveCalendarUrl = async () => {
        setSavingCalendar(true);
        setCalendarMsg('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setCalendarMsg('Not authenticated'); return; }

            const trimmedUrl = calendarBookingUrl.trim();
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .update({ calendar_booking_url: trimmedUrl || null })
                .eq('user_id', user.id)
                .select('id, full_name, email')
                .maybeSingle();

            if (profileError) {
                setCalendarMsg(`Error: ${profileError.message}`);
                return;
            }

            if (!profile?.id) {
                setCalendarMsg('Error: profile not found');
                return;
            }

            const displayName = profile.full_name || profile.email || formData.full_name || user.email || profile.id;
            const { error: mentorError } = await supabase
                .from('referral_mentors')
                .upsert({
                    profile_id: profile.id,
                    display_name: displayName,
                    calendar_booking_url: trimmedUrl || null,
                    active: Boolean(trimmedUrl),
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'profile_id' });

            setCalendarMsg(mentorError ? `Error: ${mentorError.message}` : 'Agenda salva com sucesso!');
        } catch {
            setCalendarMsg('Unexpected error');
        } finally {
            setSavingCalendar(false);
        }
    };

    const handleGoogleReturnMessage = () => {
        const params = new URLSearchParams(window.location.search);
        const googleResult = params.get('google');
        const reason = params.get('reason');

        if (!googleResult) return;

        setSchedulingMsg({
            type: googleResult === 'connected' ? 'success' : 'error',
            text: googleResult === 'connected'
                ? 'Google Calendar conectado com sucesso.'
                : `Falha ao conectar Google Calendar${reason ? `: ${reason}` : '.'}`,
        });

        params.delete('google');
        params.delete('reason');
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, document.title, nextUrl);
    };

    useEffect(() => {
        handleGoogleReturnMessage();
    }, []);

    const refreshScheduling = async () => {
        if (!profileId) return;
        await loadMentorScheduling(profileId);
    };

    const connectGoogle = async () => {
        setConnectingGoogle(true);
        setSchedulingMsg(null);

        try {
            const { data, error } = await supabase.functions.invoke('mentor-google-oauth-start');
            if (error) throw error;

            const authorizeUrl = (data as { authorize_url?: string } | null)?.authorize_url;
            if (!authorizeUrl) throw new Error('A Edge Function nao retornou authorize_url.');

            window.location.href = authorizeUrl;
        } catch (err) {
            console.error('[AdminProfile] Error starting Google OAuth:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel iniciar a conexao com Google Calendar.',
            });
            setConnectingGoogle(false);
        }
    };

    const disconnectGoogle = async () => {
        setDisconnectingGoogle(true);
        setSchedulingMsg(null);

        try {
            const { error } = await supabase.functions.invoke('mentor-google-disconnect');
            if (error) throw error;
            setSchedulingMsg({ type: 'success', text: 'Google Calendar desconectado.' });
            await refreshScheduling();
        } catch (err) {
            console.error('[AdminProfile] Error disconnecting Google:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel desconectar o Google Calendar.',
            });
        } finally {
            setDisconnectingGoogle(false);
        }
    };

    const saveScheduleConfig = async () => {
        if (!profileId) return;
        setSavingScheduleConfig(true);
        setSchedulingMsg(null);

        try {
            const { error: updateError } = await supabase
                .from('referral_mentors')
                .update({
                    timezone: scheduleConfig.timezone,
                    slot_duration_minutes: scheduleConfig.slot_duration_minutes,
                    booking_lead_hours: scheduleConfig.booking_lead_hours,
                    booking_window_business_days: scheduleConfig.booking_window_business_days,
                })
                .eq('profile_id', profileId);

            if (updateError) throw updateError;
            setSchedulingMsg({ type: 'success', text: 'Configuracao de agenda salva.' });
            await refreshScheduling();
        } catch (err) {
            console.error('[AdminProfile] Error saving schedule config:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel salvar a configuracao de agenda.',
            });
        } finally {
            setSavingScheduleConfig(false);
        }
    };

    const hasOverlap = (weekday: number, start: string, end: string) => {
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);

        return availability.some((block) => {
            if (block.weekday !== weekday) return false;
            const blockStart = timeToMinutes(normalizeTime(block.start_time));
            const blockEnd = timeToMinutes(normalizeTime(block.end_time));
            return startMinutes < blockEnd && endMinutes > blockStart;
        });
    };

    const addAvailabilityBlock = async (weekday: number) => {
        if (!profileId) return;
        const draft = availabilityDrafts[weekday] ?? { start: '09:00', end: '12:00' };
        const startMinutes = timeToMinutes(draft.start);
        const endMinutes = timeToMinutes(draft.end);

        if (endMinutes <= startMinutes) {
            setSchedulingMsg({ type: 'error', text: 'O horario final precisa ser maior que o inicial.' });
            return;
        }

        if (endMinutes - startMinutes < scheduleConfig.slot_duration_minutes) {
            setSchedulingMsg({ type: 'error', text: 'O bloco precisa comportar pelo menos um slot.' });
            return;
        }

        if (hasOverlap(weekday, draft.start, draft.end)) {
            setSchedulingMsg({ type: 'error', text: 'Ja existe um bloco sobreposto nesse dia.' });
            return;
        }

        setSchedulingMsg(null);
        try {
            const { error: insertError } = await supabase
                .from('mentor_availability')
                .insert({
                    mentor_id: profileId,
                    weekday,
                    start_time: draft.start,
                    end_time: draft.end,
                });

            if (insertError) throw insertError;
            await refreshScheduling();
        } catch (err) {
            console.error('[AdminProfile] Error adding availability block:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel adicionar o bloco.',
            });
        }
    };

    const removeAvailabilityBlock = async (blockId: string) => {
        setSchedulingMsg(null);
        try {
            const { error: deleteError } = await supabase
                .from('mentor_availability')
                .delete()
                .eq('id', blockId);

            if (deleteError) throw deleteError;
            await refreshScheduling();
        } catch (err) {
            console.error('[AdminProfile] Error removing availability block:', err);
            setSchedulingMsg({
                type: 'error',
                text: err instanceof Error ? err.message : 'Nao foi possivel remover o bloco.',
            });
        }
    };

    const isSchedulingReady = googleStatus?.connected && availability.length > 0;

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
                <Card className="bg-zinc-900/40 border-white/5">
                    <CardHeader className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-64" />
                        </div>
                        <Skeleton className="h-4 w-80" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-full rounded-md mt-6" />
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
                        {accountRole === 'mentor' ? <User className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                        {accountRole === 'mentor' ? 'Mentor Profile Settings' : 'Admin Profile Settings'}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                        {accountRole === 'mentor'
                            ? 'Update your mentor account details and scheduling link'
                            : 'Update your administrator account details'}
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

                    {accountRole === 'mentor' && (
                        <div className="mt-8 pt-6 border-t border-white/10 space-y-6">
                            {schedulingMsg && (
                                <Alert className={`${schedulingMsg.type === 'error'
                                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                                    : 'border-green-500/40 bg-green-500/10 text-green-200'
                                    }`}>
                                    {schedulingMsg.type === 'error'
                                        ? <AlertTriangle className="h-4 w-4" />
                                        : <CheckCircle2 className="h-4 w-4" />}
                                    <AlertTitle>{schedulingMsg.type === 'error' ? 'Agenda nao atualizada' : 'Agenda atualizada'}</AlertTitle>
                                    <AlertDescription>{schedulingMsg.text}</AlertDescription>
                                </Alert>
                            )}

                            {!isSchedulingReady && (
                                <Alert className="border-yellow-500/40 bg-yellow-500/10 text-yellow-100">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Configuracao pendente</AlertTitle>
                                    <AlertDescription>
                                        Para receber agendamentos, conecte o Google Calendar e configure seus horarios disponiveis.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <section className="space-y-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                                            <CalendarDays className="h-5 w-5 text-gold-light" />
                                            Google Calendar
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-400">
                                            {googleStatus?.connected
                                                ? `Conta conectada: ${googleStatus.account_email ?? 'email indisponivel'}`
                                                : googleStatus?.status === 'revoked'
                                                    ? 'Acesso revogado, reconecte sua conta.'
                                                    : 'Conecte sua conta para liberar agendamentos automáticos.'}
                                        </p>
                                    </div>

                                    <Badge className={`${googleStatus?.connected
                                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                                        : googleStatus?.status === 'revoked'
                                            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
                                            : 'border-white/10 bg-white/5 text-gray-300'
                                        }`}>
                                        {googleStatus?.connected ? 'Conectado' : googleStatus?.status === 'revoked' ? 'Revogado' : 'Desconectado'}
                                    </Badge>
                                </div>

                                {googleStatus?.connected && (
                                    <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase text-gray-500">Email</p>
                                            <p className="mt-1 break-all text-white">{googleStatus.account_email ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-gray-500">Conectado em</p>
                                            <p className="mt-1 text-white">{formatDateTime(googleStatus.connected_at)}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        onClick={connectGoogle}
                                        disabled={connectingGoogle || loadingScheduling}
                                        className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                                    >
                                        {connectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        {googleStatus?.connected ? 'Reconectar' : 'Conectar Google Calendar'}
                                    </Button>

                                    {googleStatus?.connected && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={disconnectGoogle}
                                            disabled={disconnectingGoogle}
                                            className="border-red-500/40 bg-black/30 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                                        >
                                            {disconnectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                                            Desconectar
                                        </Button>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                                        <Clock className="h-5 w-5 text-gold-light" />
                                        Regras de agenda
                                    </h3>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-white">Timezone</Label>
                                        <Select
                                            value={scheduleConfig.timezone}
                                            onValueChange={(value) => setScheduleConfig((prev) => ({ ...prev, timezone: value }))}
                                            disabled={loadingScheduling}
                                        >
                                            <SelectTrigger className="border-white/10 bg-white text-black">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-950 text-white">
                                                {TIMEZONE_OPTIONS.map((timezone) => (
                                                    <SelectItem key={timezone} value={timezone}>
                                                        {timezone}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-white">Duracao do slot</Label>
                                        <Select
                                            value={String(scheduleConfig.slot_duration_minutes)}
                                            onValueChange={(value) => setScheduleConfig((prev) => ({ ...prev, slot_duration_minutes: Number(value) }))}
                                            disabled={loadingScheduling}
                                        >
                                            <SelectTrigger className="border-white/10 bg-white text-black">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-950 text-white">
                                                {[15, 30, 45, 60].map((minutes) => (
                                                    <SelectItem key={minutes} value={String(minutes)}>
                                                        {minutes} min
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="booking_lead_hours" className="text-white">Antecedencia minima</Label>
                                        <Input
                                            id="booking_lead_hours"
                                            type="number"
                                            min={0}
                                            max={168}
                                            value={scheduleConfig.booking_lead_hours}
                                            onChange={(e) => setScheduleConfig((prev) => ({ ...prev, booking_lead_hours: Number(e.target.value) }))}
                                            className="bg-white text-black"
                                            disabled={loadingScheduling}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="booking_window_business_days" className="text-white">Janela em dias uteis</Label>
                                        <Input
                                            id="booking_window_business_days"
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={scheduleConfig.booking_window_business_days}
                                            onChange={(e) => setScheduleConfig((prev) => ({ ...prev, booking_window_business_days: Number(e.target.value) }))}
                                            className="bg-white text-black"
                                            disabled={loadingScheduling}
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    onClick={saveScheduleConfig}
                                    disabled={savingScheduleConfig || loadingScheduling}
                                    className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                                >
                                    {savingScheduleConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar regras
                                </Button>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                                        <CalendarDays className="h-5 w-5 text-gold-light" />
                                        Horarios disponiveis
                                    </h3>
                                </div>

                                {loadingScheduling ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((item) => (
                                            <Skeleton key={item} className="h-16 w-full rounded-lg bg-white/10" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {WEEKDAYS.map((day) => {
                                            const dayBlocks = availability.filter((block) => block.weekday === day.value);
                                            const draft = availabilityDrafts[day.value] ?? { start: '09:00', end: '12:00' };

                                            return (
                                                <div key={day.value} className="rounded-lg border border-white/10 bg-black/20 p-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-16 font-bold text-white">{day.label}</div>

                                                        <div className="flex-1 space-y-2">
                                                            {dayBlocks.length === 0 ? (
                                                                <p className="text-sm text-gray-500">Sem blocos.</p>
                                                            ) : (
                                                                dayBlocks.map((block) => (
                                                                    <div key={block.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                                                        <span className="text-sm font-medium text-white">
                                                                            {normalizeTime(block.start_time)} - {normalizeTime(block.end_time)}
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            onClick={() => removeAvailabilityBlock(block.id)}
                                                                            className="h-8 w-8 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                                                            aria-label={`Remover bloco de ${day.label}`}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Input
                                                                type="time"
                                                                value={draft.start}
                                                                onChange={(e) => setAvailabilityDrafts((prev) => ({
                                                                    ...prev,
                                                                    [day.value]: { ...(prev[day.value] ?? draft), start: e.target.value },
                                                                }))}
                                                                className="w-32 bg-white text-black"
                                                                aria-label={`Inicio ${day.label}`}
                                                            />
                                                            <Input
                                                                type="time"
                                                                value={draft.end}
                                                                onChange={(e) => setAvailabilityDrafts((prev) => ({
                                                                    ...prev,
                                                                    [day.value]: { ...(prev[day.value] ?? draft), end: e.target.value },
                                                                }))}
                                                                className="w-32 bg-white text-black"
                                                                aria-label={`Fim ${day.label}`}
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                onClick={() => addAvailabilityBlock(day.value)}
                                                                className="h-9 w-9 bg-gold-medium text-black hover:bg-gold-light"
                                                                aria-label={`Adicionar bloco em ${day.label}`}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {accountRole !== 'mentor' && (
                        <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                            <Label htmlFor="calendar_booking_url" className="text-white flex items-center gap-2">
                                <CalendarDays className="w-4 h-4" />
                                URL de agenda (Google Appointment Scheduling)
                            </Label>
                            <p className="text-xs text-gray-500">
                                Cole aqui a URL pública da sua agenda do Google Calendar. Leads indicados por seus alunos vão poder agendar diretamente nessa agenda.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    id="calendar_booking_url"
                                    type="url"
                                    value={calendarBookingUrl}
                                    onChange={(e) => setCalendarBookingUrl(e.target.value)}
                                    className="bg-white text-black flex-1"
                                    placeholder="https://calendar.google.com/calendar/appointments/..."
                                />
                                <Button
                                    type="button"
                                    onClick={handleSaveCalendarUrl}
                                    disabled={savingCalendar}
                                    className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium"
                                >
                                    {savingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                            {calendarMsg && (
                                <p className={`text-sm ${calendarMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                                    {calendarMsg}
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
