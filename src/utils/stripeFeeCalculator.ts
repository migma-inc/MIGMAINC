/**
 * Calculadora de taxas do Stripe (Frontend) — portada do Matricula USA
 */

export async function getExchangeRate(): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (response.ok) {
      const data = await response.json();
      const baseRate = parseFloat(data.rates.BRL);
      return Math.round(baseRate * 1.04 * 1000) / 1000; // +4% margem comercial
    }
    throw new Error('API falhou');
  } catch {
    return 5.6; // fallback
  }
}

/**
 * Valor a cobrar no cartão USD para receber netAmount líquido após taxas Stripe.
 * Taxa: 3.9% + $0.30 (conservadora — cobre cartões internacionais)
 */
export function calculateCardAmountWithFees(netAmount: number): number {
  const STRIPE_PCT = 0.039;
  const STRIPE_FIXED = 0.30;
  return Math.round(((netAmount + STRIPE_FIXED) / (1 - STRIPE_PCT)) * 100) / 100;
}

/**
 * Valor a cobrar em BRL (PIX) para receber netAmountUSD líquido.
 * Taxa Stripe PIX: ~1.8% (processamento + conversão). IOF de 3.5% adicionado automaticamente.
 */
export function calculatePIXAmountWithFees(netAmountUSD: number, exchangeRate: number): number {
  const STRIPE_PIX_PCT = 0.018;
  const netBRL = netAmountUSD * exchangeRate;
  return Math.round((netBRL / (1 - STRIPE_PIX_PCT)) * 100) / 100;
}

export function calculatePIXTotalWithIOF(netAmountUSD: number, exchangeRate: number): {
  baseAmount: number;
  totalWithIOF: number;
  iofAmount: number;
} {
  const IOF = 0.035;
  const baseAmount = calculatePIXAmountWithFees(netAmountUSD, exchangeRate);
  const iofAmount = Math.round(baseAmount * IOF * 100) / 100;
  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    totalWithIOF: Math.round((baseAmount + iofAmount) * 100) / 100,
    iofAmount,
  };
}
