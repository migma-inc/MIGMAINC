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

/**
 * Valida os dados do Step 1 (Personal Information)
 * @param formData Dados do formulário
 * @returns Resultado da validação com mensagem de erro se inválido
 */
export function validateStep1(formData: Step1FormData): ValidationResult {
  if (!formData.clientName.trim()) {
    return { valid: false, error: 'Full name is required' };
  }
  
  if (!formData.clientEmail.trim() || !formData.clientEmail.includes('@')) {
    return { valid: false, error: 'Valid email is required' };
  }
  
  if (!formData.dateOfBirth) {
    return { valid: false, error: 'Date of birth is required' };
  }
  
  if (!formData.documentType) {
    return { valid: false, error: 'Document type is required' };
  }
  
  if (!formData.documentNumber.trim() || formData.documentNumber.length < 5) {
    return { valid: false, error: 'Document number is required (minimum 5 characters)' };
  }
  
  if (!formData.addressLine.trim()) {
    return { valid: false, error: 'Address is required' };
  }
  
  if (!formData.city.trim()) {
    return { valid: false, error: 'City is required' };
  }
  
  if (!formData.state.trim()) {
    return { valid: false, error: 'State is required' };
  }
  
  if (!formData.postalCode.trim()) {
    return { valid: false, error: 'Postal code is required' };
  }
  
  if (!formData.clientCountry.trim()) {
    return { valid: false, error: 'Country is required' };
  }
  
  if (!formData.clientNationality.trim()) {
    return { valid: false, error: 'Nationality is required' };
  }
  
  if (!formData.clientWhatsApp.trim() || !formData.clientWhatsApp.startsWith('+')) {
    return { valid: false, error: 'WhatsApp with country code (e.g., +1) is required' };
  }
  
  if (!formData.maritalStatus) {
    return { valid: false, error: 'Marital status is required' };
  }
  
  return { valid: true };
}












