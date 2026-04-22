import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "npm:pdf-lib@^1.17.1";
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
  "statement_of_institutional_purpose",
  "statement_of_faith",
  "code_of_conduct",
  "refund_policy",
  "agreement_to_complete_mandatory_intensives",
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
  statement_of_faith:                         "Statement of Faith",
  code_of_conduct:                            "Code of Conduct",
  refund_policy:                              "Refund Policy",
  agreement_to_complete_mandatory_intensives: "Agreement to Complete Mandatory Intensives",
  christian_faith_statement:                  "Christian Faith Statement",
  termo_responsabilidade_estudante:           "Termo de Responsabilidade do Estudante",
};

const OIKOS_APPLICATION_PACKET_TEMPLATE_FILENAME = "1. Application Packet - OIKOS (1).pdf";
const OIKOS_VERIFICATION_OF_FINANCIAL_TEMPLATE_FILENAME = "5. Verification of Financial  (1).pdf";

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
  align?: "left" | "right";
  transform?: "year2digits_or_suffix" | "year4digits_or_suffix" | "year2digits" | "year4digits" | "phone_area_code" | "phone_local_number";
  width?: number;
  height?: number;
  fontSize?: number;
  minFontSize?: number;
  valign?: "baseline" | "middle";
  paddingLeft?: number;
  paddingRight?: number;
  baselineOffset?: number;
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
  align?: "left" | "right";
  transform?: "student_display_name";
  optional?: boolean;
  format?: "MM/DD/YYYY";
}

interface OikosApplicationPacketData {
  applicant: {
    koreanName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: "M" | "F";
    placeOfBirth?: string;
    ssn?: string;
    driversLicenseNumber?: string;
    driversLicenseState?: string;
    email?: string;
    phoneDay?: string;
    phoneNight?: string;
    visaStatus?: string;
    alienRegistrationNumber?: string;
    usCitizen?: boolean;
    countryOfCitizenship?: string;
    permanentAddress?: string;
    currentAddress?: string;
  };
  maritalStatus?: string;
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
  discoverySource?: {
    internet?: boolean;
    yahoo?: boolean;
    google?: boolean;
    oikosWebsite?: boolean;
    postedFlyer?: boolean;
    personalReferral?: boolean;
    other?: boolean;
    otherText?: string;
  };
  signature?: {
    applicantSignatureText?: string;
    applicantDate?: string;
  };
  i20?: {
    requestType?: "new_student" | "change_of_status" | "transfer_student";
    foreignAddress?: string;
    usAddress?: string;
    dependents?: Array<Record<string, string | undefined>>;
  };
  recommendation?: {
    applicantAddressLine?: string;
    applicantCityStateZip?: string;
    applicantTelephone?: string;
  };
  christianFaith?: {
    name?: string;
    date?: string;
    statement?: string;
  };
  derived?: {
    applicantDisplayName?: string;
    applicantPassportLastName?: string;
    applicantPassportFirstName?: string;
    applicantPassportMiddleName?: string;
    applicantCityStateZip?: string;
    applicantPrimaryPhone?: string;
    applicantDayPhone?: string;
    applicantNightPhone?: string;
    applicantSignatureText?: string;
    christianFaithName?: string;
    christianFaithDate?: string;
    christianFaithStatement?: string;
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

const OIKOS_APPLICATION_PACKET_V1: {
  acroForm: Record<string, PacketTextField>;
  overlay: {
    text: Record<string, PacketTextField>;
    checkboxes: Record<string, PacketCheckboxField>;
    grids: Record<string, PacketGridField>;
    multiline: Record<string, PacketMultilineField>;
  };
} = {
  acroForm: {
    christian_faith_name: { page: 4, x: 0, top: 0, maxWidth: 0, source: "christianFaith.name" },
    christian_faith_date: { page: 4, x: 0, top: 0, maxWidth: 0, source: "christianFaith.date" },
    christian_faith_statement: { page: 4, x: 0, top: 0, maxWidth: 0, source: "christianFaith.statement" },
  },
  overlay: {
    text: {
      applicant_korean_name: { page: 0, x: 112, top: 183, maxWidth: 128, source: "applicant.koreanName" },
      applicant_english_name: { page: 0, x: 320, top: 172, maxWidth: 140, width: 170, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantDisplayName" },
      applicant_ssn: { page: 0, x: 141, top: 206, maxWidth: 82, source: "applicant.ssn" },
      applicant_drivers_license_number: { page: 0, x: 338, top: 206, maxWidth: 70, source: "applicant.driversLicenseNumber" },
      applicant_drivers_license_state: { page: 0, x: 473, top: 206, maxWidth: 52, source: "applicant.driversLicenseState" },
      applicant_permanent_address: { page: 0, x: 180, top: 217, maxWidth: 345, width: 360, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.permanentAddress" },
      applicant_current_address: { page: 0, x: 160, top: 240, maxWidth: 360, width: 372, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.currentAddress" },
      applicant_phone_day_area:   { page: 0, x: 133, top: 283, maxWidth: 38,  fontSize: 10, baselineOffset: 12, source: "applicant.phoneDay",   transform: "phone_area_code"   },
      applicant_phone_day_number: { page: 0, x: 180, top: 283, maxWidth: 100, fontSize: 10, baselineOffset: 12, source: "applicant.phoneDay",   transform: "phone_local_number" },
      applicant_phone_night_area:   { page: 0, x: 302, top: 283, maxWidth: 38,  fontSize: 10, baselineOffset: 12, source: "applicant.phoneNight", transform: "phone_area_code"   },
      applicant_phone_night_number: { page: 0, x: 345, top: 283, maxWidth: 100, fontSize: 10, baselineOffset: 12, source: "applicant.phoneNight", transform: "phone_local_number" },
      applicant_email: { page: 0, x: 160, top: 286, maxWidth: 210, width: 220, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.email" },
      applicant_dob: { page: 0, x: 130, top: 309, maxWidth: 88, width: 92, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.dateOfBirth" },
      applicant_place_of_birth: { page: 0, x: 463, top: 315, maxWidth: 96, source: "applicant.placeOfBirth" },
      applicant_country_of_citizenship: { page: 0, x: 472, top: 354, maxWidth: 110, width: 116, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.countryOfCitizenship" },
      applicant_visa_status: { page: 0, x: 110, top: 377, maxWidth: 110, width: 118, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.visaStatus" },
      applicant_alien_registration_number: { page: 0, x: 408, top: 389, maxWidth: 112, source: "applicant.alienRegistrationNumber" },
      start_year_spring: { page: 0, x: 151, top: 452, maxWidth: 20, baselineOffset: 11, source: "admission.startYear", transform: "year2digits", renderWhen: { path: "admission.startSemester", equals: "spring" } },
      start_year_fall: { page: 0, x: 268, top: 452, maxWidth: 20, baselineOffset: 11, source: "admission.startYear", transform: "year2digits", renderWhen: { path: "admission.startSemester", equals: "fall" } },
      start_year_summer: { page: 0, x: 404, top: 452, maxWidth: 30, baselineOffset: 11, source: "admission.startYear", transform: "year4digits", renderWhen: { path: "admission.startSemester", equals: "summer" } },
      emergency_contact_name: { page: 0, x: 100, top: 633, maxWidth: 150, width: 160, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.name" },
      emergency_contact_phone: { page: 0, x: 392, top: 633, maxWidth: 150, width: 160, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.phone" },
      emergency_contact_address: { page: 0, x: 94, top: 654, maxWidth: 390, width: 410, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "emergencyContact.address" },
      found_other_text: { page: 1, x: 278, top: 593, maxWidth: 245, source: "discoverySource.otherText" },
      applicant_signature_text: { page: 1, x: 150, top: 647, maxWidth: 255, width: 270, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantSignatureText" },
      applicant_signature_date: { page: 1, x: 520, top: 647, maxWidth: 86, width: 86, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "signature.applicantDate", align: "right" },
      i20_last_name: { page: 2, x: 112, top: 183, maxWidth: 116, width: 122, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantPassportLastName" },
      i20_first_name: { page: 2, x: 302, top: 183, maxWidth: 122, width: 128, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantPassportFirstName" },
      i20_middle_name: { page: 2, x: 486, top: 183, maxWidth: 88, width: 90, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantPassportMiddleName" },
      i20_dob: { page: 2, x: 138, top: 236, maxWidth: 112, width: 116, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.dateOfBirth" },
      i20_place_of_birth: { page: 2, x: 423, top: 236, maxWidth: 145, width: 148, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.placeOfBirth" },
      i20_country_of_citizenship: { page: 2, x: 176, top: 272, maxWidth: 360, width: 370, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "applicant.countryOfCitizenship" },
      i20_foreign_address: { page: 2, x: 148, top: 308, maxWidth: 395, width: 404, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.foreignAddress" },
      i20_us_address: { page: 2, x: 132, top: 344, maxWidth: 408, width: 418, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "i20.usAddress" },
      recommendation_applicant_name: { page: 3, x: 136, top: 146, maxWidth: 250, source: "derived.applicantDisplayName" },
      recommendation_applicant_address: { page: 3, x: 82, top: 172, maxWidth: 485, source: "recommendation.applicantAddressLine" },
      recommendation_city_state_zip: { page: 3, x: 164, top: 199, maxWidth: 215, source: "recommendation.applicantCityStateZip" },
      recommendation_applicant_phone: { page: 3, x: 458, top: 193, maxWidth: 96, width: 100, height: 16, fontSize: 10, minFontSize: 8, valign: "middle", baselineOffset: -1, source: "derived.applicantPrimaryPhone" },
    },
    checkboxes: {
      applicant_gender_m: { page: 0, x: 257, top: 319, source: "applicant.gender", equals: "M" },
      applicant_gender_f: { page: 0, x: 279, top: 319, source: "applicant.gender", equals: "F" },
      applicant_us_citizen_yes: { page: 0, x: 186, top: 365, source: "applicant.usCitizen", equals: true },
      applicant_us_citizen_no: { page: 0, x: 214, top: 365, source: "applicant.usCitizen", equals: false },
      start_semester_spring: { page: 0, x: 57, top: 445, source: "admission.startSemester", equals: "spring" },
      start_semester_fall: { page: 0, x: 170, top: 445, source: "admission.startSemester", equals: "fall" },
      start_semester_summer: { page: 0, x: 272, top: 445, source: "admission.startSemester", equals: "summer" },
      degree_ba_biblical_studies: { page: 0, x: 57, top: 514, source: "admission.degreeProgram", equals: "ba_biblical_studies" },
      degree_bm: { page: 0, x: 185, top: 514, source: "admission.degreeProgram", equals: "bm" },
      degree_baba: { page: 0, x: 316, top: 514, source: "admission.degreeProgram", equals: "baba" },
      degree_mdiv: { page: 0, x: 57, top: 553, source: "admission.degreeProgram", equals: "mdiv" },
      degree_mm: { page: 0, x: 184, top: 553, source: "admission.degreeProgram", equals: "mm" },
      degree_mba: { page: 0, x: 316, top: 553, source: "admission.degreeProgram", equals: "mba" },
      degree_dmin: { page: 0, x: 57, top: 593, source: "admission.degreeProgram", equals: "dmin" },
      degree_dma: { page: 0, x: 186, top: 593, source: "admission.degreeProgram", equals: "dma" },
      degree_dba: { page: 0, x: 322, top: 593, source: "admission.degreeProgram", equals: "dba" },
      marital_single: { page: 1, x: 142, top: 43, source: "maritalStatus", equals: "single" },
      marital_married: { page: 1, x: 202, top: 43, source: "maritalStatus", equals: "married" },
      found_internet: { page: 1, x: 44, top: 570, source: "discoverySource.internet", equals: true },
      found_yahoo: { page: 1, x: 115, top: 570, source: "discoverySource.yahoo", equals: true },
      found_google: { page: 1, x: 167, top: 570, source: "discoverySource.google", equals: true },
      found_oikos_website: { page: 1, x: 230, top: 570, source: "discoverySource.oikosWebsite", equals: true },
      found_posted_flyer: { page: 1, x: 363, top: 570, source: "discoverySource.postedFlyer", equals: true },
      found_personal_referral: { page: 1, x: 44, top: 590, source: "discoverySource.personalReferral", equals: true },
      found_other: { page: 1, x: 172, top: 590, source: "discoverySource.other", equals: true },
      i20_request_new_student: { page: 2, x: 109, top: 390, source: "i20.requestType", equals: "new_student" },
      i20_request_change_of_status: { page: 2, x: 197, top: 390, source: "i20.requestType", equals: "change_of_status" },
      i20_request_transfer_student: { page: 2, x: 357, top: 390, source: "i20.requestType", equals: "transfer_student" },
      i20_program_ba_biblical_studies: { page: 2, x: 37, top: 462, source: "admission.degreeProgram", equals: "ba_biblical_studies" },
      i20_program_bm: { page: 2, x: 184, top: 462, source: "admission.degreeProgram", equals: "bm" },
      i20_program_baba: { page: 2, x: 320, top: 463, source: "admission.degreeProgram", equals: "baba" },
      i20_program_mdiv: { page: 2, x: 37, top: 503, source: "admission.degreeProgram", equals: "mdiv" },
      i20_program_mm: { page: 2, x: 186, top: 503, source: "admission.degreeProgram", equals: "mm" },
      i20_program_mba: { page: 2, x: 320, top: 504, source: "admission.degreeProgram", equals: "mba" },
      i20_program_dmin: { page: 2, x: 37, top: 536, source: "admission.degreeProgram", equals: "dmin" },
    },
    grids: {
      personalReferences: {
        page: 1,
        maxRows: 4,
        source: "personalReferences",
        columns: [
          { key: "name", x: 44, maxWidth: 126 },
          { key: "relationship", x: 183, maxWidth: 72 },
          { key: "gender", x: 264, maxWidth: 50 },
          { key: "contactNumber", x: 327, maxWidth: 106 },
          { key: "countryOfCitizenship", x: 444, maxWidth: 130 },
        ],
        rowTops: [126, 153, 180, 207],
      },
      academicBackground: {
        page: 1,
        maxRows: 4,
        source: "academicBackground",
        columns: [
          { key: "schoolName", x: 44, maxWidth: 88 },
          { key: "location", x: 148, maxWidth: 185 },
          { key: "duration", x: 346, maxWidth: 110 },
          { key: "degreeDiploma", x: 472, maxWidth: 98 },
        ],
        rowTops: [289, 317, 344, 371],
      },
      workMinistryExperience: {
        page: 1,
        maxRows: 3,
        source: "workMinistryExperience",
        rows: [
          {
            companyOrChurch: { x: 194, top: 415, maxWidth: 235 },
            duration: { x: 120, top: 435, maxWidth: 64 },
            position: { x: 258, top: 435, maxWidth: 170 },
          },
          {
            companyOrChurch: { x: 194, top: 455, maxWidth: 235 },
            duration: { x: 120, top: 475, maxWidth: 64 },
            position: { x: 258, top: 475, maxWidth: 170 },
          },
          {
            companyOrChurch: { x: 194, top: 495, maxWidth: 235 },
            duration: { x: 120, top: 515, maxWidth: 64 },
            position: { x: 258, top: 515, maxWidth: 170 },
          },
        ],
      },
      dependents: {
        page: 2,
        maxRows: 6,
        source: "i20.dependents",
        columns: [
          { key: "name", x: 38, maxWidth: 102 },
          { key: "relationship", x: 148, maxWidth: 58 },
          { key: "sex", x: 217, maxWidth: 22 },
          { key: "dateOfBirth", x: 251, maxWidth: 74 },
          { key: "placeOfBirth", x: 338, maxWidth: 96 },
          { key: "countryOfCitizenship", x: 447, maxWidth: 98 },
        ],
        rowTops: [626, 645, 663, 682, 700, 719],
      },
    },
    multiline: {
      christian_faith_statement: {
        page: 4,
        x: 58,
        top: 190,
        width: 490,
        height: 405,
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
    student_state: { page: 0, x: 385, top: 198, maxWidth: 30, source: "student.state" },
    student_zip: { page: 0, x: 425, top: 198, maxWidth: 50, source: "student.zip" },
    annual_projected_tuition_expense: { page: 0, x: 360, top: 303, maxWidth: 72, source: "financial.annualProjectedTuitionExpense" },
    sponsor_name: { page: 0, x: 62, top: 354, maxWidth: 205, source: "sponsor.name" },
    sponsor_relationship: { page: 0, x: 286, top: 354, maxWidth: 72, source: "sponsor.relationship" },
    sponsor_telephone: { page: 0, x: 378, top: 354, maxWidth: 110, source: "sponsor.telephone" },
    sponsor_address: { page: 0, x: 62, top: 400, maxWidth: 180, source: "sponsor.address" },
    sponsor_city: { page: 0, x: 267, top: 400, maxWidth: 92, source: "sponsor.city" },
    sponsor_state: { page: 0, x: 354, top: 400, maxWidth: 42, source: "sponsor.state" },
    sponsor_zip: { page: 0, x: 406, top: 400, maxWidth: 52, source: "sponsor.zip" },
    sponsor_name_inline: { page: 0, x: 80, top: 442, maxWidth: 120, source: "sponsor.name" },
    student_name_inline: { page: 0, x: 326, top: 442, maxWidth: 110, source: "student.firstName", transform: "student_display_name" },
    annual_support_amount: { page: 0, x: 370, top: 465, maxWidth: 85, source: "financial.annualSupportAmount" },
    sponsor_signature_text: { page: 0, x: 113, top: 518, maxWidth: 185, source: "sponsor.signatureText", optional: true },
    sponsor_signature_date: { page: 0, x: 386, top: 518, maxWidth: 86, source: "sponsor.signatureDate", format: "MM/DD/YYYY", optional: true },
    sponsor_oath_signature_text: { page: 0, x: 160, top: 663, maxWidth: 190, source: "notary.sponsorOathSignatureText", optional: true },
    subscribed_day: { page: 0, x: 273, top: 707, maxWidth: 34, source: "notary.subscribedDay", optional: true },
    subscribed_month: { page: 0, x: 355, top: 707, maxWidth: 84, source: "notary.subscribedMonth", optional: true },
    subscribed_location: { page: 0, x: 65, top: 728, maxWidth: 170, source: "notary.subscribedLocation", optional: true },
    commission_expires_on: { page: 0, x: 333, top: 728, maxWidth: 165, source: "notary.commissionExpiresOn", optional: true },
    officer_signature_text: { page: 0, x: 62, top: 783, maxWidth: 205, source: "notary.officerSignatureText", optional: true },
    officer_title: { page: 0, x: 307, top: 783, maxWidth: 115, source: "notary.officerTitle", optional: true },
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
  debug_env?: boolean;
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
  while (output.length > 0 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1);
  }
  return output ? `${output}...` : "";
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
  const usAddress = joinAddress([identity?.address, identity?.city, identity?.state, identity?.zip_code]);
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
  const applicantFullName = compact(profile.full_name) || undefined;
  const requestType = profile.service_type === "transfer"
    ? "transfer_student"
    : profile.service_type === "cos"
    ? "change_of_status"
    : "new_student";
  const applicantDisplayName = compact(
    compact(profile.full_name) || joinNonEmpty([splitName.firstName, splitName.middleName, splitName.lastName]),
  );
  const applicantPrimaryPhone = looksLikePhone(profile.phone ?? profile.whatsapp) ? asString(profile.phone ?? profile.whatsapp) : undefined;
  const cityStateZip = joinNonEmpty([identity?.city, identity?.state, identity?.zip_code], ", ");
  const personalReferencesNormalized = (supplemental.recommenders ?? []).slice(0, 4).map((ref) => ({
      name: compact(ref.name) || undefined,
    relationship: compact(ref.position) || undefined,
    gender: undefined,
    contactNumber: looksLikePhone(ref.contact) ? compact(ref.contact) : undefined,
    countryOfCitizenship: undefined,
  }));
  const academicBackgroundNormalized = survey?.academic_formation
    ? [{
        schoolName: compact(survey.academic_formation) || undefined,
        location: undefined,
        duration: undefined,
        degreeDiploma: compact(survey.academic_formation) || undefined,
      }]
    : [];
  const christianFaithStatement = compact(answers.christian_faith_statement ?? answers.faith_statement) || undefined;

  return {
    applicant: {
      firstName: splitName.firstName,
      middleName: splitName.middleName,
      lastName: splitName.lastName,
      fullName: applicantDisplayName || undefined,
      dateOfBirth: applicantDateOfBirth,
      gender: asString(answers.gender).toUpperCase() === "F" ? "F" : asString(answers.gender).toUpperCase() === "M" ? "M" : undefined,
      placeOfBirth,
      email: asString(profile.email) || undefined,
      phoneDay: applicantPrimaryPhone,
      phoneNight: applicantPrimaryPhone,
      visaStatus: profile.service_type === "cos" ? "Change of Status" : profile.service_type === "transfer" ? "Transfer" : undefined,
      usCitizen: nationality?.toLowerCase().includes("united states") || nationality?.toLowerCase() === "usa",
      countryOfCitizenship: nationality,
      permanentAddress: foreignAddress,
      currentAddress: usAddress,
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
    discoverySource: {
      internet: true,
      google: true,
    },
    signature: {
      applicantSignatureText: undefined,
      applicantDate: signatureDate,
    },
    i20: {
      requestType,
      foreignAddress,
      usAddress,
      dependents: [],
    },
    recommendation: {
      applicantAddressLine: usAddress ?? foreignAddress,
      applicantCityStateZip: cityStateZip || undefined,
      applicantTelephone: applicantPrimaryPhone,
    },
    christianFaith: {
      name: applicantDisplayName || undefined,
      date: signatureDate,
      statement: christianFaithStatement,
    },
    derived: {
      applicantDisplayName: applicantDisplayName || undefined,
      applicantPassportLastName: compact(splitName.lastName) || undefined,
      applicantPassportFirstName: compact(splitName.firstName) || undefined,
      applicantPassportMiddleName: compact(splitName.middleName) || undefined,
      applicantCityStateZip: cityStateZip || undefined,
      applicantPrimaryPhone,
      applicantDayPhone: applicantPrimaryPhone,
      applicantNightPhone: applicantPrimaryPhone,
      applicantSignatureText: undefined,
      christianFaithName: applicantDisplayName || undefined,
      christianFaithDate: signatureDate,
      christianFaithStatement,
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
      city: undefined,
      state: undefined,
      zip: undefined,
      signatureDate: undefined,
      signatureText: undefined,
    },
    notary: {},
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

  let x = field.x + paddingLeft;
  if (field.align === "right") x = field.x + boxWidth - paddingRight - textWidth;

  let y = topToPdfY(page, field.top, drawSize) + (field.baselineOffset ?? 0);
  if (field.valign === "middle") {
    y = page.getHeight() - field.top - ((boxHeight - textHeight) / 2) - textHeight + (field.baselineOffset ?? 0);
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
    });
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

  let acroFormFilled = false;
  try {
    const form = doc.getForm();
    form.getTextField("Text13").setText(asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithName")));
    form.getTextField("Text14").setText(asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithDate")));
    form.getTextField("Text16").setText(asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithStatement")));
    form.updateFieldAppearances(font);
    form.flatten();
    acroFormFilled = true;
  } catch (error) {
    console.warn("[generate-institution-forms] packet_acroform_fallback", error);
  }

  if (!acroFormFilled) {
    const fallbackName = asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithName"));
    const fallbackDate = asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithDate"));
    const fallbackStatement = asString(getValueAtPath(formData as unknown as Record<string, any>, "derived.christianFaithStatement"));
    const page = pages[4];

    if (fallbackName) {
      page.drawText(
        truncateToWidth(font, fallbackName, 10, 142),
        { x: 104, y: topToPdfY(page, 160, 10), size: 10, font, color: rgb(0, 0, 0), maxWidth: 142 },
      );
    }
    if (fallbackDate) {
      page.drawText(
        truncateToWidth(font, fallbackDate, 10, 138),
        { x: 415, y: topToPdfY(page, 160, 10), size: 10, font, color: rgb(0, 0, 0), maxWidth: 138 },
      );
    }
    if (fallbackStatement) {
      drawPacketMultiline(page, font, fallbackStatement, OIKOS_APPLICATION_PACKET_V1.overlay.multiline.christian_faith_statement);
    }
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
    const { application_id, supplemental_data = {}, debug_env = false }: Payload = await req.json();

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
      const formData = formType === "affidavit_of_financial_support" && isOikos
        ? buildOikosVerificationFinancialData(profile, scholarship, resolvedSupplemental, identity)
        : buildFormData(formType, profile, institution, scholarship, course, survey, resolvedSupplemental, identity);
      const pdfBytes  = await generateFormPdf(formType, formData, institution.name, profile.full_name ?? "", slug);

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
