interface VisaProduct {
  base_price_usd: string;
  extra_unit_price: string;
  calculation_type: 'base_plus_units' | 'units_only';
  allow_extra_units: boolean;
}

type PaymentMethod = 'card' | 'pix' | 'zelle';

// Stripe fee constants (matching backend)
const CARD_FEE_PERCENTAGE = 0.039; // 3.9%
const CARD_FEE_FIXED = 0.30; // $0.30
const PIX_FEE_PERCENTAGE = 0.0179; // 1.79% (1.19% processing + 0.6% conversion)

/**
 * Obtém o IP do cliente usando um serviço externo
 * @returns IP do cliente ou string vazia em caso de erro
 */
export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || '';
  } catch (error) {
    console.warn('Failed to get client IP:', error);
    return '';
  }
}

/**
 * Obtém o user agent do navegador
 * @returns User agent string
 */
export function getUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

/**
 * Calcula o total base (antes das taxas) baseado no tipo de cálculo do produto
 * @param product Produto visa
 * @param extraUnits Número de unidades extras (dependentes)
 * @returns Total base em USD
 */
export function calculateBaseTotal(product: VisaProduct, extraUnits: number): number {
  if (product.calculation_type === 'units_only') {
    // Se for units_only, o preço é apenas extra_units * extra_unit_price
    return extraUnits * parseFloat(product.extra_unit_price);
  } else {
    // base_plus_units: base_price + (extra_units * extra_unit_price)
    const basePrice = parseFloat(product.base_price_usd);
    const extraPrice = extraUnits * parseFloat(product.extra_unit_price);
    return basePrice + extraPrice;
  }
}

/**
 * Calcula o total com taxas baseado no método de pagamento
 * @param baseTotal Total base antes das taxas
 * @param paymentMethod Método de pagamento (card, pix, zelle)
 * @param exchangeRate Taxa de câmbio para PIX (opcional)
 * @returns Total com taxas aplicadas
 */
export function calculateTotalWithFees(
  baseTotal: number,
  paymentMethod: PaymentMethod,
  exchangeRate?: number
): number {
  if (paymentMethod === 'zelle') {
    // Zelle não tem taxas
    return baseTotal;
  }

  if (paymentMethod === 'pix' && exchangeRate) {
    // PIX: 1.79% fee (already includes conversion)
    // netAmountBRL = baseTotal * exchangeRate
    // grossAmountBRL = netAmountBRL / (1 - PIX_FEE_PERCENTAGE)
    const netAmountBRL = baseTotal * exchangeRate;
    const grossAmountBRL = netAmountBRL / (1 - PIX_FEE_PERCENTAGE);
    return grossAmountBRL;
  }

  if (paymentMethod === 'card') {
    // Card: 3.9% + $0.30
    return baseTotal + (baseTotal * CARD_FEE_PERCENTAGE) + CARD_FEE_FIXED;
  }

  // Fallback: retornar total base
  return baseTotal;
}











