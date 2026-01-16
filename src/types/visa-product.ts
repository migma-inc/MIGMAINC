export interface VisaProduct {
    id: string;
    slug: string;
    name: string;
    description: string;
    base_price_usd: string;
    price_per_dependent_usd: string;
    allow_extra_units: boolean;
    extra_unit_label: string;
    extra_unit_price: string;
    calculation_type: 'base_plus_units' | 'units_only';
}
