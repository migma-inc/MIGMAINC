// Terms version constant
export const TERMS_VERSION = 'v1.0-2025-01-15';

// localStorage key for draft
export const DRAFT_STORAGE_KEY = 'visa_checkout_draft';

// Lista de países (sem "Other") - já ordenada alfabeticamente
const countriesList = [
  'Angola', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Cape Verde',
  'Chile', 'Colombia', 'Czech Republic', 'Denmark', 'Ecuador', 'Finland', 'France', 'Germany',
  'Hong Kong', 'Ireland', 'Italy', 'Japan', 'Mexico', 'Mozambique', 'Netherlands', 'New Zealand',
  'Norway', 'Paraguay', 'Peru', 'Poland', 'Portugal', 'Singapore', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'United Kingdom', 'United States', 'Uruguay', 'Venezuela'
];

/**
 * Retorna lista de países ordenada alfabeticamente com "Other" sempre por último
 * @returns Array de países ordenado
 */
export function getSortedCountries(): string[] {
  return [...countriesList, 'Other'];
}

// Lista de países ordenada (com "Other" no final)
export const countries = getSortedCountries();

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











