import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle2, ExternalLink, Loader2, RefreshCw,
  Search, Trophy, Undo2, Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadStatus = 'visit' | 'pending' | 'scheduled' | 'fechado' | 'cancelled';

interface ReferralLead {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  country: string | null;
  referral_code: string | null;
  status: LeadStatus;
  meet_url: string | null;
  notes: string | null;
  referral_links: {
    profile_id: string;
    unique_code: string;
    closures_count: number;
    user_profiles: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
}

type FilterTab = 'all' | 'scheduled' | 'fechado' | 'pending' | 'other';

type DashboardOutletContext = {
  accessRole: 'admin' | 'mentor';
  mentorProfileId: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  visit:     { label: 'Visit',     className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  pending:   { label: 'Pending',   className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  fechado:   { label: 'Closed',    className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as LeadStatus] ?? {
    label: status, className: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AdminReferralLeads = () => {
  const dashboardContext = useOutletContext<DashboardOutletContext | undefined>();
  const isMentor = dashboardContext?.accessRole === 'mentor';
  const mentorProfileId = isMentor ? dashboardContext?.mentorProfileId : null;

  const [leads, setLeads] = useState<ReferralLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (id: string, msg: string, type: 'success' | 'error') => {
    setToast({ id, msg, type });
    setTimeout(() => setToast(t => t?.id === id ? null : t), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);

    if (isMentor && !mentorProfileId) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const selectClause = isMentor
      ? `
        id, created_at, full_name, email, phone, country,
        referral_code, status, meet_url, notes,
        referral_links:referral_link_id!inner (
          profile_id, unique_code, closures_count,
          user_profiles:profile_id ( full_name, email )
        )
      `
      : `
        id, created_at, full_name, email, phone, country,
        referral_code, status, meet_url, notes,
        referral_links:referral_link_id (
          profile_id, unique_code, closures_count,
          user_profiles:profile_id ( full_name, email )
        )
      `;

    let query = supabase
      .from('referral_leads')
      .select(selectClause);

    if (isMentor && mentorProfileId) {
      query = query.eq('referral_links.profile_id', mentorProfileId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error) setLeads((data as unknown as ReferralLead[]) ?? []);
    setLoading(false);
  }, [isMentor, mentorProfileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleClose = async (lead: ReferralLead) => {
    if (isMentor) return;

    setActionLoading(lead.id);
    const { data, error } = await supabase.rpc('credit_referral_lead_closure', { p_lead_id: lead.id });
    if (error) {
      showToast(lead.id, error.message, 'error');
    } else {
      const result = data as {
        closures_count: number;
        goal_reached_now: boolean;
        already_closed: boolean;
        profile_id: string | null;
        exempted_charges?: number;
      };

      let notifyError: string | null = null;
      if (!result.already_closed && result.profile_id) {
        const { error: notificationError } = await supabase.functions.invoke('migma-notify', {
          body: result.goal_reached_now
            ? {
                trigger: 'referral_goal_reached',
                user_id: result.profile_id,
                data: {
                  closures_count: result.closures_count,
                  exempted_charges: result.exempted_charges ?? 0,
                },
              }
            : {
                trigger: 'new_referral_closed',
                user_id: result.profile_id,
                data: {
                  referral_name: lead.full_name,
                  closures_count: result.closures_count,
                },
              },
        });
        notifyError = notificationError?.message ?? null;
      }

      const msg = result.already_closed
        ? 'Lead was already closed.'
        : notifyError
          ? `Closed. ${result.closures_count}/10 referrals. Notification failed: ${notifyError}`
          : result.goal_reached_now
            ? `Closed. Goal reached: ${result.closures_count} referrals closed. Notification sent.`
            : `Closed. ${result.closures_count}/10 referrals. Notification sent.`;
      showToast(lead.id, msg, notifyError ? 'error' : 'success');
      void load();
    }
    setActionLoading(null);
  };

  const handleRevert = async (lead: ReferralLead) => {
    if (isMentor) return;

    setActionLoading(lead.id);
    const { data, error } = await supabase.rpc('revert_referral_lead_closure', { p_lead_id: lead.id });
    if (error) {
      showToast(lead.id, error.message, 'error');
    } else {
      const result = data as { error?: string; closures_count: number };
      if (result.error) {
        showToast(lead.id, result.error, 'error');
      } else {
        showToast(lead.id, `Reverted. ${result.closures_count}/10 referrals.`, 'success');
        void load();
      }
    }
    setActionLoading(null);
  };

  // Filtered list
  const filtered = leads.filter(l => {
    const matchTab =
      activeTab === 'all' ? true :
      activeTab === 'scheduled' ? l.status === 'scheduled' :
      activeTab === 'fechado' ? l.status === 'fechado' :
      activeTab === 'pending' ? l.status === 'pending' :
      !['scheduled', 'fechado', 'pending'].includes(l.status);

    const q = search.toLowerCase();
    const matchSearch = !q || [l.full_name, l.email, l.phone, l.referral_code, l.country]
      .some(v => v?.toLowerCase().includes(q));

    return matchTab && matchSearch;
  });

  const counts = {
    all:       leads.length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    fechado:   leads.filter(l => l.status === 'fechado').length,
    pending:   leads.filter(l => l.status === 'pending').length,
    other:     leads.filter(l => !['scheduled', 'fechado', 'pending'].includes(l.status)).length,
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'fechado',   label: 'Closed' },
    { key: 'pending',   label: 'Pending' },
    { key: 'other',     label: 'Other' },
  ];
  const tableHeaders = isMentor
    ? ['Date', 'Lead', 'Contact', 'Country', 'Referred by', 'Status', 'Meet']
    : ['Date', 'Lead', 'Contact', 'Country', 'Referred by', 'Status', 'Meet', 'Actions'];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-gold-medium" />
          <h1 className="text-2xl font-bold migma-gold-text">Referral Leads</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="border-white/20 text-gray-300 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'text-white' },
          { label: 'Scheduled', value: counts.scheduled, color: 'text-blue-300' },
          { label: 'Closed', value: counts.fechado, color: 'text-green-300' },
          { label: 'Pending', value: counts.pending, color: 'text-yellow-300' },
        ].map(s => (
          <Card key={s.label} className="bg-zinc-900/40 border-white/5">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-gold-medium text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-70">({counts[t.key]})</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, code…"
            className="pl-9 bg-zinc-900 border-white/10 text-white placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="bg-zinc-900/40 border-white/5 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-white/5">
          <CardTitle className="text-sm text-gray-400 font-medium">
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">No leads found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    {tableHeaders.map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, i) => {
                    const isLoading = actionLoading === lead.id;
                    const student = lead.referral_links?.user_profiles;
                    const closures = lead.referral_links?.closures_count ?? 0;
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                          i % 2 === 0 ? '' : 'bg-white/[0.01]'
                        }`}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                          {fmt(lead.created_at)}
                        </td>

                        {/* Lead */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-white whitespace-nowrap">{lead.full_name}</p>
                          <p className="text-xs text-gray-500">{lead.email}</p>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                          {lead.phone}
                        </td>

                        {/* Country */}
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                          {lead.country ?? '—'}
                        </td>

                        {/* Referred by */}
                        <td className="px-4 py-3">
                          {student ? (
                            <>
                              <p className="text-white text-xs whitespace-nowrap">{student.full_name ?? student.email}</p>
                              <p className="text-[11px] text-gray-500">
                                {lead.referral_code} · {closures}/10
                                {closures >= 10 && <Trophy className="inline w-3 h-3 ml-1 text-gold-medium" />}
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-600 text-xs">{lead.referral_code ?? '—'}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={lead.status} />
                          {toast?.id === lead.id && (
                            <p className={`text-[11px] mt-1 ${toast.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                              {toast.msg}
                            </p>
                          )}
                        </td>

                        {/* Meet */}
                        <td className="px-4 py-3">
                          {lead.meet_url ? (
                            <a
                              href={lead.meet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Meet
                            </a>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>

                        {!isMentor && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {lead.status !== 'fechado' && (
                                <Button
                                  size="sm"
                                  disabled={isLoading}
                                  onClick={() => handleClose(lead)}
                                  className="h-7 px-2 text-xs bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/40 hover:text-white"
                                >
                                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                  Close
                                </Button>
                              )}
                              {lead.status === 'fechado' && (
                                <Button
                                  size="sm"
                                  disabled={isLoading}
                                  onClick={() => handleRevert(lead)}
                                  className="h-7 px-2 text-xs bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-600/40 hover:text-white"
                                >
                                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3 mr-1" />}
                                  Revert
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
