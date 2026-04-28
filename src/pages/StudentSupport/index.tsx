import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, MessageCircle, UserCheck, CheckCircle, Calendar } from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { supabase } from '../../lib/supabase';

const N8N_WEBHOOK_URL = (import.meta.env.VITE_SUPPORT_N8N_WEBHOOK_URL || import.meta.env.VITE_N8N_WEBHOOK_URL) as string | undefined;
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
const SUPPORT_GET_SLOTS_URL = import.meta.env.VITE_SUPPORT_GET_SLOTS_URL as string | undefined;
const SUPPORT_BOOK_SLOT_URL = import.meta.env.VITE_SUPPORT_BOOK_SLOT_URL as string | undefined;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  is_handoff?: boolean;
}

interface HandoffRecord {
  id: string;
  status: 'pending' | 'in_progress' | 'resolved';
  meeting_url: string | null;
  meeting_requested_at: string | null;
  resolved_note: string | null;
  resolved_at: string | null;
  created_at: string;
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

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou da Equipe Migma 👋\n\nEstou aqui para tirar suas dúvidas sobre o processo, documentos, universidades, visto F-1 e tudo mais. Como posso ajudar?',
  created_at: new Date().toISOString(),
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(iso));
}

function formatMonthDay(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

function groupSlotsByDate(slots: Slot[]): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  const sortedSlots = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const slot of sortedSlots) {
    const d = new Date(slot.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) {
      map.set(key, { dateLabel: formatDateLabel(slot.start), dateKey: key, slots: [] });
    }
    map.get(key)!.slots.push(slot);
  }

  return Array.from(map.values());
}

function extractSupportMeetingStart(record: Pick<HandoffRecord, 'resolved_note' | 'meeting_requested_at'> | null) {
  if (!record) return null;
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

function formatCountdown(countdown: CountdownState | null) {
  if (!countdown) return 'Aguardando horário confirmado';
  if (countdown.expired) return 'Disponível agora';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (countdown.days > 0) {
    return `${countdown.days}d ${pad(countdown.hours)}h ${pad(countdown.mins)}m ${pad(countdown.secs)}s`;
  }
  return `${pad(countdown.hours)}:${pad(countdown.mins)}:${pad(countdown.secs)}`;
}

function SupportSlotPicker({
  groups,
  selected,
  onSelect,
}: {
  groups: SlotGroup[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
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
                {firstSlot ? formatWeekday(firstSlot.start) : group.dateLabel}
              </span>
              <span className="block text-sm font-black">
                {firstSlot ? formatMonthDay(firstSlot.start) : group.dateLabel}
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
          <p className="text-xs text-blue-700/60 dark:text-blue-300/60">{activeGroup.slots.length} horários</p>
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
                {formatTime(slot.start)}
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
  const { user, userProfile } = useStudentAuth();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [handoffCreatedAt, setHandoffCreatedAt] = useState<string | null>(null);
  const [handoffMeetingUrl, setHandoffMeetingUrl] = useState<string | null>(null);
  const [handoffMeetingStart, setHandoffMeetingStart] = useState<string | null>(null);
  const [meetingCountdown, setMeetingCountdown] = useState<CountdownState | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingSlot, setBookingSlot] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [resolvedHandoff, setResolvedHandoff] = useState<HandoffRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slotGroups = groupSlotsByDate(slots);

  useEffect(() => {
    if (!userProfile?.id) return;

    (async () => {
      const [{ data: chatData }, { data: handoffData }] = await Promise.all([
        supabase
          .from('support_chat_messages')
          .select('id, role, content, created_at')
          .eq('profile_id', userProfile.id)
          .order('created_at', { ascending: true })
          .limit(300),
        supabase
          .from('support_handoffs')
          .select('id, status, meeting_url, meeting_requested_at, resolved_note, resolved_at, created_at')
          .eq('profile_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (chatData && chatData.length > 0) {
        setMessages([WELCOME_MESSAGE, ...(chatData as Message[])]);
      }

      if (handoffData && handoffData.length > 0) {
        const active = (handoffData as HandoffRecord[]).find(
          (h) => h.status === 'pending' || h.status === 'in_progress',
        );
        const resolved = (handoffData as HandoffRecord[]).find((h) => h.status === 'resolved');

        if (active) {
          setHandedOff(true);
          setHandoffId(active.id);
          setHandoffCreatedAt(active.created_at);
          setHandoffMeetingUrl(active.meeting_url);
          setHandoffMeetingStart(extractSupportMeetingStart(active));
        } else if (resolved) {
          const resolvedAt = resolved.resolved_at ? new Date(resolved.resolved_at).getTime() : 0;
          const hasPostResolutionMessage = (chatData ?? []).some(
            (m: { role: string; created_at: string }) =>
              m.role === 'user' && new Date(m.created_at).getTime() > resolvedAt,
          );
          if (!hasPostResolutionMessage) {
            setResolvedHandoff(resolved);
          }
        }
      }

      setHistoryLoaded(true);
    })();
  }, [userProfile?.id]);

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
    async (role: 'user' | 'assistant' | 'system', content: string) => {
      if (!userProfile?.id) return;
      await supabase.from('support_chat_messages').insert({ profile_id: userProfile.id, role, content });
    },
    [userProfile?.id],
  );

  const fetchSupportSlots = useCallback(async (targetHandoffId: string) => {
    if (!SUPPORT_GET_SLOTS_URL) {
      setSlotsError('Agenda de suporte não configurada.');
      return;
    }

    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const url = new URL(SUPPORT_GET_SLOTS_URL);
      url.searchParams.set('handoff_id', targetHandoffId);
      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      setSlots(Array.isArray(data.slots) ? data.slots : []);
      setMentorName(data.mentor_name ?? null);
    } catch (err) {
      console.error('[StudentSupport] support slots error', err);
      setSlots([]);
      setSlotsError('Não conseguimos carregar a agenda agora. Nossa equipe vai acompanhar seu caso.');
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!handoffId || handoffMeetingUrl) return;
    void fetchSupportSlots(handoffId);
  }, [fetchSupportSlots, handoffId, handoffMeetingUrl]);

  const createHandoff = useCallback(
    async (reason: string, lastAiMessage: string) => {
      if (!userProfile?.id || handedOff) return;

      const systemMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Atendimento humano solicitado. Um especialista da Equipe Migma vai acompanhar seu caso. Escolha um horário na agenda abaixo para falar com seu mentor.',
        created_at: new Date().toISOString(),
        is_handoff: true,
      };
      setMessages((prev) => [...prev, systemMsg]);
      await saveMessage('system', systemMsg.content);

      const { data } = await supabase
        .from('support_handoffs')
        .insert({
          profile_id: userProfile.id,
          triggered_by: 'ai_escalation',
          reason,
          last_ai_message: lastAiMessage,
          status: 'pending',
        })
        .select('id, created_at, meeting_url')
        .single();

      setHandedOff(true);
      setHandoffId(data?.id ?? null);
      setHandoffCreatedAt(data?.created_at ?? new Date().toISOString());
      setHandoffMeetingUrl(data?.meeting_url ?? null);

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
            data: { client_name: userProfile.full_name ?? 'Aluno', client_id: userProfile.id, reason, last_message: lastAiMessage },
          }),
        });
      } catch { /* best-effort */ }
    },
    [userProfile, handedOff, saveMessage],
  );

  const bookSupportSlot = useCallback(async () => {
    if (!handoffId || !selectedSlot || bookingSlot) return;
    if (!SUPPORT_BOOK_SLOT_URL) {
      setBookingError('Agenda de suporte não configurada.');
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
        if (data?.error === 'slot_taken') {
          setBookingError('Esse horário acabou de ser reservado. Escolha outro horário.');
          setSelectedSlot(null);
          await fetchSupportSlots(handoffId);
          return;
        }
        throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
      }

      setHandoffMeetingUrl(data.meet_url ?? null);
      setHandoffMeetingStart(data.slot_start ?? selectedSlot.start);
      setHandoffCreatedAt((current) => current ?? new Date().toISOString());
      if (data.mentor_name) setMentorName(data.mentor_name);
      setSlots([]);
    } catch (err) {
      console.error('[StudentSupport] support booking error', err);
      setBookingError('Não conseguimos confirmar esse horário. Tente novamente.');
    } finally {
      setBookingSlot(false);
    }
  }, [bookingSlot, fetchSupportSlots, handoffId, selectedSlot]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || (handedOff && !meetingCountdown?.expired)) return;

    if (resolvedHandoff) setResolvedHandoff(null);

    setInput('');
    setSending(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    await saveMessage('user', text);

    try {
      if (!N8N_WEBHOOK_URL) throw new Error('VITE_N8N_WEBHOOK_URL não configurado');

      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: userProfile?.id ?? user?.id,
          profileId: userProfile?.id ?? user?.id,
          studentName: userProfile?.full_name ?? '',
          studentEmail: user?.email ?? '',
          history: (() => {
            const cutoff = resolvedHandoff?.resolved_at ?? null;
            return messages
              .filter((m) => m.id !== 'welcome' && m.role !== 'system')
              .filter((m) => !cutoff || new Date(m.created_at) > new Date(cutoff))
              .slice(-20)
              .map((m) => ({ role: m.role, content: m.content }));
          })(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const reply: string = json.response ?? json.message ?? json.output ?? json.text ?? 'Sem resposta da Equipe Migma.';
      const escalate: boolean = json.escalate === true;
      const escalateReason: string = json.reason ?? json.escalate_reason ?? '';

      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: reply, created_at: new Date().toISOString(), is_handoff: escalate };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage('assistant', reply);

      if (escalate) await createHandoff(escalateReason, reply);
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: 'Ops, tive um problema técnico agora. Tente novamente em alguns segundos.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, handedOff, meetingCountdown?.expired, resolvedHandoff, messages, userProfile, user, saveMessage, createHandoff]);

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
    <div className={`${embedded ? 'h-[calc(100vh-132px)] min-h-[620px] rounded-lg border border-[#e3d5bd] dark:border-white/10 overflow-hidden' : 'min-h-screen'} bg-[#f7f4ee] dark:bg-[#0a0a0a] flex flex-col text-[#1f1a14] dark:text-white`}>
      <header className="shrink-0 bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur border-b border-[#e3d5bd] dark:border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {!embedded && onBack && (
            <button onClick={onBack} className="p-2 rounded-lg text-[#6f6251] dark:text-white/50 hover:bg-[#f3ead9] dark:hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${handedOff ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[#CE9F48]/15 border-[#CE9F48]/30'}`}>
              {handedOff ? <UserCheck className="w-5 h-5 text-blue-400" /> : <MessageCircle className="w-5 h-5 text-[#9a6a16] dark:text-[#CE9F48]" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1f1a14] dark:text-white leading-none">Equipe Migma</p>
              <p className={`text-xs mt-0.5 ${handedOff ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {handedOff ? 'Aguardando atendente' : 'Online agora'}
              </p>
            </div>
          </div>
          <img src="/migma-logo.png" alt="Migma" className="h-6 opacity-70" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

          {sending && <TypingIndicator />}

          {handedOff && handoffCreatedAt && (
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              <UserCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{handoffMeetingUrl ? 'Reunião com mentor agendada' : 'Agende com seu mentor'}</p>
                <p className="text-blue-600/60 dark:text-blue-300/60 text-xs mt-0.5">
                  Solicitado às {new Date(handoffCreatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {handoffMeetingUrl ? 'O chat será liberado no horário da reunião.' : 'Escolha um horário disponível para falar com a Equipe Migma.'}
                </p>

                {handoffMeetingUrl ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-blue-600/20 bg-white/60 px-4 py-3 dark:border-blue-500/20 dark:bg-black/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700/70 dark:text-blue-300/70">
                        Chat disponível em
                      </p>
                      <p className="mt-1 font-mono text-2xl font-black text-blue-800 dark:text-blue-100">
                        {formatCountdown(meetingCountdown)}
                      </p>
                      {handoffMeetingStart && (
                        <p className="mt-1 text-xs text-blue-700/60 dark:text-blue-300/60">
                          Reunião: {new Date(handoffMeetingStart).toLocaleString('pt-BR', {
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
                      Entrar no Google Meet
                    </a>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {slotsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-blue-700/70 dark:text-blue-300/70">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Carregando horários disponíveis{mentorName ? ` com ${mentorName}` : ''}...
                      </div>
                    ) : slotsError ? (
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70">{slotsError}</p>
                    ) : slotGroups.length > 0 ? (
                      <>
                        <SupportSlotPicker groups={slotGroups} selected={selectedSlot} onSelect={setSelectedSlot} />
                        {bookingError && <p className="text-xs font-medium text-red-600 dark:text-red-300">{bookingError}</p>}
                        <button
                          type="button"
                          onClick={bookSupportSlot}
                          disabled={!selectedSlot || bookingSlot}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#CE9F48] px-4 py-2 text-xs font-black text-black transition-colors hover:bg-[#b8892f] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {bookingSlot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                          {selectedSlot ? `Confirmar ${formatTime(selectedSlot.start)}` : 'Escolha um horário'}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70">
                        Não encontramos horários disponíveis agora. Nossa equipe vai acompanhar seu caso.
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
                <p className="font-medium">Atendimento encerrado</p>
                {resolvedHandoff.resolved_note && (
                  <p className="text-emerald-600/80 dark:text-emerald-300/80 text-xs mt-1">"{resolvedHandoff.resolved_note}"</p>
                )}
                <p className="text-emerald-600/50 dark:text-emerald-300/50 text-xs mt-1">Pode continuar enviando mensagens normalmente.</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="sticky bottom-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur border-t border-[#e3d5bd] dark:border-white/5 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {handedOff && !meetingCountdown?.expired ? (
            <div className="flex flex-col items-center gap-3 text-center text-[#8a7b66] dark:text-white/40 text-sm py-2">
              <span>
                {handoffMeetingUrl
                  ? `Chat bloqueado até a reunião · ${formatCountdown(meetingCountdown)}`
                  : 'Conversa transferida. Escolha um horário na agenda acima.'}
              </span>
              {handoffMeetingUrl && (
                <a
                  href={handoffMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600/30 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Entrar no Google Meet
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
                  placeholder="Escreva sua dúvida..."
                  rows={1}
                  className="flex-1 bg-transparent text-[#1f1a14] dark:text-white placeholder-[#8a7b66] dark:placeholder-white/30 text-sm resize-none outline-none max-h-32 leading-relaxed"
                  style={{ height: 'auto' }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px`; }}
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#CE9F48] hover:bg-[#b8892f] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 text-black animate-spin" /> : <Send className="w-4 h-4 text-black" />}
                </button>
              </div>
              <p className="text-center text-[#8a7b66] dark:text-white/20 text-xs mt-2">Enter para enviar · Shift+Enter para nova linha</p>
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

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
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
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border ${message.is_handoff ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[#CE9F48]/15 border-[#CE9F48]/30'}`}>
          {message.is_handoff ? <UserCheck className="w-4 h-4 text-blue-400" /> : <MessageCircle className="w-4 h-4 text-[#9a6a16] dark:text-[#CE9F48]" />}
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-[#CE9F48] text-black rounded-tr-sm font-medium' : 'bg-[#f3ead9] dark:bg-white/5 border border-[#e3d5bd] dark:border-white/10 text-[#1f1a14] dark:text-white/90 rounded-tl-sm'}`}>
        {message.content}
        <div className={`text-xs mt-1.5 ${isUser ? 'text-black/50' : 'text-[#8a7b66] dark:text-white/25'}`}>
          {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
