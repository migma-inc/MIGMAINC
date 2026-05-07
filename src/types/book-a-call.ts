export interface BookACallSubmission {
    id: string;
    company_name: string;
    website: string | null;
    country: string;
    contact_name: string;
    email: string;
    phone: string;
    type_of_business: string;
    lead_volume: string;
    challenges: string | null;
    confirmation_accepted: boolean;
    ip_address: string | null;
    created_at: string;
    referral_code: string | null;
    referral_link_id: string | null;
    status: 'novo' | 'em_contato' | 'fechado' | 'descartado';
}
