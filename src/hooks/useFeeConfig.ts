/**
 * Hook para valores de taxas — versão Migma (simplificada do Matricula USA).
 * Migma usa sempre placement_fee_flow = true, então não há scholarship_fee padrão.
 */

const DEFAULT_FEES = {
  selection_process_fee: 400,    // USD 400
  application_fee_default: 400,  // varia por bolsa, mas 400 é o padrão
  scholarship_fee_default: 900,  // não usado no fluxo Migma (placement_fee_flow = true)
  i20_control_fee: 900,
  placement_fee_default: 0,      // calculado dinamicamente: 20% da anuidade
};

export interface FeeConfig {
  selection_process_fee: number;
  application_fee_default: number;
  scholarship_fee_default: number;
  i20_control_fee: number;
}

export const useFeeConfig = (_userId?: string) => {
  const getFeeAmount = (feeType: string, customAmount?: number): number => {
    if (customAmount !== undefined) return customAmount;

    switch (feeType) {
      case 'selection_process': return DEFAULT_FEES.selection_process_fee;
      case 'application_fee': return DEFAULT_FEES.application_fee_default;
      case 'scholarship_fee': return DEFAULT_FEES.scholarship_fee_default;
      case 'i20_control_fee':
      case 'i-20_control_fee': return DEFAULT_FEES.i20_control_fee;
      case 'placement_fee':
      case 'placement': return DEFAULT_FEES.placement_fee_default;
      default: return DEFAULT_FEES.application_fee_default;
    }
  };

  const formatFeeAmount = (amount: number | string): string => {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    const dollars = n >= 10000 ? n / 100 : n;
    return `$${dollars.toFixed(2)}`;
  };

  return {
    feeConfig: DEFAULT_FEES as FeeConfig,
    getFeeAmount,
    formatFeeAmount,
    loading: false,
    error: null,
    userFeeOverrides: null,
    userSystemType: null as 'legacy' | 'simplified' | null,
    userDependents: 0,
  };
};
