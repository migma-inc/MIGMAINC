/**
 * UniversitySelectionStep — Spec V11 §§ 7.1–7.7
 * Multi-select até 4 universidades → Review → Confirm → salva no banco.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Search, MapPin, Clock,
  ChevronRight, Loader2, AlertCircle, X, CheckCircle, CheckCircle2, AlertTriangle,
  DollarSign, Info, Shield
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';
import { UniversitySelectionModal, type Institution } from './UniversitySelectionModal';

const MAX_SELECTIONS = 4;
const DISABLE_SCHOLARSHIP_APPROVAL_LOCK_FOR_TESTS = true;

const STUDY_AREA_LABEL_KEYS: Record<string, string> = {
  'Exatas & Tecnologia': 'student_onboarding.scholarship.study_area_options.stem',
  'Negócios & Gestão': 'student_onboarding.scholarship.study_area_options.business',
  'Humanas & Sociais': 'student_onboarding.scholarship.study_area_options.humanities',
  'Saúde & Ciências': 'student_onboarding.scholarship.study_area_options.health',
};

const DEGREE_LEVEL_LABEL_KEYS: Record<string, string> = {
  'Graduação': 'student_onboarding.university_modal.degree_undergraduate',
  'Pós-Graduação': 'student_onboarding.university_modal.degree_postgraduate',
  'Mestrado': 'student_onboarding.university_modal.degree_masters',
};

type SelectionEntry = {
  institution: Institution;
  scholarshipId: string;
};

type View = 'list' | 'review';
type ExistingApplication = {
  id: string;
  status: string;
  institution_id: string;
  scholarship_level_id: string;
  institutions: { name: string; city: string; state: string; logo_url?: string | null } | null;
  institution_scholarships: { scholarship_level: string | null; discount_percent: number | null } | null;
};

export const UniversitySelectionStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile } = useStudentAuth();
  const { t } = useTranslation();

  const formatDegreeLevel = (value: string | null | undefined) => {
    if (!value) return '';
    const key = DEGREE_LEVEL_LABEL_KEYS[value];
    return key ? t(key) : value;
  };

  // ── Data ──
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ──
  const [searchTerm, setSearchTerm] = useState('');
  const [universityFilter, setUniversityFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [workAuthFilter, setWorkAuthFilter] = useState('');
  const [minTuitionFilter, setMinTuitionFilter] = useState('');
  const [maxTuitionFilter, setMaxTuitionFilter] = useState('');

  // ── Selection ──
  const [selections, setSelections] = useState<Map<string, SelectionEntry>>(new Map());
  const [modalInstId, setModalInstId] = useState<string | null>(null);

  // ── View state ──
  const [view, setView] = useState<View>('list');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [existingApps, setExistingApps] = useState<ExistingApplication[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('institutions')
        .select(`
          *,
          courses:institution_courses(*),
          scholarships:institution_scholarships(*)
        `)
        .eq('esl_flag', false)
        .order('name');

      if (fetchError) throw fetchError;
      setInstitutions((data as Institution[]) || []);

      if (userProfile?.id) {
        const { data: apps } = await supabase
          .from('institution_applications')
          .select(`
            id, status, institution_id, scholarship_level_id,
            institutions ( name, city, state, logo_url ),
            institution_scholarships ( scholarship_level, discount_percent )
          `)
          .eq('profile_id', userProfile.id);
        setExistingApps(((apps || []) as unknown) as ExistingApplication[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived filter options ──
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    institutions.forEach(i => i.courses.forEach(c => areas.add(c.area)));
    return Array.from(areas).sort();
  }, [institutions]);

  // ── Filtered institutions ──
  const filteredInstitutions = useMemo(() => {
    const minT = minTuitionFilter ? Number(minTuitionFilter) : null;
    const maxT = maxTuitionFilter ? Number(maxTuitionFilter) : null;

    const filtered = institutions.filter(inst => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = inst.name.toLowerCase().includes(q) ||
          inst.city.toLowerCase().includes(q) ||
          inst.courses.some(c => c.course_name.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (universityFilter && inst.id !== universityFilter) return false;
      if (modalityFilter && inst.modality !== modalityFilter) return false;
      if (areaFilter && !inst.courses.some(c => c.area === areaFilter)) return false;
      if (levelFilter && !inst.courses.some(c => c.degree_level === levelFilter)) return false;
      if (workAuthFilter === 'CPT') {
        // Filter: must mention CPT availability (cpt_after_months defined in courses)
        if (!inst.courses.some(c => c.cpt_after_months !== null)) return false;
      }
      const instMinTuition = Math.min(...inst.scholarships.map(s => s.tuition_annual_usd), Infinity);
      if (minT !== null && instMinTuition < minT) return false;
      if (maxT !== null && instMinTuition > maxT) return false;
      return true;
    });

    // Sort: highlights first, then name
    return [...filtered].sort((a, b) => {
      const aH = a.highlight_badge ? 1 : 0;
      const bH = b.highlight_badge ? 1 : 0;
      if (aH !== bH) return bH - aH;
      return a.name.localeCompare(b.name);
    });
  }, [institutions, searchTerm, universityFilter, modalityFilter, areaFilter, levelFilter, workAuthFilter, minTuitionFilter, maxTuitionFilter]);

  // ── Selection handlers ──
  const handleSelect = useCallback((instId: string, scholarshipId: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      const institution = institutions.find(i => i.id === instId);
      if (!institution) return prev;
      next.set(instId, { institution, scholarshipId });
      return next;
    });
  }, [institutions]);

  const handleRemove = useCallback((instId: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      next.delete(instId);
      return next;
    });
  }, []);

  const resetFilters = () => {
    setSearchTerm('');
    setUniversityFilter('');
    setModalityFilter('');
    setFrequencyFilter('');
    setAreaFilter('');
    setLevelFilter('');
    setWorkAuthFilter('');
    setMinTuitionFilter('');
    setMaxTuitionFilter('');
  };

  const handleConfirm = async () => {
    if (!userProfile?.id || selections.size === 0 || saving) return;
    setSaving(true);
    try {
      // Filter out selections that already have existing applications
      const newEntries = Array.from(selections.values()).filter(entry => 
        !existingApps.some(app => app.institution_id === entry.institution.id)
      );

      if (newEntries.length === 0) {
        setShowConfirmModal(false);
        setSaving(false);
        return;
      }

      const rows = newEntries.map(entry => ({
        profile_id: userProfile.id,
        institution_id: entry.institution.id,
        scholarship_level_id: entry.scholarshipId,
        status: 'pending_admin_approval',
      }));

      const { error: insertError } = await supabase
        .from('institution_applications')
        .insert(rows);

      if (insertError) throw insertError;
      
      // Refresh local data to show "In Review" state immediately
      await fetchData();
      
      setShowConfirmModal(false);
      onNext();
    } catch (err) {
      console.error('[UniversitySelectionStep] Save error:', err);
      alert(t('student_onboarding.scholarship.error_save'));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-gold-medium animate-spin mb-4" />
        <p className="text-gray-400 font-medium">{t('student_onboarding.scholarship.loading_catalog', 'Loading university catalog...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-gray-400">{t('student_onboarding.scholarship.error_load_institutions', 'Error loading institutions. Try reloading the page.')}</p>
      </div>
    );
  }

  const selectedInst = modalInstId ? institutions.find(i => i.id === modalInstId) : null;
  const isApproved = existingApps.some(a => ['approved', 'payment_pending', 'payment_confirmed', 'accepted'].includes(a.status));
  const canContinueWithExistingApps = DISABLE_SCHOLARSHIP_APPROVAL_LOCK_FOR_TESTS && existingApps.length > 0;
  const isPendingApproval = !isApproved && existingApps.length > 0 && existingApps.every(a => a.status === 'pending_admin_approval');

  // ── Approved state fallback ──
  if (isApproved || canContinueWithExistingApps) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center space-y-8">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center relative">
          <div className="absolute inset-0 bg-emerald-500/10 blur-xl animate-pulse rounded-full" />
          <CheckCircle className="w-10 h-10 text-emerald-500 relative z-10" />
        </div>

        <div className="space-y-2">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
            {t('student_onboarding.scholarship.selection_title_prefix', 'Selection')}{' '}
            <span className="text-gold-medium">
              {isApproved
                ? t('student_onboarding.scholarship.approved', 'Approved')
                : t('student_onboarding.scholarship.confirmed', 'Confirmed')}
            </span>
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed">
            {isApproved
              ? t('student_onboarding.scholarship.approved_desc', 'Your scholarship has been approved by our team. Proceed now to secure your seat.')
              : t('student_onboarding.scholarship.confirmed_desc', 'Your selection has been registered. For testing, scholarship approval is temporarily unlocked.')}
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-gold-medium/20"
        >
          {t('student_onboarding.scholarship.continue_to_payment', 'Continue to Payment')}
        </button>
      </div>
    );
  }

  // ── Awaiting Approval inline view (Spec V11) ──
  if (isPendingApproval) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center space-y-8">
        <div className="w-20 h-20 bg-gold-medium/10 border border-gold-medium/20 rounded-3xl flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gold-medium/10 blur-xl animate-pulse rounded-full" />
          <Clock className="w-10 h-10 text-gold-medium relative z-10" />
        </div>

        <div className="space-y-2">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
            {t('student_onboarding.scholarship.profile_review_title', 'Migma Profile Review')}
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed">
            {t('student_onboarding.scholarship.profile_review_desc', 'Our specialist team is reviewing your university selections and academic profile for scholarship approval.')}
          </p>
        </div>

        <div className="w-full space-y-3">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{t('student_onboarding.scholarship.applications_in_review', 'Applications in Review:')}</p>
          <div className="space-y-2">
            {existingApps.map(app => (
              <div key={app.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3.5 group hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                    {app.institutions?.logo_url ? (
                      <img
                        src={app.institutions.logo_url}
                        alt={app.institutions.name}
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <span className="text-xs font-bold text-gray-900">
                        {app.institutions?.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white group-hover:text-gold-medium transition-colors">
                    {app.institutions?.name}
                  </span>
                </div>
                <span className="text-[10px] bg-gold-medium/10 text-gold-medium px-2.5 py-1 rounded-full font-black uppercase tracking-tighter">
                  {app.institution_scholarships?.scholarship_level || t('student_onboarding.scholarship.migma_scholarship', 'Migma Scholarship')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
            <div className="w-1 h-1 bg-gold-medium rounded-full animate-ping" />
            {t('student_onboarding.scholarship.approval_estimate', 'Estimated approval within 24 business hours')}
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed italic">
            {t('student_onboarding.scholarship.approval_notification', 'You will receive a WhatsApp notification as soon as the scholarship fee payment (Placement Fee) is released.')}
          </p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // REVIEW VIEW (7.6)
  // ──────────────────────────────────────────────
  if (view === 'review') {
    const selectionArray = Array.from(selections.values());
    return (
      <div className="max-w-3xl mx-auto px-4 pb-20 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-medium/80">{t('student_onboarding.scholarship.final_review', 'Final Review')}</p>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            {t('student_onboarding.scholarship.review_title', 'Review Your Selected Universities')}
          </h1>
          <p className="text-gray-400 font-medium leading-relaxed">
            {t('student_onboarding.scholarship.review_subtitle', 'This is a final choice. Once confirmed, you will no longer be able to change the selected universities.')}
          </p>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-400">
            {t('student_onboarding.scholarship.review_warning', 'Review carefully before confirming. This selection cannot be changed after confirmation.')}
          </p>
        </div>

        {/* Selection list */}
        <div className="space-y-4">
          {selectionArray.map(entry => {
            const scholarship = entry.institution.scholarships.find(
              s => s.id === entry.scholarshipId
            );
            const course = entry.institution.courses[0];
            return (
              <div
                key={entry.institution.id}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex items-start gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/20">
                  {entry.institution.logo_url ? (
                    <img
                      src={entry.institution.logo_url}
                      alt={entry.institution.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-gold-medium font-black text-lg">
                      {entry.institution.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white">{entry.institution.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {entry.institution.city}, {entry.institution.state}
                  </p>
                  {course && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {course.course_name} — {formatDegreeLevel(course.degree_level)}
                    </p>
                  )}
                  {scholarship && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="text-xs bg-gold-medium/10 border border-gold-medium/20 text-gold-medium px-2.5 py-1 rounded-full font-bold">
                        {t('student_onboarding.scholarship.placement_fee_amount', {
                          amount: scholarship.placement_fee_usd.toLocaleString(),
                          defaultValue: 'Placement Fee: ${{amount}}',
                        })}
                      </span>
                      <span className="text-xs bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full font-bold">
                        {t('student_onboarding.scholarship.tuition_annual_amount', {
                          amount: scholarship.tuition_annual_usd.toLocaleString(),
                          defaultValue: 'Tuition: ${{amount}}/year',
                        })}
                      </span>
                      <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                        {scholarship.discount_percent}% OFF
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(entry.institution.id)}
                  className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                  title={t('student_onboarding.scholarship.remove', 'Remove')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => setView('list')}
            className="flex-1 px-6 py-4 bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 font-bold uppercase tracking-widest text-xs rounded-2xl transition-all"
          >
            {t('student_onboarding.scholarship.back_to_selection', '← Back to Selection')}
          </button>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={selectionArray.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-gold-medium hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.25)] transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('student_onboarding.scholarship.continue', 'Continue →').replace(' →', '')}
          </button>
        </div>

        {/* ── 7.7 Confirmation Modal ── */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowConfirmModal(false)} />
            <div className="relative bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-[0_0_80px_rgba(0,0,0,1)] space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {t('student_onboarding.scholarship.confirm_selection', 'Confirm Selection')}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  <Trans
                    i18nKey="student_onboarding.scholarship.confirm_modal_desc"
                    defaults="By confirming, you <strong>will no longer be able to change</strong> the selected universities. Review carefully before proceeding."
                    components={{ strong: <strong className="text-white" /> }}
                  />
                </p>
              </div>

              <div className="space-y-2">
                {Array.from(selections.values()).map(entry => (
                  <div key={entry.institution.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                      {entry.institution.logo_url ? (
                        <img
                          src={entry.institution.logo_url}
                          alt={entry.institution.name}
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <span className="text-gold-medium font-black text-sm">
                          {entry.institution.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white truncate">{entry.institution.name}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gold-medium hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg shadow-gold-medium/10 active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('student_onboarding.scholarship.saving_selection', 'Saving Selection...')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t('student_onboarding.scholarship.confirm_send_review', 'Confirm and Submit for Review')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-3 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  {t('student_onboarding.scholarship.review_again', 'Review Again')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // LIST VIEW (7.1 – 7.5)
  // ──────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 pb-32 space-y-8">

      {/* ── 7.1 Header ── */}
      <div className="space-y-4 text-center md:text-left">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
          {t('student_onboarding.scholarship.title_selecting')}
        </h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed font-medium">
          {t('student_onboarding.scholarship.subtitle_selecting')}
        </p>
      </div>

      {/* ── 7.2 Guia Rápido (List Style) ── */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          {[
            t('student_onboarding.scholarship.instruction_filter'),
            t('student_onboarding.scholarship.instruction_details'),
            t('student_onboarding.scholarship.instruction_limit'),
            t('student_onboarding.scholarship.instruction_continue'),
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-4 group">
              <div className="w-1.5 h-1.5 bg-gold-medium rounded-full shrink-0 group-hover:scale-150 transition-all shadow-[0_0_10px_rgba(212,175,55,0.4)]" />
              <p className="text-sm text-gray-400 font-medium group-hover:text-gray-300 transition-colors uppercase tracking-wider">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7.3 Filters ── */}
      <div className="bg-[#0a0a0a] border border-white/5 p-6 sm:p-8 rounded-[2rem] space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-medium/4 blur-[100px] rounded-full pointer-events-none" />

        {/* Row 1: search + university select */}
        <div className="flex flex-col lg:flex-row gap-3 relative z-10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={t('student_onboarding.scholarship.keyword_placeholder', 'Keyword: name, city, course...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 transition-all text-sm"
            />
          </div>
          <select
            value={universityFilter}
            onChange={e => setUniversityFilter(e.target.value)}
            className="migma-select lg:min-w-[220px]"
          >
            <option value="">{t('student_onboarding.scholarship.all_universities', 'All Universities')}</option>
            {institutions.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        {/* Row 2: other filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">{t('student_onboarding.scholarship.study_level', 'Study Level')}</option>
            <option value="Graduação">{t('student_onboarding.scholarship.level_undergraduate', 'Undergraduate')}</option>
            <option value="Pós-Graduação">{t('student_onboarding.scholarship.level_postgraduate', 'Postgraduate')}</option>
            <option value="Mestrado">{t('student_onboarding.scholarship.level_masters', 'Master')}</option>
          </select>

          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">{t('student_onboarding.scholarship.study_area', 'Study Area')}</option>
            {uniqueAreas.map(area => (
              <option key={area} value={area}>
                {t(STUDY_AREA_LABEL_KEYS[area] || '', { defaultValue: area })}
              </option>
            ))}
          </select>

          <select
            value={modalityFilter}
            onChange={e => {
              setModalityFilter(e.target.value);
              if (e.target.value !== 'Híbrido') setFrequencyFilter('');
            }}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">{t('student_onboarding.scholarship.modality', 'Modality')}</option>
            <option value="Híbrido">{t('student_onboarding.scholarship.hybrid', 'Hybrid')}</option>
            <option value="Presencial">{t('student_onboarding.scholarship.in_person', 'In Person')}</option>
          </select>

          {/* Frequência — só aparece quando Híbrido selecionado */}
          {modalityFilter === 'Híbrido' && (
            <select
              value={frequencyFilter}
              onChange={e => setFrequencyFilter(e.target.value)}
              className="migma-select !text-xs !font-bold border-gold-medium/20"
            >
              <option value="">{t('student_onboarding.scholarship.frequency', 'Frequency')}</option>
              <option value="mensal">{t('student_onboarding.scholarship.monthly', 'Monthly')}</option>
              <option value="semestral">{t('student_onboarding.scholarship.semesterly', 'Semesterly')}</option>
            </select>
          )}

          <select
            value={workAuthFilter}
            onChange={e => setWorkAuthFilter(e.target.value)}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">{t('student_onboarding.scholarship.work_permission', 'Work Permission')}</option>
            <option value="OPT">OPT</option>
            <option value="CPT">CPT</option>
            <option value="">{t('student_onboarding.scholarship.both', 'Both')}</option>
          </select>

          <button
            onClick={resetFilters}
            className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
          >
            {t('student_onboarding.scholarship.clear', 'Clear')}
          </button>
        </div>

        {/* Tuition range */}
        <div className="flex gap-3 relative z-10">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="number"
              placeholder={t('student_onboarding.scholarship.min_tuition', 'Min tuition')}
              value={minTuitionFilter}
              onChange={e => setMinTuitionFilter(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 text-sm"
            />
          </div>
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="number"
              placeholder={t('student_onboarding.scholarship.max_tuition', 'Max tuition')}
              value={maxTuitionFilter}
              onChange={e => setMaxTuitionFilter(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── 7.3.5 Bank Statement Objection Handling (Spec 7.4) ── */}
      <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-medium/10 blur-[60px] rounded-full" />
        <div className="w-16 h-16 bg-gold-medium/20 rounded-2xl flex items-center justify-center shrink-0">
          <Shield className="w-8 h-8 text-gold-medium" />
        </div>
        <div className="space-y-1 flex-1 text-center md:text-left">
          <h4 className="text-base font-black text-white uppercase tracking-widest">
            <Trans
              i18nKey="student_onboarding.scholarship.bank_statement_title"
              defaults="Understand the <gold>Bank Statement</gold>"
              components={{ gold: <span className="text-gold-medium" /> }}
            />
          </h4>
          <p className="text-sm text-gray-400 leading-relaxed font-medium">
            <Trans
              i18nKey="student_onboarding.scholarship.bank_statement_desc"
              defaults="The Bank Statement <strong>is NOT the amount you will spend</strong>. It is only financial proof required by U.S. immigration for your I-20 issuance. You do not need to transfer this amount to the university or to Migma."
              components={{ strong: <span className="text-white font-bold" /> }}
            />
          </p>
        </div>
        <button
          onClick={() => window.open('https://migma.app/ajuda-bank-statement', '_blank')}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all whitespace-nowrap"
        >
          {t('student_onboarding.scholarship.learn_more', 'Learn More')}
        </button>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-white">{filteredInstitutions.length}</span>{' '}
          {t(filteredInstitutions.length === 1 ? 'student_onboarding.scholarship.university_found' : 'student_onboarding.scholarship.universities_found', {
            count: filteredInstitutions.length,
            defaultValue: filteredInstitutions.length === 1 ? 'university found' : 'universities found',
          })}
        </p>
        {selections.size > 0 && (
          <p className="text-sm text-gold-medium font-bold">
            {t('student_onboarding.scholarship.selected_counter', {
              selected: selections.size,
              total: MAX_SELECTIONS,
              defaultValue: '{{selected}}/{{total}} selected',
            })}
          </p>
        )}
      </div>

      {/* ── 7.4 Institution Cards ── */}
      {filteredInstitutions.length === 0 ? (
        <div className="text-center py-24 bg-white/[0.02] border border-dashed border-white/5 rounded-[2.5rem]">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-gray-700" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase">{t('student_onboarding.scholarship.no_university_found_title', 'No university found')}</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
            {t('student_onboarding.scholarship.no_university_found_desc', 'Try other search criteria or remove some filters.')}
          </p>
          <button
            onClick={resetFilters}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-gold-medium font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
          >
            {t('student_onboarding.scholarship.reset_filters', 'Reset Filters')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInstitutions.map(inst => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              isSelected={selections.has(inst.id)}
              currentScholarshipId={selections.get(inst.id)?.scholarshipId ?? null}
              selectionDisabled={selections.size >= MAX_SELECTIONS && !selections.has(inst.id)}
              onOpenModal={() => setModalInstId(inst.id)}
              onRemove={() => handleRemove(inst.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {selectedInst && (
        <UniversitySelectionModal
          institution={selectedInst}
          preSelectedScholarshipId={selections.get(selectedInst.id)?.scholarshipId ?? null}
          onClose={() => setModalInstId(null)}
          onSelect={scholarshipId => {
            handleSelect(selectedInst.id, scholarshipId);
            setModalInstId(null);
          }}
        />
      )}

      {/* ── Floating bottom bar ── */}
      {selections.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-black/80 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-black">
                {t(selections.size === 1 ? 'student_onboarding.scholarship.selected_count_one' : 'student_onboarding.scholarship.selected_count_other', {
                  count: selections.size,
                  defaultValue: selections.size === 1 ? '{{count}} university selected' : '{{count}} universities selected',
                })}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('student_onboarding.scholarship.slots_remaining', {
                  count: MAX_SELECTIONS - selections.size,
                  defaultValue: '{{count}} slot(s) remaining',
                })}
              </p>
            </div>
            <button
              onClick={() => setView('review')}
              className="flex items-center gap-2 px-8 py-4 bg-gold-medium hover:bg-gold-light text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.3)] transition-all active:scale-95"
            >
              {t('student_onboarding.scholarship.continue', 'Continue →').replace(' →', '')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// ── Institution Card ──────────────────────────────
interface CardProps {
  institution: Institution;
  isSelected: boolean;
  currentScholarshipId: string | null;
  selectionDisabled: boolean;
  onOpenModal: () => void;
  onRemove: () => void;
}

const InstitutionCard: React.FC<CardProps> = ({
  institution, isSelected, currentScholarshipId, selectionDisabled, onOpenModal, onRemove,
}) => {
  const { t } = useTranslation();
  const scholarships = useMemo(() => 
    [...institution.scholarships].sort((a, b) => a.placement_fee_usd - b.placement_fee_usd),
    [institution.scholarships]
  );

  // Stats for the "Finance Overview" (Spec 7.4)
  const stats = useMemo(() => {
    if (scholarships.length === 0) return null;
    const maxTuition = Math.max(...scholarships.map(s => s.tuition_annual_usd));
    
    // Determine which level to display in the header summary
    // If a level is selected for this card, show it. Otherwise show the best discount.
    const displayLevel = currentScholarshipId 
      ? scholarships.find(s => s.id === currentScholarshipId) 
      : [...scholarships].sort((a, b) => b.discount_percent - a.discount_percent)[0];

    return {
      maxTuition,
      displayTuition: displayLevel?.tuition_annual_usd || 0,
      displayDiscount: displayLevel?.discount_percent || 0,
      displayPlacement: displayLevel?.placement_fee_usd || 0,
    };
  }, [scholarships, currentScholarshipId]);

  if (!stats) return null;

  return (
    <div
      className={`group relative bg-[#0a0a0a] border rounded-[2.5rem] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_30px_60px_rgba(0,0,0,0.7)] ${
        isSelected
          ? 'border-gold-medium/60 shadow-[0_0_30px_rgba(184,158,78,0.1)]'
          : selectionDisabled
          ? 'border-white/5 opacity-60'
          : 'border-white/10 hover:border-gold-medium/30'
      }`}
    >
      {/* ── Logo banner ── */}
      <div className="relative h-32 bg-white flex items-center justify-center overflow-hidden shrink-0">
        {institution.logo_url ? (
          <img
            src={institution.logo_url}
            alt={institution.name}
            className="w-full h-full object-contain p-6"
          />
        ) : (
          <span className="text-5xl font-black text-gray-200 select-none">
            {institution.name.charAt(0)}
          </span>
        )}

        {/* Badges */}
        {isSelected && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-gold-medium text-black text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Selecionada
          </div>
        )}
        {institution.highlight_badge && !isSelected && (
          <div className="absolute top-3 left-3 bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            {institution.highlight_badge}
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-6 space-y-5 flex-1">
        {/* Name + location */}
        <div>
          <h3 className="text-lg font-black text-white leading-tight group-hover:text-gold-medium transition-colors">
            {institution.name}
          </h3>
          <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-bold uppercase tracking-wide mt-1">
            <MapPin className="w-3 h-3 text-gold-medium/50" />
            {institution.city}, {institution.state}
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">{t('student_onboarding.scholarship.finance_overview', 'Migma Finances')}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[8px] text-gray-600 uppercase font-black">{t('student_onboarding.scholarship.original', 'Original')}</p>
              <p className="text-xs text-gray-500 line-through font-bold">${stats.maxTuition.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gold-medium uppercase font-black">{t('student_onboarding.scholarship.with_scholarship', 'With Scholarship')}</p>
              <p className="text-xs text-white font-black">${stats.displayTuition.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[8px] text-emerald-500 uppercase font-black">{t('student_onboarding.scholarship.discount', 'Discount')}</p>
              <p className="text-xs text-emerald-400 font-black">{stats.displayDiscount}% OFF</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-600 uppercase font-black">{t('student_onboarding.scholarship.placement_fee_short', 'Placement Fee')}</p>
              <p className="text-xs text-gray-400 font-bold">${stats.displayPlacement.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Modalidade / CPT */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2">
            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-0.5">{t('student_onboarding.scholarship.modality', 'Modality')}</p>
            <p className="text-[11px] text-gray-200 font-black">{institution.modality}</p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2">
            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-0.5">{t('student_onboarding.scholarship.work', 'Work')}</p>
            <p className="text-[11px] text-gray-200 font-black truncate">{institution.cpt_opt || 'CPT + OPT'}</p>
          </div>
        </div>

        {/* Scholarship Levels */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
            {t('student_onboarding.scholarship.scholarship_levels', 'Scholarship Levels')}
          </p>

          {currentScholarshipId ? (
            /* Selected level display */
            (() => {
              const selected = scholarships.find(s => s.id === currentScholarshipId);
              if (!selected) return null;
              return (
                <div className="flex items-center justify-between bg-gold-medium/10 border border-gold-medium/30 rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-[9px] text-gold-medium/70 uppercase font-black tracking-widest mb-0.5">{t('student_onboarding.scholarship.selected_level', 'Selected level')}</p>
                    <p className="text-lg font-black text-white leading-none">
                      ${selected.monthly_migma_usd}
                      <span className="text-[10px] text-gray-400 font-bold ml-1">{t('student_onboarding.scholarship.per_month', '/month')}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {t('student_onboarding.scholarship.placement', 'Placement')}: <span className="text-gray-300 font-bold">${selected.placement_fee_usd.toLocaleString()}</span>
                      {' · '}
                      <span className="text-emerald-400 font-bold">{selected.discount_percent}% OFF</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
                    className="text-[9px] text-gold-medium/70 hover:text-gold-medium font-black uppercase tracking-widest transition-colors"
                  >
                    {t('student_onboarding.scholarship.change', 'Change')}
                  </button>
                </div>
              );
            })()
          ) : (
            /* Price range + CTA */
            <button
              onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
              disabled={selectionDisabled}
              className="w-full flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-gold-medium/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl px-4 py-3.5 transition-all group/range"
            >
              <div className="text-left">
                <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-0.5">{t('student_onboarding.scholarship.starting_at', 'Starting at')}</p>
                <p className="text-xl font-black text-white leading-none">
                  ${Math.min(...scholarships.map(s => s.monthly_migma_usd))}
                  <span className="text-[10px] text-gray-400 font-bold ml-1">{t('student_onboarding.scholarship.per_month', '/month')}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-emerald-600 uppercase font-black tracking-widest mb-0.5">{t('student_onboarding.scholarship.highest_discount', 'Highest discount')}</p>
                <p className="text-xl font-black text-emerald-400 leading-none">
                  {Math.max(...scholarships.map(s => s.discount_percent))}% OFF
                </p>
              </div>
            </button>
          )}

          <p className="text-center text-[9px] text-gray-600 font-medium">
            {t('student_onboarding.scholarship.levels_available_compare', {
              count: scholarships.length,
              defaultValue: '{{count}} level(s) available · view details to compare',
            })}
          </p>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex border-t border-white/5 mt-auto bg-white/[0.01]">
        <button
          onClick={onOpenModal}
          className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
        >
          <Info className="w-3.5 h-3.5" />
          {t('student_onboarding.scholarship.details', 'Details')}
        </button>
        <div className="w-px bg-white/5" />
        {isSelected ? (
          <button
            onClick={onRemove}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            {t('student_onboarding.scholarship.remove', 'Remove')}
          </button>
        ) : (
          <button
            onClick={() => {
              if (selectionDisabled) return;
              onOpenModal();
            }}
            disabled={selectionDisabled}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gold-medium hover:bg-gold-medium hover:text-black disabled:text-gray-700 disabled:bg-transparent transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('student_onboarding.scholarship.select', 'Select')}
          </button>
        )}
      </div>
    </div>
  );
};
