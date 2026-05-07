import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck, CheckCircle2, Clock, ExternalLink, Globe,
  GraduationCap, Loader2, Star, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COUNTRIES = [
  'United States', 'Brazil', 'Portugal', 'Angola', 'Mozambique', 'Cape Verde',
  'Colombia', 'Mexico', 'Argentina', 'Chile', 'Peru', 'Ecuador', 'Venezuela',
  'Dominican Republic', 'Haiti', 'Jamaica', 'Cuba', 'Puerto Rico', 'Other',
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const REFERRAL_PROXY_URL = `${SUPABASE_URL}/functions/v1/referral-n8n-proxy`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Slot { start: string; end: string; }
interface SlotGroup { dateLabel: string; dateKey: string; slots: Slot[]; }

type ReferralProxyAction = 'get_slots' | 'book_slot';

async function callReferralProxy(action: ReferralProxyAction, payload: Record<string, unknown>) {
  return fetch(REFERRAL_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  }).format(new Date(iso));
}

function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(iso));
}

function formatMonthDay(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SlotPicker({
  groups, selected, onSelect,
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {groups.map((group) => {
          const firstSlot = group.slots[0];
          const active = group.dateKey === activeGroup.dateKey;
          return (
            <button
              key={group.dateKey}
              type="button"
              onClick={() => setManualDateKey(group.dateKey)}
              className={`rounded-md border px-3 py-2 text-left transition-all ${
                active
                  ? 'border-gold-medium bg-gold-medium text-black shadow-lg shadow-gold-medium/10'
                  : 'border-white/10 bg-black/20 text-gray-300 hover:border-gold-medium/50 hover:text-white'
              }`}
            >
              <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">
                {firstSlot ? formatWeekday(firstSlot.start) : group.dateLabel}
              </span>
              <span className="mt-0.5 block text-sm font-black">
                {firstSlot ? formatMonthDay(firstSlot.start) : group.dateLabel}
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold opacity-70">
                {group.slots.length} times
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
            {activeGroup.dateLabel}
          </p>
          <p className="text-xs text-gray-500">{activeGroup.slots.length} available</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeGroup.slots.map((slot) => {
            const active = selected?.start === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => onSelect(slot)}
                className={`min-h-10 rounded-md border px-3 py-2 text-sm font-bold transition-all ${
                  active
                    ? 'border-gold-medium bg-gold-medium text-black'
                    : 'border-white/15 bg-white/[0.03] text-gray-200 hover:border-gold-medium/60 hover:bg-gold-medium/10 hover:text-white'
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ReferralLandingPage = () => {
  const [searchParams] = useSearchParams();

  const refCode    = searchParams.get('ref')          ?? '';
  const utmSource  = searchParams.get('utm_source')   ?? 'migma_referral';
  const utmMedium  = searchParams.get('utm_medium')   ?? 'student_rewards';
  const utmCampaign = searchParams.get('utm_campaign') ?? 'referral_program';
  const utmContent = searchParams.get('utm_content')  ?? refCode;

  const clickTrackedRef = useRef(false);

  // Slots
  const [slotsLoading, setSlotsLoading] = useState(!!refCode);
  const [slots, setSlots]               = useState<Slot[]>([]);
  const [mentorName, setMentorName]     = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Form
  const [form, setForm]             = useState({ full_name: '', email: '', phone: '', country: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<typeof form>>({});

  // Booking
  const [booking, setBooking]       = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [meetUrl, setMeetUrl]       = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<Slot | null>(null);
  const [leadSavedWithoutMeet, setLeadSavedWithoutMeet] = useState(false);

  // ---------------------------------------------------------------------------
  // Mount: increment click + fetch slots
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!refCode || clickTrackedRef.current) return;
    clickTrackedRef.current = true;
    supabase.rpc('increment_referral_click', { p_unique_code: refCode })
      .then(({ error }) => { if (error) console.error('[referral] increment_click error:', error); });

    void (async () => {
      try {
        const res = await callReferralProxy('get_slots', { ref_code: refCode });
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots ?? []);
          setMentorName(data.mentor_name ?? null);
        }
      } catch {
        // non-critical — falls back to form-only mode
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [refCode]);

  const slotGroups = useMemo(() => groupSlotsByDate(slots), [slots]);
  const hasSlots   = slotGroups.length > 0;

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validate = () => {
    const errors: Partial<typeof form> = {};
    if (!form.full_name.trim()) errors.full_name = 'Full name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Invalid email';
    if (!form.phone.trim()) errors.phone = 'Phone is required';
    if (!form.country)       errors.country = 'Country is required';
    return errors;
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    if (hasSlots && !selectedSlot) {
      setBookingError('Please select a time slot above.');
      return;
    }
    setFieldErrors({});
    setBookingError(null);
    setBooking(true);

    try {
      let res: Response;

      try {
        res = await callReferralProxy('book_slot', {
          ref_code:   refCode || null,
          slot_start: selectedSlot?.start ?? null,
          slot_end:   selectedSlot?.end   ?? null,
          lead: {
            full_name: form.full_name.trim(),
            email:     form.email.trim().toLowerCase(),
            phone:     form.phone.trim(),
            country:   form.country,
          },
          utm_source:   utmSource,
          utm_medium:   utmMedium,
          utm_campaign: utmCampaign,
          utm_content:  utmContent,
        });
      } catch (proxyError) {
        console.warn('[ReferralLandingPage] referral proxy unavailable, saving lead without Meet', proxyError);
        const { error } = await supabase.from('referral_leads').insert([{
          full_name:        form.full_name.trim(),
          email:            form.email.trim().toLowerCase(),
          phone:            form.phone.trim(),
          country:          form.country,
          referral_code:    refCode || null,
          utm_source:       utmSource,
          utm_medium:       utmMedium,
          utm_campaign:     utmCampaign,
          utm_content:      utmContent,
          status:           'pending',
        }]);
        if (error) throw error;
        setConfirmedSlot(null);
        setLeadSavedWithoutMeet(true);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.error === 'slot_taken') {
          setBookingError('That slot was just taken. Please pick another time.');
          setSlotsLoading(true);
          setSelectedSlot(null);
          try {
            const r2 = await callReferralProxy('get_slots', { ref_code: refCode });
            if (r2.ok) { const d2 = await r2.json(); setSlots(d2.slots ?? []); }
          } finally {
            setSlotsLoading(false);
          }
          return;
        }
        throw new Error(data?.message ?? 'Booking failed');
      }

      setMeetUrl(data.meet_url ?? null);
      setConfirmedSlot(selectedSlot);
    } catch (err) {
      console.error('[ReferralLandingPage] submit error', err);
      setBookingError('Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const highlights = [
    { icon: GraduationCap, text: 'Scholarships at U.S. universities' },
    { icon: Globe,         text: 'F-1 visa support from start to finish' },
    { icon: Users,         text: 'Over 1,000 students placed' },
    { icon: Star,          text: '100% digital, fully guided process' },
  ];

  // ---------------------------------------------------------------------------
  // Confirmed state
  // ---------------------------------------------------------------------------

  if (meetUrl !== null || leadSavedWithoutMeet) {
    // Show inline confirmation only when we've completed a booking
    const isConfirmed = meetUrl !== null || leadSavedWithoutMeet;
    if (isConfirmed) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
          <Header />
          <div className="pt-[120px] pb-24 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card className="max-w-lg w-full border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                <CardContent className="p-10 text-center space-y-6">
                  <div className="w-16 h-16 bg-green-900/30 border-2 border-green-500/50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-300" />
                  </div>
                  <h2 className="text-3xl font-bold migma-gold-text">You're all set!</h2>
                  {confirmedSlot && (
                    <div className="flex items-center justify-center gap-2 text-gray-300">
                      <Clock className="w-4 h-4 text-gold-medium" />
                      <span>{formatDateLabel(confirmedSlot.start)} at {formatTime(confirmedSlot.start)}</span>
                    </div>
                  )}
                  {meetUrl ? (
                    <>
                      <p className="text-gray-300">
                        Your call{mentorName ? ` with ${mentorName}` : ''} is confirmed. Here's your Google Meet link:
                      </p>
                      <a href={meetUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="w-full btn btn-primary py-5 text-base">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Google Meet
                        </Button>
                      </a>
                      <p className="text-xs text-gray-500">A confirmation was sent to {form.email}</p>
                    </>
                  ) : (
                    <p className="text-gray-300">
                      Our team will reach out on WhatsApp shortly to schedule your call with a mentor.
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
          <Footer />
        </div>
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
      <Header />

      <section className="pt-[120px] pb-24">
        <div className="container max-w-6xl">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-gold-medium text-sm font-semibold uppercase tracking-widest mb-3">
              You were referred
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter migma-gold-text mb-5">
              Your path to studying in the U.S. starts here
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              A friend referred you to MIGMA. Pick a time and our mentor will walk you through a personalized plan — no commitment required.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">

            {/* Left — Why MIGMA */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">Why MIGMA?</h2>
              <div className="space-y-4">
                {highlights.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold-medium/10 border border-gold-medium/30 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-gold-medium" />
                    </div>
                    <span className="text-gray-200">{text}</span>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-lg border border-gold-medium/20 bg-gold-medium/5">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="w-5 h-5 text-gold-medium mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">
                    Pick a slot below and book directly in your mentor's calendar — your Google Meet link is generated automatically.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Right — Slot picker + Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                <CardContent className="p-8 space-y-7">

                  {/* Slot section */}
                  <AnimatePresence mode="wait">
                    {slotsLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 text-gray-400 py-2"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                        <span className="text-sm">Loading available times{mentorName ? ` with ${mentorName}` : ''}…</span>
                      </motion.div>
                    ) : hasSlots ? (
                      <motion.div key="slots" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-white font-bold mb-4">
                          {mentorName ? `${mentorName}'s` : 'Available'} time slots
                        </p>
                        <SlotPicker groups={slotGroups} selected={selectedSlot} onSelect={setSelectedSlot} />
                        {hasSlots && !selectedSlot && (
                          <p className="text-xs text-gray-500 mt-3">Select a time to continue.</p>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="no-slots" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-sm text-gray-400">
                          No slots available right now. Fill in your details and our team will reach out to schedule.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Divider */}
                  {(hasSlots || !slotsLoading) && (
                    <div className="border-t border-white/10" />
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <p className="text-white font-bold">Your information</p>

                    <div className="space-y-1.5">
                      <Label htmlFor="full_name" className="text-white">Full Name *</Label>
                      <Input
                        id="full_name"
                        value={form.full_name}
                        onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                        className="bg-white text-black"
                        placeholder="Your full name"
                      />
                      {fieldErrors.full_name && <p className="text-xs text-destructive">{fieldErrors.full_name}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-white">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                        className="bg-white text-black"
                        placeholder="you@email.com"
                      />
                      {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-white">Phone / WhatsApp *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="bg-white text-black"
                        placeholder="+1 (555) 000-0000"
                      />
                      {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-white">Country *</Label>
                      <Select value={form.country} onValueChange={(v) => setForm(f => ({ ...f, country: v }))}>
                        <SelectTrigger className="bg-white text-black">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.country && <p className="text-xs text-destructive">{fieldErrors.country}</p>}
                    </div>

                    {bookingError && (
                      <p className="text-sm text-destructive">{bookingError}</p>
                    )}

                    <div className="pt-1">
                      <Button
                        type="submit"
                        disabled={booking || (hasSlots && !selectedSlot)}
                        className="w-full btn btn-primary text-base py-5 disabled:opacity-50"
                      >
                        {booking ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Booking…</>
                        ) : hasSlots && selectedSlot ? (
                          <>
                            <CalendarCheck className="w-4 h-4 mr-2" />
                            Confirm — {formatTime(selectedSlot.start)}
                          </>
                        ) : (
                          'Book my free call'
                        )}
                      </Button>
                    </div>
                  </form>

                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
