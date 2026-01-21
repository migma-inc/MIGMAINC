export interface Step1FormData {
  clientName: string;
  clientEmail: string;
  dateOfBirth: string;
  documentType: 'passport' | 'id' | 'driver_license' | '';
  documentNumber: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  clientCountry: string;
  clientNationality: string;
  clientWhatsApp: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '';
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FieldErrors {
  [fieldName: string]: string;
}

export interface ValidationResultWithFields {
  valid: boolean;
  errors?: FieldErrors;
  firstErrorField?: string;
}

/**
 * Valida os dados do Step 1 (Personal Information)
 * @param formData Dados do formulário
 * @returns Resultado da validação com mensagens de erro por campo
 */
export function validateStep1(formData: Step1FormData): ValidationResultWithFields {
  const errors: FieldErrors = {};

  if (!formData.clientName.trim()) {
    errors.clientName = 'Full name is required';
  }

  // Email validation: no spaces, must have @, characters before/after @, dot after @, characters after dot
  const email = formData.clientEmail.trim();
  if (!email) {
    errors.clientEmail = 'Email is required';
  } else {
    // Check for spaces
    if (email.includes(' ')) {
      errors.clientEmail = 'Email cannot contain spaces';
    } else if (!email.includes('@')) {
      errors.clientEmail = 'Email must contain @';
    } else {
      const emailParts = email.split('@');
      if (emailParts.length !== 2) {
        errors.clientEmail = 'Invalid email format';
      } else {
        const [localPart, domainPart] = emailParts;

        // Check characters before @
        if (!localPart || localPart.length === 0) {
          errors.clientEmail = 'Email must have characters before @';
        } else if (!domainPart || domainPart.length === 0) {
          errors.clientEmail = 'Email must have characters after @';
        } else if (!domainPart.includes('.')) {
          errors.clientEmail = 'Email must have a dot after @';
        } else {
          const domainParts = domainPart.split('.');
          const lastPart = domainParts[domainParts.length - 1];
          if (!lastPart || lastPart.length === 0) {
            errors.clientEmail = 'Email must have characters after the dot';
          }
        }
      }
    }
  }

  // Date of Birth validation: minimum year (>= 1900), valid date, must be in the past, accept day 31
  if (!formData.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required';
  } else {
    const birthDate = new Date(formData.dateOfBirth);

    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
      errors.dateOfBirth = 'Invalid date of birth';
    } else {
      // Check minimum year (1900)
      const year = birthDate.getFullYear();
      if (year < 1900) {
        errors.dateOfBirth = 'Date of birth year must be 1900 or later';
      } else {
        // Check if date is in the past (not today or future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const birthDateNormalized = new Date(birthDate);
        birthDateNormalized.setHours(0, 0, 0, 0);

        if (birthDateNormalized >= today) {
          errors.dateOfBirth = 'Date of birth must be in the past';
        }
      }
    }
  }

  if (!formData.documentType) {
    errors.documentType = 'Document type is required';
  }

  if (!formData.documentNumber.trim() || formData.documentNumber.length < 5) {
    errors.documentNumber = 'Document number is required (minimum 5 characters)';
  }

  if (!formData.addressLine.trim()) {
    errors.addressLine = 'Address is required';
  }

  // City validation: only letters, spaces, hyphens, and apostrophes (no numbers)
  const city = formData.city.trim();
  if (!city) {
    errors.city = 'City is required';
  } else {
    const cityRegex = /^[a-zA-Z\u00C0-\u00FF\s\-']+$/;
    if (!cityRegex.test(city)) {
      errors.city = 'City must contain only letters (including accents), spaces, hyphens, and apostrophes';
    }
  }

  // State validation: only letters, spaces, hyphens, and apostrophes (no numbers)
  const state = formData.state.trim();
  if (!state) {
    errors.state = 'State is required';
  } else {
    const stateRegex = /^[a-zA-Z\u00C0-\u00FF\s\-']+$/;
    if (!stateRegex.test(state)) {
      errors.state = 'State must contain only letters (including accents), spaces, hyphens, and apostrophes';
    }
  }

  if (!formData.postalCode.trim()) {
    errors.postalCode = 'Postal code is required';
  }

  if (!formData.clientCountry.trim()) {
    errors.clientCountry = 'Country is required';
  }

  if (!formData.clientNationality.trim()) {
    errors.clientNationality = 'Nationality is required';
  }

  // WhatsApp validation: required and must start with +
  const whatsapp = formData.clientWhatsApp.trim();
  if (!whatsapp) {
    errors.clientWhatsApp = 'WhatsApp with country code (e.g., +1) is required';
  } else if (!whatsapp.startsWith('+')) {
    errors.clientWhatsApp = 'WhatsApp must start with country code (e.g., +1)';
  } else if (whatsapp.replace(/\D/g, '').length < 7) {
    errors.clientWhatsApp = 'Phone number is too short (min. 7 digits including country code).';
  }

  if (!formData.maritalStatus) {
    errors.maritalStatus = 'Marital status is required';
  }

  const valid = Object.keys(errors).length === 0;
  const firstErrorField = valid ? undefined : Object.keys(errors)[0];

  return {
    valid,
    errors: valid ? undefined : errors,
    firstErrorField
  };
}
















