import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, MessageCircle, Bot, UserCheck, CheckCircle, Calendar } from 'lucide-react';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { supabase } from '../../lib/supabase';

const N8N_WEBHOOK_URL = (import.meta.env.VITE_SUPPORT_N8N_WEBHOOK_URL || import.meta.env.VITE_N8N_WEBHOOK_URL) as string | undefined;
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
const SUPPORT_CALENDLY_URL = import.meta.env.VITE_SUPPORT_CALENDLY_URL as string | undefined;

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

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou da Equipe Migma 👋\n\nEstou aqui para tirar suas dúvidas sobre o processo, documentos, universidades, visto F-1 e tudo mais. Como posso ajudar?',
  created_at: new Date().toISOString(),
};

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
  const [handoffCreatedAt, setHandoffCreatedAt] = useState<string | null>(null);
  const [handoffMeetingUrl, setHandoffMeetingUrl] = useState<string | null>(null);
  const [resolvedHandoff, setResolvedHandoff] = useState<HandoffRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
          setHandoffCreatedAt(active.created_at);
          setHandoffMeetingUrl(active.meeting_url);
        } else if (resolved) {
          // Mostra card pós-resolução apenas se não há mensagem do aluno após o resolved_at
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

  const saveMessage = useCallback(
    async (role: 'user' | 'assistant' | 'system', content: string) => {
      if (!userProfile?.id) return;
      await supabase.from('support_chat_messages').insert({ profile_id: userProfile.id, role, content });
    },
    [userProfile?.id],
  );

  const buildSupportMeetingUrl = useCallback(() => {
    const base = SUPPORT_CALENDLY_URL || `${window.location.origin}/book-a-call`;
    const url = new URL(base, window.location.origin);
    url.searchParams.set('source', 'support_handoff');
    url.searchParams.set('profile_id', userProfile?.id ?? '');
    if (user?.email) url.searchParams.set('email', user.email);
    return url.toString();
  }, [user?.email, userProfile?.id]);

  const createHandoff = useCallback(
    async (reason: string, lastAiMessage: string) => {
      if (!userProfile?.id || handedOff) return;

      // Marco visual no chat
      const systemMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Atendimento humano solicitado. Um especialista da Equipe Migma vai acompanhar seu caso. Você também pode agendar uma conversa pelo link que apareceu abaixo.',
        created_at: new Date().toISOString(),
        is_handoff: true,
      };
      setMessages((prev) => [...prev, systemMsg]);
      await saveMessage('system', systemMsg.content);

      const meetingUrl = buildSupportMeetingUrl();
      const { data } = await supabase
        .from('support_handoffs')
        .insert({
          profile_id: userProfile.id,
          triggered_by: 'ai_escalation',
          reason,
          last_ai_message: lastAiMessage,
          status: 'pending',
          meeting_url: meetingUrl,
          meeting_requested_at: new Date().toISOString(),
        })
        .select('created_at, meeting_url')
        .single();

      setHandedOff(true);
      setHandoffCreatedAt(data?.created_at ?? new Date().toISOString());
      setHandoffMeetingUrl(data?.meeting_url ?? meetingUrl);

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
            data: { client_name: userProfile.full_name ?? 'Aluno', client_id: userProfile.id, reason, last_message: lastAiMessage, meeting_url: meetingUrl },
          }),
        });
      } catch { /* best-effort */ }
    },
    [userProfile, handedOff, saveMessage, buildSupportMeetingUrl],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || handedOff) return;

    // Ao enviar após resolução, limpa o card de resolução
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
      const reply: string = json.response ?? json.message ?? json.output ?? json.text ?? 'Sem resposta do assistente.';
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
  }, [input, sending, handedOff, resolvedHandoff, messages, userProfile, user, saveMessage, createHandoff]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!user || !historyLoaded) {
    return (
      <div className={`${embedded ? 'min-h-[520px]' : 'min-h-screen'} bg-[#0a0a0a] flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 text-[#CE9F48] animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${embedded ? 'h-[calc(100vh-132px)] min-h-[620px] rounded-lg border border-white/10 overflow-hidden' : 'min-h-screen'} bg-[#0a0a0a] flex flex-col`}>
      {/* Header */}
      <header className="shrink-0 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {!embedded && onBack && (
            <button onClick={onBack} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${handedOff ? 'bg-blue-500/15 border-blue-500/30' : 'bg-[#CE9F48]/15 border-[#CE9F48]/30'}`}>
              {handedOff ? <UserCheck className="w-5 h-5 text-blue-400" /> : <Bot className="w-5 h-5 text-[#CE9F48]" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Equipe Migma</p>
              <p className={`text-xs mt-0.5 ${handedOff ? 'text-blue-400' : 'text-green-400'}`}>
                {handedOff ? 'Aguardando atendente' : 'Online agora'}
              </p>
            </div>
          </div>
          <img src="/migma-logo.png" alt="Migma" className="h-6 opacity-70" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

          {sending && <TypingIndicator />}

          {/* Banner aguardando atendente */}
          {handedOff && handoffCreatedAt && (
            <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3 text-sm text-blue-300">
              <UserCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Aguardando atendente humano</p>
                <p className="text-blue-300/60 text-xs mt-0.5">
                  Solicitado às {new Date(handoffCreatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Nossa equipe entrará em contato pelo WhatsApp ou e-mail cadastrado.
                </p>
                {handoffMeetingUrl && (
                  <a
                    href={handoffMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/20"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Agendar conversa
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Card pós-resolução */}
          {resolvedHandoff && !handedOff && (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3 text-sm text-green-300">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Atendimento encerrado</p>
                {resolvedHandoff.resolved_note && (
                  <p className="text-green-300/80 text-xs mt-1">"{resolvedHandoff.resolved_note}"</p>
                )}
                <p className="text-green-300/50 text-xs mt-1">Pode continuar enviando mensagens normalmente.</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/5 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {handedOff ? (
            <div className="flex flex-col items-center gap-3 text-center text-white/40 text-sm py-2">
              <span>Conversa transferida para um atendente. Aguarde o contato da equipe.</span>
              {handoffMeetingUrl && (
                <a
                  href={handoffMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/20"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Agendar conversa
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#CE9F48]/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva sua dúvida..."
                  rows={1}
                  className="flex-1 bg-transparent text-white placeholder-white/30 text-sm resize-none outline-none max-h-32 leading-relaxed"
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
              <p className="text-center text-white/20 text-xs mt-2">Enter para enviar · Shift+Enter para nova linha</p>
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

// ── Sub-components ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/40">
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
          {message.is_handoff ? <UserCheck className="w-4 h-4 text-blue-400" /> : <MessageCircle className="w-4 h-4 text-[#CE9F48]" />}
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-[#CE9F48] text-black rounded-tr-sm font-medium' : 'bg-white/8 border border-white/10 text-white/90 rounded-tl-sm'}`}>
        {message.content}
        <div className={`text-xs mt-1.5 ${isUser ? 'text-black/50' : 'text-white/25'}`}>
          {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex gap-3">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#CE9F48]/15 border border-[#CE9F48]/30 flex items-center justify-center">
      <MessageCircle className="w-4 h-4 text-[#CE9F48]" />
    </div>
    <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center h-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#CE9F48]/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  </div>
);

export default StudentSupport;
