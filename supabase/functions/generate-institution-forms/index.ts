import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, PDFForm } from "npm:pdf-lib@^1.17.1";
import { fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

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
  "application_packet",
  "affidavit_of_financial_support",  // conditional on sponsor
  "enrollment_agreement",
  "all_statements_and_agreement",
  "scholarship_agreement",
  "termo_responsabilidade_estudante", // internal only
] as const;

type FormType = typeof CAROLINE_FORMS[number] | typeof OIKOS_FORMS[number];

// ─── Form display names ───────────────────────────────────────────────────────

const FORM_LABELS: Record<string, string> = {
  application_packet:                        "Application Packet",
  application_for_admission:                  "Application for Admission",
  i20_request_form:                           "I-20 Request Form",
  letter_of_recommendation:                   "Letter of Recommendation",
  affidavit_of_financial_support:             "Affidavit of Financial Support",
  tuition_refund_policy:                      "Tuition Refund Policy",
  statement_of_institutional_purpose:         "Statement of Institutional Purpose",
  scholarship_support_compliance_agreement:   "Scholarship Support & Compliance Agreement",
  enrollment_agreement:                       "Enrollment Agreement",
  all_statements_and_agreement:               "All Statements and Agreement",
  scholarship_agreement:                      "Scholarship Agreement",
  statement_of_faith:                         "Statement of Faith",
  code_of_conduct:                            "Code of Conduct",
  refund_policy:                              "Refund Policy",
  agreement_to_complete_mandatory_intensives: "Agreement to Complete Mandatory Intensives",
  christian_faith_statement:                  "Christian Faith Statement",
  termo_responsabilidade_estudante:           "Termo de Responsabilidade do Estudante",
};

const OIKOS_APPLICATION_PACKET_TEMPLATE_FILENAME = "1. Application Packet - OIKOS (1).pdf";
const OIKOS_VERIFICATION_OF_FINANCIAL_TEMPLATE_FILENAME = "5. Verification of Financial  (1).pdf";
const OIKOS_ALL_STATEMENTS_AND_AGREEMENT_TEMPLATE_FILENAME = "All Statement and agreement  (1).pdf";
const OIKOS_ENROLLMENT_AGREEMENT_TEMPLATE_FILENAME = "Enrollment Agreement (1).pdf";
const OIKOS_SCHOLARSHIP_AGREEMENT_TEMPLATE_FILENAME = "Scholarship agreement_OIKOS.pdf";
const CAROLINE_LETTER_OF_RECOMMENDATION_TEMPLATE_FILENAME = "Caroline Form Letter of Recommendation (1).pdf";
const CAROLINE_AFFIDAVIT_OF_FINANCIAL_SUPPORT_TEMPLATE_FILENAME = "Caroline_Affidavit of Financial Support_2024 (1).pdf";
const CAROLINE_APPLICATION_FORM_TEMPLATE_FILENAME = "Caroline_Form_Application_2024 (1).pdf";
const CAROLINE_I20_REQUEST_FORM_TEMPLATE_FILENAME = "CU_Form_I-20 Request_2024 (1).pdf";
const CAROLINE_STATEMENT_OF_INSTITUTIONAL_PURPOSE_TEMPLATE_FILENAME = "CU_Form_Statement of Institutional Purpose_2024 (1).pdf";
const CAROLINE_TUITION_REFUND_POLICY_TEMPLATE_FILENAME = "CU_Form_Tuition Refund_2024 (1).pdf";
const CAROLINE_SCHOLARSHIP_SUPPORT_AND_COMPLIANCE_AGREEMENT_TEMPLATE_FILENAME = "SCHOLARSHIP SUPPORT AND COMPLIANCE AGREEMENT (2).pdf";

type PacketDegreeProgram =
  | "ba_biblical_studies"
  | "bm"
  | "baba"
  | "mdiv"
  | "mm"
  | "mba"
  | "dmin"
  | "dma"
  | "dba";

interface PacketGridColumn {
  key: string;
  x: number;
  maxWidth: number;
}

interface PacketGridRowField {
  x: number;
  top: number;
  maxWidth: number;
}

interface PacketTextField {
  page: number;
  x: number;
  top: number;
  maxWidth: number;
  source: string;
  align?: "left" | "right" | "center";
  transform?: "year2digits_or_suffix" | "year4digits_or_suffix" | "year2digits" | "year4digits" | "phone_area_code" | "phone_local_number";
  width?: number;
  height?: number;
  fontSize?: number;
  minFontSize?: number;
  valign?: "baseline" | "middle";
  paddingLeft?: number;
  paddingRight?: number;
  baselineOffset?: number;
  shrinkTopPerPoint?: number;
  renderWhen?: {
    path: string;
    equals: unknown;
  };
}

interface PacketCheckboxField {
  page: number;
  x: number;
  top: number;
  source: string;
  equals: unknown;
}

interface PacketGridField {
  page: number;
  maxRows: number;
  source: string;
  columns?: PacketGridColumn[];
  rowTops?: number[];
  rows?: Record<string, PacketGridRowField>[];
}

interface PacketMultilineField {
  page: number;
  x: number;
  top: number;
  width: number;
  height: number;
  source: string;
  lineHeight: number;
  fontSize: number;
}

interface OverlayTextField {
  page: number;
  x: number;
  top: number;
  maxWidth: number;
  source: string;
  align?: "left" | "right" | "center";
  transform?: "student_display_name" | "date_mm" | "date_dd" | "date_yyyy";
  optional?: boolean;
  format?: "MM/DD/YYYY";
  width?: number;
  height?: number;
  fontSize?: number;
  minFontSize?: number;
  valign?: "baseline" | "middle";
  paddingLeft?: number;
  paddingRight?: number;
  baselineOffset?: number;
  shrinkTopPerPoint?: number;
}

interface OikosApplicationPacketData {
  applicant: {
    fullNameEnglish?: string;
    dateOfBirth?: string;
    gender?: "M" | "F";
    usCitizen?: boolean;
    placeOfBirth?: string;
    email?: string;
    phone?: string;
    countryOfCitizenship?: string;
    permanentAddress?: string;
    currentAddress?: string;
  };
  maritalStatus?: "single" | "married";
  admission: {
    startSemester?: "spring" | "summer" | "fall";
    startYear?: string;
    degreeProgram?: PacketDegreeProgram;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  personalReferences?: Array<Record<string, string | undefined>>;
  academicBackground?: Array<Record<string, string | undefined>>;
  workMinistryExperience?: Array<Record<string, string | undefined>>;
  i20?: {
    lastName?: string;
    firstName?: string;
    middleName?: string;
    dateOfBirth?: string;
    placeOfBirth?: string;
    countryOfCitizenship?: string;
    requestType?: "new_student" | "change_of_status" | "transfer_student";
    foreignAddress?: string;
    usAddress?: string;
    dependents?: Array<Record<string, string | undefined>>;
  };
  recommendation?: {
    applicantName?: string;
    applicantAddressLine?: string;
    applicantCityStateZip?: string;
    applicantTelephone?: string;
  };
  christianFaith?: {
    name?: string;
    date?: string;
    statement?: string;
  };
  personalReferencesNormalized?: Array<Record<string, string | undefined>>;
  academicBackgroundNormalized?: Array<Record<string, string | undefined>>;
}

interface OikosVerificationFinancialData {
  student: {
    lastName?: string;
    firstName?: string;
    middleName?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  financial: {
    annualProjectedTuitionExpense?: string;
    annualSupportAmount?: string;
  };
  sponsor: {
    name?: string;
    relationship?: string;
    telephone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    signatureDate?: string;
    signatureText?: string;
  };
  notary?: {
    sponsorOathSignatureText?: string;
    subscribedDay?: string;
    subscribedMonth?: string;
    subscribedLocation?: string;
    commissionExpiresOn?: string;
    officerSignatureText?: string;
    officerTitle?: string;
  };
}

interface CarolineAffidavitOfFinancialSupportData {
  student: {
    lastName?: string;
    firstName?: string;
    middleName?: string;
    dateOfBirth?: string;
  };
  sponsor: {
    name?: string;
    telephone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    relationship?: string;
    employer?: string;
    title?: string;
    years?: string;
    income?: string;
  };
  financial: {
    annualProjectedTuitionExpense?: string;
    annualSupportAmount?: string;
  };
}

interface OikosAllStatementsAgreementData {
  student: {
    fullName?: string;
  };
  meta: {
    currentDate?: string;
  };
  christianFaith: {
    name?: string;
    date?: string;
    statement?: string;
  };
}

interface OikosEnrollmentAgreementData {
  student: {
    enrollmentType?: "new_student" | "reentry_student";
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    homePhone?: string;
    cellPhone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    email?: string;
  };
  program: {
    name?: string;
    totalCreditHours?: string;
    agreementStartDate?: string;
    scheduledCompletionDate?: string;
    programStartDate?: string;
    programCompletionDate?: string;
  };
}

interface CarolineLetterOfRecommendationData {
  applicant: {
    fullName?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  recommender: {
    name?: string;
    email?: string;
    telephone?: string;
    date?: string;
    institution?: string;
    position?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

interface CarolineStatementOfInstitutionalPurposeData {
  student: {
    fullName?: string;
    degreeProgram?: string;
    currentDate?: string;
  };
}

interface CarolineTuitionRefundPolicyData {
  student: {
    fullName?: string;
    degreeProgram?: string;
    dateOfBirth?: string;
  };
}

interface CarolineScholarshipSupportComplianceAgreementData {
  agency: {
    name?: string;
  };
}

const CAROLINE_LETTER_OF_RECOMMENDATION_V1: {
  text: Record<string, OverlayTextField>;
} = {
  text: {
    applicant_name: { page: 0, x: 162, top: 164, maxWidth: 400, fontSize: 10, source: "applicant.fullName" },
    applicant_address: { page: 0, x: 112, top: 194, maxWidth: 500, fontSize: 10, source: "applicant.addressLine1" },
    applicant_city: { page: 0, x: 285, top: 194, maxWidth: 110, fontSize: 10, align: "center", source: "applicant.city" },
    applicant_state: { page: 0, x: 395, top: 194, maxWidth: 40, fontSize: 10, align: "center", source: "applicant.state" },
    applicant_zip: { page: 0, x: 470, top: 194, maxWidth: 60, fontSize: 10, align: "center", source: "applicant.zip" },
    recommender_name: { page: 0, x: 135, top: 548, maxWidth: 220, fontSize: 10, source: "recommender.name" },
    recommender_email: { page: 0, x: 355, top: 548, maxWidth: 215, fontSize: 10, source: "recommender.email" },
    recommender_date_mm: { page: 0, x: 150, top: 561, maxWidth: 28, fontSize: 10, source: "recommender.date", transform: "date_mm", optional: true },
    recommender_date_dd: { page: 0, x: 183, top: 561, maxWidth: 28, fontSize: 10, source: "recommender.date", transform: "date_dd", optional: true },
    recommender_date_yyyy: { page: 0, x: 255, top: 561, maxWidth: 52, fontSize: 10, source: "recommender.date", transform: "date_yyyy", optional: true },
    recommender_institution: { page: 0, x: 205, top: 586, maxWidth: 220, fontSize: 8, minFontSize: 7, source: "recommender.institution", optional: true },
    recommender_position: { page: 0, x: 410, top: 586, maxWidth: 170, fontSize: 8, minFontSize: 7, source: "recommender.position" },
    recommender_address: { page: 0, x: 145, top: 606, maxWidth: 135, fontSize: 7, minFontSize: 6, source: "recommender.address", optional: true },
    recommender_telephone: { page: 0, x: 430, top: 606, maxWidth: 150, fontSize: 9, minFontSize: 8, source: "recommender.telephone" },
    recommender_city: { page: 0, x: 240, top: 606, maxWidth: 120, fontSize: 7, minFontSize: 6, align: "center", source: "recommender.city", optional: true },
    recommender_state: { page: 0, x: 310, top: 606, maxWidth: 40, fontSize: 7, minFontSize: 6, align: "center", source: "recommender.state", optional: true },
    recommender_zip: { page: 0, x: 330, top: 606, maxWidth: 55, fontSize: 7, minFontSize: 6, align: "center", source: "recommender.zip", optional: true },
  },
};

const CAROLINE_AFFIDAVIT_OF_FINANCIAL_SUPPORT_V1: {
  text: Record<string, OverlayTextField>;
} = {
  text: {
    student_last_name: { page: 0, x: 100, top: 195, maxWidth: 110, fontSize: 10, align: "center", source: "student.lastName" },
    student_first_name: { page: 0, x: 274, top: 196, maxWidth: 110, fontSize: 10, align: "center", source: "student.firstName" },
    student_middle_name: { page: 0, x: 420, top: 196, maxWidth: 90, fontSize: 10, align: "center", source: "student.middleName" },
    student_date_of_birth: { page: 0, x: 100, top: 235, maxWidth: 130, fontSize: 10, align: "center", source: "student.dateOfBirth", format: "MM/DD/YYYY" },

    sponsor_name: { page: 0, x: 100, top: 280, maxWidth: 210, fontSize: 10, source: "sponsor.name" },
    sponsor_telephone: { page: 0, x: 326, top: 278, maxWidth: 150, fontSize: 10, source: "sponsor.telephone" },
    sponsor_address: { page: 0, x: 100, top: 322, maxWidth: 220, fontSize: 8, minFontSize: 7, source: "sponsor.address" },
    sponsor_city: { page: 0, x: 300, top: 319, maxWidth: 90, fontSize: 10, source: "sponsor.city" },
    sponsor_state: { page: 0, x: 433, top: 319, maxWidth: 45, fontSize: 10, source: "sponsor.state" },
    sponsor_zip: { page: 0, x: 500, top: 318, maxWidth: 70, fontSize: 10, source: "sponsor.zip" },

    annual_projected_tuition_expense: { page: 0, x: 105, top: 401, maxWidth: 70, fontSize: 10, source: "financial.annualProjectedTuitionExpense" },

    sponsor_name_2: { page: 0, x: 100, top: 429, maxWidth: 210, fontSize: 10, source: "sponsor.name" },
    sponsor_relationship: { page: 0, x: 383, top: 428, maxWidth: 120, fontSize: 10, source: "sponsor.relationship" },
    sponsor_employer: { page: 0, x: 100, top: 471, maxWidth: 205, fontSize: 9, minFontSize: 8, source: "sponsor.employer", optional: true },
    sponsor_title: { page: 0, x: 382, top: 469, maxWidth: 180, fontSize: 9, minFontSize: 8, source: "sponsor.title", optional: true },
    sponsor_years: { page: 0, x: 100, top: 511, maxWidth: 40, fontSize: 10, source: "sponsor.years", optional: true },
    sponsor_income: { page: 0, x: 315, top: 510, maxWidth: 100, fontSize: 10, source: "sponsor.income", optional: true },

    sponsor_name_inline: { page: 0, x: 104, top: 551, maxWidth: 150, fontSize: 9, minFontSize: 8, source: "sponsor.name" },
    student_name_inline: { page: 0, x: 100, top: 580, maxWidth: 150, fontSize: 9, minFontSize: 8, source: "student.firstName", transform: "student_display_name" },
    annual_support_amount: { page: 0, x: 239, top: 606, maxWidth: 70, fontSize: 10, source: "financial.annualSupportAmount" },
  },
};

const CAROLINE_APPLICATION_FORM_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    // Page 0 — Personal info
    student_last_name:      { page: 0, x: 69,   top: 174, maxWidth: 100, fontSize: 10, source: "student.lastName" },
    student_first_name:     { page: 0, x: 178,  top: 173, maxWidth: 95,  fontSize: 10, source: "student.firstName" },
    student_middle_name:    { page: 0, x: 279,  top: 172, maxWidth: 90,  fontSize: 10, source: "student.middleName", optional: true },
    dob_month:              { page: 0, x: 438,  top: 173, maxWidth: 30,  fontSize: 10, source: "student.dateOfBirth", transform: "date_mm" },
    dob_day:                { page: 0, x: 484,  top: 172, maxWidth: 30,  fontSize: 10, source: "student.dateOfBirth", transform: "date_dd" },
    dob_year:               { page: 0, x: 527,  top: 174, maxWidth: 40,  fontSize: 10, source: "student.dateOfBirth", transform: "date_yyyy" },
    address:                { page: 0, x: 82,   top: 222, maxWidth: 255, fontSize: 10, source: "student.address", optional: true },
    address_city:           { page: 0, x: 355,  top: 222, maxWidth: 70,  fontSize: 10, source: "student.city", optional: true },
    address_state:          { page: 0, x: 443,  top: 222, maxWidth: 40,  fontSize: 10, source: "student.state", optional: true },
    address_zip:            { page: 0, x: 497,  top: 220, maxWidth: 55,  fontSize: 10, source: "student.zip", optional: true },
    phone:                  { page: 0, x: 137,  top: 259, maxWidth: 140, fontSize: 10, source: "student.phone", optional: true },
    email:                  { page: 0, x: 297,  top: 260, maxWidth: 200, fontSize: 10, source: "student.email" },
    country_of_citizenship: { page: 0, x: 458,  top: 314, maxWidth: 110, fontSize: 10, source: "student.countryOfCitizenship", optional: true },
    visa_status:            { page: 0, x: 144,  top: 346, maxWidth: 200, fontSize: 10, source: "student.visaStatus", optional: true },
    spring_year:            { page: 0, x: 161,  top: 407, maxWidth: 35,  fontSize: 10, source: "student.preferredYear", optional: true },
    summer_year:            { page: 0, x: 301,  top: 408, maxWidth: 35,  fontSize: 10, source: "student.preferredYear", optional: true },
    fall_year:              { page: 0, x: 423,  top: 407, maxWidth: 35,  fontSize: 10, source: "student.preferredYear", optional: true },
    emergency_name:         { page: 0, x: 67,   top: 593, maxWidth: 175, fontSize: 10, source: "emergency.name", optional: true },
    emergency_phone:        { page: 0, x: 263,  top: 592, maxWidth: 155, fontSize: 10, source: "emergency.phone", optional: true },
    emergency_relationship: { page: 0, x: 442,  top: 592, maxWidth: 120, fontSize: 10, source: "emergency.relationship", optional: true },
    emergency_address:      { page: 0, x: 80,   top: 627, maxWidth: 255, fontSize: 10, source: "emergency.address", optional: true },
    emergency_city:         { page: 0, x: 358,  top: 628, maxWidth: 55,  fontSize: 10, source: "emergency.city", optional: true },
    emergency_state:        { page: 0, x: 429,  top: 627, maxWidth: 45,  fontSize: 10, source: "emergency.state", optional: true },
    emergency_zip:          { page: 0, x: 493,  top: 627, maxWidth: 55,  fontSize: 10, source: "emergency.zip", optional: true },

    // Page 1 — Family dependents (up to 4 rows)
    family_name_0:         { page: 1, x: 43,   top: 141, maxWidth: 140, fontSize: 10, source: "dependents.0.name", optional: true },
    family_relation_0:     { page: 1, x: 197,  top: 142, maxWidth: 90,  fontSize: 10, source: "dependents.0.relationship", optional: true },
    family_gender_0:       { page: 1, x: 297,  top: 142, maxWidth: 65,  fontSize: 10, source: "dependents.0.gender", optional: true },
    family_dob_0:          { page: 1, x: 376,  top: 141, maxWidth: 75,  fontSize: 10, source: "dependents.0.dateOfBirth", optional: true },
    family_country_0:      { page: 1, x: 465,  top: 142, maxWidth: 100, fontSize: 10, source: "dependents.0.countryOfCitizenship", optional: true },
    family_name_1:         { page: 1, x: 43,   top: 164, maxWidth: 140, fontSize: 10, source: "dependents.1.name", optional: true },
    family_relation_1:     { page: 1, x: 196,  top: 163, maxWidth: 90,  fontSize: 10, source: "dependents.1.relationship", optional: true },
    family_gender_1:       { page: 1, x: 296,  top: 165, maxWidth: 65,  fontSize: 10, source: "dependents.1.gender", optional: true },
    family_dob_1:          { page: 1, x: 376,  top: 165, maxWidth: 75,  fontSize: 10, source: "dependents.1.dateOfBirth", optional: true },
    family_country_1:      { page: 1, x: 464,  top: 165, maxWidth: 100, fontSize: 10, source: "dependents.1.countryOfCitizenship", optional: true },
    family_name_2:         { page: 1, x: 41,   top: 187, maxWidth: 140, fontSize: 10, source: "dependents.2.name", optional: true },
    family_relation_2:     { page: 1, x: 195,  top: 188, maxWidth: 90,  fontSize: 10, source: "dependents.2.relationship", optional: true },
    family_gender_2:       { page: 1, x: 297,  top: 185, maxWidth: 65,  fontSize: 10, source: "dependents.2.gender", optional: true },
    family_dob_2:          { page: 1, x: 375,  top: 185, maxWidth: 75,  fontSize: 10, source: "dependents.2.dateOfBirth", optional: true },
    family_country_2:      { page: 1, x: 463,  top: 186, maxWidth: 100, fontSize: 10, source: "dependents.2.countryOfCitizenship", optional: true },
    family_name_3:         { page: 1, x: 43,   top: 209, maxWidth: 140, fontSize: 10, source: "dependents.3.name", optional: true },
    family_relation_3:     { page: 1, x: 195,  top: 209, maxWidth: 90,  fontSize: 10, source: "dependents.3.relationship", optional: true },
    family_gender_3:       { page: 1, x: 295,  top: 208, maxWidth: 65,  fontSize: 10, source: "dependents.3.gender", optional: true },
    family_dob_3:          { page: 1, x: 377,  top: 208, maxWidth: 75,  fontSize: 10, source: "dependents.3.dateOfBirth", optional: true },
    family_country_3:      { page: 1, x: 466,  top: 209, maxWidth: 100, fontSize: 10, source: "dependents.3.countryOfCitizenship", optional: true },

    // Page 1 — Academic background (up to 4 schools)
    school_name_0:     { page: 1, x: 42,  top: 304, maxWidth: 145, fontSize: 10, source: "academic.0.schoolName", optional: true },
    school_location_0: { page: 1, x: 201, top: 304, maxWidth: 170, fontSize: 10, source: "academic.0.location", optional: true },
    school_duration_0: { page: 1, x: 385, top: 302, maxWidth: 65,  fontSize: 10, source: "academic.0.duration", optional: true },
    school_degree_0:   { page: 1, x: 461, top: 303, maxWidth: 95,  fontSize: 10, source: "academic.0.degree", optional: true },
    school_name_1:     { page: 1, x: 42,  top: 327, maxWidth: 145, fontSize: 10, source: "academic.1.schoolName", optional: true },
    school_location_1: { page: 1, x: 200, top: 326, maxWidth: 170, fontSize: 10, source: "academic.1.location", optional: true },
    school_duration_1: { page: 1, x: 385, top: 325, maxWidth: 65,  fontSize: 10, source: "academic.1.duration", optional: true },
    school_degree_1:   { page: 1, x: 463, top: 326, maxWidth: 95,  fontSize: 10, source: "academic.1.degree", optional: true },
    school_name_2:     { page: 1, x: 41,  top: 352, maxWidth: 145, fontSize: 10, source: "academic.2.schoolName", optional: true },
    school_location_2: { page: 1, x: 200, top: 350, maxWidth: 170, fontSize: 10, source: "academic.2.location", optional: true },
    school_duration_2: { page: 1, x: 386, top: 349, maxWidth: 65,  fontSize: 10, source: "academic.2.duration", optional: true },
    school_degree_2:   { page: 1, x: 462, top: 350, maxWidth: 95,  fontSize: 10, source: "academic.2.degree", optional: true },
    school_name_3:     { page: 1, x: 42,  top: 374, maxWidth: 145, fontSize: 10, source: "academic.3.schoolName", optional: true },
    school_location_3: { page: 1, x: 199, top: 373, maxWidth: 170, fontSize: 10, source: "academic.3.location", optional: true },
    school_duration_3: { page: 1, x: 387, top: 372, maxWidth: 65,  fontSize: 10, source: "academic.3.duration", optional: true },
    school_degree_3:   { page: 1, x: 461, top: 372, maxWidth: 95,  fontSize: 10, source: "academic.3.degree", optional: true },

    // Page 1 — Work / ministry experience (up to 3 rows)
    work_duration_0:  { page: 1, x: 118, top: 437, maxWidth: 115, fontSize: 9, minFontSize: 8, source: "work.0.duration", optional: true },
    work_position_0:  { page: 1, x: 249, top: 436, maxWidth: 315, fontSize: 9, minFontSize: 8, source: "work.0.position", optional: true },
    work_duration_1:  { page: 1, x: 118, top: 474, maxWidth: 115, fontSize: 9, minFontSize: 8, source: "work.1.duration", optional: true },
    work_position_1:  { page: 1, x: 250, top: 472, maxWidth: 315, fontSize: 9, minFontSize: 8, source: "work.1.position", optional: true },
    work_duration_2:  { page: 1, x: 117, top: 509, maxWidth: 115, fontSize: 9, minFontSize: 8, source: "work.2.duration", optional: true },
    work_position_2:  { page: 1, x: 250, top: 510, maxWidth: 315, fontSize: 9, minFontSize: 8, source: "work.2.position", optional: true },

    // Page 1 — Recommenders (up to 2)
    recommender_name_0:     { page: 1, x: 102, top: 546, maxWidth: 130, fontSize: 7, minFontSize: 6, source: "recommenders.0.name", optional: true },
    recommender_position_0: { page: 1, x: 250, top: 546, maxWidth: 190, fontSize: 9, minFontSize: 8, source: "recommenders.0.position", optional: true },
    recommender_contact_0:  { page: 1, x: 455, top: 545, maxWidth: 110, fontSize: 9, minFontSize: 8, source: "recommenders.0.contact", optional: true },
    recommender_name_1:     { page: 1, x: 101, top: 564, maxWidth: 130, fontSize: 7, minFontSize: 6, source: "recommenders.1.name", optional: true },
    recommender_position_1: { page: 1, x: 250, top: 564, maxWidth: 190, fontSize: 9, minFontSize: 8, source: "recommenders.1.position", optional: true },
    recommender_contact_1:  { page: 1, x: 456, top: 564, maxWidth: 110, fontSize: 9, minFontSize: 8, source: "recommenders.1.contact", optional: true },
  },
  checkboxes: {
    // Page 0
    gender_m:        { page: 0, x: 525, top: 269, source: "student.gender",          equals: "m" },
    gender_f:        { page: 0, x: 556, top: 268, source: "student.gender",          equals: "f" },
    us_citizen_yes:  { page: 0, x: 237, top: 320, source: "student.isUsCitizen",     equals: true },
    us_citizen_no:   { page: 0, x: 267, top: 322, source: "student.isUsCitizen",     equals: false },
    semester_spring: { page: 0, x: 57,  top: 412, source: "student.preferredSemester", equals: "spring" },
    semester_summer: { page: 0, x: 199, top: 414, source: "student.preferredSemester", equals: "summer" },
    semester_fall:   { page: 0, x: 340, top: 414, source: "student.preferredSemester", equals: "fall" },
    degree_bba:      { page: 0, x: 60,  top: 470, source: "student.degreeProgram",   equals: "bba" },
    degree_mba:      { page: 0, x: 59,  top: 485, source: "student.degreeProgram",   equals: "mba" },
    degree_mcis:     { page: 0, x: 59,  top: 500, source: "student.degreeProgram",   equals: "mcis" },
    degree_mphil:    { page: 0, x: 60,  top: 515, source: "student.degreeProgram",   equals: "mphil" },
    degree_dba:      { page: 0, x: 59,  top: 530, source: "student.degreeProgram",   equals: "dba" },
    degree_dphil:    { page: 0, x: 60,  top: 546, source: "student.degreeProgram",   equals: "dphil" },
    // Page 1
    marital_single:   { page: 1, x: 121, top: 92, source: "student.maritalStatus",     equals: "single" },
    marital_married:  { page: 1, x: 162, top: 91, source: "student.maritalStatus",     equals: "married" },
    hs_diploma_yes:   { page: 1, x: 131, top: 260, source: "student.hasHighSchoolDiploma", equals: true },
    hs_diploma_no:    { page: 1, x: 161, top: 261, source: "student.hasHighSchoolDiploma", equals: false },
  },
};

const CAROLINE_I20_REQUEST_FORM_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    last_name:              { page: 0, x: 122.5, top: 133.5, maxWidth: 225, fontSize: 10, source: "student.lastName" },
    first_name:             { page: 0, x: 363.5, top: 134.5, maxWidth: 115, fontSize: 10, source: "student.firstName" },
    middle_name:            { page: 0, x: 493.5, top: 132.5, maxWidth: 80,  fontSize: 10, source: "student.middleName", optional: true },
    date_of_birth:          { page: 0, x: 156.5, top: 176.0, maxWidth: 120, fontSize: 10, source: "student.dateOfBirth", format: "MM/DD/YYYY" },
    place_of_birth:         { page: 0, x: 430.0, top: 174.5, maxWidth: 145, fontSize: 10, source: "student.placeOfBirth", optional: true },
    country_of_citizenship: { page: 0, x: 203.5, top: 215.0, maxWidth: 370, fontSize: 10, source: "student.countryOfCitizenship", optional: true },
    foreign_address:        { page: 0, x: 170.5, top: 257.5, maxWidth: 400, fontSize: 9,  minFontSize: 8, source: "student.foreignAddress", optional: true },
    us_address:             { page: 0, x: 158.5, top: 296.5, maxWidth: 415, fontSize: 9,  minFontSize: 8, source: "student.usAddress", optional: true },

    // Dependents — 6 rows
    dep_name_0:         { page: 0, x: 83.5,  top: 556.5, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.0.name", optional: true },
    dep_relation_0:     { page: 0, x: 211.0, top: 554.5, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.0.relationship", optional: true },
    dep_gender_0:       { page: 0, x: 272.0, top: 554.0, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.0.gender", optional: true },
    dep_dob_0:          { page: 0, x: 309.5, top: 555.0, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.0.dateOfBirth", optional: true },
    dep_pob_0:          { page: 0, x: 377.0, top: 553.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.0.placeOfBirth", optional: true },
    dep_country_0:      { page: 0, x: 447.5, top: 553.5, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.0.countryOfCitizenship", optional: true },

    dep_name_1:         { page: 0, x: 83.0,  top: 581.0, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.1.name", optional: true },
    dep_relation_1:     { page: 0, x: 210.5, top: 580.5, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.1.relationship", optional: true },
    dep_gender_1:       { page: 0, x: 270.5, top: 581.0, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.1.gender", optional: true },
    dep_dob_1:          { page: 0, x: 313.5, top: 581.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.1.dateOfBirth", optional: true },
    dep_pob_1:          { page: 0, x: 379.0, top: 579.0, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.1.placeOfBirth", optional: true },
    dep_country_1:      { page: 0, x: 447.5, top: 581.0, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.1.countryOfCitizenship", optional: true },

    dep_name_2:         { page: 0, x: 82.0,  top: 605.5, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.2.name", optional: true },
    dep_relation_2:     { page: 0, x: 208.0, top: 605.0, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.2.relationship", optional: true },
    dep_gender_2:       { page: 0, x: 269.0, top: 604.5, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.2.gender", optional: true },
    dep_dob_2:          { page: 0, x: 314.5, top: 606.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.2.dateOfBirth", optional: true },
    dep_pob_2:          { page: 0, x: 381.0, top: 605.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.2.placeOfBirth", optional: true },
    dep_country_2:      { page: 0, x: 448.5, top: 605.5, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.2.countryOfCitizenship", optional: true },

    dep_name_3:         { page: 0, x: 82.5,  top: 630.0, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.3.name", optional: true },
    dep_relation_3:     { page: 0, x: 208.0, top: 631.0, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.3.relationship", optional: true },
    dep_gender_3:       { page: 0, x: 271.0, top: 631.0, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.3.gender", optional: true },
    dep_dob_3:          { page: 0, x: 313.5, top: 630.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.3.dateOfBirth", optional: true },
    dep_pob_3:          { page: 0, x: 380.5, top: 632.0, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.3.placeOfBirth", optional: true },
    dep_country_3:      { page: 0, x: 448.0, top: 632.5, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.3.countryOfCitizenship", optional: true },

    dep_name_4:         { page: 0, x: 83.0,  top: 658.0, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.4.name", optional: true },
    dep_relation_4:     { page: 0, x: 209.5, top: 656.5, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.4.relationship", optional: true },
    dep_gender_4:       { page: 0, x: 271.0, top: 657.5, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.4.gender", optional: true },
    dep_dob_4:          { page: 0, x: 313.0, top: 658.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.4.dateOfBirth", optional: true },
    dep_pob_4:          { page: 0, x: 381.0, top: 659.0, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.4.placeOfBirth", optional: true },
    dep_country_4:      { page: 0, x: 448.5, top: 661.0, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.4.countryOfCitizenship", optional: true },

    dep_name_5:         { page: 0, x: 83.0,  top: 683.0, maxWidth: 115, fontSize: 9, minFontSize: 7, source: "dependents.5.name", optional: true },
    dep_relation_5:     { page: 0, x: 209.0, top: 681.5, maxWidth: 52,  fontSize: 9, minFontSize: 7, source: "dependents.5.relationship", optional: true },
    dep_gender_5:       { page: 0, x: 270.5, top: 684.0, maxWidth: 30,  fontSize: 9, minFontSize: 7, source: "dependents.5.gender", optional: true },
    dep_dob_5:          { page: 0, x: 313.5, top: 685.0, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.5.dateOfBirth", optional: true },
    dep_pob_5:          { page: 0, x: 381.0, top: 684.5, maxWidth: 60,  fontSize: 9, minFontSize: 7, source: "dependents.5.placeOfBirth", optional: true },
    dep_country_5:      { page: 0, x: 446.0, top: 685.0, maxWidth: 120, fontSize: 9, minFontSize: 7, source: "dependents.5.countryOfCitizenship", optional: true },
  },
  checkboxes: {
    request_new_student: { page: 0, x: 275.5, top: 326.0, source: "student.requestType", equals: "new_student" },
    request_cos:         { page: 0, x: 432.0, top: 326.0, source: "student.requestType", equals: "cos" },
    request_transfer:    { page: 0, x: 529.0, top: 326.0, source: "student.requestType", equals: "transfer" },
    degree_bba:          { page: 0, x: 95.0,  top: 385.5, source: "student.degreeProgram", equals: "bba" },
    degree_mba:          { page: 0, x: 96.0,  top: 404.0, source: "student.degreeProgram", equals: "mba" },
    degree_mcis:         { page: 0, x: 95.5,  top: 422.0, source: "student.degreeProgram", equals: "mcis" },
    degree_mphil:        { page: 0, x: 96.0,  top: 439.5, source: "student.degreeProgram", equals: "mphil" },
    degree_dba:          { page: 0, x: 95.5,  top: 459.0, source: "student.degreeProgram", equals: "dba" },
    degree_dphil:        { page: 0, x: 96.0,  top: 476.5, source: "student.degreeProgram", equals: "dphil" },
  },
};

const CAROLINE_STATEMENT_OF_INSTITUTIONAL_PURPOSE_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    student_name:   { page: 0, x: 152.0, top: 640.5, maxWidth: 228, fontSize: 10, source: "student.fullName" },
    degree_program: { page: 0, x: 152.0, top: 654.0, maxWidth: 188, fontSize: 10, source: "student.degreeProgram" },
    date_mm:        { page: 0, x: 397.5, top: 668.5, maxWidth: 24, fontSize: 10, source: "student.currentDate", transform: "date_mm", optional: true },
    date_dd:        { page: 0, x: 451.5, top: 667.0, maxWidth: 24, fontSize: 10, source: "student.currentDate", transform: "date_dd", optional: true },
    date_yyyy:      { page: 0, x: 500.5, top: 668.0, maxWidth: 42, fontSize: 10, source: "student.currentDate", transform: "date_yyyy", optional: true },
  },
  checkboxes: {},
};

const CAROLINE_TUITION_REFUND_POLICY_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    student_name:   { page: 0, x: 107.0, top: 120.0, maxWidth: 240, fontSize: 10, source: "student.fullName" },
    degree_program: { page: 0, x: 155.0, top: 142.0, maxWidth: 260, fontSize: 10, source: "student.degreeProgram" },
    date_of_birth:  { page: 0, x: 140.0, top: 164.0, maxWidth: 180, fontSize: 10, source: "student.dateOfBirth", format: "MM/DD/YYYY", optional: true },
  },
  checkboxes: {},
};

const CAROLINE_SCHOLARSHIP_SUPPORT_AND_COMPLIANCE_AGREEMENT_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    agency_name: { page: 0, x: 277.0, top: 133.5, maxWidth: 120, fontSize: 10, source: "agency.name" },
  },
  checkboxes: {},
};

const OIKOS_ENROLLMENT_AGREEMENT_V1: {
  text: Record<string, OverlayTextField>;
  checkboxes: Record<string, PacketCheckboxField>;
} = {
  text: {
    applicant_first_name:         { page: 0, x: 217.0, top: 138.5, maxWidth: 78, fontSize: 10, source: "student.firstName", optional: true },
    applicant_middle_name:        { page: 0, x: 347.0, top: 138.0, maxWidth: 74, fontSize: 10, source: "student.middleName", optional: true },
    applicant_last_name:          { page: 0, x: 217.5, top: 149.0, maxWidth: 78, fontSize: 10, source: "student.lastName", optional: true },
    dob_mm:                       { page: 0, x: 309.5, top: 162.5, maxWidth: 16, fontSize: 10, source: "student.dateOfBirth", transform: "date_mm", optional: true },
    dob_dd:                       { page: 0, x: 331.0, top: 162.0, maxWidth: 16, fontSize: 10, source: "student.dateOfBirth", transform: "date_dd", optional: true },
    dob_yyyy:                     { page: 0, x: 361.0, top: 161.0, maxWidth: 30, fontSize: 10, source: "student.dateOfBirth", transform: "date_yyyy", optional: true },
    home_phone:                   { page: 0, x: 189.0, top: 176.5, maxWidth: 66, fontSize: 10, source: "student.homePhone", optional: true },
    cell_phone:                   { page: 0, x: 451.0, top: 176.5, maxWidth: 72, fontSize: 10, source: "student.cellPhone", optional: true },
    address:                      { page: 0, x: 142.5, top: 188.5, maxWidth: 105, fontSize: 10, source: "student.address", optional: true },
    city:                         { page: 0, x: 277.5, top: 189.0, maxWidth: 104, fontSize: 10, source: "student.city", optional: true },
    state:                        { page: 0, x: 417.0, top: 188.5, maxWidth: 28, fontSize: 10, source: "student.state", optional: true },
    zip:                          { page: 0, x: 483.0, top: 188.0, maxWidth: 36, fontSize: 10, source: "student.zip", optional: true },
    email:                        { page: 0, x: 121.0, top: 201.0, maxWidth: 198, fontSize: 10, source: "student.email", optional: true },
    program_name:                 { page: 0, x: 123.0, top: 227.5, maxWidth: 140, fontSize: 10, source: "program.name", optional: true },
    total_credit_hours:           { page: 0, x: 404.5, top: 227.0, maxWidth: 46, fontSize: 10, source: "program.totalCreditHours", optional: true },
    agreement_start_date:         { page: 0, x: 264.5, top: 240.5, maxWidth: 68, fontSize: 10, source: "program.agreementStartDate", format: "MM/DD/YYYY", optional: true },
    scheduled_completion_date:    { page: 0, x: 463.5, top: 241.0, maxWidth: 66, fontSize: 10, source: "program.scheduledCompletionDate", format: "MM/DD/YYYY", optional: true },
    program_start_date:           { page: 0, x: 170.5, top: 253.0, maxWidth: 70, fontSize: 10, source: "program.programStartDate", format: "MM/DD/YYYY", optional: true },
    program_completion_date:      { page: 0, x: 425.5, top: 252.5, maxWidth: 90, fontSize: 10, source: "program.programCompletionDate", format: "MM/DD/YYYY", optional: true },
  },
  checkboxes: {
    new_student:    { page: 0, x: 153.0, top: 127.0, source: "student.enrollmentType", equals: "new_student" },
    reentry_student:{ page: 0, x: 256.5, top: 126.0, source: "student.enrollmentType", equals: "reentry_student" },
  },
};

const OIKOS_SCHOLARSHIP_AGREEMENT_V1: {
  text: Record<string, OverlayTextField>;
} = {
  text: {
    agency_name: { page: 0, x: 277.0, top: 133.5, maxWidth: 150, fontSize: 10, source: "agency.name", optional: true },
  },
};

const OIKOS_ALL_STATEMENTS_AND_AGREEMENT_V1: {
  text: Record<string, OverlayTextField>;
  multiline: Record<string, PacketMultilineField>;
} = {
  text: {
    page1_student_name: { page: 0, x: 364.5, top: 478.5, maxWidth: 170, fontSize: 10, source: "student.fullName", optional: true },
    page1_current_date: { page: 0, x: 364.5, top: 508.0, maxWidth: 128, fontSize: 10, source: "meta.currentDate", format: "MM/DD/YYYY", optional: true },
    page2_student_name: { page: 1, x: 328.0, top: 699.5, maxWidth: 170, fontSize: 10, source: "student.fullName", optional: true },
    page2_current_date: { page: 1, x: 328.5, top: 717.5, maxWidth: 128, fontSize: 10, source: "meta.currentDate", format: "MM/DD/YYYY", optional: true },
    page3_student_name: { page: 2, x: 112.0, top: 443.5, maxWidth: 170, fontSize: 10, source: "student.fullName", optional: true },
    page3_current_date: { page: 2, x: 108.0, top: 471.0, maxWidth: 128, fontSize: 10, source: "meta.currentDate", format: "MM/DD/YYYY", optional: true },
    page4_current_date: { page: 3, x: 77.5, top: 698.5, maxWidth: 128, fontSize: 10, source: "meta.currentDate", format: "MM/DD/YYYY", optional: true },
    page4_student_name: { page: 3, x: 255.0, top: 700.5, maxWidth: 170, fontSize: 10, source: "student.fullName", optional: true },
    page5_student_name: { page: 4, x: 80.0, top: 694.5, maxWidth: 170, width: 182, height: 16, fontSize: 6.5, minFontSize: 4, valign: "middle", baselineOffset: -1, shrinkTopPerPoint: 1, source: "student.fullName", optional: true },
    page5_current_date: { page: 4, x: 230.0, top: 698.5, maxWidth: 128, fontSize: 10, source: "meta.currentDate", format: "MM/DD/YYYY", optional: true },
    page6_student_name: { page: 5, x: 111.0, top: 166.0, maxWidth: 200, fontSize: 10, source: "christianFaith.name", optional: true },
    page6_current_date: { page: 5, x: 423.5, top: 166.5, maxWidth: 128, fontSize: 10, source: "christianFaith.date", format: "MM/DD/YYYY", optional: true },
  },
  multiline: {
    christian_faith_statement: {
      page: 5,
      x: 75.5,
      top: 213.0,
      width: 462,
      height: 450,
      source: "christianFaith.statement",
      lineHeight: 14,
      fontSize: 11,
    },
  },
};

const OIKOS_APPLICATION_PACKET_V1: {
  overlay: {
    text: Record<string, PacketTextField>;
    checkboxes: Record<string, PacketCheckboxField>;
    grids: Record<string, PacketGridField>;
    multiline: Record<string, PacketMultilineField>;
  };
} = {
  overlay: {
    text: {
      applicant_english_name: { page: 0, x: 317.5, top: 174.0, maxWidth: 140, width: 170, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.fullNameEnglish" },
      applicant_permanent_address: { page: 0, x: 172.5, top: 219.0, maxWidth: 350, width: 360, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.permanentAddress" },
      applicant_current_address: { page: 0, x: 165.0, top: 241.5, maxWidth: 355, width: 365, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.currentAddress" },
      applicant_phone: { page: 0, x: 157.0, top: 266.0, maxWidth: 250, width: 260, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.phone" },
      applicant_email: { page: 0, x: 110.5, top: 288.5, maxWidth: 190, width: 198, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.email" },
      applicant_dob: { page: 0, x: 101.5, top: 312.5, maxWidth: 88, width: 92, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.dateOfBirth" },
      applicant_place_of_birth: { page: 0, x: 405.5, top: 312.0, maxWidth: 115, width: 120, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.placeOfBirth" },
      applicant_country_of_citizenship: { page: 0, x: 412.5, top: 357.0, maxWidth: 110, width: 116, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.countryOfCitizenship" },
      start_year_spring: { page: 0, x: 143.5, top: 450.0, maxWidth: 18, fontSize: 10, baselineOffset: 11, source: "admission.startYear", transform: "year2digits", renderWhen: { path: "admission.startSemester", equals: "spring" } },
      start_year_fall: { page: 0, x: 246.5, top: 450.0, maxWidth: 18, fontSize: 10, baselineOffset: 11, source: "admission.startYear", transform: "year2digits", renderWhen: { path: "admission.startSemester", equals: "fall" } },
      start_year_summer: { page: 0, x: 365.0, top: 450.0, maxWidth: 18, fontSize: 10, baselineOffset: 11, source: "admission.startYear", transform: "year2digits", renderWhen: { path: "admission.startSemester", equals: "summer" } },
      emergency_contact_name: { page: 0, x: 69.0, top: 635.5, maxWidth: 150, width: 160, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.name" },
      emergency_contact_phone: { page: 0, x: 318.0, top: 636.5, maxWidth: 150, width: 160, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.phone" },
      emergency_contact_address: { page: 0, x: 79.5, top: 656.0, maxWidth: 395, width: 405, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.address" },
      i20_last_name: { page: 2, x: 148.0, top: 183.0, maxWidth: 96, width: 102, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.lastName" },
      i20_first_name: { page: 2, x: 255.0, top: 184.5, maxWidth: 112, width: 118, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.firstName" },
      i20_middle_name: { page: 2, x: 377.0, top: 184.5, maxWidth: 112, width: 118, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.middleName" },
      i20_dob: { page: 2, x: 103.0, top: 236.0, maxWidth: 112, width: 116, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.dateOfBirth" },
      i20_place_of_birth: { page: 2, x: 307.0, top: 237.5, maxWidth: 208, width: 214, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.placeOfBirth" },
      i20_country_of_citizenship: { page: 2, x: 142.0, top: 273.5, maxWidth: 360, width: 370, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.countryOfCitizenship" },
      i20_foreign_address: { page: 2, x: 118.0, top: 310.0, maxWidth: 398, width: 406, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.foreignAddress" },
      i20_us_address: { page: 2, x: 106.0, top: 345.5, maxWidth: 415, width: 423, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.usAddress" },
      recommendation_applicant_name: { page: 3, x: 137.0, top: 139.0, maxWidth: 430, width: 438, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "recommendation.applicantName" },
      recommendation_applicant_address: { page: 3, x: 84.5, top: 165.0, maxWidth: 485, width: 492, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "recommendation.applicantAddressLine" },
      recommendation_city_state_zip: { page: 3, x: 112.0, top: 193.0, maxWidth: 278, width: 286, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "recommendation.applicantCityStateZip" },
      recommendation_applicant_phone: { page: 3, x: 41.5, top: 207.5, maxWidth: 120, width: 126, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "recommendation.applicantTelephone" },
      christian_faith_name: { page: 4, x: 104.0, top: 165.0, maxWidth: 142, width: 150, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "christianFaith.name" },
      christian_faith_date: { page: 4, x: 416.5, top: 163.5, maxWidth: 138, width: 142, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "christianFaith.date" },
    },
    checkboxes: {
      applicant_gender_m: { page: 0, x: 260.5, top: 316.5, source: "applicant.gender", equals: "M" },
      applicant_gender_f: { page: 0, x: 283.0, top: 316.5, source: "applicant.gender", equals: "F" },
      applicant_us_citizen_yes: { page: 0, x: 190.0, top: 362.0, source: "applicant.usCitizen", equals: true },
      applicant_us_citizen_no: { page: 0, x: 217.5, top: 362.0, source: "applicant.usCitizen", equals: false },
      marital_single: { page: 1, x: 142.5, top: 40.0, source: "maritalStatus", equals: "single" },
      marital_married: { page: 1, x: 203.5, top: 40.0, source: "maritalStatus", equals: "married" },
      start_semester_spring: { page: 0, x: 61.0, top: 443.0, source: "admission.startSemester", equals: "spring" },
      start_semester_fall: { page: 0, x: 173.0, top: 444.0, source: "admission.startSemester", equals: "fall" },
      start_semester_summer: { page: 0, x: 275.0, top: 443.0, source: "admission.startSemester", equals: "summer" },
      degree_ba_biblical_studies: { page: 0, x: 61.5, top: 512.0, source: "admission.degreeProgram", equals: "ba_biblical_studies" },
      degree_bm: { page: 0, x: 189.0, top: 511.5, source: "admission.degreeProgram", equals: "bm" },
      degree_baba: { page: 0, x: 318.5, top: 512.5, source: "admission.degreeProgram", equals: "baba" },
      degree_mdiv: { page: 0, x: 61.0, top: 550.5, source: "admission.degreeProgram", equals: "mdiv" },
      degree_mm: { page: 0, x: 187.5, top: 551.0, source: "admission.degreeProgram", equals: "mm" },
      degree_mba: { page: 0, x: 320.0, top: 550.5, source: "admission.degreeProgram", equals: "mba" },
      degree_dmin: { page: 0, x: 61.5, top: 591.0, source: "admission.degreeProgram", equals: "dmin" },
      degree_dma: { page: 0, x: 190.0, top: 592.0, source: "admission.degreeProgram", equals: "dma" },
      degree_dba: { page: 0, x: 325.5, top: 591.5, source: "admission.degreeProgram", equals: "dba" },
      i20_request_new_student: { page: 2, x: 113.0, top: 388.5, source: "i20.requestType", equals: "new_student" },
      i20_request_change_of_status: { page: 2, x: 200.5, top: 389.0, source: "i20.requestType", equals: "change_of_status" },
      i20_request_transfer_student: { page: 2, x: 361.0, top: 389.0, source: "i20.requestType", equals: "transfer_student" },
      i20_program_ba_biblical_studies: { page: 2, x: 41.0, top: 462.0, source: "admission.degreeProgram", equals: "ba_biblical_studies" },
      i20_program_bm: { page: 2, x: 187.5, top: 460.0, source: "admission.degreeProgram", equals: "bm" },
      i20_program_baba: { page: 2, x: 323.0, top: 461.5, source: "admission.degreeProgram", equals: "baba" },
      i20_program_mdiv: { page: 2, x: 41.0, top: 502.5, source: "admission.degreeProgram", equals: "mdiv" },
      i20_program_mm: { page: 2, x: 189.0, top: 502.0, source: "admission.degreeProgram", equals: "mm" },
      i20_program_mba: { page: 2, x: 323.5, top: 503.0, source: "admission.degreeProgram", equals: "mba" },
      i20_program_dmin: { page: 2, x: 41.0, top: 535.0, source: "admission.degreeProgram", equals: "dmin" },
    },
    grids: {
      personalReferences: {
        page: 1,
        maxRows: 4,
        source: "personalReferences",
        columns: [
          { key: "name", x: 47.5, maxWidth: 122 },
          { key: "relationship", x: 183.0, maxWidth: 72 },
          { key: "contactNumber", x: 333.5, maxWidth: 106 },
        ],
        rowTops: [119.0, 144.0, 173.5, 203.0],
      },
      academicBackground: {
        page: 1,
        maxRows: 4,
        source: "academicBackground",
        columns: [
          { key: "schoolName", x: 47.5, maxWidth: 88 },
          { key: "degreeDiploma", x: 472.0, maxWidth: 98 },
        ],
        rowTops: [282.0, 311.0, 338.5, 364.0],
      },
      workMinistryExperience: {
        page: 1,
        maxRows: 3,
        source: "workMinistryExperience",
        rows: [
          {
            companyOrChurch: { x: 201.0, top: 409.0, maxWidth: 228 },
            duration: { x: 123.0, top: 423.5, maxWidth: 64 },
            position: { x: 263.0, top: 423.5, maxWidth: 168 },
          },
          {
            companyOrChurch: { x: 200.5, top: 445.0, maxWidth: 228 },
            duration: { x: 120.5, top: 464.0, maxWidth: 64 },
            position: { x: 260.5, top: 464.0, maxWidth: 168 },
          },
          {
            companyOrChurch: { x: 199.0, top: 485.0, maxWidth: 228 },
            duration: { x: 121.0, top: 504.0, maxWidth: 64 },
            position: { x: 259.0, top: 503.0, maxWidth: 168 },
          },
        ],
      },
      dependents: {
        page: 2,
        maxRows: 6,
        source: "i20.dependents",
        columns: [
          { key: "name", x: 37.5, maxWidth: 104 },
          { key: "relationship", x: 150.5, maxWidth: 58 },
          { key: "sex", x: 218.0, maxWidth: 22 },
          { key: "dateOfBirth", x: 250.5, maxWidth: 78 },
          { key: "placeOfBirth", x: 338.0, maxWidth: 98 },
          { key: "countryOfCitizenship", x: 448.0, maxWidth: 98 },
        ],
        rowTops: [623.5, 641.0, 661.5, 682.0, 700.0, 717.5],
      },
    },
    multiline: {
      christian_faith_statement: {
        page: 4,
        x: 88.5,
        top: 207.5,
        width: 455,
        height: 382,
        source: "christianFaith.statement",
        lineHeight: 14,
        fontSize: 11,
      },
    },
  },
};

const OIKOS_VERIFICATION_OF_FINANCIAL_V1: {
  text: Record<string, OverlayTextField>;
} = {
  text: {
    student_last_name: { page: 0, x: 62, top: 170, maxWidth: 118, source: "student.lastName" },
    student_first_name: { page: 0, x: 185, top: 170, maxWidth: 118, source: "student.firstName" },
    student_middle_name: { page: 0, x: 306, top: 170, maxWidth: 78, source: "student.middleName" },
    student_date_of_birth: { page: 0, x: 403, top: 170, maxWidth: 115, source: "student.dateOfBirth", format: "MM/DD/YYYY" },
    student_address: { page: 0, x: 115, top: 198, maxWidth: 140, source: "student.address" },
    student_city: { page: 0, x: 280, top: 198, maxWidth: 80, source: "student.city" },
    student_state: { page: 0, x: 385, top: 198, maxWidth: 80, fontSize: 10, minFontSize: 5, source: "student.state" },
    student_zip: { page: 0, x: 468, top: 198, maxWidth: 65, source: "student.zip" },
    sponsor_name: { page: 0, x: 65, top: 320, maxWidth: 205, source: "sponsor.name" },
    sponsor_relationship: { page: 0, x: 325, top: 320, maxWidth: 72, source: "sponsor.relationship" },
    sponsor_telephone: { page: 0, x: 435, top: 320, maxWidth: 110, source: "sponsor.telephone" },
    sponsor_address: { page: 0, x: 58, top: 354, maxWidth: 180, source: "sponsor.address" },
    sponsor_city: { page: 0, x: 280, top: 354, maxWidth: 92, source: "sponsor.city" },
    sponsor_state: { page: 0, x: 395, top: 354, maxWidth: 42, source: "sponsor.state" },
    sponsor_zip: { page: 0, x: 455, top: 354, maxWidth: 65, source: "sponsor.zip" },
    sponsor_name_inline: { page: 0, x: 80, top: 400, maxWidth: 120, source: "sponsor.name" },
    student_name_inline: { page: 0, x: 365, top: 400, maxWidth: 110, source: "student.firstName", transform: "student_display_name" },
    annual_support_amount: { page: 0, x: 375, top: 418, maxWidth: 85, source: "financial.annualSupportAmount" },
    annual_projected_tuition_expense: { page: 0, x: 435, top: 272, maxWidth: 100, source: "financial.annualProjectedTuitionExpense" },
  },
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
    city?: string;
    state?: string;
    zip?: string;
    employer?: string;
    position?: string;
    years_employed?: number;
    annual_income_usd?: string;
    committed_amount_usd?: number;
    signature_text?: string;
    signature_date?: string;
  };
  notary?: {
    sponsor_oath_signature_text?: string;
    subscribed_day?: string;
    subscribed_month?: string;
    subscribed_location?: string;
    commission_expires_on?: string;
    officer_signature_text?: string;
    officer_title?: string;
  };
  work_experience?: Array<{ company?: string; period?: string; position?: string }>;
  recommenders?: Array<{
    name?: string;
    position?: string;
    contact?: string;
    email?: string;
    telephone?: string;
    date?: string;
    institution?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
  preferred_start_term?: string;
}

interface Payload {
  application_id?: string;
  supplemental_data?: SupplementalData;
  debug_env?: boolean;
  local_test?: {
    enabled?: boolean;
    form_types?: string[];
    institution?: Record<string, any>;
    scholarship?: Record<string, any> | null;
    course?: Record<string, any> | null;
    survey?: Record<string, any> | null;
    profile?: Record<string, any>;
    identity?: Record<string, any>;
    supplemental_data?: SupplementalData;
    return_resolved_form_data?: boolean;
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getValueAtPath(data: Record<string, any>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function truncateToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let output = text;
  while (output.length > 0 && font.widthOfTextAtSize(output, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return output;
}

function wrapTextToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }

      let remainder = word;
      while (remainder.length > 0) {
        let chunk = remainder;
        while (chunk.length > 1 && font.widthOfTextAtSize(chunk, size) > maxWidth) {
          chunk = chunk.slice(0, -1);
        }
        lines.push(chunk);
        remainder = remainder.slice(chunk.length);
      }
      current = "";
    }

    if (current) lines.push(current);
  }

  return lines;
}

function topToPdfY(page: PDFPage, top: number, fontSize: number): number {
  return page.getHeight() - top - fontSize;
}

function normalizeCheckboxValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim().toLowerCase();
  return value;
}

function compact(value?: string | null): string {
  return (value ?? "").trim();
}

function joinNonEmpty(parts: Array<string | undefined | null>, sep = " "): string {
  return parts.map((part) => compact(part)).filter(Boolean).join(sep);
}

function isProbablyEmail(value?: string | null): boolean {
  const text = compact(value);
  return /\S+@\S+\.\S+/.test(text);
}

function safeName(value?: string | null): string {
  const text = compact(value);
  return isProbablyEmail(text) ? "" : text;
}

function looksLikePhone(value?: string | null): boolean {
  const text = compact(value);
  return /[0-9()+\- ]{6,}/.test(text);
}

function shouldRenderField(data: Record<string, any>, renderWhen?: { path: string; equals: unknown }): boolean {
  if (!renderWhen) return true;
  return getValueAtPath(data, renderWhen.path) === renderWhen.equals;
}

function maybeFormatDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  return `${month}/${day}/${year}`;
}

function joinAddress(parts: Array<string | null | undefined>): string | undefined {
  const filtered = parts.map((part) => asString(part)).filter(Boolean);
  return filtered.length > 0 ? filtered.join(", ") : undefined;
}

function splitFullName(fullName: string | null | undefined) {
  const parts = asString(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? undefined,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined,
    lastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
  };
}

function parsePreferredStart(value: string | undefined): { startSemester?: "spring" | "summer" | "fall"; startYear?: string } {
  const raw = asString(value).toLowerCase();
  if (!raw) return {};

  const startSemester = raw.includes("spring")
    ? "spring"
    : raw.includes("summer")
    ? "summer"
    : raw.includes("fall") || raw.includes("autumn")
    ? "fall"
    : undefined;

  const yearMatch = raw.match(/\b(20\d{2})\b/);
  return {
    startSemester,
    startYear: yearMatch?.[1],
  };
}

function extractPhoneParts(raw: string): { area: string; local: string } {
  const digits = raw.replace(/\D/g, "");
  // Brazil +55 DD NNNNNNNNN (12-13 digits)
  if (digits.startsWith("55") && digits.length >= 12) {
    return { area: digits.slice(2, 4), local: digits.slice(4) };
  }
  // US +1 NXX NXXXXXX (11 digits)
  if (digits.startsWith("1") && digits.length === 11) {
    return { area: digits.slice(1, 4), local: digits.slice(4) };
  }
  // Generic: first 2-3 digits as area code
  if (digits.length >= 10) {
    return { area: digits.slice(0, 2), local: digits.slice(2) };
  }
  return { area: "", local: digits };
}

function transformPacketValue(value: string, transform: PacketTextField["transform"]): string {
  if (!transform || !value) return value;
  if (transform === "year2digits_or_suffix") return value.slice(-2);
  if (transform === "year4digits_or_suffix") return value.slice(-4);
  if (transform === "year2digits") return value.length === 4 ? value.slice(-2) : value;
  if (transform === "year4digits") return value;
  if (transform === "phone_area_code") return extractPhoneParts(value).area;
  if (transform === "phone_local_number") return extractPhoneParts(value).local;
  return value;
}

function formatMoneyValue(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return asString(value) || undefined;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numeric);
}

function inferPacketDegreeProgram(course: Record<string, any> | null): PacketDegreeProgram | undefined {
  const degree = asString(course?.degree_level).toLowerCase();
  const courseName = asString(course?.course_name).toLowerCase();

  if (courseName.includes("biblical")) return "ba_biblical_studies";
  if (courseName.includes("music") || degree.includes("music")) return degree.startsWith("doctor") ? "dma" : degree.startsWith("master") ? "mm" : "bm";
  if (courseName.includes("business") || courseName.includes("administration") || courseName.includes("mba")) {
    if (degree.startsWith("doctor")) return "dba";
    return "mba";
  }
  if (courseName.includes("divinity")) return "mdiv";
  if (courseName.includes("ministry") || degree.includes("ministry")) return "dmin";
  if (courseName.includes("arts") || degree.includes("bachelor")) return "baba";
  return undefined;
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

function buildOikosApplicationPacketData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  survey: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): OikosApplicationPacketData {
  const answers = (survey?.answers ?? {}) as Record<string, any>;
  const splitName = splitFullName(profile.full_name);
  const preferredStart = parsePreferredStart(supplemental.preferred_start_term);
  const currentAddress = joinAddress([identity?.address, identity?.city, identity?.state, identity?.zip_code]);
  const foreignAddress = supplemental.emergency_contact?.address;
  const birthCity = asString(answers.birthplace_city);
  const birthCountry = asString(answers.birthplace_country);
  const placeOfBirth = [birthCity, birthCountry].filter(Boolean).join(", ") || undefined;
  const nationality = asString(identity?.nationality ?? identity?.country) || undefined;
  const maritalStatusRaw = asString(identity?.marital_status).toLowerCase();
  const maritalStatus = maritalStatusRaw.includes("married")
    ? "married"
    : maritalStatusRaw.includes("single")
    ? "single"
    : undefined;
  const signatureDate = maybeFormatDate(new Date().toISOString());
  const applicantDateOfBirth = maybeFormatDate(identity?.birth_date);
  const applicantPhone = asString(profile.phone ?? profile.whatsapp) || undefined;
  const requestType = profile.service_type === "transfer"
    ? "transfer_student"
    : profile.service_type === "cos"
    ? "change_of_status"
    : "new_student";
  const applicantFullName = compact(
    compact(profile.full_name) || joinNonEmpty([splitName.firstName, splitName.middleName, splitName.lastName]),
  ) || undefined;
  const cityStateZip = joinNonEmpty([identity?.city, identity?.state, identity?.zip_code], ", ");
  const personalReferencesNormalized = (supplemental.recommenders ?? []).slice(0, 4).map((ref) => ({
    name: compact(ref.name) || undefined,
    relationship: compact(ref.position) || undefined,
    contactNumber: looksLikePhone(ref.contact) ? compact(ref.contact) : undefined,
  }));
  const academicBackgroundNormalized = survey?.academic_formation
    ? [{
        schoolName: compact(survey.academic_formation) || undefined,
        degreeDiploma: compact(survey.academic_formation) || undefined,
      }]
    : [];
  const christianFaithStatement = compact(answers.christian_faith_statement ?? answers.faith_statement) || undefined;

  return {
    applicant: {
      fullNameEnglish: applicantFullName,
      dateOfBirth: applicantDateOfBirth,
      gender: asString(answers.gender).toUpperCase() === "F" ? "F" : asString(answers.gender).toUpperCase() === "M" ? "M" : undefined,
      usCitizen: nationality?.toLowerCase().includes("united states") || nationality?.toLowerCase() === "usa",
      placeOfBirth,
      email: asString(profile.email) || undefined,
      phone: applicantPhone,
      countryOfCitizenship: nationality,
      permanentAddress: foreignAddress,
      currentAddress,
    },
    maritalStatus,
    admission: {
      startSemester: preferredStart.startSemester,
      startYear: preferredStart.startYear,
      degreeProgram: inferPacketDegreeProgram(course),
    },
    emergencyContact: {
      name: supplemental.emergency_contact?.name,
      phone: supplemental.emergency_contact?.phone,
      address: supplemental.emergency_contact?.address,
    },
    personalReferences: personalReferencesNormalized,
    academicBackground: academicBackgroundNormalized,
    workMinistryExperience: (supplemental.work_experience ?? []).slice(0, 3).map((item) => ({
      companyOrChurch: item.company,
      duration: item.period,
      position: item.position,
    })),
    i20: {
      lastName: splitName.lastName,
      firstName: splitName.firstName,
      middleName: splitName.middleName,
      dateOfBirth: applicantDateOfBirth,
      placeOfBirth,
      countryOfCitizenship: nationality,
      requestType,
      foreignAddress,
      usAddress: currentAddress,
      dependents: [],
    },
    recommendation: {
      applicantName: applicantFullName,
      applicantAddressLine: currentAddress ?? foreignAddress,
      applicantCityStateZip: cityStateZip || undefined,
      applicantTelephone: applicantPhone,
    },
    christianFaith: {
      name: applicantFullName,
      date: signatureDate,
      statement: christianFaithStatement,
    },
    personalReferencesNormalized,
    academicBackgroundNormalized,
  };
}

function buildOikosVerificationFinancialData(
  profile: Record<string, any>,
  scholarship: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): OikosVerificationFinancialData {
  const splitName = splitFullName(profile.full_name);
  const studentAddress = joinAddress([identity?.address]);
  const tuitionExpense = formatMoneyValue(scholarship?.tuition_annual_usd);
  const supportAmount = formatMoneyValue(supplemental.sponsor?.committed_amount_usd ?? scholarship?.tuition_annual_usd);

  return {
    student: {
      lastName: splitName.lastName,
      firstName: splitName.firstName,
      middleName: splitName.middleName,
      dateOfBirth: maybeFormatDate(identity?.birth_date),
      address: studentAddress,
      city: asString(identity?.city) || undefined,
      state: asString(identity?.state) || undefined,
      zip: asString(identity?.zip_code) || undefined,
    },
    financial: {
      annualProjectedTuitionExpense: tuitionExpense,
      annualSupportAmount: supportAmount,
    },
    sponsor: {
      name: supplemental.sponsor?.full_name,
      relationship: supplemental.sponsor?.relationship,
      telephone: supplemental.sponsor?.phone,
      address: supplemental.sponsor?.address,
      city: supplemental.sponsor?.city,
      state: supplemental.sponsor?.state,
      zip: supplemental.sponsor?.zip,
      signatureText: supplemental.sponsor?.signature_text,
      signatureDate: supplemental.sponsor?.signature_date,
    },
    notary: {
      sponsorOathSignatureText: supplemental.notary?.sponsor_oath_signature_text,
      subscribedDay: supplemental.notary?.subscribed_day,
      subscribedMonth: supplemental.notary?.subscribed_month,
      subscribedLocation: supplemental.notary?.subscribed_location,
      commissionExpiresOn: supplemental.notary?.commission_expires_on,
      officerSignatureText: supplemental.notary?.officer_signature_text,
      officerTitle: supplemental.notary?.officer_title,
    },
  };
}

function buildOikosAllStatementsAgreementData(
  profile: Record<string, any>,
  survey: Record<string, any> | null,
): OikosAllStatementsAgreementData {
  const answers = (survey?.answers ?? {}) as Record<string, any>;
  const splitName = splitFullName(profile.full_name);
  const currentDate = maybeFormatDate(new Date().toISOString());
  const fullName = compact(
    compact(profile.full_name) || joinNonEmpty([splitName.firstName, splitName.middleName, splitName.lastName]),
  ) || undefined;
  const christianFaithStatement = compact(answers.christian_faith_statement ?? answers.faith_statement) || undefined;

  return {
    student: {
      fullName,
    },
    meta: {
      currentDate,
    },
    christianFaith: {
      name: fullName,
      date: currentDate,
      statement: christianFaithStatement,
    },
  };
}

function addMonthsToDate(base: Date, months: number): Date {
  const date = new Date(base.getTime());
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}

function preferredStartToDate(preferredStart?: string): string | undefined {
  const parsed = parsePreferredStart(preferredStart);
  if (!parsed.startSemester || !parsed.startYear) return undefined;
  const month = parsed.startSemester === "spring" ? 1 : parsed.startSemester === "summer" ? 6 : 8;
  return maybeFormatDate(new Date(Date.UTC(Number(parsed.startYear), month, 1)).toISOString());
}

function normalizeEnrollmentPhone(value: string | undefined): string | undefined {
  const raw = compact(value);
  if (!raw) return undefined;
  const normalizedDigits = raw.replace(/\D/g, "");
  const usDigits = normalizedDigits.startsWith("1") && normalizedDigits.length === 11
    ? normalizedDigits.slice(1)
    : normalizedDigits;
  return usDigits || undefined;
}

function buildOikosEnrollmentAgreementData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  survey: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): OikosEnrollmentAgreementData {
  const splitName = splitFullName(profile.full_name);
  const primaryPhone = looksLikePhone(profile.phone ?? profile.whatsapp) ? asString(profile.phone ?? profile.whatsapp) : undefined;
  const homePhone = normalizeEnrollmentPhone(primaryPhone);
  const cellPhone = normalizeEnrollmentPhone(primaryPhone);
  const startDate = preferredStartToDate(supplemental.preferred_start_term);
  const durationMonths = Number(course?.duration_months ?? 0);
  const completionDate = startDate && durationMonths > 0
    ? maybeFormatDate(addMonthsToDate(new Date(`${startDate.slice(6, 10)}-${startDate.slice(0, 2)}-${startDate.slice(3, 5)}T00:00:00Z`), durationMonths).toISOString())
    : undefined;
  const totalCreditHours = asString((course as Record<string, any> | null)?.credit_hours)
    || asString((survey?.answers ?? {}).credit_hours)
    || undefined;

  return {
    student: {
      enrollmentType: "new_student",
      firstName: splitName.firstName,
      middleName: splitName.middleName,
      lastName: splitName.lastName,
      dateOfBirth: maybeFormatDate(identity?.birth_date),
      homePhone,
      cellPhone,
      address: compact(identity?.address) || undefined,
      city: compact(identity?.city) || undefined,
      state: compact(identity?.state) || undefined,
      zip: compact(identity?.zip_code) || undefined,
      email: compact(profile.email) || undefined,
    },
    program: {
      name: compact(course?.course_name) || compact(course?.degree_level) || undefined,
      totalCreditHours,
      agreementStartDate: startDate,
      scheduledCompletionDate: completionDate,
      programStartDate: startDate,
      programCompletionDate: completionDate,
    },
  };
}

function buildCarolineLetterOfRecommendationData(
  profile: Record<string, any>,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): CarolineLetterOfRecommendationData {
  const recommender = supplemental.recommenders?.[0];
  const contact = compact(recommender?.contact);
  const recommenderEmail = compact(recommender?.email) || (isProbablyEmail(contact) ? contact : undefined);
  const recommenderTelephone = compact(recommender?.telephone) || (!recommenderEmail && looksLikePhone(contact) ? contact : undefined);

  return {
    applicant: {
      fullName: compact(profile.full_name) || undefined,
      addressLine1: compact(identity?.address) || undefined,
      city: compact(identity?.city) || undefined,
      state: compact(identity?.state) || undefined,
      zip: compact(identity?.zip_code) || undefined,
    },
    recommender: {
      name: safeName(recommender?.name) || undefined,
      email: recommenderEmail,
      telephone: recommenderTelephone,
      date: compact(recommender?.date) || undefined,
      institution: compact(recommender?.institution) || undefined,
      position: compact(recommender?.position) || undefined,
      address: compact(recommender?.address) || undefined,
      city: compact(recommender?.city) || undefined,
      state: compact(recommender?.state) || undefined,
      zip: compact(recommender?.zip) || undefined,
    },
  };
}

function buildCarolineAffidavitOfFinancialSupportData(
  profile: Record<string, any>,
  scholarship: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): CarolineAffidavitOfFinancialSupportData {
  const splitName = splitFullName(profile.full_name);
  const tuitionExpense = formatMoneyValue(scholarship?.tuition_annual_usd);
  const supportAmount = formatMoneyValue(supplemental.sponsor?.committed_amount_usd ?? scholarship?.tuition_annual_usd);
  const income = formatMoneyValue(supplemental.sponsor?.annual_income_usd);

  return {
    student: {
      lastName: splitName.lastName,
      firstName: splitName.firstName,
      middleName: splitName.middleName,
      dateOfBirth: identity?.birth_date ?? undefined,
    },
    sponsor: {
      name: supplemental.sponsor?.full_name,
      telephone: supplemental.sponsor?.phone,
      address: supplemental.sponsor?.address,
      city: supplemental.sponsor?.city,
      state: supplemental.sponsor?.state,
      zip: supplemental.sponsor?.zip,
      relationship: supplemental.sponsor?.relationship,
      employer: supplemental.sponsor?.employer,
      title: supplemental.sponsor?.position,
      years: supplemental.sponsor?.years_employed != null ? String(supplemental.sponsor.years_employed) : undefined,
      income,
    },
    financial: {
      annualProjectedTuitionExpense: tuitionExpense,
      annualSupportAmount: supportAmount,
    },
  };
}

function inferCarolineDegreeProgram(course: Record<string, any> | null): string | undefined {
  const degree = asString(course?.degree_level).toLowerCase();
  const name = asString(course?.course_name).toLowerCase();
  if (degree.startsWith("bachelor") || name.includes("bba")) return "bba";
  if (name.includes("computer") || name.includes("information system")) return "mcis";
  if (name.includes("philosophy") && degree.startsWith("doctor")) return "dphil";
  if (name.includes("philosophy")) return "mphil";
  if (degree.startsWith("doctor")) return "dba";
  if (degree.startsWith("master")) return "mba";
  return undefined;
}

function buildCarolineApplicationFormData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  survey: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): Record<string, any> {
  const splitName = splitFullName(profile.full_name);
  const preferredStart = parsePreferredStart(supplemental.preferred_start_term);
  const answers = (survey?.answers ?? {}) as Record<string, any>;
  const nationality = asString(identity?.nationality ?? identity?.country) || undefined;
  const isUsCitizen = nationality?.toLowerCase().includes("united states") || nationality?.toLowerCase() === "usa" || false;
  const maritalRaw = asString(identity?.marital_status).toLowerCase();
  const maritalStatus = maritalRaw.includes("married") ? "married" : maritalRaw.includes("single") ? "single" : undefined;
  const gender = asString(answers.gender).toUpperCase();

  return {
    student: {
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      middleName: splitName.middleName,
      dateOfBirth: maybeFormatDate(identity?.birth_date),
      address: compact(identity?.address) || undefined,
      city: compact(identity?.city) || undefined,
      state: compact(identity?.state) || undefined,
      zip: compact(identity?.zip_code) || undefined,
      phone: compact(profile.phone ?? profile.whatsapp) || undefined,
      email: compact(profile.email) || undefined,
      gender: gender === "M" || gender === "F" ? gender.toLowerCase() : undefined,
      isUsCitizen,
      countryOfCitizenship: isUsCitizen ? undefined : nationality,
      visaStatus: profile.service_type === "cos" ? "F-1 (COS)" : profile.service_type === "transfer" ? "F-1 (Transfer)" : undefined,
      maritalStatus,
      hasHighSchoolDiploma: true,
      preferredSemester: preferredStart.startSemester,
      preferredYear: preferredStart.startYear,
      degreeProgram: inferCarolineDegreeProgram(course),
    },
    emergency: {
      name: compact(supplemental.emergency_contact?.name) || undefined,
      phone: compact(supplemental.emergency_contact?.phone) || undefined,
      relationship: compact(supplemental.emergency_contact?.relationship) || undefined,
      address: compact(supplemental.emergency_contact?.address) || undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
    },
    dependents: [],
    academic: survey?.academic_formation
      ? [{ schoolName: compact(survey.academic_formation) || undefined, location: undefined, duration: undefined, degree: compact(survey.academic_formation) || undefined }]
      : [],
    work: (supplemental.work_experience ?? []).slice(0, 3).map((item) => ({
      duration: compact(item.period) || undefined,
      position: compact(item.position) || undefined,
    })),
    recommenders: (supplemental.recommenders ?? []).slice(0, 2).map((r) => ({
      name: compact(r.name) || undefined,
      position: compact(r.position) || undefined,
      contact: compact(r.contact ?? r.email ?? r.telephone) || undefined,
    })),
  };
}

function buildCarolineI20RequestFormData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  supplemental: SupplementalData,
  identity: Record<string, any> | null,
): Record<string, any> {
  const splitName = splitFullName(profile.full_name);
  const nationality = asString(identity?.nationality ?? identity?.country) || undefined;
  const isUsCitizen = nationality?.toLowerCase().includes("united states") || nationality?.toLowerCase() === "usa" || false;
  const requestType = profile.service_type === "cos" ? "cos" : profile.service_type === "transfer" ? "transfer" : "new_student";
  const usAddress = joinAddress([identity?.address, identity?.city, identity?.state, identity?.zip_code]);
  const foreignAddress = compact(supplemental.emergency_contact?.address) || undefined;

  return {
    student: {
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      middleName: splitName.middleName,
      dateOfBirth: maybeFormatDate(identity?.birth_date),
      placeOfBirth: isUsCitizen ? undefined : nationality,
      countryOfCitizenship: isUsCitizen ? undefined : nationality,
      foreignAddress,
      usAddress,
      requestType,
      degreeProgram: inferCarolineDegreeProgram(course),
    },
    dependents: [],
  };
}

function buildCarolineStatementOfInstitutionalPurposeData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
): CarolineStatementOfInstitutionalPurposeData {
  const splitName = splitFullName(profile.full_name);
  const fullName = compact(
    compact(profile.full_name) || joinNonEmpty([splitName.firstName, splitName.middleName, splitName.lastName]),
  ) || undefined;
  const degreeProgram = compact(course?.course_name) || compact(course?.degree_level) || undefined;
  const signatureDate = maybeFormatDate(new Date().toISOString());

  return {
    student: {
      fullName,
      degreeProgram,
      currentDate: signatureDate,
    },
  };
}

function buildCarolineTuitionRefundPolicyData(
  profile: Record<string, any>,
  course: Record<string, any> | null,
  identity: Record<string, any> | null,
): CarolineTuitionRefundPolicyData {
  const splitName = splitFullName(profile.full_name);
  const fullName = compact(
    compact(profile.full_name) || joinNonEmpty([splitName.firstName, splitName.middleName, splitName.lastName]),
  ) || undefined;
  const degreeProgram = compact(course?.course_name) || compact(course?.degree_level) || undefined;

  return {
    student: {
      fullName,
      degreeProgram,
      dateOfBirth: maybeFormatDate(identity?.birth_date),
    },
  };
}

function buildCarolineScholarshipSupportComplianceAgreementData(): CarolineScholarshipSupportComplianceAgreementData {
  return {
    agency: {
      name: "MIGMA INC",
    },
  };
}

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
  if (formType === "application_packet") {
    return buildOikosApplicationPacketData(profile, course, survey, supplemental, identity);
  }

  if (formType === "all_statements_and_agreement") {
    return buildOikosAllStatementsAgreementData(profile, survey);
  }

  if (formType === "letter_of_recommendation") {
    return buildCarolineLetterOfRecommendationData(profile, supplemental, identity);
  }

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
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineApplicationFormData(profile, course, survey, supplemental, identity);
      }
      return { ...base, institution_name: institution.name, institution_city: institution.city };

    case "i20_request_form":
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineI20RequestFormData(profile, course, supplemental, identity);
      }
      return { ...base, institution_name: institution.name };

    case "statement_of_institutional_purpose":
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineStatementOfInstitutionalPurposeData(profile, course);
      }
      return { ...base, institution_name: institution.name };

    case "tuition_refund_policy":
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineTuitionRefundPolicyData(profile, course, identity);
      }
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
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineAffidavitOfFinancialSupportData(profile, scholarship, supplemental, identity);
      }
      return {
        ...base,
        has_sponsor: supplemental.has_sponsor,
        sponsor: supplemental.sponsor,
        tuition_annual_usd: scholarship?.tuition_annual_usd,
      };

    case "scholarship_support_compliance_agreement":
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("caroline")) {
        return buildCarolineScholarshipSupportComplianceAgreementData();
      }
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
      if ((institution.slug ?? institution.name ?? "").toLowerCase().includes("oikos")) {
        return buildOikosEnrollmentAgreementData(profile, course, survey, supplemental, identity);
      }
      return {
        ...base,
        institution_name: institution.name,
        tuition_annual_usd: scholarship?.tuition_annual_usd,
        course_name: course?.course_name,
        degree_level: course?.degree_level,
        monthly_migma_usd: scholarship?.monthly_migma_usd,
        installments_total: scholarship?.installments_total,
      };

    case "scholarship_agreement":
      return { agency: { name: "MIGMA INC" } };

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

async function resolveTemplatePath(filename: string): Promise<string> {
  const moduleRelativeUrl = new URL(`./templates/${filename}`, import.meta.url);
  const moduleRelativePath = fromFileUrl(moduleRelativeUrl);
  const attempted: string[] = [moduleRelativePath];
  try {
    await Deno.stat(moduleRelativePath);
    return moduleRelativePath;
  } catch {
    // fallback to cwd-based candidates
  }

  const candidates = [
    `./templates/${filename}`,
    `../pdf-template/${filename}`,
    `../../pdf-template/${filename}`,
    `../../../pdf-template/${filename}`,
    `./pdf-template/${filename}`,
    `../${filename}`,
  ];

  for (const candidate of candidates) {
    attempted.push(candidate);
    try {
      await Deno.stat(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(`template file not found: ${filename} | import_meta=${import.meta.url} | cwd=${Deno.cwd()} | attempted=${attempted.join(" ; ")}`);
}

async function loadPdfTemplate(filename: string): Promise<Uint8Array> {
  const baseUrl = Deno.env.get("PDF_TEMPLATE_BASE_URL");
  if (baseUrl) {
    const baseCandidates = [
      baseUrl,
      baseUrl.replace("host.docker.internal", "192.168.2.104"),
      "http://192.168.2.104:8011/",
    ];

    let lastError: string | null = null;
    for (const candidate of [...new Set(baseCandidates.filter(Boolean))]) {
      const remoteUrl = new URL(filename, candidate.endsWith("/") ? candidate : `${candidate}/`);
      try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
          lastError = `template fetch failed: ${remoteUrl.toString()} (${response.status})`;
          continue;
        }
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        lastError = `template fetch failed: ${remoteUrl.toString()} (${error instanceof Error ? error.message : String(error)})`;
      }
    }

    try {
      const resolvedPath = await resolveTemplatePath(filename);
      return await Deno.readFile(resolvedPath);
    } catch (localError) {
      const localMessage = localError instanceof Error ? localError.message : String(localError);
      throw new Error(`${lastError ?? `template fetch failed for ${filename}`} | local fallback failed: ${localMessage}`);
    }
  }

  const resolvedPath = await resolveTemplatePath(filename);
  return await Deno.readFile(resolvedPath);
}

function drawPacketTextField(
  page: PDFPage,
  font: PDFFont,
  value: string,
  field: PacketTextField,
  fontSize = 10,
) {
  const resolved = transformPacketValue(value, field.transform);
  if (!resolved) return;

  const boxWidth = field.width ?? field.maxWidth;
  const boxHeight = field.height ?? (field.fontSize ?? fontSize) + 6;
  const baseSize = field.fontSize ?? fontSize;
  const minSize = field.minFontSize ?? baseSize;
  const paddingLeft = field.paddingLeft ?? 2;
  const paddingRight = field.paddingRight ?? 2;
  const usableWidth = Math.max(0, boxWidth - paddingLeft - paddingRight);

  let drawSize = baseSize;
  while (drawSize > minSize && font.widthOfTextAtSize(resolved, drawSize) > usableWidth) {
    drawSize -= 0.25;
  }

  const text = truncateToWidth(font, resolved, drawSize, usableWidth);
  if (!text) return;

  const textWidth = font.widthOfTextAtSize(text, drawSize);
  const textHeight = font.heightAtSize(drawSize);
  const effectiveTop = field.top - ((field.shrinkTopPerPoint ?? 0) * (baseSize - drawSize));

  let x = field.x + paddingLeft;
  if (field.align === "right") x = field.x + boxWidth - paddingRight - textWidth;
  if (field.align === "center") x = field.x + paddingLeft + Math.max(0, (usableWidth - textWidth) / 2);

  let y = topToPdfY(page, effectiveTop, drawSize) + (field.baselineOffset ?? 0);
  if (field.valign === "middle") {
    y = page.getHeight() - effectiveTop - ((boxHeight - textHeight) / 2) - textHeight + (field.baselineOffset ?? 0);
  }

  page.drawText(text, {
    x,
    y,
    size: drawSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: usableWidth,
  });
}

function drawPacketCheckbox(page: PDFPage, font: PDFFont, x: number, top: number) {
  page.drawText("X", {
    x,
    y: topToPdfY(page, top, 10),
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawPacketGrid(
  page: PDFPage,
  font: PDFFont,
  rows: Array<Record<string, any>>,
  grid: PacketGridField,
) {
  if (rows.length > grid.maxRows) {
    console.warn("[generate-institution-forms] template_row_overflow", {
      formType: "application_packet",
      section: grid.source,
      maxRows: grid.maxRows,
      received: rows.length,
    });
  }

  if (grid.columns && grid.rowTops) {
    rows.slice(0, grid.maxRows).forEach((row, index) => {
      const rowTop = grid.rowTops?.[index];
      if (rowTop == null) return;
      for (const column of grid.columns ?? []) {
        const text = truncateToWidth(font, asString(row[column.key]), 9, column.maxWidth);
        if (!text) continue;
        page.drawText(text, {
          x: column.x,
          y: topToPdfY(page, rowTop, 9),
          size: 9,
          font,
          color: rgb(0, 0, 0),
          maxWidth: column.maxWidth,
        });
      }
    });
    return;
  }

  if (grid.rows) {
    rows.slice(0, grid.maxRows).forEach((row, index) => {
      const rowLayout = grid.rows?.[index];
      if (!rowLayout) return;
      for (const [key, layout] of Object.entries(rowLayout)) {
        const text = truncateToWidth(font, asString(row[key]), 9, layout.maxWidth);
        if (!text) continue;
        page.drawText(text, {
          x: layout.x,
          y: topToPdfY(page, layout.top, 9),
          size: 9,
          font,
          color: rgb(0, 0, 0),
          maxWidth: layout.maxWidth,
        });
      }
    });
  }
}

function drawPacketMultiline(
  page: PDFPage,
  font: PDFFont,
  value: string,
  field: PacketMultilineField,
) {
  const lines = wrapTextToWidth(font, value, field.fontSize, field.width);
  const maxLines = Math.max(1, Math.floor(field.height / field.lineHeight));
  const visible = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    console.warn("[generate-institution-forms] template_multiline_overflow", {
      formType: "application_packet",
      field: field.source,
      lines: lines.length,
      maxLines,
    });
  }

  page.drawText(visible.join("\n"), {
    x: field.x,
    y: topToPdfY(page, field.top, field.fontSize),
    size: field.fontSize,
    font,
    color: rgb(0, 0, 0),
    lineHeight: field.lineHeight,
    maxWidth: field.width,
  });
}

function resolveOverlayTextValue(
  formData: Record<string, any>,
  field: OverlayTextField,
): string {
  let value = asString(getValueAtPath(formData, field.source));

  if (field.transform === "student_display_name") {
    const firstName = asString(getValueAtPath(formData, "student.firstName"));
    const lastName = asString(getValueAtPath(formData, "student.lastName"));
    value = [firstName, lastName].filter(Boolean).join(" ");
  }

  if (field.format === "MM/DD/YYYY") {
    value = maybeFormatDate(value) ?? value;
  }

  if (field.transform === "date_mm" || field.transform === "date_dd" || field.transform === "date_yyyy") {
    const formatted = maybeFormatDate(value) ?? value;
    const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return "";
    if (field.transform === "date_mm") return match[1];
    if (field.transform === "date_dd") return match[2];
    return match[3];
  }

  return value;
}

async function generateOikosVerificationFinancialPdf(
  formData: OikosVerificationFinancialData,
): Promise<Uint8Array> {
  if (!formData.sponsor?.name) {
    throw new Error("verification_of_financial_support requires sponsor.name");
  }

  const templateBytes = await loadPdfTemplate(OIKOS_VERIFICATION_OF_FINANCIAL_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(OIKOS_VERIFICATION_OF_FINANCIAL_V1.text)) {
    const value = resolveOverlayTextValue(formData as unknown as Record<string, any>, field);
    if (!value) {
      if (field.optional) {
        console.info("[generate-institution-forms] template_optional_field_blank", {
          formType: "verification_of_financial_support",
          field: field.source,
        });
      }
      continue;
    }

    drawPacketTextField(page, font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  return await doc.save();
}

function setAcroTextField(form: PDFForm, fieldName: string, value: string | undefined) {
  if (!value) return;
  try {
    form.getTextField(fieldName).setText(value);
  } catch (error) {
    console.warn("[generate-institution-forms] acro_text_field_missing", { fieldName, error });
  }
}

async function generateOikosAllStatementsAgreementPdf(
  formData: OikosAllStatementsAgreementData,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(OIKOS_ALL_STATEMENTS_AND_AGREEMENT_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(OIKOS_ALL_STATEMENTS_AND_AGREEMENT_V1.text)) {
    const value = resolveOverlayTextValue(formData as unknown as Record<string, any>, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      width: field.width,
      height: field.height,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
      valign: field.valign,
      paddingLeft: field.paddingLeft,
      paddingRight: field.paddingRight,
      baselineOffset: field.baselineOffset,
      shrinkTopPerPoint: field.shrinkTopPerPoint,
    });
  }

  for (const field of Object.values(OIKOS_ALL_STATEMENTS_AND_AGREEMENT_V1.multiline)) {
    const value = asString(getValueAtPath(formData as unknown as Record<string, any>, field.source));
    if (!value) continue;
    drawPacketMultiline(pages[field.page], font, value, field);
  }

  return await doc.save();
}

async function generateCarolineLetterOfRecommendationPdf(
  formData: CarolineLetterOfRecommendationData,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_LETTER_OF_RECOMMENDATION_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_LETTER_OF_RECOMMENDATION_V1.text)) {
    const value = resolveOverlayTextValue(formData as unknown as Record<string, any>, field);
    if (!value) {
      if (field.optional) {
        console.info("[generate-institution-forms] template_optional_field_blank", {
          formType: "letter_of_recommendation",
          field: field.source,
        });
      }
      continue;
    }
    drawPacketTextField(page, font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  return await doc.save();
}

async function generateCarolineAffidavitOfFinancialSupportPdf(
  formData: CarolineAffidavitOfFinancialSupportData,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_AFFIDAVIT_OF_FINANCIAL_SUPPORT_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_AFFIDAVIT_OF_FINANCIAL_SUPPORT_V1.text)) {
    const value = resolveOverlayTextValue(formData as unknown as Record<string, any>, field);
    if (!value) {
      if (field.optional) {
        console.info("[generate-institution-forms] template_optional_field_blank", {
          formType: "affidavit_of_financial_support",
          field: field.source,
        });
      }
      continue;
    }
    drawPacketTextField(page, font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  return await doc.save();
}

async function generateCarolineApplicationFormPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_APPLICATION_FORM_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_APPLICATION_FORM_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) {
      if (field.optional) continue;
      console.info("[generate-institution-forms] caroline_app_form_field_blank", { field: field.source });
      continue;
    }
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_APPLICATION_FORM_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateCarolineI20RequestFormPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_I20_REQUEST_FORM_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_I20_REQUEST_FORM_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_I20_REQUEST_FORM_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateCarolineStatementOfInstitutionalPurposePdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_STATEMENT_OF_INSTITUTIONAL_PURPOSE_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_STATEMENT_OF_INSTITUTIONAL_PURPOSE_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_STATEMENT_OF_INSTITUTIONAL_PURPOSE_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateCarolineTuitionRefundPolicyPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_TUITION_REFUND_POLICY_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_TUITION_REFUND_POLICY_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_TUITION_REFUND_POLICY_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateCarolineScholarshipSupportComplianceAgreementPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(CAROLINE_SCHOLARSHIP_SUPPORT_AND_COMPLIANCE_AGREEMENT_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(CAROLINE_SCHOLARSHIP_SUPPORT_AND_COMPLIANCE_AGREEMENT_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(CAROLINE_SCHOLARSHIP_SUPPORT_AND_COMPLIANCE_AGREEMENT_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateOikosEnrollmentAgreementPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(OIKOS_ENROLLMENT_AGREEMENT_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(OIKOS_ENROLLMENT_AGREEMENT_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page,
      x: field.x,
      top: field.top,
      maxWidth: field.maxWidth,
      source: field.source,
      align: field.align,
      fontSize: field.fontSize,
      minFontSize: field.minFontSize,
    });
  }

  for (const field of Object.values(OIKOS_ENROLLMENT_AGREEMENT_V1.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  return await doc.save();
}

async function generateOikosApplicationPacketPdf(
  formData: OikosApplicationPacketData,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(OIKOS_APPLICATION_PACKET_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(OIKOS_APPLICATION_PACKET_V1.overlay.text)) {
    if (!shouldRenderField(formData as unknown as Record<string, any>, field.renderWhen)) continue;
    const value = asString(getValueAtPath(formData as unknown as Record<string, any>, field.source));
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, field);
  }

  for (const field of Object.values(OIKOS_APPLICATION_PACKET_V1.overlay.checkboxes)) {
    const current = normalizeCheckboxValue(getValueAtPath(formData as unknown as Record<string, any>, field.source));
    const expected = normalizeCheckboxValue(field.equals);
    if (current === expected) {
      drawPacketCheckbox(pages[field.page], font, field.x, field.top);
    }
  }

  for (const grid of Object.values(OIKOS_APPLICATION_PACKET_V1.overlay.grids)) {
    const rows = getValueAtPath(formData as unknown as Record<string, any>, grid.source);
    if (!Array.isArray(rows) || rows.length === 0) continue;
    drawPacketGrid(pages[grid.page], font, rows as Array<Record<string, any>>, grid);
  }

  for (const field of Object.values(OIKOS_APPLICATION_PACKET_V1.overlay.multiline)) {
    const value = asString(getValueAtPath(formData as unknown as Record<string, any>, field.source));
    if (!value) continue;
    drawPacketMultiline(pages[field.page], font, value, field);
  }

  return await doc.save();
}

async function generateOikosScholarshipAgreementPdf(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const templateBytes = await loadPdfTemplate(OIKOS_SCHOLARSHIP_AGREEMENT_TEMPLATE_FILENAME);
  const doc = await PDFDocument.load(templateBytes);
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const field of Object.values(OIKOS_SCHOLARSHIP_AGREEMENT_V1.text)) {
    const value = resolveOverlayTextValue(formData, field);
    if (!value) continue;
    drawPacketTextField(pages[field.page], font, value, {
      page: field.page, x: field.x, top: field.top,
      maxWidth: field.maxWidth, source: field.source,
      fontSize: field.fontSize,
    });
  }

  return await doc.save();
}

// ─── PDF generator ────────────────────────────────────────────────────────────

async function generateFormPdf(
  formType: string,
  formData: Record<string, any>,
  institutionName: string,
  profileName: string,
  institutionSlug?: string,
): Promise<Uint8Array> {
  if (formType === "application_packet") {
    return await generateOikosApplicationPacketPdf(formData as OikosApplicationPacketData);
  }

  if (formType === "affidavit_of_financial_support" && institutionSlug?.includes("oikos")) {
    return await generateOikosVerificationFinancialPdf(formData as OikosVerificationFinancialData);
  }

  if (formType === "affidavit_of_financial_support" && institutionSlug?.includes("caroline")) {
    return await generateCarolineAffidavitOfFinancialSupportPdf(formData as CarolineAffidavitOfFinancialSupportData);
  }

  if (formType === "all_statements_and_agreement" && institutionSlug?.includes("oikos")) {
    return await generateOikosAllStatementsAgreementPdf(formData as OikosAllStatementsAgreementData);
  }

  if (formType === "enrollment_agreement" && institutionSlug?.includes("oikos")) {
    return await generateOikosEnrollmentAgreementPdf(formData as OikosEnrollmentAgreementData);
  }

  if (formType === "scholarship_agreement" && institutionSlug?.includes("oikos")) {
    return await generateOikosScholarshipAgreementPdf(formData);
  }

  if (formType === "letter_of_recommendation" && institutionSlug?.includes("caroline")) {
    return await generateCarolineLetterOfRecommendationPdf(formData as CarolineLetterOfRecommendationData);
  }

  if (formType === "application_for_admission" && institutionSlug?.includes("caroline")) {
    return await generateCarolineApplicationFormPdf(formData);
  }

  if (formType === "i20_request_form" && institutionSlug?.includes("caroline")) {
    return await generateCarolineI20RequestFormPdf(formData);
  }

  if (formType === "statement_of_institutional_purpose" && institutionSlug?.includes("caroline")) {
    return await generateCarolineStatementOfInstitutionalPurposePdf(formData);
  }

  if (formType === "tuition_refund_policy" && institutionSlug?.includes("caroline")) {
    return await generateCarolineTuitionRefundPolicyPdf(formData);
  }

  if (formType === "scholarship_support_compliance_agreement" && institutionSlug?.includes("caroline")) {
    return await generateCarolineScholarshipSupportComplianceAgreementPdf(formData);
  }

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
    const { application_id, supplemental_data = {}, debug_env = false, local_test }: Payload = await req.json();
    const isLocalTest = local_test?.enabled === true;

    if (debug_env) {
      return new Response(
        JSON.stringify({
          cwd: Deno.cwd(),
          supabaseUrl,
          hasRemoteUrl: Boolean(Deno.env.get("REMOTE_SUPABASE_URL")),
          hasRemoteServiceRole: Boolean(Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY")),
          hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
          hasSupabaseServiceRole: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
          templateProbe: {
            filename: OIKOS_APPLICATION_PACKET_TEMPLATE_FILENAME,
            exists: await resolveTemplatePath(OIKOS_APPLICATION_PACKET_TEMPLATE_FILENAME).then(() => true).catch((error) => String(error.message ?? error)),
          },
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    let app: Record<string, any> | null = null;
    let institution: Record<string, any>;
    let scholarship: Record<string, any> | null = null;
    let course: Record<string, any> | null = null;
    let survey: Record<string, any> | null = null;
    let resolvedProfile: Record<string, any>;
    let resolvedIdentity: Record<string, any> | null;
    let resolvedSupplemental: SupplementalData;
    let profileIdForStorage = "local-test-profile";

    if (isLocalTest) {
      institution = {
        id: "local-test-institution",
        name: local_test?.institution?.name ?? "Local Test Institution",
        slug: local_test?.institution?.slug ?? "local-test-institution",
        city: local_test?.institution?.city ?? null,
        state: local_test?.institution?.state ?? null,
        modality: local_test?.institution?.modality ?? null,
        cpt_opt: local_test?.institution?.cpt_opt ?? null,
        accepts_cos: local_test?.institution?.accepts_cos ?? null,
        accepts_transfer: local_test?.institution?.accepts_transfer ?? null,
      };
      scholarship = local_test?.scholarship ?? null;
      course = local_test?.course ?? scholarship?.institution_courses ?? null;
      if (scholarship && !scholarship.institution_courses && course) {
        scholarship = { ...scholarship, institution_courses: course };
      }
      survey = local_test?.survey ?? null;
      resolvedProfile = {
        id: "local-test-profile",
        user_id: "local-test-user",
        full_name: null,
        email: null,
        phone: null,
        whatsapp: null,
        num_dependents: null,
        student_process_type: null,
        service_type: null,
        signature_url: null,
        ...(local_test?.profile ?? {}),
      };
      resolvedIdentity = {
        birth_date: null,
        nationality: null,
        marital_status: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        ...(local_test?.identity ?? {}),
      };
      resolvedSupplemental = {
        ...(local_test?.supplemental_data ?? {}),
      };
      profileIdForStorage = resolvedProfile.id ?? profileIdForStorage;
    } else {
      if (!application_id) {
        return new Response(JSON.stringify({ error: "application_id is required" }), { status: 400, headers: CORS });
      }

      // ── 1. Fetch application + institution + scholarship + course ──────────
      const { data: remoteApp, error: appErr } = await supabase
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

      if (appErr || !remoteApp) {
        return new Response(JSON.stringify({ error: "Application not found", detail: appErr?.message }), { status: 404, headers: CORS });
      }
      app = remoteApp as Record<string, any>;

      if (app.status !== "payment_confirmed") {
        return new Response(
          JSON.stringify({ error: "Forms can only be generated after placement fee is confirmed", current_status: app.status }),
          { status: 422, headers: CORS }
        );
      }

      // ── 2. Fetch user profile ──────────────────────────────────────────────
      const { data: profile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, email, phone, whatsapp, num_dependents, student_process_type, service_type, signature_url")
        .eq("id", app.profile_id)
        .single();

      if (profileErr || !profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: CORS });
      }

      // ── 3. Fetch survey answers ────────────────────────────────────────────
      const { data: remoteSurvey } = await supabase
        .from("selection_survey_responses")
        .select("answers, academic_formation, english_level")
        .eq("profile_id", app.profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── 3b. Fetch user_identity — user_id = auth user ID ──────────────────
      const { data: identity } = await supabase
        .from("user_identity")
        .select("birth_date, nationality, marital_status, address, city, state, zip_code, country")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      // ── 4. Resolve supplemental data (payload takes precedence over DB) ───
      resolvedSupplemental = {
        ...(app.supplemental_data ?? {}),
        ...supplemental_data,
      };

      resolvedProfile = profile;
      resolvedIdentity = identity ?? null;
      survey = remoteSurvey ?? null;

      if (Object.keys(supplemental_data).length > 0) {
        await supabase
          .from("institution_applications")
          .update({ supplemental_data: resolvedSupplemental })
          .eq("id", application_id);
      }

      institution = app.institutions as Record<string, any>;
      scholarship = app.institution_scholarships as Record<string, any> ?? null;
      course = scholarship?.institution_courses ?? null;
      profileIdForStorage = app.profile_id ?? profileIdForStorage;
    }

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
    let finalFormList = formList.filter((ft) => {
      if (ft === "affidavit_of_financial_support") return resolvedSupplemental.has_sponsor === true;
      return true;
    });

    if (isLocalTest && Array.isArray(local_test?.form_types) && local_test.form_types.length > 0) {
      finalFormList = [...new Set(local_test.form_types)];
    }

    console.log(`[generate-institution-forms] Institution: ${institution.name} | Forms: ${finalFormList.length} | User: ${resolvedProfile.full_name}${isLocalTest ? " | local_test" : ""}`);

    // ── 6. Mark as generating ────────────────────────────────────────────────
    if (!isLocalTest && app && application_id) {
      await supabase
        .from("institution_applications")
        .update({ forms_status: "generating" })
        .eq("id", application_id);
    }

    // ── 7. Generate + upload PDFs ────────────────────────────────────────────
    const generatedFormIds: string[] = [];
    const localGeneratedPdfs: Array<{ form_type: string; file_name: string; base64: string; resolved_form_data?: Record<string, any> }> = [];
    const now = new Date().toISOString();

    for (const formType of finalFormList) {
      const formData = formType === "affidavit_of_financial_support" && isOikos
        ? buildOikosVerificationFinancialData(resolvedProfile, scholarship, resolvedSupplemental, resolvedIdentity)
        : buildFormData(formType, resolvedProfile, institution, scholarship, course, survey, resolvedSupplemental, resolvedIdentity);
      const pdfBytes  = await generateFormPdf(formType, formData, institution.name, resolvedProfile.full_name ?? "", slug);

      if (isLocalTest) {
        localGeneratedPdfs.push({
          form_type: formType,
          file_name: `${formType}.pdf`,
          base64: uint8ToBase64(pdfBytes),
          resolved_form_data: local_test?.return_resolved_form_data ? formData : undefined,
        });
        continue;
      }

      const storagePath = `${profileIdForStorage}/${application_id}/${formType}.pdf`;

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
          profile_id:     profileIdForStorage,
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
    if (!isLocalTest && application_id) {
      await supabase
        .from("institution_applications")
        .update({ forms_status: "generated", forms_generated_at: now })
        .eq("id", application_id);
    }

    // ── 9. Notify client ──────────────────────────────────────────────────────
    if (!isLocalTest && app) {
      const notifyRes = await fetch(`${supabaseUrl}/functions/v1/migma-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          trigger: "forms_generated",
          user_id: app.profile_id,
          data: { app_url: `${Deno.env.get("APP_BASE_URL") ?? "https://migmainc.com"}/student/dashboard/forms` },
        }),
      });

      if (!notifyRes.ok) {
        console.error("[generate-institution-forms] migma-notify forms_generated failed:", notifyRes.status, await notifyRes.text());
      } else {
        console.log("[generate-institution-forms] ✅ forms_generated notification dispatched for profile", app.profile_id);
      }
    }

    console.log(`[generate-institution-forms] Done. ${(isLocalTest ? localGeneratedPdfs.length : generatedFormIds.length)}/${finalFormList.length} forms generated.`);

    return new Response(
      JSON.stringify({
        success: true,
        institution: institution.name,
        local_test: isLocalTest,
        forms_generated: isLocalTest ? localGeneratedPdfs.length : generatedFormIds.length,
        forms_total: finalFormList.length,
        form_types: finalFormList,
        form_ids: isLocalTest ? [] : generatedFormIds,
        pdfs: isLocalTest ? localGeneratedPdfs : undefined,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[generate-institution-forms] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
