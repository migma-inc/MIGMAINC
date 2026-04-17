/**
 * UniversitySelectionModal — Spec V11 § 7.5
 * Coração da automação da mentoria. Seções 1-7.
 * NÃO salva no banco — chama onSelect(scholarshipId) para o pai gerenciar.
 */
import React, { useState, useMemo } from 'react';
import {
  X, Award, Clock, GraduationCap, Globe, CheckCircle2,
  Calculator, ExternalLink, BookOpen, UserPlus, HelpCircle,
  ChevronDown, ChevronUp, MapPin, Briefcase, Shield, Info
} from 'lucide-react';

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
    q: 'O que é Placement Fee?',
    a: 'É um investimento único que você faz para garantir sua bolsa e vaga na universidade. Quanto maior o Placement Fee pago agora, menor será sua tuition anual durante todo o curso — como uma compra antecipada de desconto.',
  },
  {
    q: 'O que é CPT e OPT?',
    a: 'CPT (Curricular Practical Training) é a autorização para trabalhar na sua área durante o curso, com vínculo ao currículo acadêmico. OPT (Optional Practical Training) é a autorização para trabalhar após a formatura — 1 ano padrão ou até 3 anos para cursos STEM.',
  },
  {
    q: 'Posso mudar de bolsa depois?',
    a: 'Não. A escolha do nível de bolsa é definitiva após a confirmação. Por isso, avalie cuidadosamente a calculadora de economia antes de confirmar.',
  },
  {
    q: 'O que acontece se eu não for aprovado?',
    a: 'Se você não for aceito em nenhuma universidade parceira Migma, a taxa do processo seletivo será totalmente reembolsada, conforme nossa Garantia de Reembolso.',
  },
];

export const UniversitySelectionModal: React.FC<Props> = ({
  institution,
  preSelectedScholarshipId,
  onClose,
  onSelect,
}) => {
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
    if (selectedCourse.cpt_after_months === 0) return 'disponível desde o 1º dia de aula';
    if (selectedCourse.cpt_after_months) return `disponível após ${selectedCourse.cpt_after_months} meses matriculado`;
    return institution.cpt_opt;
  }, [institution, selectedCourse]);

  // Course duration label
  const durationLabel = useMemo(() => {
    if (!selectedCourse || !selectedCourse.duration_months) return null;
    const y = Math.round(selectedCourse.duration_months / 12);
    const level = selectedCourse.degree_level === 'Graduação' ? 'Bacharelado' : selectedCourse.degree_level;
    return `${level} — ${y} ${y === 1 ? 'ano' : 'anos'}`;
  }, [selectedCourse]);

  const handleSelect = () => {
    if (!selectedScholarshipId) return;
    onSelect(selectedScholarshipId);
    onClose();
  };

  const initial = institution.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden flex flex-col">

        {/* ── Seção 1 — Identificação ── */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-start gap-5 min-w-0">
            {/* Logo / initial */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
              {institution.logo_url ? (
                <img 
                  src={institution.logo_url} 
                  alt={institution.name} 
                  className="max-h-[70%] max-w-[70%] object-contain"
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
                  {institution.modality}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {institution.accepts_transfer && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 tracking-widest">
                    Aceita Transfer
                  </span>
                )}
                {institution.accepts_cos && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 tracking-widest">
                    Aceita COS
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
                  Escolha seu Curso
                </h3>
              </div>
              <div className="relative group">
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-5 py-4 text-white font-bold appearance-none focus:outline-none focus:border-gold-medium/50 transition-all cursor-pointer"
                >
                  {institution.courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_name} — {course.degree_level}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-gold-medium pointer-events-none transition-all" />
              </div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                * As bolsas exibidas abaixo mudam conforme o curso selecionado.
              </p>
            </section>
          )}

          {/* ── Seção 2 — Escolha do Nível de Bolsa ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                Escolha seu Nível de Bolsa
              </h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
              Quanto maior o{' '}
              <span className="text-gold-medium font-bold">Placement Fee</span>{' '}
              que você paga agora, menor será sua{' '}
              <span className="text-white font-bold">tuition anual</span>{' '}
              durante todo o curso.
            </p>

            {sortedScholarships.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Nenhum nível de bolsa cadastrado para esta instituição.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-4 px-6 pb-1 text-[10px] text-gray-600 font-black uppercase tracking-widest">
                  <span>Placement Fee</span>
                  <span>Tuition Anual</span>
                  <span>Desconto</span>
                  <span className="text-right">Selecionar</span>
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
                          Mais Popular
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          Placement Fee
                        </p>
                        <p className={`text-lg font-black ${isSelected ? 'text-gold-medium' : 'text-gray-200'}`}>
                          ${level.placement_fee_usd.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          Tuition Anual
                        </p>
                        <p className="text-lg font-black text-white">
                          ${level.tuition_annual_usd.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5 sm:hidden">
                          Desconto
                        </p>
                        <p className="text-lg font-black text-emerald-400">
                          {level.scholarship_level || `${level.discount_percent}% OFF`}
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
                  Se você estudar{' '}
                  <span className="font-black text-white">{savingsInfo.years} anos</span>, você
                  economiza{' '}
                  <span className="font-black text-emerald-400">
                    ${savingsInfo.totalSavings.toLocaleString()}
                  </span>{' '}
                  comparado à tuition cheia.
                </p>
              </div>
            )}
          </section>

          {/* ── Seção 3 — Quanto vou pagar? ── */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <Calculator className="w-5 h-5 text-gold-medium shrink-0" />
              <h3 className="text-base font-black text-white uppercase tracking-widest">
                Quanto vou pagar?
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* AGORA */}
              <div className="bg-gold-medium/8 border border-gold-medium/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gold-medium text-black flex items-center justify-center text-[10px] font-black">1</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold-medium">Agora — Para confirmar sua vaga</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    {selectedScholarship
                      ? `$${selectedScholarship.placement_fee_usd.toLocaleString()}`
                      : <span className="text-gray-600">Escolha um nível acima</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Placement Fee — garante sua bolsa e vaga</p>
                </div>
              </div>

              {/* APÓS ACEITE */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">2</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Após Aceite — Para efetivar a matrícula</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    ${institution.application_fee_usd.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Taxa I-20 / Application Fee — obrigatória para emissão do I-20
                    <span className="block text-gray-600 mt-0.5">+$100 por dependente</span>
                  </p>
                </div>
              </div>

              {/* AO INICIAR */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">3</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ao Iniciar o Curso — Taxa única</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between text-gray-300">
                    <span>Orientation Day</span>
                    <span className="font-bold">$300</span>
                  </li>
                  <li className="flex justify-between text-gray-400">
                    <span>Teste de Inglês <span className="text-gray-600">(se aplicável)</span></span>
                    <span className="font-bold">$50</span>
                  </li>
                  <li className="flex justify-between text-gray-500 text-xs">
                    <span>Material didático</span>
                    <span>informado pela universidade</span>
                  </li>
                </ul>
              </div>

              {/* ANUALMENTE */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[10px] font-black">4</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Anualmente — Tuition</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">
                    {selectedScholarship
                      ? `$${selectedScholarship.tuition_annual_usd.toLocaleString()}`
                      : <span className="text-gray-600 text-xl">Escolha um nível</span>}
                    <span className="text-sm font-normal text-gray-500 ml-1">/ano</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Estruturado em 12 parcelas mensais pela universidade
                  </p>
                </div>
              </div>
            </div>

            {/* Calculadora primeiro ano */}
            {firstYearEstimate && (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-gray-500 shrink-0" />
                  <p className="text-xs text-gray-400">Investimento estimado no primeiro ano completo:</p>
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
                Informações do Programa
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-gold-medium/80">
                  Cursos Disponíveis
                </h4>
                {institution.courses.length > 0 ? (
                  <ul className="space-y-1.5">
                    {institution.courses.map(c => (
                      <li key={c.id} className="text-sm text-gray-300 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold-medium/60 shrink-0" />
                        {c.course_name}
                        <span className="text-xs text-gray-600">— {c.degree_level}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">A confirmar</p>
                )}
                {durationLabel && (
                  <p className="text-xs text-gray-500 border-t border-white/5 pt-3">{durationLabel}</p>
                )}
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-gold-medium/80">
                  Permissão de Trabalho
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-white">CPT</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Autorização para trabalhar durante o curso — {cptLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">OPT</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Autorização pós-formatura: 1 ano padrão (3 anos para cursos STEM)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Modalidade</p>
                    <p className="text-xs text-gray-400 mt-0.5">{institution.modality}</p>
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
                Requisitos de Entrada
              </h3>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">GPA mínimo 2.0</strong> — histórico escolar ou
                    equivalente (conforme avaliação da universidade)
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Proficiência em inglês</strong> — TOEFL, IELTS,
                    Duolingo ou entrevista com o diretor acadêmico
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Documentação</strong> — passaporte válido,
                    diploma(s) e histórico(s) escolar(es) anteriores
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-gold-medium shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Bank Statement</strong> — comprovante de
                    ${institution.bank_statement_min_usd.toLocaleString()} mínimo
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
                Perguntas Frequentes
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
                  <span className="text-sm font-bold text-white">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-gold-medium shrink-0 ml-3" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-3" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
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
                Programa de Indicação
              </h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Indique <strong className="text-white">10 pessoas efetivadas</strong> e sua tuition
                cai para{' '}
                <strong className="text-white">$3.800/ano</strong> pelo restante do curso — uma
                economia enorme ao longo dos anos.
              </p>
            </div>
          </div>

        </div>

        {/* ── Footer CTA ── */}
        <div className="p-6 sm:p-8 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <Briefcase className="w-4 h-4 text-gold-medium/40 shrink-0" />
            <span className="uppercase font-black tracking-widest leading-tight max-w-[160px]">
              Dúvidas?{' '}
              <span className="text-white normal-case font-medium tracking-normal">
                Fale com seu consultor
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-4 text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-all"
            >
              Voltar
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedScholarshipId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-10 py-4 bg-gold-medium hover:bg-gold-light disabled:opacity-30 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(184,158,78,0.25)] transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Selecionar esta Universidade
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
