/**
 * Perguntas do Questionário do Processo Seletivo — MIGMA v7
 *
 * 5 seções (A–E) conforme spec v7. Separado do formQuestions.ts legado.
 * A pergunta de "tipo de processo" foi REMOVIDA — determinada pela URL.
 * Perguntas exclusivas por serviço ficam em SERVICE_SPECIFIC_QUESTIONS.
 */

export type QuestionType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'radio'
  | 'multiselect'
  | 'yesno'
  | 'date'
  | 'checkbox';

export interface SurveyOption {
  label: string;
  value: string;
}

export interface SurveyQuestion {
  id: string;
  section: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  type: QuestionType;
  required: boolean;
  options?: SurveyOption[];
  /** For multiselect: exact number required (null = no restriction) */
  exactCount?: number;
  /** Prefill from user profile field */
  prefillFrom?: 'full_name' | 'email';
  /** Correct answer value(s) — for Seções D and E (quiz-style) */
  correct?: string;
  /** Informational description shown below the label */
  description?: string;
  /** Critical warning shown highlighted below the input */
  warning?: string;
}

export interface SurveySection {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  description: string;
}

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    key: 'A',
    title: 'Perfil e Preferências Acadêmicas',
    description: 'Conte-nos sobre seus objetivos e preferências para encontrarmos as melhores universidades para você.',
  },
  {
    key: 'B',
    title: 'Documentos e Linha do Tempo',
    description: 'Informações sobre sua documentação atual e disponibilidade de tempo.',
  },
  {
    key: 'C',
    title: 'Responsabilidade Financeira',
    description: 'Entendimento sobre os custos e responsabilidades financeiras do processo.',
  },
  {
    key: 'D',
    title: 'Regras do Visto F-1',
    description: 'Conhecimento básico sobre as regras do visto de estudante americano.',
  },
  {
    key: 'E',
    title: 'Mentalidade e Comprometimento',
    description: 'Seu compromisso com o processo e com a vida acadêmica nos EUA.',
  },
];

// ---------------------------------------------------------------------------
// Seção A — Perfil e Preferências Acadêmicas
// ---------------------------------------------------------------------------

const SECTION_A: SurveyQuestion[] = [
  {
    id: 'a_email',
    section: 'A',
    text: 'E-mail',
    type: 'email',
    required: true,
    prefillFrom: 'email',
  },
  {
    id: 'a_full_name',
    section: 'A',
    text: 'Nome completo',
    type: 'text',
    required: true,
    prefillFrom: 'full_name',
  },
  {
    id: 'a_formation',
    section: 'A',
    text: 'Tipo de formação buscada',
    type: 'radio',
    required: true,
    options: [
      { label: 'Certificate', value: 'certificate' },
      { label: 'Bacharelado', value: 'bachelor' },
      { label: 'Mestrado', value: 'master' },
    ],
  },
  {
    id: 'a_interest_areas',
    section: 'A',
    text: 'Áreas de interesse (escolha exatamente 2)',
    type: 'multiselect',
    required: true,
    exactCount: 2,
    options: [
      { label: 'Exatas & Tecnologia', value: 'stem' },
      { label: 'Negócios & Gestão', value: 'business' },
      { label: 'Humanas & Sociais', value: 'humanities' },
      { label: 'Saúde & Ciências', value: 'health' },
    ],
  },
  {
    id: 'a_class_frequency',
    section: 'A',
    text: 'Frequência das aulas preferida (escolha exatamente 2)',
    type: 'multiselect',
    required: true,
    exactCount: 2,
    options: [
      { label: '2x/ano (3 dias)', value: '2x_year' },
      { label: '4x/ano (4 dias)', value: '4x_year' },
      { label: '2x/semana', value: '2x_week' },
      { label: '4x/semana', value: '4x_week' },
    ],
  },
  {
    id: 'a_annual_investment',
    section: 'A',
    text: 'Faixa de investimento anual aceitável (escolha exatamente 2)',
    type: 'multiselect',
    required: true,
    exactCount: 2,
    options: [
      { label: 'Até $3.800/ano', value: 'up_to_3800' },
      { label: '$3.800 – $6.000/ano', value: '3800_6000' },
      { label: '$6.000 – $9.000/ano', value: '6000_9000' },
      { label: '$9.000 – $13.800/ano', value: '9000_13800' },
      { label: 'Acima de $13.800/ano', value: 'above_13800' },
    ],
  },
  {
    id: 'a_preferred_regions',
    section: 'A',
    text: 'Regiões de preferência nos EUA (escolha exatamente 3 estados)',
    type: 'multiselect',
    required: true,
    exactCount: 3,
    options: [
      { label: 'California', value: 'CA' },
      { label: 'Texas', value: 'TX' },
      { label: 'Florida', value: 'FL' },
      { label: 'New York', value: 'NY' },
      { label: 'Illinois', value: 'IL' },
      { label: 'Washington', value: 'WA' },
      { label: 'Georgia', value: 'GA' },
      { label: 'Massachusetts', value: 'MA' },
      { label: 'Arizona', value: 'AZ' },
      { label: 'Colorado', value: 'CO' },
      { label: 'Nevada', value: 'NV' },
      { label: 'Pennsylvania', value: 'PA' },
      { label: 'North Carolina', value: 'NC' },
      { label: 'Virginia', value: 'VA' },
      { label: 'Oregon', value: 'OR' },
    ],
  },
  {
    id: 'a_english_level',
    section: 'A',
    text: 'Nível de inglês atual',
    type: 'radio',
    required: true,
    options: [
      { label: 'Zero', value: 'zero' },
      { label: 'Básico', value: 'basic' },
      { label: 'Intermediário', value: 'intermediate' },
      { label: 'Avançado', value: 'advanced' },
      { label: 'Fluente', value: 'fluent' },
    ],
  },
  {
    id: 'a_studied_college',
    section: 'A',
    text: 'Já estudou em college ou universidade?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'a_main_objective',
    section: 'A',
    text: 'Objetivo principal com o programa',
    type: 'radio',
    required: true,
    options: [
      { label: 'Obter diploma americano', value: 'diploma' },
      { label: 'Melhorar o inglês e o currículo', value: 'english_career' },
      { label: 'Abrir caminho para imigração', value: 'immigration' },
      { label: 'Desenvolvimento profissional', value: 'professional' },
      { label: 'Outro', value: 'other' },
    ],
  },
  {
    id: 'a_weekly_availability',
    section: 'A',
    text: 'Disponibilidade mínima de estudo semanal',
    type: 'radio',
    required: true,
    options: [
      { label: 'Menos de 5 horas', value: 'less_5h' },
      { label: '5 a 10 horas', value: '5_10h' },
      { label: '10 a 20 horas', value: '10_20h' },
      { label: 'Mais de 20 horas', value: 'more_20h' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção B — Documentos e Linha do Tempo (Q11–Q17 MatriculaUSA)
// ---------------------------------------------------------------------------

const SECTION_B: SurveyQuestion[] = [
  {
    id: 'b_has_passport',
    section: 'B',
    text: 'Você tem passaporte válido?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'b_can_send_passport',
    section: 'B',
    text: 'Consegue enviar uma cópia do passaporte?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'b_has_education_proof',
    section: 'B',
    text: 'Tem comprovação de conclusão do ensino médio ou superior?',
    type: 'radio',
    required: true,
    options: [
      { label: 'Sim, consigo enviar', value: 'yes' },
      { label: 'Não', value: 'no' },
    ],
  },
  {
    id: 'b_can_organize_docs',
    section: 'B',
    text: 'Consegue organizar documentos em pasta online (Google Drive / Dropbox)?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'b_start_timeline',
    section: 'B',
    text: 'Em quanto tempo quer iniciar o programa?',
    type: 'radio',
    required: true,
    options: [
      { label: 'O mais rápido possível', value: 'asap' },
      { label: 'Em até 3 meses', value: '3_months' },
      { label: 'Em até 6 meses', value: '6_months' },
      { label: 'Em até 1 ano', value: '1_year' },
      { label: 'Mais de 1 ano', value: 'over_1_year' },
    ],
  },
  {
    id: 'b_can_interview',
    section: 'B',
    text: 'Pode participar de uma entrevista de alinhamento?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'b_understands_no_skip',
    section: 'B',
    text: 'Entende que pular etapas do processo atrasa o resultado?',
    type: 'yesno',
    required: true,
  },
];

// ---------------------------------------------------------------------------
// Seção C — Responsabilidade Financeira (Q27–Q29 MatriculaUSA)
// ---------------------------------------------------------------------------

const SECTION_C: SurveyQuestion[] = [
  {
    id: 'c_fees_difference',
    section: 'C',
    text: 'Entende que a tuition (mensalidade) e as taxas do processo seletivo são cobranças diferentes?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'c_scholarship_responsibility',
    section: 'C',
    text: 'Se tiver bolsa, ainda sou responsável por manter meu status ativo na universidade.',
    type: 'radio',
    required: true,
    options: [
      { label: 'Verdadeiro', value: 'true' },
      { label: 'Falso', value: 'false' },
    ],
  },
  {
    id: 'c_payment_method',
    section: 'C',
    text: 'Forma de pagamento com que tem mais facilidade',
    type: 'radio',
    required: true,
    options: [
      { label: 'À vista', value: 'cash' },
      { label: 'Parcelado no cartão', value: 'installments' },
      { label: 'Boleto / PIX', value: 'pix' },
      { label: 'Transferência internacional', value: 'wire' },
      { label: 'Outra', value: 'other' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção D — Regras do Visto F-1 (Q31–Q40 MatriculaUSA — múltipla escolha)
// ---------------------------------------------------------------------------

const SECTION_D: SurveyQuestion[] = [
  {
    id: 'd_f1_objective',
    section: 'D',
    text: 'O objetivo do visto F-1 é:',
    type: 'radio',
    required: true,
    correct: 'study_sevis',
    options: [
      { label: 'Trabalhar legalmente nos EUA', value: 'work' },
      { label: 'Estudar em instituição autorizada pelo SEVIS', value: 'study_sevis' },
      { label: 'Morar permanentemente nos EUA', value: 'permanent' },
      { label: 'Fazer turismo estendido', value: 'tourism' },
    ],
  },
  {
    id: 'd_i20_is',
    section: 'D',
    text: 'O I-20 é:',
    type: 'radio',
    required: true,
    correct: 'school_doc',
    options: [
      { label: 'Um visto americano', value: 'visa' },
      { label: 'Documento da escola que sustenta o status F-1', value: 'school_doc' },
      { label: 'Autorização de trabalho', value: 'work_auth' },
      { label: 'Um passaporte americano', value: 'passport' },
    ],
  },
  {
    id: 'd_maintain_status',
    section: 'D',
    text: 'Manter o status F-1 significa:',
    type: 'radio',
    required: true,
    correct: 'comply_rules',
    options: [
      { label: 'Não sair dos EUA', value: 'no_leave' },
      { label: 'Cumprir regras, frequência e obrigações da escola', value: 'comply_rules' },
      { label: 'Trabalhar em tempo integral', value: 'work_full' },
      { label: 'Renovar o visto anualmente', value: 'renew_visa' },
    ],
  },
  {
    id: 'd_miss_classes',
    section: 'D',
    text: 'Se faltar muito e parar de estudar, posso:',
    type: 'radio',
    required: true,
    correct: 'risk_status',
    options: [
      { label: 'Continuar nos EUA normalmente', value: 'stay_normal' },
      { label: 'Colocar meu status F-1 em risco', value: 'risk_status' },
      { label: 'Transferir automaticamente para outro visto', value: 'auto_transfer' },
      { label: 'Receber uma multa', value: 'fine' },
    ],
  },
  {
    id: 'd_critical_decisions',
    section: 'D',
    text: 'Para decisões críticas sobre meu status, devo:',
    type: 'radio',
    required: true,
    correct: 'consult_dso',
    options: [
      { label: 'Decidir por conta própria', value: 'self_decide' },
      { label: 'Consultar a escola / DSO', value: 'consult_dso' },
      { label: 'Ligar para o consulado', value: 'consulate' },
      { label: 'Perguntar a amigos com F-1', value: 'ask_friends' },
    ],
  },
  {
    id: 'd_cos_is',
    section: 'D',
    text: 'COS (Change of Status) é:',
    type: 'radio',
    required: true,
    correct: 'change_status_usa',
    options: [
      { label: 'Mudar de endereço nos EUA', value: 'change_address' },
      { label: 'Mudar de status de visto estando nos EUA', value: 'change_status_usa' },
      { label: 'Cancelar o visto atual', value: 'cancel_visa' },
      { label: 'Solicitar um visto de trabalho', value: 'work_visa' },
    ],
  },
  {
    id: 'd_transfer_is',
    section: 'D',
    text: 'Transfer é:',
    type: 'radio',
    required: true,
    correct: 'change_sevis',
    options: [
      { label: 'Transferir dinheiro para a escola', value: 'money' },
      { label: 'Trocar o SEVIS / I-20 de uma escola para outra', value: 'change_sevis' },
      { label: 'Mudar de estado nos EUA', value: 'change_state' },
      { label: 'Renovar o visto', value: 'renew' },
    ],
  },
  {
    id: 'd_initial_is',
    section: 'D',
    text: 'Initial é:',
    type: 'radio',
    required: true,
    correct: 'outside_usa',
    options: [
      { label: 'Processo para quem já está nos EUA com F-1', value: 'already_usa' },
      { label: 'Processo para quem está fora dos EUA e vai entrar com F-1', value: 'outside_usa' },
      { label: 'Processo de renovação de visto', value: 'renewal' },
      { label: 'Processo de cancelamento', value: 'cancel' },
    ],
  },
  {
    id: 'd_work_without_auth',
    section: 'D',
    text: 'Trabalhar sem autorização F-1 é:',
    type: 'radio',
    required: true,
    correct: 'serious_risk',
    options: [
      { label: 'Permitido se for por menos de 20h/semana', value: 'allowed_20h' },
      { label: 'Risco sério que pode prejudicar o status', value: 'serious_risk' },
      { label: 'Aceito durante as férias escolares', value: 'ok_vacation' },
      { label: 'Sem consequências', value: 'no_consequence' },
    ],
  },
  {
    id: 'd_confused_rule',
    section: 'D',
    text: 'Se estiver confuso sobre uma regra do F-1, devo:',
    type: 'radio',
    required: true,
    correct: 'ask_dso',
    options: [
      { label: 'Ignorar e agir', value: 'ignore' },
      { label: 'Perguntar oficialmente à escola / DSO', value: 'ask_dso' },
      { label: 'Pesquisar em fóruns online', value: 'forums' },
      { label: 'Esperar alguém avisar', value: 'wait' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção E — Mentalidade e Comprometimento (Q41–Q50 MatriculaUSA)
// ---------------------------------------------------------------------------

const SECTION_E: SurveyQuestion[] = [
  {
    id: 'e_professional_student',
    section: 'E',
    text: 'Ser um aluno profissional significa:',
    type: 'radio',
    required: true,
    correct: 'deadlines_attendance',
    options: [
      { label: 'Ter notas máximas em tudo', value: 'perfect_grades' },
      { label: 'Cumprir prazos, frequência, comunicação e consistência', value: 'deadlines_attendance' },
      { label: 'Nunca precisar de ajuda', value: 'no_help' },
      { label: 'Estudar mais de 40h por semana', value: 'study_40h' },
    ],
  },
  {
    id: 'e_avoid_missing_deadlines',
    section: 'E',
    text: 'Para não perder prazos nos EUA, o melhor hábito é:',
    type: 'radio',
    required: true,
    correct: 'calendar_email',
    options: [
      { label: 'Confiar na memória', value: 'memory' },
      { label: 'Calendário + lembretes + checar e-mail diariamente', value: 'calendar_email' },
      { label: 'Esperar a escola avisar', value: 'wait_school' },
      { label: 'Pedir para alguém lembrar', value: 'ask_someone' },
    ],
  },
  {
    id: 'e_difficulty_in_subject',
    section: 'E',
    text: 'Se tiver dificuldade em uma matéria, devo primeiro:',
    type: 'radio',
    required: true,
    correct: 'seek_tutor',
    options: [
      { label: 'Desistir da matéria', value: 'give_up' },
      { label: 'Buscar tutor / office hours / advisor cedo', value: 'seek_tutor' },
      { label: 'Esperar o semestre acabar', value: 'wait_semester' },
      { label: 'Pedir transferência de escola', value: 'transfer_school' },
    ],
  },
  {
    id: 'e_networking',
    section: 'E',
    text: 'Networking na universidade serve para:',
    type: 'radio',
    required: true,
    correct: 'opportunities',
    options: [
      { label: 'Fazer amigos para festas', value: 'parties' },
      { label: 'Abrir portas acadêmicas e profissionais dentro das regras', value: 'opportunities' },
      { label: 'Conseguir respostas de provas', value: 'exam_answers' },
      { label: 'Evitar estudar', value: 'avoid_study' },
    ],
  },
  {
    id: 'e_main_fail_reason',
    section: 'E',
    text: 'O que leva mais gente a falhar no programa:',
    type: 'radio',
    required: true,
    correct: 'inconsistency',
    options: [
      { label: 'Falta de dinheiro', value: 'money' },
      { label: 'Falta de consistência', value: 'inconsistency' },
      { label: 'Inglês insuficiente', value: 'english' },
      { label: 'Escola ruim', value: 'bad_school' },
    ],
  },
  {
    id: 'e_current_priority',
    section: 'E',
    text: 'Minha prioridade mais importante agora nesse processo é:',
    type: 'radio',
    required: true,
    options: [
      { label: 'Valor acessível', value: 'value' },
      { label: 'Flexibilidade de horários', value: 'flexibility' },
      { label: 'Autorização de trabalho', value: 'work_auth' },
      { label: 'Qualidade acadêmica', value: 'academic_quality' },
    ],
  },
  {
    id: 'e_accept_feedback',
    section: 'E',
    text: 'Aceita receber feedback e ser corrigido ao longo do processo?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'e_commitment_checkbox',
    section: 'E',
    text: 'Me comprometo a manter frequência, cumprir prazos e seguir as regras do visto F-1.',
    type: 'checkbox',
    required: true,
  },
  {
    id: 'e_study_plan',
    section: 'E',
    text: 'Descreva seu plano de estudo semanal (dias e horários disponíveis)',
    type: 'textarea',
    required: true,
  },
  {
    id: 'e_final_declaration',
    section: 'E',
    text: 'Declaração final de comprometimento (escreva com suas palavras)',
    type: 'textarea',
    required: true,
  },
];

// ---------------------------------------------------------------------------
// Perguntas exclusivas por serviço
// ---------------------------------------------------------------------------

export const SERVICE_SPECIFIC_QUESTIONS: Record<string, SurveyQuestion> = {
  transfer: {
    id: 'service_transfer_deadline',
    section: 'A',
    text: 'Qual é o seu prazo máximo de transferência?',
    type: 'date',
    required: true,
  },
  cos: {
    id: 'service_cos_i94_expiry',
    section: 'A',
    text: 'Quando vence o seu status / I-94?',
    type: 'date',
    required: true,
  },
};

// ---------------------------------------------------------------------------
// Export consolidado
// ---------------------------------------------------------------------------

export const ALL_QUESTIONS: SurveyQuestion[] = [
  ...SECTION_A,
  ...SECTION_B,
  ...SECTION_C,
  ...SECTION_D,
  ...SECTION_E,
];

export function getQuestionsForService(serviceType: string): SurveyQuestion[] {
  const base = [...ALL_QUESTIONS];
  const serviceQ = SERVICE_SPECIFIC_QUESTIONS[serviceType];
  if (serviceQ) {
    // Insert after a_weekly_availability in Section A
    const insertAfterIdx = base.findIndex(q => q.id === 'a_weekly_availability');
    base.splice(insertAfterIdx + 1, 0, serviceQ);
  }
  return base;
}

/** IDs das perguntas cujas respostas ficam em user_profiles (campos operacionais) */
export const OPERATIONAL_FIELD_MAP: Record<string, string> = {
  a_formation: 'academic_formation',
  a_interest_areas: 'interest_areas',
  a_class_frequency: 'class_frequency',
  a_annual_investment: 'annual_investment',
  a_preferred_regions: 'preferred_regions',
  a_english_level: 'english_level',
  a_main_objective: 'main_objective',
  a_weekly_availability: 'weekly_availability',
  service_transfer_deadline: 'transfer_deadline_date',
  service_cos_i94_expiry: 'cos_i94_expiry_date',
};
