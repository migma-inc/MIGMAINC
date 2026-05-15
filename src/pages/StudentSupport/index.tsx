import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ArrowLeft, Send, Loader2, MessageCircle, UserCheck, CheckCircle, Calendar } from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { supabase } from '../../lib/supabase';

const SUPPORT_N8N_WEBHOOK_URL = (
  import.meta.env.VITE_N8N_WEBHOOK_SUPPORT_URL ||
  import.meta.env.VITE_SUPPORT_N8N_WEBHOOK_URL
) as string | undefined;
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
const DEFAULT_SUPPORT_CHAT_SETTINGS: SupportChatSettings = {
  ai_enabled: true,
  human_timeout_minutes: 60,
};

function resolveSupportWorkflowUrl(explicitUrl: string | undefined, workflowPath: string) {
  const explicit = explicitUrl?.trim();
  if (explicit) return explicit;

  const base = (
    import.meta.env.VITE_N8N_WEBHOOK_SUPPORT_BASE_URL ||
    import.meta.env.VITE_SUPPORT_N8N_WEBHOOK_BASE_URL
  ) as string | undefined;
  if (base?.trim()) return `${base.trim().replace(/\/+$/, '')}/${workflowPath}`;

  const chatWebhook = SUPPORT_N8N_WEBHOOK_URL?.trim();
  const match = chatWebhook?.match(/^(.*\/webhook(?:-test)?\/)/);
  return match ? `${match[1]}${workflowPath}` : undefined;
}

const SUPPORT_GET_SLOTS_URL = resolveSupportWorkflowUrl(
  (import.meta.env.VITE_N8N_WEBHOOK_SUPPORT_GET_SLOTS_URL || import.meta.env.VITE_SUPPORT_GET_SLOTS_URL) as string | undefined,
  'support-get-slots',
);
const SUPPORT_BOOK_SLOT_URL = resolveSupportWorkflowUrl(
  (import.meta.env.VITE_N8N_WEBHOOK_SUPPORT_BOOK_SLOT_URL || import.meta.env.VITE_SUPPORT_BOOK_SLOT_URL) as string | undefined,
  'support-book-slot',
);

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'mentor' | 'admin';
  content: string;
  created_at: string;
  is_handoff?: boolean;
  sender_display_name?: string | null;
  sender_role_label?: string | null;
}

interface SavedSupportMessage {
  id: string;
  created_at: string;
}

interface HandoffRecord {
  id: string;
  status: 'pending' | 'in_progress' | 'scheduled' | 'resolved' | 'cancelled';
  triggered_by: 'ai_escalation' | 'ai_review' | 'ai_meeting' | 'student_request' | 'admin_manual' | string;
  meeting_url: string | null;
  meeting_requested_at: string | null;
  meeting_start: string | null;
  meeting_end: string | null;
  calendar_event_id: string | null;
  meeting_calendar_link: string | null;
  resolved_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface SupportChatSettings {
  ai_enabled: boolean;
  human_timeout_minutes: number;
}

interface CountdownState {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  expired: boolean;
}

interface Slot {
  start: string;
  end: string;
}

interface SlotGroup {
  dateLabel: string;
  dateKey: string;
  slots: Slot[];
}

function getDateLocale(language: string) {
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es-ES';
  if (language.startsWith('fr')) return 'fr-FR';
  return 'en-US';
}

function createWelcomeMessage(t: TFunction): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: String(t(
      'student_support.welcome_message',
      'Hi! I am from the Migma Team 👋\n\nI am here to answer your questions about the process, documents, universities, F-1 visa, and anything else. How can I help?',
    )),
    created_at: new Date().toISOString(),
  };
}

function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDateLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function formatWeekday(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(iso));
}

function formatMonthDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
}

function groupSlotsByDate(slots: Slot[], locale: string): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  const sortedSlots = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const slot of sortedSlots) {
    const d = new Date(slot.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) {
      map.set(key, { dateLabel: formatDateLabel(slot.start, locale), dateKey: key, slots: [] });
    }
    map.get(key)!.slots.push(slot);
  }

  return Array.from(map.values());
}

function extractSupportMeetingStart(record: Pick<HandoffRecord, 'meeting_start' | 'resolved_note' | 'meeting_requested_at'> | null) {
  if (!record) return null;
  if (record.meeting_start) return record.meeting_start;
  const startMatch = record.resolved_note?.match(/^Start:\s*(.+)$/im);
  return startMatch?.[1]?.trim() || record.meeting_requested_at || null;
}

function getCountdown(targetIso: string | null): CountdownState | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, expired: false };
}

function formatCountdown(countdown: CountdownState | null, t: TFunction) {
  if (!countdown) return t('student_support.countdown.waiting_confirmed', 'Waiting for confirmed time');
  if (countdown.expired) return t('student_support.countdown.available_now', 'Available now');
  const pad = (n: number) => String(n).padStart(2, '0');
  if (countdown.days > 0) {
    return `${countdown.days}d ${pad(countdown.hours)}h ${pad(countdown.mins)}m ${pad(countdown.secs)}s`;
  }
  return `${pad(countdown.hours)}:${pad(countdown.mins)}:${pad(countdown.secs)}`;
}

function getSlotsErrorMessage(error: string | undefined, t: TFunction) {
  switch (error) {
    case 'mentor_not_connected':
    case 'mentor_token_revoked':
      return t('student_support.errors.mentor_calendar_not_connected', 'Your mentor still needs to connect their calendar. Our team will follow up on your case.');
    case 'student_without_mentor':
    case 'mentor_not_found_or_inactive':
      return t('student_support.errors.mentor_not_found', 'We could not find an active mentor for your profile. Our team will follow up on your case.');
    case 'handoff_closed':
      return t('student_support.errors.handoff_closed', 'This support request is already closed.');
    default:
      return t('student_support.errors.load_slots', 'We could not load the schedule right now. Our team will follow up on your case.');
  }
}

function isSlotUnavailableError(error: string | undefined) {
  return error === 'slot_taken' || error === 'slot_unavailable';
}

function isActiveHandoff(status: HandoffRecord['status']) {
  return status === 'pending' || status === 'in_progress' || status === 'scheduled';
}

function isMeetingHandoff(record: Pick<HandoffRecord, 'triggered_by' | 'meeting_url' | 'meeting_start'> | null) {
  if (!record) return false;
  return record.triggered_by === 'ai_meeting'
    || record.triggered_by === 'student_request'
    || Boolean(record.meeting_url)
    || Boolean(record.meeting_start);
}

function isHumanTeamRole(role: Message['role']) {
  return role === 'mentor' || role === 'admin';
}

function isSupportChatSettingsMissingError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? '';
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('support_chat_runtime_settings');
}

function normalizeSupportChatSettings(profileRow: unknown, globalRow?: unknown): SupportChatSettings {
  const profile = profileRow && typeof profileRow === 'object' ? profileRow as Record<string, unknown> : null;
  const global = globalRow && typeof globalRow === 'object' ? globalRow as Record<string, unknown> : null;
  const row = profile ?? global;
  if (!row) return DEFAULT_SUPPORT_CHAT_SETTINGS;
  const record = row as Record<string, unknown>;
  const rawTimeout = typeof record.human_timeout_minutes === 'number'
    ? record.human_timeout_minutes
    : Number(record.human_timeout_minutes);
  const humanTimeoutMinutes = Number.isFinite(rawTimeout)
    ? Math.min(1440, Math.max(1, Math.round(rawTimeout)))
    : DEFAULT_SUPPORT_CHAT_SETTINGS.human_timeout_minutes;
  return {
    ai_enabled: true,
    human_timeout_minutes: humanTimeoutMinutes,
  };
}

function SupportSlotPicker({
  groups,
  selected,
  onSelect,
  locale,
}: {
  groups: SlotGroup[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const selectedDateKey = selected
    ? groups.find((group) => group.slots.some((slot) => slot.start === selected.start))?.dateKey
    : null;
  const [manualDateKey, setManualDateKey] = useState('');
  const activeDateKey = groups.some((group) => group.dateKey === manualDateKey)
    ? manualDateKey
    : selectedDateKey || groups[0]?.dateKey;
  const activeGroup = groups.find((group) => group.dateKey === activeDateKey) ?? groups[0];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {groups.map((group) => {
          const firstSlot = group.slots[0];
          const active = group.dateKey === activeGroup.dateKey;
          return (
            <button
              key={group.dateKey}
              type="button"
              onClick={() => setManualDateKey(group.dateKey)}
              className={`rounded-lg border px-3 py-2 text-left transition-all ${
                active
                  ? 'border-[#CE9F48] bg-[#CE9F48] text-black'
                  : 'border-blue-600/20 bg-white/50 text-[#1f1a14] hover:border-[#CE9F48]/60 dark:border-blue-500/20 dark:bg-white/5 dark:text-white'
              }`}
            >
              <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">
                {firstSlot ? formatWeekday(firstSlot.start, locale) : group.dateLabel}
              </span>
              <span className="block text-sm font-black">
                {firstSlot ? formatMonthDay(firstSlot.start, locale) : group.dateLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-blue-600/20 bg-white/60 p-3 dark:border-blue-500/20 dark:bg-black/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
            {activeGroup.dateLabel}
          </p>
          <p className="text-xs text-blue-700/60 dark:text-blue-300/60">
            {activeGroup.slots.length} {activeGroup.slots.length === 1 ? t('student_support.handoff.slot_one', 'time') : t('student_support.handoff.slot_other', 'times')}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeGroup.slots.map((slot) => {
            const active = selected?.start === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => onSelect(slot)}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-bold transition-all ${
                  active
                    ? 'border-[#CE9F48] bg-[#CE9F48] text-black'
                    : 'border-blue-600/20 bg-white text-blue-900 hover:border-[#CE9F48]/70 dark:border-blue-500/20 dark:bg-white/5 dark:text-blue-100'
                }`}
              >
                {formatTime(slot.start, locale)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StudentSupportPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

export const StudentSupportPanel: React.FC<StudentSupportPanelProps> = ({ embedded = false, onBack }) => {
  const { t, i18n } = useTranslation();
  const { user, userProfile } = useStudentAuth();
  const locale = getDateLocale(i18n.language);
  const welcomeMessage = useMemo(() => createWelcomeMessage(t), [t]);

  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [handoffCreatedAt, setHandoffCreatedAt] = useState<string | null>(null);
  const [handoffMeetingUrl, setHandoffMeetingUrl] = useState<string | null>(null);
  const [handoffMeetingStart, setHandoffMeetingStart] = useState<string | null>(null);
  const [handoffRequiresMeeting, setHandoffRequiresMeeting] = useState(false);
  const [meetingCountdown, setMeetingCountdown] = useState<CountdownState | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingSlot, setBookingSlot] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [resolvedHandoff, setResolvedHandoff] = useState<HandoffRecord | null>(null);
  const [supportChatSettings, setSupportChatSettings] = useState<SupportChatSettings>(DEFAULT_SUPPORT_CHAT_SETTINGS);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slotGroups = groupSlotsByDate(slots, locale);
  const latestHumanMessage = useMemo(
    () => [...messages].reverse().find((message) => isHumanTeamRole(message.role)) ?? null,
    [messages],
  );
  const latestHumanMessageAt = latestHumanMessage ? new Date(latestHumanMessage.created_at).getTime() : null;
  const humanTimeoutMs = supportChatSettings.human_timeout_minutes * 60 * 1000;
  const humanTimeoutActive = latestHumanMessageAt !== null
    && !Number.isNaN(latestHumanMessageAt)
    && nowMs - latestHumanMessageAt < humanTimeoutMs;
  const humanSupportActive = handedOff || humanTimeoutActive;
  const composerLocked = handedOff && handoffRequiresMeeting && Boolean(handoffMeetingUrl) && !meetingCountdown?.expired;
  const supportStatusLabel = handedOff
    ? t('student_support.status.waiting_agent', 'Waiting for support')
    : humanSupportActive
      ? t('student_support.status.support_active', 'Support active')
      : t('student_support.status.online_now', 'Online now');
  const supportStatusClass = handedOff
    ? 'text-blue-600 dark:text-blue-400'
    : humanSupportActive
      ? 'text-[#9a6a16] dark:text-[#CE9F48]'
      : 'text-emerald-600 dark:text-emerald-400';
  const supportIconClass = handedOff
    ? 'bg-blue-500/15 border-blue-500/30'
    : humanSupportActive
      ? 'bg-[#CE9F48]/15 border-[#CE9F48]/30'
      : 'bg-emerald-500/15 border-emerald-500/30';

  useEffect(() => {
    setMessages((prev) => prev.map((message) => (message.id === 'welcome' ? welcomeMessage : message)));
  }, [welcomeMessage]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const loadSupportState = useCallback(async () => {
    if (!userProfile?.id) return;

    const [
      { data: chatData, error: chatError },
      { data: handoffData, error: handoffError },
      { data: profileSettingsData, error: profileSettingsError },
      { data: globalSettingsData, error: globalSettingsError },
    ] = await Promise.all([
      supabase
        .from('support_chat_messages')
        .select('id, role, content, created_at, sender_display_name, sender_role_label')
        .eq('profile_id', userProfile.id)
        .order('created_at', { ascending: true })
        .limit(300),
      supabase
        .from('support_handoffs')
        .select('id, status, triggered_by, meeting_url, meeting_requested_at, meeting_start, meeting_end, calendar_event_id, meeting_calendar_link, resolved_note, resolved_at, created_at')
        .eq('profile_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('support_chat_profile_ai_controls')
        .select('ai_enabled, human_timeout_minutes, updated_at')
        .eq('profile_id', userProfile.id)
        .maybeSingle(),
      supabase
        .from('support_chat_runtime_settings')
        .select('ai_enabled, human_timeout_minutes')
        .eq('id', 'default')
        .maybeSingle(),
    ]);

    if (chatError) console.error('[StudentSupport] chat load error', chatError);
    if (handoffError) console.error('[StudentSupport] handoff load error', handoffError);
    if (profileSettingsError || globalSettingsError) {
      if (profileSettingsError && !isSupportChatSettingsMissingError(profileSettingsError)) {
        console.error('[StudentSupport] profile support chat settings load error', profileSettingsError);
      }
      if (globalSettingsError && !isSupportChatSettingsMissingError(globalSettingsError)) {
        console.error('[StudentSupport] support chat settings load error', globalSettingsError);
      }
      setSupportChatSettings(DEFAULT_SUPPORT_CHAT_SETTINGS);
    } else {
      setSupportChatSettings(normalizeSupportChatSettings(profileSettingsData, globalSettingsData));
    }

    setMessages(chatData && chatData.length > 0 ? [welcomeMessage, ...(chatData as Message[])] : [welcomeMessage]);

    const handoffs = (handoffData ?? []) as HandoffRecord[];
    const active = handoffs.find((h) => isActiveHandoff(h.status));
    const resolved = handoffs.find((h) => h.status === 'resolved');

    if (active) {
      setHandedOff(true);
      setHandoffId(active.id);
      setHandoffCreatedAt(active.created_at);
      setHandoffMeetingUrl(active.meeting_url);
      setHandoffMeetingStart(extractSupportMeetingStart(active));
      setHandoffRequiresMeeting(isMeetingHandoff(active));
      setResolvedHandoff(null);
      return;
    }

    setHandedOff(false);
    setHandoffId(null);
    setHandoffCreatedAt(null);
    setHandoffMeetingUrl(null);
    setHandoffMeetingStart(null);
    setHandoffRequiresMeeting(false);
    setSlots([]);
    setSelectedSlot(null);
    setBookingError(null);

    if (resolved) {
      const resolvedAt = resolved.resolved_at ? new Date(resolved.resolved_at).getTime() : 0;
      const hasPostResolutionMessage = (chatData ?? []).some(
        (m: { role: string; created_at: string }) =>
          m.role === 'user' && new Date(m.created_at).getTime() > resolvedAt,
      );
      setResolvedHandoff(hasPostResolutionMessage ? null : resolved);
    } else {
      setResolvedHandoff(null);
    }
  }, [userProfile?.id, welcomeMessage]);

  useEffect(() => {
    if (!userProfile?.id) return;

    (async () => {
      await loadSupportState();
      setHistoryLoaded(true);
    })();
  }, [loadSupportState, userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id) return;

    const channel = supabase
      .channel(`student-support-${userProfile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_handoffs', filter: `profile_id=eq.${userProfile.id}` },
        () => {
          void loadSupportState();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_chat_messages', filter: `profile_id=eq.${userProfile.id}` },
        () => {
          void loadSupportState();
        },
      )
      .subscribe();

    const refreshVisibleState = () => {
      if (document.visibilityState === 'visible') void loadSupportState();
    };
    const interval = window.setInterval(refreshVisibleState, 15000);
    window.addEventListener('focus', refreshVisibleState);
    document.addEventListener('visibilitychange', refreshVisibleState);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleState);
      document.removeEventListener('visibilitychange', refreshVisibleState);
      void supabase.removeChannel(channel);
    };
  }, [loadSupportState, userProfile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!handoffMeetingUrl || !handoffMeetingStart) {
      setMeetingCountdown(null);
      return;
    }

    const update = () => setMeetingCountdown(getCountdown(handoffMeetingStart));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [handoffMeetingStart, handoffMeetingUrl]);

  const saveMessage = useCallback(
    async (role: 'user' | 'assistant' | 'system', content: string): Promise<SavedSupportMessage | null> => {
      if (!userProfile?.id) return null;
      const { data, error } = await supabase
        .from('support_chat_messages')
        .insert({ profile_id: userProfile.id, role, content })
        .select('id, created_at')
        .single();

      if (error) {
        console.error('[StudentSupport] failed to save support chat message', error);
        return null;
      }

      return data as SavedSupportMessage;
    },
    [userProfile?.id],
  );

  const notifyMentorOfUnreadSupportMessage = useCallback(
    async (messageId: string | null) => {
      if (!userProfile?.id || !messageId) return;

      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) return;

        const notifyUrl = FUNCTIONS_URL
          ? `${FUNCTIONS_URL}/support-mentor-message-notify`
          : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-mentor-message-notify`;

        const response = await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profile_id: userProfile.id,
            message_id: messageId,
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          console.warn('[StudentSupport] mentor unread notification failed', response.status, detail);
        }
      } catch (err) {
        console.warn('[StudentSupport] mentor unread notification error', err);
      }
    },
    [userProfile?.id],
  );

  const fetchSupportSlots = useCallback(async (targetHandoffId: string) => {
    if (!SUPPORT_GET_SLOTS_URL) {
      setSlotsError(t('student_support.errors.schedule_not_configured', 'Support schedule is not configured.'));
      return;
    }

    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const url = new URL(SUPPORT_GET_SLOTS_URL, window.location.origin);
      url.searchParams.set('handoff_id', targetHandoffId);
      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = data?.error ?? `HTTP ${res.status}`;
        setSlots([]);
        setSlotsError(getSlotsErrorMessage(error, t));
        return;
      }
      if (data?.ok === false) {
        setSlots([]);
        setSlotsError(getSlotsErrorMessage(data?.error, t));
        return;
      }

      setSlots(Array.isArray(data.slots) ? data.slots : []);
      setMentorName(data.mentor_name ?? null);
    } catch (err) {
      console.error('[StudentSupport] support slots error', err);
      setSlots([]);
      setSlotsError(t('student_support.errors.load_slots', 'We could not load the schedule right now. Our team will follow up on your case.'));
    } finally {
      setSlotsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!handoffId || !handoffRequiresMeeting || handoffMeetingUrl) return;
    void fetchSupportSlots(handoffId);
  }, [fetchSupportSlots, handoffId, handoffMeetingUrl, handoffRequiresMeeting]);

  const createHandoff = useCallback(
    async (reason: string, lastAiMessage: string, handoffType: 'review' | 'meeting') => {
      if (!userProfile?.id || handedOff) return;
      const requiresMeeting = handoffType === 'meeting';

      const systemMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: requiresMeeting
          ? t(
            'student_support.handoff.system_message',
            'Support requested. The Migma Team will follow up on your case. Choose a time in the schedule below to speak with your mentor.',
          )
          : t(
            'student_support.handoff.review_system_message',
            'Support requested. The Migma Team will review your case and follow up here in the chat.',
          ),
        created_at: new Date().toISOString(),
        is_handoff: true,
      };
      setMessages((prev) => [...prev, systemMsg]);
      await saveMessage('system', systemMsg.content);

      const { data, error } = await supabase
        .from('support_handoffs')
        .insert({
          profile_id: userProfile.id,
          triggered_by: requiresMeeting ? 'ai_meeting' : 'ai_review',
          reason,
          last_ai_message: lastAiMessage,
          status: 'pending',
        })
        .select('id, created_at, meeting_url')
        .single();

      if (error || !data?.id) {
        console.error('[StudentSupport] handoff insert failed', error);
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: requiresMeeting
            ? t('student_support.errors.handoff_create_failed', 'We could not open the support schedule right now. Please try again in a few seconds.')
            : t('student_support.errors.review_handoff_create_failed', 'We could not request a team review right now. Please try again in a few seconds.'),
          created_at: new Date().toISOString(),
        }]);
        return;
      }

      setHandedOff(true);
      setHandoffId(data.id);
      setHandoffCreatedAt(data.created_at ?? new Date().toISOString());
      setHandoffMeetingUrl(data.meeting_url ?? null);
      setHandoffRequiresMeeting(requiresMeeting);
      if (requiresMeeting) void fetchSupportSlots(data.id);

      try {
        const notifyUrl = FUNCTIONS_URL
          ? `${FUNCTIONS_URL}/migma-notify`
          : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migma-notify`;
        await fetch(notifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            trigger: 'admin_support_handoff',
            data: { client_name: userProfile.full_name ?? t('student_support.student_fallback', 'Student'), client_id: userProfile.id, reason, last_message: lastAiMessage },
          }),
        });
      } catch { /* best-effort */ }
    },
    [userProfile, handedOff, saveMessage, fetchSupportSlots, t],
  );

  const bookSupportSlot = useCallback(async () => {
    if (!handoffId || !selectedSlot || bookingSlot) return;
    if (!SUPPORT_BOOK_SLOT_URL) {
      setBookingError(t('student_support.errors.schedule_not_configured', 'Support schedule is not configured.'));
      return;
    }

    setBookingSlot(true);
    setBookingError(null);
    try {
      const res = await fetch(SUPPORT_BOOK_SLOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handoff_id: handoffId,
          slot_start: selectedSlot.start,
          slot_end: selectedSlot.end,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (isSlotUnavailableError(data?.error)) {
          setBookingError(t('student_support.errors.slot_taken', 'This time was just booked. Choose another time.'));
          setSelectedSlot(null);
          await fetchSupportSlots(handoffId);
          return;
        }
        throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
      }
      if (data?.ok === false) {
        if (isSlotUnavailableError(data?.error)) {
          setBookingError(t('student_support.errors.slot_taken', 'This time was just booked. Choose another time.'));
          setSelectedSlot(null);
          await fetchSupportSlots(handoffId);
          return;
        }
        throw new Error(data?.message ?? data?.error ?? 'booking_failed');
      }

      setHandoffMeetingUrl(data.meet_url ?? null);
      setHandoffMeetingStart(data.slot_start ?? selectedSlot.start);
      setHandoffCreatedAt((current) => current ?? new Date().toISOString());
      if (data.mentor_name) setMentorName(data.mentor_name);
      setSlots([]);
    } catch (err) {
      console.error('[StudentSupport] support booking error', err);
      setBookingError(t('student_support.errors.book_slot', 'We could not confirm this time. Please try again.'));
    } finally {
      setBookingSlot(false);
    }
  }, [bookingSlot, fetchSupportSlots, handoffId, selectedSlot, t]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || composerLocked) return;

    if (resolvedHandoff) setResolvedHandoff(null);

    setInput('');
    setSending(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    const savedUserMessage = await saveMessage('user', text);
    void notifyMentorOfUnreadSupportMessage(savedUserMessage?.id ?? null);

    if (!SUPPORT_N8N_WEBHOOK_URL) {
      console.warn('[StudentSupport] Support automation webhook is not configured; message saved for team follow-up.');
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await fetch(SUPPORT_N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'student_support_message',
          payloadVersion: 2,
          message: text,
          role: 'user',
          currentMessage: {
            role: 'user',
            content: text,
            created_at: userMsg.created_at,
            sender_display_name: userProfile?.full_name ?? user?.email ?? 'Student',
            sender_role_label: 'Student',
          },
          sessionId: userProfile?.id ?? user?.id,
          profileId: userProfile?.id ?? user?.id,
          studentName: userProfile?.full_name ?? '',
          studentEmail: user?.email ?? '',
          handoff: {
            active: handedOff,
            id: handoffId,
            meetingUrl: handoffMeetingUrl,
            meetingStart: handoffMeetingStart,
            chatAvailable: !handedOff || Boolean(meetingCountdown?.expired),
            resolvedAt: resolvedHandoff?.resolved_at ?? null,
          },
          history: (() => {
            const cutoff = resolvedHandoff?.resolved_at ?? null;
            return messages
              .filter((m) => m.id !== 'welcome')
              .filter((m) => !cutoff || new Date(m.created_at) > new Date(cutoff))
              .slice(-20)
              .map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                created_at: m.created_at,
                sender_display_name: m.sender_display_name ?? null,
                sender_role_label: m.sender_role_label ?? null,
              }));
          })(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const reply: string = String(json.response ?? json.message ?? json.output ?? json.text ?? '').trim();
      const escalate: boolean = json.escalate === true;
      const escalateReason: string = json.reason ?? json.escalate_reason ?? '';
      const handoffType: 'review' | 'meeting' = json.handoff_type === 'meeting' ? 'meeting' : 'review';

      if (!reply) {
        setSending(false);
        inputRef.current?.focus();
        return;
      }

      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: reply, created_at: new Date().toISOString(), is_handoff: escalate };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage('assistant', reply);

      if (escalate) await createHandoff(escalateReason, reply, handoffType);
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: t('student_support.errors.technical_issue', 'Sorry, I had a technical issue just now. Please try again in a few seconds.'),
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [
    input,
    sending,
    composerLocked,
    handedOff,
    meetingCountdown?.expired,
    resolvedHandoff,
    messages,
    userProfile,
    user,
    handoffId,
    handoffMeetingUrl,
    handoffMeetingStart,
    saveMessage,
    notifyMentorOfUnreadSupportMessage,
    createHandoff,
    t,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user || !historyLoaded) {
    return (
      <div className={`${embedded ? 'min-h-[520px]' : 'min-h-screen'} bg-[#f7f4ee] dark:bg-[#0a0a0a] flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 text-[#9a6a16] dark:text-[#CE9F48] animate-spin" />
      </div>
    );
  }

  return (
    <div data-tour="student-support-page" className={`${embedded ? 'h-[calc(100vh-132px)] min-h-[620px] rounded-lg border border-[#e3d5bd] dark:border-white/10 overflow-hidden' : 'min-h-screen'} bg-[#f7f4ee] dark:bg-[#0a0a0a] flex flex-col text-[#1f1a14] dark:text-white`}>
      <header data-tour="student-support-header" className="shrink-0 bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur border-b border-[#e3d5bd] dark:border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {!embedded && onBack && (
            <button onClick={onBack} className="p-2 rounded-lg text-[#6f6251] dark:text-white/50 hover:bg-[#f3ead9] dark:hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div data-tour="student-support-status" className="flex items-center gap-3 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${supportIconClass}`}>
              {handedOff ? (
                <UserCheck className="w-5 h-5 text-blue-400" />
              ) : (
                <MessageCircle className={`w-5 h-5 ${humanSupportActive ? 'text-[#9a6a16] dark:text-[#CE9F48]' : 'text-emerald-500'}`} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1f1a14] dark:text-white leading-none">{t('student_support.team_name', 'Migma Team')}</p>
              <p className={`text-xs mt-0.5 ${supportStatusClass}`}>
                {supportStatusLabel}
              </p>
            </div>
          </div>
          <img src="/migma-logo.png" alt="Migma" className="h-6 opacity-70" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      </header>

      <main data-tour="student-support-chat" className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} locale={locale} />)}

          {sending && <TypingIndicator />}

          {handedOff && handoffCreatedAt && (
            <div data-tour="student-support-handoff" className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              <UserCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {handoffRequiresMeeting
                    ? handoffMeetingUrl
                      ? t('student_support.handoff.meeting_scheduled', 'Mentor meeting scheduled')
                      : t('student_support.handoff.schedule_with_mentor', 'Schedule with your mentor')
                    : t('student_support.handoff.review_requested', 'MIGMA Team review requested')}
                </p>
                <p className="text-blue-600/60 dark:text-blue-300/60 text-xs mt-0.5">
                  {t('student_support.handoff.requested_at', 'Requested at')} {new Date(handoffCreatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} · {handoffRequiresMeeting
                    ? handoffMeetingUrl
                      ? t('student_support.handoff.chat_release_notice', 'Chat will be available at the meeting time.')
                      : t('student_support.handoff.choose_slot_notice', 'Choose an available time to speak with the Migma Team.')
                    : t('student_support.handoff.review_notice', 'The team will review this and follow up here.')}
                </p>

                {!handoffRequiresMeeting ? null : handoffMeetingUrl ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-blue-600/20 bg-white/60 px-4 py-3 dark:border-blue-500/20 dark:bg-black/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700/70 dark:text-blue-300/70">
                        {t('student_support.handoff.chat_available_in', 'Chat available in')}
                      </p>
                      <p className="mt-1 font-mono text-2xl font-black text-blue-800 dark:text-blue-100">
                        {formatCountdown(meetingCountdown, t)}
                      </p>
                      {handoffMeetingStart && (
                        <p className="mt-1 text-xs text-blue-700/60 dark:text-blue-300/60">
                          {t('student_support.handoff.meeting', 'Meeting')}: {new Date(handoffMeetingStart).toLocaleString(locale, {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <a
                      href={handoffMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-600/30 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {t('student_support.handoff.join_google_meet', 'Join Google Meet')}
                    </a>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {slotsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-blue-700/70 dark:text-blue-300/70">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t('student_support.handoff.loading_slots', 'Loading available times')}{mentorName ? ` ${t('student_support.handoff.with_mentor', 'with')} ${mentorName}` : ''}...
                      </div>
                    ) : slotsError ? (
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70">{slotsError}</p>
                    ) : slotGroups.length > 0 ? (
                      <div data-tour="student-support-schedule" className="space-y-3">
                        <SupportSlotPicker groups={slotGroups} selected={selectedSlot} onSelect={setSelectedSlot} locale={locale} />
                        {bookingError && <p className="text-xs font-medium text-red-600 dark:text-red-300">{bookingError}</p>}
                        <button
                          type="button"
                          onClick={bookSupportSlot}
                          disabled={!selectedSlot || bookingSlot}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#CE9F48] px-4 py-2 text-xs font-black text-black transition-colors hover:bg-[#b8892f] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {bookingSlot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                          {selectedSlot ? `${t('student_support.handoff.confirm', 'Confirm')} ${formatTime(selectedSlot.start, locale)}` : t('student_support.handoff.choose_time', 'Choose a time')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70">
                        {t('student_support.handoff.no_slots', 'We could not find available times right now. Our team will follow up on your case.')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {resolvedHandoff && !handedOff && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('student_support.resolved.title', 'Support closed')}</p>
                {resolvedHandoff.resolved_note && (
                  <p className="text-emerald-600/80 dark:text-emerald-300/80 text-xs mt-1">"{resolvedHandoff.resolved_note}"</p>
                )}
                <p className="text-emerald-600/50 dark:text-emerald-300/50 text-xs mt-1">{t('student_support.resolved.continue_message', 'You can keep sending messages normally.')}</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer data-tour="student-support-composer" className="sticky bottom-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur border-t border-[#e3d5bd] dark:border-white/5 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {composerLocked ? (
            <div className="flex flex-col items-center gap-3 text-center text-[#8a7b66] dark:text-white/40 text-sm py-2">
              <span>
                {handoffMeetingUrl
                  ? `${t('student_support.footer.chat_locked_until_meeting', 'Chat locked until the meeting')} · ${formatCountdown(meetingCountdown, t)}`
                  : t('student_support.footer.transferred_choose_slot', 'Conversation transferred. Choose a time in the schedule above.')}
              </span>
              {handoffMeetingUrl && (
                <a
                  href={handoffMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600/30 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {t('student_support.handoff.join_google_meet', 'Join Google Meet')}
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-3 bg-[#f3ead9] dark:bg-white/5 border border-[#e3d5bd] dark:border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#CE9F48]/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('student_support.composer.placeholder', 'Write your question...')}
                  rows={1}
                  className="flex-1 bg-transparent text-[#1f1a14] dark:text-white placeholder-[#8a7b66] dark:placeholder-white/30 text-sm resize-none outline-none max-h-32 leading-relaxed"
                  style={{ height: 'auto' }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px`; }}
                  disabled={sending}
                />
                <button
                  data-tour="student-support-send"
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#CE9F48] hover:bg-[#b8892f] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 text-black animate-spin" /> : <Send className="w-4 h-4 text-black" />}
                </button>
              </div>
              <p className="text-center text-[#8a7b66] dark:text-white/20 text-xs mt-2">{t('student_support.composer.hint', 'Enter to send · Shift+Enter for a new line')}</p>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

const StudentSupport: React.FC = () => {
  const { user, loading } = useStudentAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/student/login');
  }, [loading, user, navigate]);

  return <StudentSupportPanel onBack={() => navigate(-1)} />;
};

const MessageBubble: React.FC<{ message: Message; locale: string }> = ({ message, locale }) => {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 bg-[#f3ead9] dark:bg-white/5 border border-[#e3d5bd] dark:border-white/10 rounded-full px-4 py-1.5 text-xs text-[#8a7b66] dark:text-white/40">
          {message.is_handoff && <UserCheck className="w-3 h-3 text-blue-400 flex-shrink-0" />}
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const isHumanTeam = message.role === 'mentor' || message.role === 'admin';
  const displayName = message.sender_display_name || (message.role === 'mentor' ? 'Migma Mentor' : 'Migma Team');
  const roleLabel = message.sender_role_label || (message.role === 'mentor' ? 'Mentor' : 'Migma Team');

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border ${message.is_handoff || isHumanTeam ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[#CE9F48]/15 border-[#CE9F48]/30'}`}>
          {message.is_handoff || isHumanTeam ? <UserCheck className="w-4 h-4 text-blue-400" /> : <MessageCircle className="w-4 h-4 text-[#9a6a16] dark:text-[#CE9F48]" />}
        </div>
      )}
      <div data-tour={!isUser ? 'student-support-message' : undefined} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-[#CE9F48] text-black rounded-tr-sm font-medium' : 'bg-[#f3ead9] dark:bg-white/5 border border-[#e3d5bd] dark:border-white/10 text-[#1f1a14] dark:text-white/90 rounded-tl-sm'}`}>
        {isHumanTeam && (
          <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-300">
            {displayName}
            <span className="ml-1 font-semibold normal-case tracking-normal text-[#8a7b66] dark:text-white/35">
              {roleLabel}
            </span>
          </div>
        )}
        {message.content}
        <div className={`text-xs mt-1.5 ${isUser ? 'text-black/50' : 'text-[#8a7b66] dark:text-white/25'}`}>
          {new Date(message.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#CE9F48]/15 border border-[#CE9F48]/30 flex items-center justify-center">
      <MessageCircle className="w-4 h-4 text-[#9a6a16] dark:text-[#CE9F48]" />
    </div>
    <div className="bg-[#f3ead9] dark:bg-white/5 border border-[#e3d5bd] dark:border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#CE9F48]/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  </div>
);

export default StudentSupport;
