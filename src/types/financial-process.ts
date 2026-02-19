export type FinancialProcessType = 'initial' | 'cos' | 'transfer' | 'eb3';
export type FinancialProcessStatus = 'active' | 'completed' | 'cancelled';
export type FinancialStepStatus = 'pending' | 'paid' | 'skipped';

export interface ClientFinancialProcess {
    id: string;
    client_id: string;
    process_type: FinancialProcessType;
    status: FinancialProcessStatus;
    total_steps: number;
    completed_steps: number;
    created_at: string;
    updated_at: string;
}

export interface FinancialProcessStep {
    id: string;
    process_id: string;
    step_number: number;
    step_name: string;
    product_slug: string;
    base_amount: number;
    amount_per_dependent: number;
    status: FinancialStepStatus;
    order_id?: string | null;
    payment_metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface FinancialProcessWithSteps extends ClientFinancialProcess {
    steps: FinancialProcessStep[];
    client?: {
        full_name: string;
        email: string;
    };
}

export const PROCESS_TEMPLATES: Record<FinancialProcessType, {
    name: string;
    steps: Array<{
        step_number: number;
        step_name: string;
        product_slug: string; // This should match visa_products slugs
        base_amount: number;
        amount_per_dependent?: number;
    }>;
}> = {
    initial: {
        name: 'INITIAL Application',
        steps: [
            {
                step_number: 1,
                step_name: 'Selection Process',
                product_slug: 'initial-selection-process',
                base_amount: 400.00,
                amount_per_dependent: 150.00
            },
            {
                step_number: 2,
                step_name: 'Scholarship',
                product_slug: 'initial-scholarship',
                base_amount: 900.00
            },
            {
                step_number: 3,
                step_name: 'I-20 Control',
                product_slug: 'initial-i20-control',
                base_amount: 900.00
            }
        ]
    },
    cos: {
        name: 'Change of Status (COS)',
        steps: [
            {
                step_number: 1,
                step_name: 'Selection Process',
                product_slug: 'cos-selection-process',
                base_amount: 400.00,
                amount_per_dependent: 150.00
            },
            {
                step_number: 2,
                step_name: 'Scholarship',
                product_slug: 'cos-scholarship',
                base_amount: 900.00
            },
            {
                step_number: 3,
                step_name: 'I-20 Control',
                product_slug: 'cos-i20-control',
                base_amount: 900.00
            }
        ]
    },
    transfer: {
        name: 'TRANSFER',
        steps: [
            {
                step_number: 1,
                step_name: 'Selection Process',
                product_slug: 'transfer-selection-process',
                base_amount: 400.00,
                amount_per_dependent: 150.00
            },
            {
                step_number: 2,
                step_name: 'Scholarship',
                product_slug: 'transfer-scholarship',
                base_amount: 900.00
            },
            {
                step_number: 3,
                step_name: 'I-20 Control',
                product_slug: 'transfer-i20-control',
                base_amount: 900.00
            }
        ]
    },
    eb3: {
        name: 'EB-3 Program',
        steps: [
            {
                step_number: 1,
                step_name: 'EB-3 Step Plan – Initial Payment (Contract & Annex)',
                product_slug: 'eb3-step-initial',
                base_amount: 5000.00,
                amount_per_dependent: 500.00
            },
            {
                step_number: 2,
                step_name: 'EB-3 Step Plan – Job Catalog Delivery Payment (Annex)',
                product_slug: 'eb3-step-catalog',
                base_amount: 5000.00,
                amount_per_dependent: 500.00
            },
            {
                step_number: 3,
                step_name: 'EB-3 Installment Plan – Initial Payment (Contract & Annex)',
                product_slug: 'eb3-installment-initial',
                base_amount: 3000.00,
                amount_per_dependent: 500.00
            },
            {
                step_number: 4,
                step_name: 'EB-3 Installment Plan – Job Catalog Delivery Payment (Annex)',
                product_slug: 'eb3-installment-catalog',
                base_amount: 3000.00,
                amount_per_dependent: 500.00
            },
            {
                step_number: 5,
                step_name: 'EB-3 Installment Plan – Monthly Installment (Annex)',
                product_slug: 'eb3-installment-monthly',
                base_amount: 650.00
            }
        ]
    }
};
