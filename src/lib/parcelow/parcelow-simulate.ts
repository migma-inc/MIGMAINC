// Parcelow Simulation Functions

import { ParcelowClient } from './parcelow-client';
import type {
  ParcelowSimulateResponse,
  ParcelowInstallmentOption,
} from './parcelow-types';

/**
 * Simulate payment options for a USD amount
 * Returns installment options in BRL
 */
export async function simulateParcelowPayment(
  client: ParcelowClient,
  amountUSD: number // Amount in USD (dollars, not cents)
): Promise<ParcelowSimulateResponse> {
  // Convert USD to cents
  const amountInCents = Math.round(amountUSD * 100);

  try {
    const response = await client.simulate(amountInCents);
    return response;
  } catch (error: any) {
    throw new Error(`Failed to simulate Parcelow payment: ${error.message}`);
  }
}

/**
 * Get installment options formatted for display
 */
export function formatInstallmentOptions(
  simulateResponse: ParcelowSimulateResponse
): ParcelowInstallmentOption[] {
  return simulateResponse.data?.creditcard || [];
}

/**
 * Calculate total with installment fees
 */
export function calculateInstallmentTotal(
  options: ParcelowInstallmentOption[],
  installments: number
): number | null {
  const option = options.find((opt) => opt.installment === installments);
  if (!option) {
    return null;
  }

  // Parse total (it's a string like "6062.40")
  return parseFloat(option.total);
}

/**
 * Get monthly payment amount
 */
export function getMonthlyPayment(
  options: ParcelowInstallmentOption[],
  installments: number
): number | null {
  const option = options.find((opt) => opt.installment === installments);
  if (!option) {
    return null;
  }

  // Parse monthly (it's a string like "3061.21")
  return parseFloat(option.monthly);
}

/**
 * Get exchange rate from simulation
 */
export function getExchangeRate(
  simulateResponse: ParcelowSimulateResponse
): number {
  const rate = parseFloat(simulateResponse.data?.dolar || '0');
  return rate;
}

/**
 * Get TED amount (bank transfer option)
 */
export function getTEDAmount(
  simulateResponse: ParcelowSimulateResponse
): number {
  const amount = parseFloat(simulateResponse.data?.ted?.amount || '0');
  return amount;
}
