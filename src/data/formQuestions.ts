export interface Option {
  label: string; // Use i18n key: selectionSurvey.questions.[id].options.[value]
  value: string;
  correct?: boolean | null;
  warning?: boolean;
}

export interface Question {
  id: number;
  section: string;
  sectionTitle: string; // Use i18n key: selectionSurvey.sections.[section]
  text: string; // Use i18n key: selectionSurvey.questions.[id].text
  type: 'text' | 'email' | 'textarea' | 'radio' | 'yesno' | 'truefalse' | 'date' | 'number';
  options?: Option[];
  required?: boolean;
  scored?: boolean;
  conditionalOn?: { questionId: number; value: string };
  extraFieldOn?: { value: string; label: string; type: 'text' | 'date' | 'number' }; // Use i18n key: selectionSurvey.questions.[id].extraLabel
  placeholder?: string; // Use i18n key: selectionSurvey.questions.[id].placeholder
  prompt?: string; // Use i18n key: selectionSurvey.questions.[id].prompt
}

export const sections = [
  { key: 'A', title: 'selectionSurvey.sections.A', range: [1, 10] },
  { key: 'B', title: 'selectionSurvey.sections.B', range: [11, 20] },
  { key: 'C', title: 'selectionSurvey.sections.C', range: [21, 30] },
  { key: 'D', title: 'selectionSurvey.sections.D', range: [31, 40] },
  { key: 'E', title: 'selectionSurvey.sections.E', range: [41, 50] },
];

export const questions: Question[] = [
  // Section A
  { id: 1, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.1.text', type: 'text', required: true, placeholder: 'selectionSurvey.questions.1.placeholder' },
  { id: 2, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.2.text', type: 'email', required: true, placeholder: 'selectionSurvey.questions.2.placeholder' },
  { id: 3, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.3.text', type: 'text', required: true, placeholder: 'selectionSurvey.questions.3.placeholder' },
  {
    id: 3.1, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.3_1.text', type: 'radio', required: true, scored: false,
    options: [
      { label: 'selectionSurvey.questions.3_1.options.engineering', value: 'engineering' },
      { label: 'selectionSurvey.questions.3_1.options.business', value: 'business' },
      { label: 'selectionSurvey.questions.3_1.options.computer-science', value: 'computer-science' },
      { label: 'selectionSurvey.questions.3_1.options.medicine', value: 'medicine' },
      { label: 'selectionSurvey.questions.3_1.options.law', value: 'law' },
      { label: 'selectionSurvey.questions.3_1.options.arts', value: 'arts' },
      { label: 'selectionSurvey.questions.3_1.options.sciences', value: 'sciences' },
      { label: 'selectionSurvey.questions.3_1.options.other', value: 'other' },
    ]
  },
  {
    id: 3.2, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.3_2.text', type: 'radio', required: true, scored: false,
    options: [
      { label: 'selectionSurvey.questions.3_2.options.high-school', value: 'high-school' },
      { label: 'selectionSurvey.questions.3_2.options.undergraduate', value: 'undergraduate' },
      { label: 'selectionSurvey.questions.3_2.options.graduate', value: 'graduate' },
      { label: 'selectionSurvey.questions.3_2.options.doctorate', value: 'doctorate' },
    ]
  },
  {
    id: 3.3, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.3_3.text', type: 'number', required: true, scored: false,
    placeholder: '0.0', prompt: '0.0 - 4.0'
  },
  {
    id: 4, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.4.text', type: 'yesno', required: true,
  },
  {
    id: 5, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.5.text', type: 'radio', required: true,
    options: [
      { label: 'selectionSurvey.questions.5.options.initial', value: 'initial', correct: null },
      { label: 'selectionSurvey.questions.5.options.cos', value: 'cos', correct: null },
      { label: 'selectionSurvey.questions.5.options.resident', value: 'resident', correct: null },
      { label: 'selectionSurvey.questions.5.options.transfer', value: 'transfer', correct: null },
      { label: 'selectionSurvey.questions.5.options.nao_sei', value: 'nao_sei', correct: null },
    ]
  },
  {
    id: 5.1, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.5_1.text', type: 'yesno', required: true, scored: false,
    conditionalOn: { questionId: 5, value: 'transfer' },
    options: [
      { label: 'selectionSurvey.questions.5_1.options.sim', value: 'sim', correct: null },
      { label: 'selectionSurvey.questions.5_1.options.nao', value: 'nao', correct: null },
    ]
  },
  {
    id: 6, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.6.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.6.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.6.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.6.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.6.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 7, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.7.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.7.options.a', value: 'a', correct: false },
      { label: 'selectionSurvey.questions.7.options.b', value: 'b', correct: false, warning: true },
      { label: 'selectionSurvey.questions.7.options.c', value: 'c', correct: true },
      { label: 'selectionSurvey.questions.7.options.d', value: 'd', correct: true },
    ]
  },
  {
    id: 8, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.8.text', type: 'radio', required: true, scored: false,
    options: [
      { label: 'selectionSurvey.questions.8.options.beginner', value: 'beginner' },
      { label: 'selectionSurvey.questions.8.options.intermediate', value: 'intermediate' },
      { label: 'selectionSurvey.questions.8.options.advanced', value: 'advanced' },
      { label: 'selectionSurvey.questions.8.options.native', value: 'native' },
      { label: 'selectionSurvey.questions.8.options.toefl', value: 'toefl' },
    ]
  },
  {
    id: 9, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.9.text', type: 'yesno', required: true,
    extraFieldOn: { value: 'Sim', label: 'selectionSurvey.questions.9.extraLabel', type: 'text' },
  },
  {
    id: 10, section: 'A', sectionTitle: 'selectionSurvey.sections.A', text: 'selectionSurvey.questions.10.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.10.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.10.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.10.options.c', value: 'c', correct: false },
    ]
  },

  // Section B
  {
    id: 11, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.11.text', type: 'yesno', required: true,
    extraFieldOn: { value: 'Não', label: 'selectionSurvey.questions.11.extraLabel', type: 'text' },
  },
  {
    id: 12, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.12.text', type: 'date',
    conditionalOn: { questionId: 11, value: 'Sim' },
  },
  {
    id: 13, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.13.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.13.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.13.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 14, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.14.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.14.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.14.options.b', value: 'b', correct: false, warning: true },
      { label: 'selectionSurvey.questions.14.options.c', value: 'c', correct: false },
    ]
  },
  {
    id: 15, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.15.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.15.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.15.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 16, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.16.text', type: 'radio', required: true,
    options: [
      { label: 'selectionSurvey.questions.16.options.a', value: 'a', correct: null },
      { label: 'selectionSurvey.questions.16.options.b', value: 'b', correct: null },
      { label: 'selectionSurvey.questions.16.options.c', value: 'c', correct: null },
      { label: 'selectionSurvey.questions.16.options.d', value: 'd', correct: null },
    ]
  },
  {
    id: 17, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.17.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.17.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.17.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 18, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.18.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.18.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.18.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 19, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.19.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.19.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.19.options.b', value: 'b', correct: false, warning: true },
      { label: 'selectionSurvey.questions.19.options.c', value: 'c', correct: false },
    ]
  },
  { id: 20, section: 'B', sectionTitle: 'selectionSurvey.sections.B', text: 'selectionSurvey.questions.20.text', type: 'text', required: true, placeholder: 'selectionSurvey.questions.20.placeholder' },

  // Section C
  {
    id: 21, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.21.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.21.options.a', value: 'a', correct: false },
      { label: 'selectionSurvey.questions.21.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.21.options.c', value: 'c', correct: true },
      { label: 'selectionSurvey.questions.21.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 22, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.22.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.22.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.22.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.22.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.22.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 23, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.23.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.23.options.a', value: 'a', correct: false },
      { label: 'selectionSurvey.questions.23.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.23.options.c', value: 'c', correct: true },
      { label: 'selectionSurvey.questions.23.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 24, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.24.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.24.options.a', value: 'a', correct: false },
      { label: 'selectionSurvey.questions.24.options.b', value: 'b', correct: true },
      { label: 'selectionSurvey.questions.24.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.24.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 25, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.25.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.25.options.a', value: 'a', correct: false },
      { label: 'selectionSurvey.questions.25.options.b', value: 'b', correct: true },
      { label: 'selectionSurvey.questions.25.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.25.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 26, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.26.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.26.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.26.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.26.options.c', value: 'c', correct: null, warning: true },
    ],
    extraFieldOn: { value: 'c', label: 'selectionSurvey.questions.26.extraLabel', type: 'number' },
  },
  {
    id: 27, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.27.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.27.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.27.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 28, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.28.text', type: 'truefalse', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.28.options.verdadeiro', value: 'verdadeiro', correct: true },
      { label: 'selectionSurvey.questions.28.options.falso', value: 'falso', correct: false },
    ]
  },
  {
    id: 29, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.29.text', type: 'radio', required: true,
    options: [
      { label: 'selectionSurvey.questions.29.options.a', value: 'a', correct: null },
      { label: 'selectionSurvey.questions.29.options.b', value: 'b', correct: null },
      { label: 'selectionSurvey.questions.29.options.c', value: 'c', correct: null },
    ]
  },
  { id: 30, section: 'C', sectionTitle: 'selectionSurvey.sections.C', text: 'selectionSurvey.questions.30.text', type: 'number', required: true, placeholder: 'selectionSurvey.questions.30.placeholder' },

  // Section D
  {
    id: 31, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.31.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.31.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.31.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.31.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.31.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 32, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.32.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.32.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.32.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.32.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.32.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 33, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.33.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.33.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.33.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.33.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.33.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 34, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.34.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.34.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.34.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.34.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.34.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 35, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.35.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.35.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.35.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.35.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.35.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 36, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.36.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.36.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.36.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.36.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.36.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 37, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.37.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.37.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.37.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.37.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.37.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 38, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.38.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.38.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.38.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.38.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.38.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 39, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.39.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.39.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.39.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.39.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.39.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 40, section: 'D', sectionTitle: 'selectionSurvey.sections.D', text: 'selectionSurvey.questions.40.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.40.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.40.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.40.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.40.options.d', value: 'd', correct: false },
    ]
  },

  // Section E
  {
    id: 41, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.41.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.41.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.41.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.41.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.41.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 42, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.42.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.42.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.42.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.42.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.42.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 43, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.43.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.43.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.43.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.43.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.43.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 44, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.44.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.44.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.44.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.44.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.44.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 45, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.45.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.45.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.45.options.b', value: 'b', correct: false },
      { label: 'selectionSurvey.questions.45.options.c', value: 'c', correct: false },
      { label: 'selectionSurvey.questions.45.options.d', value: 'd', correct: false },
    ]
  },
  {
    id: 46, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.46.text', type: 'radio', required: true,
    options: [
      { label: 'selectionSurvey.questions.46.options.a', value: 'a', correct: null },
      { label: 'selectionSurvey.questions.46.options.b', value: 'b', correct: null },
      { label: 'selectionSurvey.questions.46.options.c', value: 'c', correct: null },
    ]
  },
  {
    id: 47, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.47.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.47.options.a', value: 'a', correct: true },
      { label: 'selectionSurvey.questions.47.options.b', value: 'b', correct: false },
    ]
  },
  {
    id: 48, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.48.text', type: 'radio', required: true, scored: true,
    options: [
      { label: 'selectionSurvey.questions.48.options.concordo', value: 'concordo', correct: true },
      { label: 'selectionSurvey.questions.48.options.nao_concordo', value: 'nao_concordo', correct: false },
    ]
  },
  { id: 49, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.49.text', type: 'textarea', required: true, placeholder: 'selectionSurvey.questions.49.placeholder' },
  {
    id: 50, section: 'E', sectionTitle: 'selectionSurvey.sections.E', text: 'selectionSurvey.questions.50.text', type: 'textarea', required: true,
    prompt: 'selectionSurvey.questions.50.prompt',
    placeholder: 'selectionSurvey.questions.50.placeholder',
  },
];

export function calculateScore(answers: Record<number, string>): { score: number; total: number; percentage: number } {
  const scoredQuestions = questions.filter(q => q.scored && q.options);
  let correct = 0;
  const total = scoredQuestions.length;

  for (const q of scoredQuestions) {
    const answer = answers[q.id];
    if (!answer) continue;
    const selectedOption = q.options?.find(o => o.value === answer);
    if (selectedOption?.correct === true) correct++;
  }

  return { score: correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 };
}
