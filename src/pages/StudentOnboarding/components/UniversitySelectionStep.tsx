/**
 * UniversitySelectionStep — Spec V11 §§ 7.1–7.7
 * Multi-select até 4 universidades → Review → Confirm → salva no banco.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

type SelectionEntry = {
  institution: Institution;
  scholarshipId: string;
};

type View = 'list' | 'review';

export const UniversitySelectionStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile } = useStudentAuth();
  const { t } = useTranslation();

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
  const [existingApps, setExistingApps] = useState<any[]>([]);
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
        setExistingApps(apps || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

    } catch (err: any) {
      console.error('[UniversitySelectionStep] Save error:', err);
      alert('Erro ao salvar seleção. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-gold-medium animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Carregando catálogo de universidades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-gray-400">Erro ao carregar instituições. Tente recarregar a página.</p>
      </div>
    );
  }

  const selectedInst = modalInstId ? institutions.find(i => i.id === modalInstId) : null;
  const isApproved = existingApps.some(a => ['approved', 'payment_pending', 'payment_confirmed', 'accepted'].includes(a.status));
  const isPendingApproval = !isApproved && existingApps.length > 0 && existingApps.every(a => a.status === 'pending_admin_approval');

  // ── Approved state fallback ──
  if (isApproved) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center space-y-8">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center relative">
          <div className="absolute inset-0 bg-emerald-500/10 blur-xl animate-pulse rounded-full" />
          <CheckCircle className="w-10 h-10 text-emerald-500 relative z-10" />
        </div>

        <div className="space-y-2">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
            Seleção <span className="text-gold-medium">Aprovada</span>
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed">
            Sua bolsa de estudos foi aprovada pela nossa equipe! Prossiga agora para garantir sua vaga.
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full bg-gold-medium hover:bg-gold-dark text-black py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-gold-medium/20"
        >
          Continuar para Pagamento
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
            Análise de Perfil <span className="text-gold-medium">Migma</span>
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed">
            Nossa equipe de especialistas está revisando suas seleções de universidade e seu perfil acadêmico para aprovação das bolsas.
          </p>
        </div>

        <div className="w-full space-y-3">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Candidaturas em Revisão:</p>
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
                  {app.institution_scholarships?.scholarship_level || 'Bolsa Migma'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
            <div className="w-1 h-1 bg-gold-medium rounded-full animate-ping" />
            Aprovação estimada em até 24h úteis
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed italic">
            Você receberá uma notificação em seu WhatsApp assim que o pagamento da taxa de bolsa (Placement Fee) for liberado.
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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-medium/80">Revisão Final</p>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Revise suas Universidades Selecionadas
          </h1>
          <p className="text-gray-400 font-medium leading-relaxed">
            Esta é uma escolha definitiva. Ao confirmar, você não poderá mais alterar as universidades escolhidas.
          </p>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            Revise cuidadosamente antes de confirmar. Esta seleção não poderá ser alterada após a confirmação.
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
                      {course.course_name} — {course.degree_level}
                    </p>
                  )}
                  {scholarship && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="text-xs bg-gold-medium/10 border border-gold-medium/20 text-gold-medium px-2.5 py-1 rounded-full font-bold">
                        Placement Fee: ${scholarship.placement_fee_usd.toLocaleString()}
                      </span>
                      <span className="text-xs bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full font-bold">
                        Tuition: ${scholarship.tuition_annual_usd.toLocaleString()}/ano
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
                  title="Remover"
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
            ← Voltar para Seleção
          </button>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={selectionArray.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-gold-medium hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.25)] transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Continuar
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
                  Confirmar Seleção
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Ao confirmar, você <strong className="text-white">não poderá mais alterar</strong> as universidades escolhidas. Revise cuidadosamente antes de prosseguir.
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
                      <span>Salvando Seleção...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e Enviar para Análise
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-3 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Revisar Novamente
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
              placeholder="Palavra-chave: nome, cidade, curso..."
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
            <option value="">Todas as Universidades</option>
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
            <option value="">Nível de Estudo</option>
            <option value="Graduação">Graduação</option>
            <option value="Pós-Graduação">Pós-Graduação</option>
            <option value="Mestrado">Mestrado</option>
          </select>

          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">Área de Estudo</option>
            {uniqueAreas.map(area => (
              <option key={area} value={area}>{area}</option>
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
            <option value="">Modalidade</option>
            <option value="Híbrido">Híbrido</option>
            <option value="Presencial">Presencial</option>
          </select>

          {/* Frequência — só aparece quando Híbrido selecionado */}
          {modalityFilter === 'Híbrido' && (
            <select
              value={frequencyFilter}
              onChange={e => setFrequencyFilter(e.target.value)}
              className="migma-select !text-xs !font-bold border-gold-medium/20"
            >
              <option value="">Frequência</option>
              <option value="mensal">Mensal</option>
              <option value="semestral">Semestral</option>
            </select>
          )}

          <select
            value={workAuthFilter}
            onChange={e => setWorkAuthFilter(e.target.value)}
            className="migma-select !text-xs !font-bold"
          >
            <option value="">Permissão de Trabalho</option>
            <option value="OPT">OPT</option>
            <option value="CPT">CPT</option>
            <option value="">Ambos</option>
          </select>

          <button
            onClick={resetFilters}
            className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all"
          >
            Limpar
          </button>
        </div>

        {/* Tuition range */}
        <div className="flex gap-3 relative z-10">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="number"
              placeholder="Tuition mín."
              value={minTuitionFilter}
              onChange={e => setMinTuitionFilter(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 text-sm"
            />
          </div>
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="number"
              placeholder="Tuition máx."
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
            Entenda o <span className="text-gold-medium">Bank Statement</span>
          </h4>
          <p className="text-sm text-gray-400 leading-relaxed font-medium">
            O Bank Statement <span className="text-white font-bold">NÃO é o valor que você vai gastar</span>. É apenas uma comprovação financeira exigida pela imigração dos EUA para a emissão do seu I-20. Você não precisa transferir esse valor para a universidade ou para a Migma.
          </p>
        </div>
        <button
          onClick={() => window.open('https://migma.app/ajuda-bank-statement', '_blank')}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all whitespace-nowrap"
        >
          Saber Mais
        </button>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-white">{filteredInstitutions.length}</span>{' '}
          {filteredInstitutions.length === 1 ? 'universidade encontrada' : 'universidades encontradas'}
        </p>
        {selections.size > 0 && (
          <p className="text-sm text-gold-medium font-bold">
            {selections.size}/{MAX_SELECTIONS} selecionadas
          </p>
        )}
      </div>

      {/* ── 7.4 Institution Cards ── */}
      {filteredInstitutions.length === 0 ? (
        <div className="text-center py-24 bg-white/[0.02] border border-dashed border-white/5 rounded-[2.5rem]">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-gray-700" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase">Nenhuma universidade encontrada</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
            Tente outros critérios de busca ou remova alguns filtros.
          </p>
          <button
            onClick={resetFilters}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-gold-medium font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
          >
            Resetar Filtros
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
                {selections.size} {selections.size === 1 ? 'universidade selecionada' : 'universidades selecionadas'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {MAX_SELECTIONS - selections.size} vaga(s) restante(s)
              </p>
            </div>
            <button
              onClick={() => setView('review')}
              className="flex items-center gap-2 px-8 py-4 bg-gold-medium hover:bg-gold-light text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.3)] transition-all active:scale-95"
            >
              Continuar
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
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">Finanças Migma</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[8px] text-gray-600 uppercase font-black">Original</p>
              <p className="text-xs text-gray-500 line-through font-bold">${stats.maxTuition.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gold-medium uppercase font-black">Com Bolsa</p>
              <p className="text-xs text-white font-black">${stats.displayTuition.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[8px] text-emerald-500 uppercase font-black">Desconto</p>
              <p className="text-xs text-emerald-400 font-black">{stats.displayDiscount}% OFF</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-600 uppercase font-black">Taxa Coloc.</p>
              <p className="text-xs text-gray-400 font-bold">${stats.displayPlacement.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Modalidade / CPT */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2">
            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-0.5">Modalidade</p>
            <p className="text-[11px] text-gray-200 font-black">{institution.modality}</p>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2">
            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-0.5">Trabalho</p>
            <p className="text-[11px] text-gray-200 font-black truncate">{institution.cpt_opt || 'CPT + OPT'}</p>
          </div>
        </div>

        {/* Scholarship Levels */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
            Níveis de Bolsa
          </p>

          {currentScholarshipId ? (
            /* Selected level display */
            (() => {
              const selected = scholarships.find(s => s.id === currentScholarshipId);
              if (!selected) return null;
              return (
                <div className="flex items-center justify-between bg-gold-medium/10 border border-gold-medium/30 rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-[9px] text-gold-medium/70 uppercase font-black tracking-widest mb-0.5">Nível selecionado</p>
                    <p className="text-lg font-black text-white leading-none">
                      ${selected.monthly_migma_usd}
                      <span className="text-[10px] text-gray-400 font-bold ml-1">/mês</span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Placement: <span className="text-gray-300 font-bold">${selected.placement_fee_usd.toLocaleString()}</span>
                      {' · '}
                      <span className="text-emerald-400 font-bold">{selected.discount_percent}% OFF</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
                    className="text-[9px] text-gold-medium/70 hover:text-gold-medium font-black uppercase tracking-widest transition-colors"
                  >
                    Trocar
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
                <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-0.5">A partir de</p>
                <p className="text-xl font-black text-white leading-none">
                  ${Math.min(...scholarships.map(s => s.monthly_migma_usd))}
                  <span className="text-[10px] text-gray-400 font-bold ml-1">/mês</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-emerald-600 uppercase font-black tracking-widest mb-0.5">Maior desconto</p>
                <p className="text-xl font-black text-emerald-400 leading-none">
                  {Math.max(...scholarships.map(s => s.discount_percent))}% OFF
                </p>
              </div>
            </button>
          )}

          <p className="text-center text-[9px] text-gray-600 font-medium">
            {scholarships.length} nível{scholarships.length !== 1 ? 'is' : ''} disponíve{scholarships.length !== 1 ? 'is' : 'l'} · ver detalhes para comparar
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
          Detalhes
        </button>
        <div className="w-px bg-white/5" />
        {isSelected ? (
          <button
            onClick={onRemove}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            Remover
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
            Selecionar
          </button>
        )}
      </div>
    </div>
  );
};
