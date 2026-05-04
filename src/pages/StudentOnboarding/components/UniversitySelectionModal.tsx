/**
 * UniversitySelectionModal — Spec V11 § 7.5
 * Coração da automação da mentoria. Seções 1-7.
 * NÃO salva no banco — chama onSelect(scholarshipId) para o pai gerenciar.
 */
import React, { useState, useMemo } from 'react';
import {
  X, Award, GraduationCap, Globe, CheckCircle2,
  Calculator, BookOpen, UserPlus, HelpCircle,
  ChevronDown, ChevronUp, MapPin, Briefcase, Shield, Info
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

export interface ScholarshipLevel {
  id: string;
  institution_id: string;
  course_id: string | null;
  scholarship_level: string | null;
  placement_fee_usd: number;
  discount_percent: number;
  tuition_annual_usd: number;
  monthly_migma_usd: number;
  installments_total: number;
}

export interface Course {
  id: string;
  institution_id: string;
  course_name: string;
  area: string;
  degree_level: string;
  duration_months: number | null;
  cpt_after_months: number | null;
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  modality: string;
  cpt_opt: string;
  application_fee_usd: number;
  bank_statement_min_usd: number;
  esl_flag: boolean;
  accepts_cos: boolean;
  accepts_transfer: boolean;
  highlight_badge?: string | null;
  logo_url?: string | null;
  courses: Course[];
  scholarships: ScholarshipLevel[];
}

interface Props {
  institution: Institution;
  preSelectedScholarshipId?: string | null;
  onClose: () => void;
  onSelect: (scholarshipId: string) => void;
}

const FAQ_ITEMS = [
  {
    qKey: 'student_onboarding.university_modal.faq_placement_q',
    aKey: 'student_onboarding.university_modal.faq_placement_a',
  },
  {
    qKey: 'student_onboarding.university_modal.faq_cpt_opt_q',
    aKey: 'student_onboarding.university_modal.faq_cpt_opt_a',
  },
  {
    qKey: 'student_onboarding.university_modal.faq_change_q',
    aKey: 'student_onboarding.university_modal.faq_change_a',
  },
  {
    qKey: 'student_onboarding.university_modal.faq_rejected_q',
    aKey: 'student_onboarding.university_modal.faq_rejected_a',
  },
];

const DEGREE_LEVEL_LABEL_KEYS: Record<string, string> = {
  'Graduação': 'student_onboarding.university_modal.degree_undergraduate',
  'Pós-Graduação': 'student_onboarding.university_modal.degree_postgraduate',
  'Mestrado': 'student_onboarding.university_modal.degree_masters',
};

const MODALITY_LABEL_KEYS: Record<string, string> = {
  'Híbrido': 'student_onboarding.university_modal.modality_hybrid',
  'Presencial': 'student_onboarding.university_modal.modality_in_person',
  'Híbrido ou Presencial': 'student_onboarding.university_modal.modality_hybrid_or_in_person',
  'A confirmar': 'student_onboarding.university_modal.to_confirm',
};

export const UniversitySelectionModal: React.FC<Props> = ({
  institution,
  preSelectedScholarshipId,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    institution.courses[0]?.id || null
  );
  
  const [selectedScholarshipId, setSelectedScholarshipId] = useState<string | null>(
    preSelectedScholarshipId ?? null
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Filtrar bolsas pelo curso selecionado
  const filteredScholarships = useMemo(() => {
    if (!selectedCourseId) return institution.scholarships;
    return institution.scholarships.filter(s => s.course_id === selectedCourseId || !s.course_id);
  }, [institution.scholarships, selectedCourseId]);

  const sortedScholarships = useMemo(
    () => [...filteredScholarships].sort((a, b) => a.placement_fee_usd - b.placement_fee_usd),
    [filteredScholarships]
  );

  const selectedCourse = useMemo(
    () => institution.courses.find(c => c.id === selectedCourseId) || institution.courses[0],
    [institution.courses, selectedCourseId]
  );

  const selectedScholarship = sortedScholarships.find(s => s.id === selectedScholarshipId) ?? null;

  const formatDegreeLevel = (value: string | null | undefined) => {
    if (!value) return t('student_onboarding.university_modal.to_confirm');
    const key = DEGREE_LEVEL_LABEL_KEYS[value];
    return key ? t(key) : value;
  };

  const formatModality = (value: string | null | undefined) => {
    if (!value) return t('student_onboarding.university_modal.to_confirm');
    const key = MODALITY_LABEL_KEYS[value];
    return key ? t(key) : value;
  };

  const formatScholarshipLevel = (value: string | null | undefined, discountPercent: number) => {
    if (!value) {
      return t('student_onboarding.university_modal.discount_percent', { percent: discountPercent });
    }

    const match = value.match(/^N[ií]vel\s+(\d+)(.*)$/i);
    if (!match) return value;

    return t('student_onboarding.university_modal.scholarship_level_named', {
      level: match[1],
      suffix: match[2] || '',
    });
  };

  const formatCptLabel = (value: string | null | undefined) => {
    if (!value) return t('student_onboarding.university_modal.to_confirm');
    if (value === 'A confirmar') return t('student_onboarding.university_modal.to_confirm');

    const firstDayMatch = value.match(/^1º dia(?:\s+\((.+)\))?$/i);
    if (firstDayMatch) {
      const degree = firstDayMatch[1] ? ` (${formatDegreeLevel(firstDayMatch[1])})` : '';
      return `${t('student_onboarding.university_modal.cpt_available_day_one')}${degree}`;
    }

    return value;
  };

  // Se mudar o curso e a bolsa selecionada não existir mais no filtro, deseleciona
  React.useEffect(() => {
    if (selectedScholarshipId && !sortedScholarships.some(s => s.id === selectedScholarshipId)) {
      setSelectedScholarshipId(null);
    }
  }, [selectedCourseId, sortedScholarships, selectedScholarshipId]);

  // Maior tuition (menor desconto) = preço "original"
  const maxTuition = useMemo(() => {
    if (sortedScholarships.length === 0) return 0;
    return Math.max(...sortedScholarships.map(s => s.tuition_annual_usd), 0);
  }, [sortedScholarships]);

  const mostPopularIdx = Math.floor(sortedScholarships.length / 2); // índice do meio

  // Calculadora de economia total
  const savingsInfo = useMemo(() => {
    if (!selectedScholarship) return null;
    const yearsRaw = selectedScholarship.installments_total / 12;
    const years = Math.round(yearsRaw) || 1;
    const annualSavings = maxTuition - selectedScholarship.tuition_annual_usd;
    const totalSavings = annualSavings * years;
    return { years, totalSavings, annualSavings };
  }, [selectedScholarship, maxTuition]);

  // First year cost estimate
  const firstYearEstimate = useMemo(() => {
    if (!selectedScholarship) return null;
    return (
      selectedScholarship.placement_fee_usd +
      institution.application_fee_usd +
      300 + // Orientation Day
      selectedScholarship.tuition_annual_usd
    );
  }, [selectedScholarship, institution]);

  // CPT label
  const cptLabel = useMemo(() => {
    if (!selectedCourse) return institution.cpt_opt;
    if (selectedCourse.cpt_after_months === 0) return t('student_onboarding.university_modal.cpt_available_day_one');
    if (selectedCourse.cpt_after_months) return t('student_onboarding.university_modal.cpt_available_after_months', { months: selectedCourse.cpt_after_months });
    return formatCptLabel(institution.cpt_opt);
  }, [institution, selectedCourse, t]);

  // Course duration label
  const durationLabel = useMemo(() => {
    if (!selectedCourse || !selectedCourse.duration_months) return null;
    const y = Math.round(selectedCourse.duration_months / 12);
    const level = formatDegreeLevel(selectedCourse.degree_level);
    return t('student_onboarding.university_modal.duration_years', {
      level,
      years: y,
      unit: y === 1 ? t('common.year', 'year') : t('common.years', 'years'),
    });
  }, [selectedCourse, t]);

  const handleSelect = () => {
    if (!selectedScholarshipId) return;
    onSelect(selectedScholarshipId);
    onClose();
  };

  const initial = institution.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden flex flex-col">

        {/* ── Seção 1 — Identificação ── */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-start gap-5 min-w-0">
            {/* Logo / initial */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
              {institution.logo_url ? (
                <img 
                  src={institution.logo_url} 
                  alt={institution.name} 
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-gold-medium font-black text-2xl select-none">
                  {initial}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                {institution.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="text-gray-500 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                  <MapPin className="w-3 h-3 text-gold-medium/40" />
                  {institution.city}, {institution.state}
                </span>
                <span className="text-gray-500 text-xs font-bold flex items-center gap-1 uppercase tracking-widest">
                  <Globe className="w-3 h-3 text-gold-medium/40" />
                  {formatModality(institution.modality)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                  {institution.accepts_transfer && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 tracking-widest">
                    {t('student_onboarding.university_modal.accepts_transfer')}
                  </span>
                )}
                {institution.accepts_cos && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 tracking-widest">
                    {t('student_onboarding.university_modal.accepts_cos')}
                  </span>
                )}
                {selectedCourse && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 tracking-widest">
                    {selectedCourse.course_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-all border border-white/5 ml-4 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-10">

          {/* ── Seção 1.5 — Seletor de Curso ── */}
          {institution.courses.length > 1 && (
            <section className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-gold-medium shrink-0" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                  {t('student_onboarding.university_modal.choose_course')}
                </h3>
              </div>
              <div className="relative group">
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="migma-select w-full"
                >
                  {institution.courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_name} — {formatDegreeLevel(course.degree_level)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-gold-medium pointer-events-none transition-all" />
              </div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                {t('student_onboarding.university_modal.course_note')}
              </p>
            </section>
          )}

          {/* ── Seção 2 — Escolha do Nível de Bolsa ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.choose_scholarship_level')}
              </h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
              <Trans
                i18nKey="student_onboarding.university_modal.scholarship_level_desc"
                components={{
                  gold: <span className="text-gold-medium font-bold" />,
                  strong: <span className="text-white font-bold" />,
                }}
              />
            </p>

            {sortedScholarships.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {t('student_onboarding.university_modal.no_scholarship_levels')}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-4 px-6 pb-1 text-[10px] text-gray-600 font-black uppercase tracking-widest">
                  <span>{t('student_onboarding.university_modal.placement_fee')}</span>
                  <span>{t('student_onboarding.university_modal.annual_tuition')}</span>
                  <span>{t('student_onboarding.university_modal.discount')}</span>
                  <span className="text-right">{t('student_onboarding.university_modal.select')}</span>
                </div>

                {sortedScholarships.map((level, idx) => {
                  const isSelected = selectedScholarshipId === level.id;
                  const isPopular = idx === mostPopularIdx;
                  return (
                    <div
                      key={level.id}
                      onClick={() => setSelectedScholarshipId(level.id)}
                      className={`relative grid grid-cols-2 sm:grid-cols-4 items-center gap-4 px-5 sm:px-6 py-5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-gold-medium bg-gold-medium/5 shadow-[0_0_30px_rgba(184,158,78,0.08)]'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-6 bg-emerald-500 text-black text-[9px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest">
                          {t('student_onboarding.university_modal.most_popular')}
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          {t('student_onboarding.university_modal.placement_fee')}
                        </p>
                        <p className={`text-lg font-black ${isSelected ? 'text-gold-medium' : 'text-gray-200'}`}>
                          ${level.placement_fee_usd.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          {t('student_onboarding.university_modal.annual_tuition')}
                        </p>
                        <p className="text-lg font-black text-white">
                          ${level.tuition_annual_usd.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          {t('student_onboarding.university_modal.discount')}
                        </p>
                        <p className="text-lg font-black text-emerald-400">
                          {formatScholarshipLevel(level.scholarship_level, level.discount_percent)}
                        </p>
                      </div>
                      <div className="flex justify-end items-center sm:col-start-4">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-gold-medium border-gold-medium' : 'border-white/10'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-black" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Calculadora de economia */}
            {savingsInfo && savingsInfo.totalSavings > 0 && (
              <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-5 py-4">
                <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">
                  <Trans
                    i18nKey="student_onboarding.university_modal.savings_sentence"
                    values={{
                      years: savingsInfo.years,
                      amount: `$${savingsInfo.totalSavings.toLocaleString()}`,
                    }}
                    components={{
                      years: <span className="font-black text-white" />,
                      amount: <span className="font-black text-emerald-400" />,
                    }}
                  />
                </p>
              </div>
            )}
          </section>

          {/* ── Seção 3 — Quanto vou pagar? ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Calculator className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.how_much_pay')}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* AGORA */}
              <div className="bg-gold-medium/8 border border-gold-medium/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gold-medium text-black flex items-center justify-center text-[10px] font-black">1</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold-medium">{t('student_onboarding.university_modal.now_confirm_seat')}</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    {selectedScholarship
                      ? `$${selectedScholarship.placement_fee_usd.toLocaleString()}`
                      : <span className="text-gray-600">{t('student_onboarding.university_modal.choose_level_above')}</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{t('student_onboarding.university_modal.placement_fee_guarantee')}</p>
                </div>
              </div>

              {/* APÓS ACEITE */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">2</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('student_onboarding.university_modal.after_acceptance_enroll')}</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    ${institution.application_fee_usd.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('student_onboarding.university_modal.i20_application_fee_desc')}
                    <span className="block text-gray-600 mt-0.5">{t('student_onboarding.university_modal.dependent_fee')}</span>
                  </p>
                </div>
              </div>

              {/* AO INICIAR */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">3</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('student_onboarding.university_modal.when_start_course')}</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between text-gray-300">
                    <span>{t('student_onboarding.university_modal.orientation_day')}</span>
                    <span className="font-bold">$300</span>
                  </li>
                  <li className="flex justify-between text-gray-400">
                    <span>{t('student_onboarding.university_modal.english_test')} <span className="text-gray-600">{t('student_onboarding.university_modal.if_applicable')}</span></span>
                    <span className="font-bold">$50</span>
                  </li>
                  <li className="flex justify-between text-gray-500 text-xs">
                    <span>{t('student_onboarding.university_modal.course_materials')}</span>
                    <span>{t('student_onboarding.university_modal.informed_by_university')}</span>
                  </li>
                </ul>
              </div>

              {/* ANUALMENTE */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">4</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('student_onboarding.university_modal.annually_tuition')}</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    {selectedScholarship
                      ? `$${selectedScholarship.tuition_annual_usd.toLocaleString()}`
                      : <span className="text-gray-600 text-xl">{t('student_onboarding.university_modal.choose_level')}</span>}
                    <span className="text-sm font-normal text-gray-500 ml-1">{t('student_onboarding.university_modal.per_year')}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('student_onboarding.university_modal.tuition_installments_desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Calculadora primeiro ano */}
            {firstYearEstimate && (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-gray-500 shrink-0" />
                  <p className="text-xs text-gray-400">{t('student_onboarding.university_modal.first_year_estimate')}</p>
                </div>
                <p className="text-xl font-black text-white">
                  ${firstYearEstimate.toLocaleString()}
                </p>
              </div>
            )}
          </section>

          {/* ── Seção 4 — Informações do Programa ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.program_info')}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-gold-medium/80">
                  {t('student_onboarding.university_modal.available_courses')}
                </h4>
                {institution.courses.length > 0 ? (
                  <ul className="space-y-1.5">
                    {institution.courses.map(c => (
                      <li key={c.id} className="text-sm text-gray-300 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/60 shrink-0" />
                        {c.course_name}
                        <span className="text-xs text-gray-600">— {formatDegreeLevel(c.degree_level)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">{t('student_onboarding.university_modal.to_confirm')}</p>
                )}
                {durationLabel && (
                  <p className="text-xs text-gray-500 border-t border-white/5 pt-3">{durationLabel}</p>
                )}
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-gold-medium/80">
                  {t('student_onboarding.university_modal.work_permission')}
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-white">CPT</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('student_onboarding.university_modal.cpt_desc', { cpt: cptLabel })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">OPT</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('student_onboarding.university_modal.opt_desc')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t('student_onboarding.university_modal.modality')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatModality(institution.modality)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Seção 5 — Requisitos ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.entry_requirements')}
              </h3>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <Trans i18nKey="student_onboarding.university_modal.req_gpa" components={{ strong: <strong className="text-white" /> }} />
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <Trans i18nKey="student_onboarding.university_modal.req_english" components={{ strong: <strong className="text-white" /> }} />
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <Trans i18nKey="student_onboarding.university_modal.req_documents" components={{ strong: <strong className="text-white" /> }} />
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <Trans
                      i18nKey="student_onboarding.university_modal.req_bank_statement"
                      values={{ amount: `$${institution.bank_statement_min_usd.toLocaleString()}` }}
                      components={{ strong: <strong className="text-white" /> }}
                    />
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* ── Seção 6 — FAQ Inline ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.faq_title')}
              </h3>
            </div>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]"
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.04] transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-bold text-white">{t(item.qKey)}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-gold-medium shrink-0 ml-3" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-3" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">
                    {t(item.aKey)}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* ── Seção 7 — Benefício por Indicação ── */}
          <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
              <UserPlus className="w-6 h-6 text-gold-medium" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">
                {t('student_onboarding.university_modal.referral_program')}
              </h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                <Trans
                  i18nKey="student_onboarding.university_modal.referral_desc"
                  components={{ strong: <strong className="text-white" /> }}
                />
              </p>
            </div>
          </div>

        </div>

        {/* ── Footer CTA ── */}
        <div className="p-6 sm:p-8 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <Briefcase className="w-4 h-4 text-gold-medium/40 shrink-0" />
            <span className="uppercase font-black tracking-widest leading-tight max-w-[160px]">
              {t('student_onboarding.university_modal.questions')}{' '}
              <span className="text-white normal-case font-medium tracking-normal">
                {t('student_onboarding.university_modal.talk_to_consultant')}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-4 text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-all"
            >
              {t('common.back', 'Back')}
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedScholarshipId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-10 py-4 bg-gold-medium hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.25)] transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('student_onboarding.university_modal.select_this_university')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
