// Terms version constant
export const TERMS_VERSION = 'v1.0-2025-01-15';

// localStorage key for draft
export const DRAFT_STORAGE_KEY = 'visa_checkout_draft';

// Lista de países
export const countries = [
  'Brazil', 'Portugal', 'Angola', 'Mozambique', 'Cape Verde', 'United States', 'United Kingdom',
  'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
  'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
  'Ireland', 'New Zealand', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Mexico', 'Argentina',
  'Chile', 'Colombia', 'Peru', 'Ecuador', 'Uruguay', 'Paraguay', 'Venezuela', 'Other'
];

// Mapeamento de países para códigos de telefone
export const countryPhoneCodes: Record<string, string> = {
  'Brazil': '+55',
  'Portugal': '+351',
  'Angola': '+244',
  'Mozambique': '+258',
  'Cape Verde': '+238',
  'United States': '+1',
  'United Kingdom': '+44',
  'Canada': '+1',
  'Australia': '+61',
  'Germany': '+49',
  'France': '+33',
  'Spain': '+34',
  'Italy': '+39',
  'Netherlands': '+31',
  'Belgium': '+32',
  'Switzerland': '+41',
  'Austria': '+43',
  'Sweden': '+46',
  'Norway': '+47',
  'Denmark': '+45',
  'Finland': '+358',
  'Poland': '+48',
  'Czech Republic': '+420',
  'Ireland': '+353',
  'New Zealand': '+64',
  'Japan': '+81',
  'South Korea': '+82',
  'Singapore': '+65',
  'Hong Kong': '+852',
  'Mexico': '+52',
  'Argentina': '+54',
  'Chile': '+56',
  'Colombia': '+57',
  'Peru': '+51',
  'Ecuador': '+593',
  'Uruguay': '+598',
  'Paraguay': '+595',
  'Venezuela': '+58',
  'Other': '+',
};

/**
 * Obtém o código telefônico de um país
 * @param country Nome do país
 * @returns Código telefônico (ex: '+55') ou '+' se não encontrado
 */
export function getPhoneCodeFromCountry(country: string): string {
  return countryPhoneCodes[country] || '+';
}
















