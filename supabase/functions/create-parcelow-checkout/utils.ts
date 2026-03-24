/**
 * Clean and validate CPF/CNPJ
 * Removes formatting and ensures it's a valid length
 */
export function cleanDocumentNumber(doc: string | null | undefined): string | null {
  if (!doc) return null;

  // Remove all non-numeric characters
  const cleaned = doc.replace(/\D/g, '');

  // CPF should have 11 digits, CNPJ should have 14 digits
  if (cleaned.length !== 11 && cleaned.length !== 14) {
    console.warn(`[Parcelow] Document has unexpected length: ${cleaned.length} (expected 11 for CPF or 14 for CNPJ). Value: ${cleaned}`);
  }

  return cleaned;
}

/**
 * Maps frontend payment method strings to Parcelow numeric codes
 * 1: Credit Card, 2: PIX, 4: TED
 */
export function mapPaymentMethod(method: string | undefined): number | undefined {
  if (!method) return undefined;
  
  // If it's already a number or a string representation of a number
  const numericMethod = parseInt(method);
  if (!isNaN(numericMethod) && [1, 2, 4].includes(numericMethod)) {
    return numericMethod;
  }

  switch (method.toLowerCase()) {
    case 'card':
    case 'parcelow_card':
    case 'credit_card': return 1;
    case 'pix':
    case 'parcelow_pix': return 2;
    case 'ted':
    case 'parcelow_ted': return 4;
    default: return undefined;
  }
}
