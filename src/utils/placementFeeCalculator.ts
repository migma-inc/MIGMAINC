/**
 * Calcula o Placement Fee do aluno Migma.
 * Fórmula: 20% do annual_value_with_scholarship da bolsa escolhida.
 */

export function getPlacementFee(annualValue: number, overrideAmount?: number | null): number {
  if (overrideAmount != null && overrideAmount > 0) return overrideAmount;
  return Math.round(annualValue * 0.20 * 100) / 100;
}

export function formatPlacementFee(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
