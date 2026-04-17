-- Migration: create_v11_process_schema
-- Criada para a FASE 1 da V11 (Tabelas de Processos, Documentos e Finanças)

-- 1. institution_applications
CREATE TABLE public.institution_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    scholarship_level_id UUID REFERENCES public.institution_scholarships(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_admin_approval',
    placement_fee_paid_at TIMESTAMPTZ,
    placement_fee_installments INTEGER,
    admin_approved_at TIMESTAMPTZ,
    admin_approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.institution_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own applications" ON public.institution_applications FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert their own applications" ON public.institution_applications FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update their own applications" ON public.institution_applications FOR UPDATE USING (auth.uid() = profile_id);

-- 2. global_document_requests
CREATE TABLE public.global_document_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    document_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    submitted_url TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT
);

ALTER TABLE public.global_document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own documents" ON public.global_document_requests FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update their own documents" ON public.global_document_requests FOR UPDATE USING (auth.uid() = profile_id);

-- 3. institution_forms
CREATE TABLE public.institution_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL,
    template_url TEXT,
    form_data_json JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    signed_url TEXT,
    signed_at TIMESTAMPTZ,
    signature_metadata_json JSONB
);

ALTER TABLE public.institution_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own forms" ON public.institution_forms FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update their own forms" ON public.institution_forms FOR UPDATE USING (auth.uid() = profile_id);

-- 4. recurring_charges
CREATE TABLE public.recurring_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    scholarship_level_id UUID REFERENCES public.institution_scholarships(id) ON DELETE SET NULL,
    monthly_usd NUMERIC NOT NULL,
    installments_total INTEGER NOT NULL,
    installments_paid INTEGER NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    exempted_by_referral BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recurring_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own recurring charges" ON public.recurring_charges FOR SELECT USING (auth.uid() = profile_id);

-- 5. referral_links
CREATE TABLE public.referral_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    unique_code TEXT NOT NULL UNIQUE,
    utm_source TEXT,
    clicks INTEGER NOT NULL DEFAULT 0,
    closures_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own referral link" ON public.referral_links FOR SELECT USING (auth.uid() = profile_id);
