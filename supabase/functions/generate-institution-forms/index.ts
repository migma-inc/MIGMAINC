import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "npm:pdf-lib@^1.17.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Form type catalogues ─────────────────────────────────────────────────────

const CAROLINE_FORMS = [
  "application_for_admission",
  "i20_request_form",
  "letter_of_recommendation",       // external signer
  "affidavit_of_financial_support",  // conditional on sponsor
  "tuition_refund_policy",
  "statement_of_institutional_purpose",
  "scholarship_support_compliance_agreement",
  "termo_responsabilidade_estudante", // internal only — never sent to university
] as const;

const OIKOS_FORMS = [
  "application_for_admission",
  "i20_request_form",
  "letter_of_recommendation",       // external signer
  "affidavit_of_financial_support",  // conditional on sponsor
  "enrollment_agreement",
  "statement_of_institutional_purpose",
  "statement_of_faith",
  "code_of_conduct",
  "refund_policy",
  "agreement_to_complete_mandatory_intensives",
  "christian_faith_statement",       // client edits rascunho
  "termo_responsabilidade_estudante", // internal only
] as const;

type FormType = typeof CAROLINE_FORMS[number] | typeof OIKOS_FORMS[number];

// ─── Form display names ───────────────────────────────────────────────────────

const FORM_LABELS: Record<string, string> = {
  application_for_admission:                  "Application for Admission",
  i20_request_form:                           "I-20 Request Form",
  letter_of_recommendation:                   "Letter of Recommendation",
  affidavit_of_financial_support:             "Affidavit of Financial Support",
  tuition_refund_policy:                      "Tuition Refund Policy",
  statement_of_institutional_purpose:         "Statement of Institutional Purpose",
  scholarship_support_compliance_agreement:   "Scholarship Support & Compliance Agreement",
  enrollment_agreement:                       "Enrollment Agreement",
  statement_of_faith:                         "Statement of Faith",
  code_of_conduct:                            "Code of Conduct",
  refund_policy:                              "Refund Policy",
  agreement_to_complete_mandatory_intensives: "Agreement to Complete Mandatory Intensives",
  christian_faith_statement:                  "Christian Faith Statement",
  termo_responsabilidade_estudante:           "Termo de Responsabilidade do Estudante",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplementalData {
  emergency_contact?: {
    name?: string;
    phone?: string;
    relationship?: string;
    address?: string;
  };
  has_sponsor?: boolean;
  sponsor?: {
    full_name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
    employer?: string;
    position?: string;
    years_employed?: number;
    annual_income_usd?: string;
    committed_amount_usd?: number;
  };
  work_experience?: Array<{ company?: string; period?: string; position?: string }>;
  recommenders?: Array<{ name?: string; position?: string; contact?: string }>;
  preferred_start_term?: string;
}

interface Payload {
  application_id: string;
  supplemental_data?: SupplementalData;
}

// ─── PDF builder helpers ──────────────────────────────────────────────────────

const A4_W = 595;
const A4_H = 842;
const MARGIN = 50;
const LINE_H = 18;
const SECTION_GAP = 10;

interface DrawCtx {
  page: PDFPage;
  doc: PDFDocument;
  fontBold: PDFFont;
  fontReg: PDFFont;
  y: number;
}

function addPage(ctx: DrawCtx): DrawCtx {
  const page = ctx.doc.addPage([A4_W, A4_H]);
  page.drawRectangle({ x: MARGIN, y: A4_H - 26, width: A4_W - MARGIN * 2, height: 18, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("MIGMA INC - continuacao", { x: MARGIN + 6, y: A4_H - 19, size: 8, font: ctx.fontReg, color: rgb(1, 1, 1) });
  return { ...ctx, page, y: A4_H - 46 };
}

function ensureSpace(ctx: DrawCtx, needed = 60): DrawCtx {
  return ctx.y < MARGIN + needed ? addPage(ctx) : ctx;
}

function drawText(ctx: DrawCtx, text: string, size = 10, isBold = false, indent = 0): DrawCtx {
  ctx = ensureSpace(ctx, LINE_H * 2);
  ctx.page.drawText(text, {
    x: MARGIN + indent,
    y: ctx.y,
    size,
    font: isBold ? ctx.fontBold : ctx.fontReg,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: A4_W - MARGIN * 2 - indent,
  });
  return { ...ctx, y: ctx.y - LINE_H };
}

function drawLine(ctx: DrawCtx): DrawCtx {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 4 },
    end:   { x: A4_W - MARGIN, y: ctx.y + 4 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  return { ...ctx, y: ctx.y - SECTION_GAP };
}

function drawField(ctx: DrawCtx, label: string, value: string | undefined | null): DrawCtx {
  const val = value ?? "-";
  ctx = drawText(ctx, label + ":", 9, true);
  ctx = drawText(ctx, val, 10, false, 12);
  return { ...ctx, y: ctx.y - 4 };
}

function drawSectionHeader(ctx: DrawCtx, title: string): DrawCtx {
  ctx = ensureSpace(ctx, LINE_H * 4);
  ctx = { ...ctx, y: ctx.y - 6 };
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 2,
    width: A4_W - MARGIN * 2,
    height: LINE_H + 4,
    color: rgb(0.15, 0.15, 0.15),
  });
  ctx.page.drawText(title, {
    x: MARGIN + 6,
    y: ctx.y,
    size: 10,
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  return { ...ctx, y: ctx.y - LINE_H - 8 };
}

async function buildHeader(
  ctx: DrawCtx,
  institutionName: string,
  formLabel: string,
  profileName: string,
  generatedAt: string,
): Promise<DrawCtx> {
  // Logo area placeholder
  ctx.page.drawRectangle({ x: MARGIN, y: A4_H - 70, width: 80, height: 40, color: rgb(0.1, 0.1, 0.1) });
  ctx.page.drawText("MIGMA INC", { x: MARGIN + 8, y: A4_H - 45, size: 11, font: ctx.fontBold, color: rgb(1, 1, 1) });

  ctx.page.drawText(institutionName, { x: MARGIN + 100, y: A4_H - 40, size: 12, font: ctx.fontBold, color: rgb(0.1, 0.1, 0.1) });
  ctx.page.drawText(formLabel, { x: MARGIN + 100, y: A4_H - 56, size: 10, font: ctx.fontReg, color: rgb(0.3, 0.3, 0.3) });

  ctx.page.drawText(`Candidato: ${profileName}`, { x: A4_W - 230, y: A4_H - 40, size: 9, font: ctx.fontReg, color: rgb(0.4, 0.4, 0.4) });
  ctx.page.drawText(`Gerado em: ${generatedAt}`, { x: A4_W - 230, y: A4_H - 52, size: 9, font: ctx.fontReg, color: rgb(0.4, 0.4, 0.4) });

  ctx.page.drawLine({ start: { x: MARGIN, y: A4_H - 75 }, end: { x: A4_W - MARGIN, y: A4_H - 75 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });

  return { ...ctx, y: A4_H - 95 };
}

// ─── Form data builders ───────────────────────────────────────────────────────

function buildFormData(
  formType: string,
  profile: Record<string, any>,
  institution: Record<string, any>,
  scholarship: Record<string, any> | null,
  course: Record<string, any> | null,
  survey: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): Record<string, any> {
  // §11.3 field mapping — user_identity is source of truth for personal data
  const addressUsa = identity?.address
    ? `${identity.address}, ${identity.city ?? ""}, ${identity.state ?? ""} ${identity.zip_code ?? ""}`.trim().replace(/,\s*$/, "")
    : null;

  const base = {
    full_name:          profile.full_name,
    email:              profile.email,
    phone:              profile.phone ?? profile.whatsapp,
    date_of_birth:      identity?.birth_date ?? null,
    marital_status:     identity?.marital_status ?? null,
    nationality:        identity?.nationality ?? identity?.country ?? null,
    address_usa:        addressUsa,
    address_brazil:     supplemental.emergency_contact?.address ?? null, // fallback until field exists
    visa_type:          profile.service_type === "cos" ? "F-1 (COS)" : "F-1 (Transfer)",
    process_type:       profile.student_process_type ?? profile.service_type,
    course_name:        course?.course_name,
    degree_level:       course?.degree_level,
    gender:             survey?.answers?.gender ?? null,         // not in user_identity yet
    birthplace_city:    survey?.answers?.birthplace_city ?? null,
    birthplace_country: survey?.answers?.birthplace_country ?? null,
    how_found_us:       "Brant Immigration",  // §11.3 — always this value
    preferred_start:    supplemental.preferred_start_term ?? null,
    num_dependents:     profile.num_dependents,
    emergency_contact:  supplemental.emergency_contact,
  };

  switch (formType) {
    case "application_for_admission":
      return { ...base, institution_name: institution.name, institution_city: institution.city };

    case "i20_request_form":
      return { ...base, institution_name: institution.name };

    case "letter_of_recommendation":
      return {
        candidate_name: profile.full_name,
        institution_name: institution.name,
        course_name: course?.course_name,
        recommenders: supplemental.recommenders ?? [],
        instruction: "Este documento deve ser preenchido pelo recomendante e devolvido ao candidato para inclusão no pacote.",
      };

    case "affidavit_of_financial_support":
      return {
        ...base,
        has_sponsor: supplemental.has_sponsor,
        sponsor: supplemental.sponsor,
        tuition_annual_usd: scholarship?.tuition_annual_usd,
      };

    case "scholarship_support_compliance_agreement":
      return {
        ...base,
        agency: "MIGMA INC",   // §11.3 — always forced
        institution_name: institution.name,
        scholarship_level: scholarship?.scholarship_level,
        discount_percent: scholarship?.discount_percent,
        placement_fee_usd: scholarship?.placement_fee_usd,
        authorized_representative: "Migma Inc Representative",
      };

    case "enrollment_agreement":
      return {
        ...base,
        institution_name: institution.name,
        tuition_annual_usd: scholarship?.tuition_annual_usd,
        course_name: course?.course_name,
        degree_level: course?.degree_level,
        monthly_migma_usd: scholarship?.monthly_migma_usd,
        installments_total: scholarship?.installments_total,
      };

    case "termo_responsabilidade_estudante":
      return {
        ...base,
        institution_name: institution.name,
        service_type: profile.student_process_type,
        internal_only: true,
        note: "DOCUMENTO INTERNO — Nunca enviado à universidade.",
      };

  default:
      return { ...base, institution_name: institution.name };
  }
}

function drawFieldGroup(
  ctx: DrawCtx,
  title: string,
  fields: Array<[string, string | undefined | null]>,
): DrawCtx {
  ctx = drawSectionHeader(ctx, title);
  for (const [label, value] of fields) {
    ctx = drawField(ctx, label, value);
  }
  return ctx;
}

function drawClauseLines(ctx: DrawCtx, title: string, lines: string[]): DrawCtx {
  ctx = drawSectionHeader(ctx, title);
  for (const line of lines) {
    ctx = drawText(ctx, `- ${line}`, 9, false, 4);
  }
  return ctx;
}

// ─── PDF generator ────────────────────────────────────────────────────────────

async function generateFormPdf(
  formType: string,
  formData: Record<string, any>,
  institutionName: string,
  profileName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([A4_W, A4_H]);

  let ctx: DrawCtx = { page, doc, fontBold, fontReg, y: A4_H - 50 };

  const formLabel = FORM_LABELS[formType] ?? formType;
  const now = new Date().toLocaleDateString("pt-BR");

  ctx = await buildHeader(ctx, institutionName, formLabel, profileName, now);

  // Internal document warning
  if (formData.internal_only) {
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 4, width: A4_W - MARGIN * 2, height: LINE_H + 4, color: rgb(1, 0.9, 0.8) });
    ctx.page.drawText("[!] DOCUMENTO INTERNO - NAO ENVIAR A UNIVERSIDADE", {
      x: MARGIN + 8, y: ctx.y, size: 9, font: fontBold, color: rgb(0.7, 0.3, 0),
    });
    ctx = { ...ctx, y: ctx.y - LINE_H - 10 };
  }

  switch (formType) {
    case "application_for_admission":
      ctx = drawClauseLines(ctx, "Application Overview", [
        "Este formulario consolida os dados basicos do candidato para admissao.",
        "Campos academicos e de visto seguem o cadastro e o processo selecionado.",
      ]);
      ctx = drawFieldGroup(ctx, "Dados Pessoais", [
        ["Nome Completo", formData.full_name],
        ["Email", formData.email],
        ["Telefone", formData.phone],
        ["Data de Nascimento", formData.date_of_birth],
        ["Gênero", formData.gender],
        ["Naturalidade", formData.birthplace_city ? `${formData.birthplace_city}, ${formData.birthplace_country}` : null],
        ["Nacionalidade", formData.nationality],
        ["Estado Civil", formData.marital_status],
        ["Nº de Dependentes", formData.num_dependents != null ? String(formData.num_dependents) : null],
      ]);
      ctx = drawFieldGroup(ctx, "Endereços", [
        ["Endereço nos EUA", formData.address_usa],
        ["Endereço no Brasil", formData.address_brazil],
      ]);
      ctx = drawFieldGroup(ctx, "Processo Acadêmico", [
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Nível", formData.degree_level],
        ["Tipo de Visto", formData.visa_type],
        ["Tipo de Processo", formData.process_type],
        ["Início Preferido", formData.preferred_start],
        ["Como conheceu", formData.how_found_us],
      ]);
      break;

    case "i20_request_form":
      ctx = drawClauseLines(ctx, "I-20 Request", [
        "Formulario usado para consolidar os dados do aluno para emissao do I-20.",
        "A leitura prioriza identidade, endereco nos EUA e dados de processo.",
      ]);
      ctx = drawFieldGroup(ctx, "Dados do Candidato", [
        ["Nome Completo", formData.full_name],
        ["Email", formData.email],
        ["Telefone", formData.phone],
        ["Data de Nascimento", formData.date_of_birth],
        ["Nacionalidade", formData.nationality],
        ["Estado Civil", formData.marital_status],
        ["Gênero", formData.gender],
        ["Naturalidade", formData.birthplace_city ? `${formData.birthplace_city}, ${formData.birthplace_country}` : null],
      ]);
      ctx = drawFieldGroup(ctx, "Dados do SEVIS", [
        ["Tipo de Visto", formData.visa_type],
        ["Tipo de Processo", formData.process_type],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Nível", formData.degree_level],
        ["Endereço nos EUA", formData.address_usa],
        ["Início Preferido", formData.preferred_start],
      ]);
      ctx = drawFieldGroup(ctx, "Referência do Processo", [
        ["Como conheceu", formData.how_found_us],
        ["Nº de Dependentes", formData.num_dependents != null ? String(formData.num_dependents) : null],
      ]);
      break;

    case "letter_of_recommendation":
      ctx = drawClauseLines(ctx, "Instruction", [
        "Este documento deve ser preenchido pelo recomendante e devolvido ao candidato.",
        "Use os dados do candidato abaixo como referência.",
      ]);
      ctx = drawFieldGroup(ctx, "Candidate", [
        ["Nome do Candidato", formData.candidate_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
      ]);
      if (Array.isArray(formData.recommenders) && formData.recommenders.length > 0) {
        ctx = drawSectionHeader(ctx, "Recomendantes");
        formData.recommenders.forEach((r: any, i: number) => {
          ctx = drawField(ctx, `Recomendante ${i + 1}`, r.name ? `${r.name} — ${r.position ?? ""} — ${r.contact ?? ""}` : null);
        });
      } else {
        ctx = drawText(ctx, "Nao ha recomendantes cadastrados ainda.", 9, false);
      }
      break;

    case "affidavit_of_financial_support":
      ctx = drawClauseLines(ctx, "Financial Support", [
        "O sponsor comprova que assume a responsabilidade financeira do aluno.",
        "Se nao houver sponsor, o documento deve permanecer pendente.",
      ]);
      ctx = drawFieldGroup(ctx, "Dados do Estudante", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Tuition Anual (USD)", formData.tuition_annual_usd ? `$${formData.tuition_annual_usd}` : null],
      ]);
      if (formData.has_sponsor && formData.sponsor) {
        const sponsor = formData.sponsor;
        ctx = drawFieldGroup(ctx, "Dados do Sponsor Financeiro", [
          ["Nome", sponsor.full_name],
          ["Relacionamento", sponsor.relationship],
          ["Telefone", sponsor.phone],
          ["Empregador", sponsor.employer],
          ["Cargo", sponsor.position],
          ["Anos no emprego", sponsor.years_employed != null ? String(sponsor.years_employed) : null],
          ["Renda anual", sponsor.annual_income_usd],
          ["Valor anual comprometido (USD)", sponsor.committed_amount_usd != null ? `$${sponsor.committed_amount_usd}` : null],
        ]);
      } else {
        ctx = drawText(ctx, "Sponsor nao informado no momento.", 9, false);
      }
      break;

    case "scholarship_support_compliance_agreement":
      ctx = drawClauseLines(ctx, "Scholarship Agreement", [
        "A agency e sempre preenchida como MIGMA INC.",
        "O representante autorizado e assinado pela Migma.",
        "Este formulario registra os termos da bolsa e compliance.",
      ]);
      ctx = drawFieldGroup(ctx, "Resumo da Bolsa", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Scholarship Level", formData.scholarship_level],
        ["Discount Percent", formData.discount_percent ? `${formData.discount_percent}%` : null],
        ["Placement Fee (USD)", formData.placement_fee_usd ? `$${formData.placement_fee_usd}` : null],
      ]);
      ctx = drawFieldGroup(ctx, "Assinatura Migma", [
        ["Agency", "MIGMA INC"],
        ["Authorized Rep.", formData.authorized_representative],
      ]);
      break;

    case "enrollment_agreement":
      ctx = drawClauseLines(ctx, "Enrollment Agreement", [
        "Este contrato resume os termos de matricula, tuition e parcelas.",
        "Os campos financeiros seguem o scholarship associado ao processo.",
      ]);
      ctx = drawFieldGroup(ctx, "Dados Academicos", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Nivel", formData.degree_level],
      ]);
      ctx = drawFieldGroup(ctx, "Termos Financeiros", [
        ["Tuition Anual (USD)", formData.tuition_annual_usd ? `$${formData.tuition_annual_usd}` : null],
        ["Mensalidade Migma (USD)", formData.monthly_migma_usd ? `$${formData.monthly_migma_usd}` : null],
        ["Parcelas Totais", formData.installments_total != null ? String(formData.installments_total) : null],
      ]);
      break;

    case "statement_of_institutional_purpose":
      ctx = drawClauseLines(ctx, "Statement of Institutional Purpose", [
        "Documento de declaracao de proposito institucional preenchido com dados do candidato.",
        "O texto base e adaptado para a instituicao e o curso selecionados.",
      ]);
      ctx = drawFieldGroup(ctx, "Resumo", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Nivel", formData.degree_level],
        ["Data de Nascimento", formData.date_of_birth],
      ]);
      break;

    case "statement_of_faith":
      ctx = drawClauseLines(ctx, "Statement of Faith", [
        "O candidato confirma sua trajetoria de fe e alinhamento institucional.",
        "O documento e adaptado com nome, curso e data atual.",
      ]);
      ctx = drawFieldGroup(ctx, "Identificação", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
      ]);
      break;

    case "code_of_conduct":
      ctx = drawClauseLines(ctx, "Code of Conduct", [
        "O candidato confirma que leu e aceita o codigo de conduta.",
        "Os itens listados abaixo sao a base do documento gerado.",
      ]);
      ctx = drawFieldGroup(ctx, "Identificação", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
      ]);
      ctx = drawClauseLines(ctx, "Compromissos", [
        "Respeitar regras academicas e de convivencia.",
        "Manter comunicacao com a instituicao e com a Migma.",
      ]);
      break;

    case "refund_policy":
      ctx = drawClauseLines(ctx, "Refund Policy", [
        "O candidato declara ciencia da politica de reembolso.",
        "Este documento serve como comprovante de aceite das regras financeiras.",
      ]);
      ctx = drawFieldGroup(ctx, "Identificação", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
      ]);
      break;

    case "agreement_to_complete_mandatory_intensives":
      ctx = drawClauseLines(ctx, "Mandatory Intensives Agreement", [
        "O candidato concorda em cumprir os intensivos obrigatorios da instituicao.",
        "As datas e cargas sao vinculadas ao calendario academico.",
      ]);
      ctx = drawFieldGroup(ctx, "Identificação", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
      ]);
      break;

    case "christian_faith_statement":
      ctx = drawClauseLines(ctx, "Christian Faith Statement", [
        "Rascunho base gerado pela IA para revisao e edicao do candidato.",
        "O texto final deve ser ajustado antes da assinatura.",
      ]);
      ctx = drawFieldGroup(ctx, "Identificação", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
      ]);
      ctx = drawText(ctx, "Espaco para o candidato complementar sua declaracao de fe.", 9, false);
      break;

    case "termo_responsabilidade_estudante":
      ctx = drawClauseLines(ctx, "Termo de Responsabilidade do Estudante", [
        "DOCUMENTO INTERNO - nunca deve ser enviado para a universidade.",
        "Serve apenas para registro e responsabilidade operacional da Migma.",
      ]);
      ctx = drawFieldGroup(ctx, "Resumo Interno", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Tipo de Processo", formData.process_type],
      ]);
      break;

    default:
      ctx = drawClauseLines(ctx, "Documento", [
        "Formulario gerado a partir do cadastro do aluno e da instituicao.",
      ]);
      ctx = drawFieldGroup(ctx, "Resumo", [
        ["Nome Completo", formData.full_name],
        ["Instituição", formData.institution_name],
        ["Curso", formData.course_name],
        ["Tipo de Processo", formData.process_type],
      ]);
      break;
  }

  if (formData.emergency_contact) {
    const ec = formData.emergency_contact;
    ctx = drawFieldGroup(ctx, "Contato de Emergência", [
      ["Nome", ec.name],
      ["Telefone", ec.phone],
      ["Relacionamento", ec.relationship],
      ["Endereço", ec.address],
    ]);
  }

  // Signature area
  ctx = { ...ctx, y: Math.min(ctx.y, 140) };
  ctx = drawLine(ctx);
  ctx = drawText(ctx, "Assinatura Digital:", 9, true);
  ctx = { ...ctx, y: ctx.y - 8 };
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 30, width: 220, height: 28, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.5 });
  ctx.page.drawText("[ Campo de Assinatura ]", { x: MARGIN + 60, y: ctx.y - 20, size: 8, font: fontReg, color: rgb(0.6, 0.6, 0.6) });
  ctx.page.drawText(`Data: ___/___/______`, { x: MARGIN + 240, y: ctx.y - 14, size: 9, font: fontReg, color: rgb(0.3, 0.3, 0.3) });

  return doc.save();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Prefer REMOTE_* when serving locally (CLI overrides SUPABASE_URL with local instance URL)
  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { application_id, supplemental_data = {} }: Payload = await req.json();

    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id is required" }), { status: 400, headers: CORS });
    }

    // ── 1. Fetch application + institution + scholarship + course ────────────
    const { data: app, error: appErr } = await supabase
      .from("institution_applications")
      .select(`
        id, profile_id, institution_id, scholarship_level_id, status,
        placement_fee_paid_at, supplemental_data,
        institutions (id, name, slug, city, state, modality, cpt_opt, accepts_cos, accepts_transfer),
        institution_scholarships (id, scholarship_level, placement_fee_usd, discount_percent,
          tuition_annual_usd, monthly_migma_usd, installments_total,
          institution_courses (id, course_name, degree_level, area, duration_months))
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found", detail: appErr?.message }), { status: 404, headers: CORS });
    }

    if (app.status !== "payment_confirmed") {
      return new Response(
        JSON.stringify({ error: "Forms can only be generated after placement fee is confirmed", current_status: app.status }),
        { status: 422, headers: CORS }
      );
    }

    // ── 2. Fetch user profile ────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, email, phone, whatsapp, num_dependents, student_process_type, service_type, signature_url")
      .eq("id", app.profile_id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: CORS });
    }

    // ── 3. Fetch survey answers ──────────────────────────────────────────────
    const { data: survey } = await supabase
      .from("selection_survey_responses")
      .select("answers, academic_formation, english_level")
      .eq("profile_id", app.profile_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── 3b. Fetch user_identity — user_id = auth user ID (user_profiles.user_id, not .id)
    const { data: identity } = await supabase
      .from("user_identity")
      .select("birth_date, nationality, marital_status, address, city, state, zip_code, country")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    // ── 4. Resolve supplemental data (payload takes precedence over DB) ──────
    const resolvedSupplemental: SupplementalData = {
      ...(app.supplemental_data ?? {}),
      ...supplemental_data,
    };

    // Persist if new supplemental data was provided
    if (Object.keys(supplemental_data).length > 0) {
      await supabase
        .from("institution_applications")
        .update({ supplemental_data: resolvedSupplemental })
        .eq("id", application_id);
    }

    const institution  = app.institutions as any;
    const scholarship  = app.institution_scholarships as any ?? null;
    const course       = scholarship?.institution_courses ?? null;

    // ── 5. Determine form set by institution slug/name ───────────────────────
    const slug = (institution.slug ?? institution.name ?? "").toLowerCase();
    const isCaroline = slug.includes("caroline");
    const isOikos    = slug.includes("oikos");
    const formList: string[] = isCaroline
      ? [...CAROLINE_FORMS]
      : isOikos
      ? [...OIKOS_FORMS]
      : ["application_for_admission", "i20_request_form", "termo_responsabilidade_estudante"];

    // Filter out financial support form if no sponsor
    const finalFormList = formList.filter((ft) => {
      if (ft === "affidavit_of_financial_support") return resolvedSupplemental.has_sponsor === true;
      return true;
    });

    console.log(`[generate-institution-forms] Institution: ${institution.name} | Forms: ${finalFormList.length} | User: ${profile.full_name}`);

    // ── 6. Mark as generating ────────────────────────────────────────────────
    await supabase
      .from("institution_applications")
      .update({ forms_status: "generating" })
      .eq("id", application_id);

    // ── 7. Generate + upload PDFs ────────────────────────────────────────────
    const generatedFormIds: string[] = [];
    const now = new Date().toISOString();

    for (const formType of finalFormList) {
      const formData = buildFormData(formType, profile, institution, scholarship, course, survey, resolvedSupplemental, identity);
      const pdfBytes  = await generateFormPdf(formType, formData, institution.name, profile.full_name ?? "");

      const storagePath = `${app.profile_id}/${application_id}/${formType}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from("institution-forms")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadErr) {
        console.error(`[generate-institution-forms] Storage upload failed for ${formType}:`, uploadErr.message);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("institution-forms")
        .getPublicUrl(storagePath);

      // Upsert — safe to re-run
      const { data: formRecord, error: insertErr } = await supabase
        .from("institution_forms")
        .upsert({
          institution_id: institution.id,
          profile_id:     app.profile_id,
          application_id: application_id,
          form_type:      formType,
          template_url:   publicUrlData.publicUrl,
          form_data_json: formData,
          generated_at:   now,
          signed_url:     null,
          signed_at:      null,
        }, { onConflict: "application_id,form_type" })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[generate-institution-forms] DB insert failed for ${formType}:`, insertErr.message);
      } else if (formRecord) {
        generatedFormIds.push(formRecord.id);
      }
    }

    // ── 8. Update application status ─────────────────────────────────────────
    await supabase
      .from("institution_applications")
      .update({ forms_status: "generated", forms_generated_at: now })
      .eq("id", application_id);

    // ── 9. Notify client ──────────────────────────────────────────────────────
    await supabase.functions.invoke("migma-notify", {
      body: {
        trigger: "forms_generated",
        user_id: app.profile_id,
        data: { app_url: `${Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com"}/student/forms` },
      },
    });

    console.log(`[generate-institution-forms] Done. ${generatedFormIds.length}/${finalFormList.length} forms generated.`);

    return new Response(
      JSON.stringify({
        success: true,
        institution: institution.name,
        forms_generated: generatedFormIds.length,
        forms_total: finalFormList.length,
        form_types: finalFormList,
        form_ids: generatedFormIds,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[generate-institution-forms] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
