-- Migration: create_institutions_schema
-- Criada para a FASE 1 da V11 (Mapeamento do Catálogo de Instituições)

-- 1. Tabela: institutions
CREATE TABLE public.institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    modality TEXT NOT NULL, -- Ex: 'Híbrido', 'Presencial'
    cpt_opt TEXT NOT NULL, -- Descrição textual simplificada (Ex: '1º dia')
    application_fee_usd NUMERIC NOT NULL,
    bank_statement_min_usd NUMERIC NOT NULL,
    bank_stmt_per_dep_usd NUMERIC NOT NULL,
    esl_flag BOOLEAN NOT NULL DEFAULT false, -- True para escolas de inglês
    accepts_cos BOOLEAN NOT NULL DEFAULT true,
    accepts_transfer BOOLEAN NOT NULL DEFAULT true,
    highlight_badge TEXT, -- Ex: 'Mais Popular', 'Esgotada', 'Exclusivo'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS e Permissão de Leitura Pública
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institutions are visible to everyone" ON public.institutions FOR SELECT USING (true);

-- 2. Tabela: institution_courses
CREATE TABLE public.institution_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    course_name TEXT NOT NULL,
    area TEXT NOT NULL, -- Ex: 'Exatas & Tecnologia', 'Negócios & Gestão'
    degree_level TEXT NOT NULL, -- Ex: 'Graduação', 'Pós-Graduação', 'Mestrado'
    duration_months INTEGER,
    cpt_after_months INTEGER -- 0 para primeiro dia, 9 para 9 meses
);

-- Habilitar RLS e Permissão de Leitura Pública
ALTER TABLE public.institution_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institution courses are visible to everyone" ON public.institution_courses FOR SELECT USING (true);

-- 3. Tabela: institution_scholarships
CREATE TABLE public.institution_scholarships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    placement_fee_usd NUMERIC NOT NULL,
    discount_percent NUMERIC NOT NULL,
    tuition_annual_usd NUMERIC NOT NULL,
    monthly_migma_usd NUMERIC NOT NULL,
    installments_total INTEGER NOT NULL, -- Ex: 48 (Bacharelado), 24 (Mestrado)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS e Permissão de Leitura Pública
ALTER TABLE public.institution_scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institution scholarships are visible to everyone" ON public.institution_scholarships FOR SELECT USING (true);

-- Garantir acesso aos roles anon e authenticated
GRANT SELECT ON public.institutions TO anon, authenticated;
GRANT SELECT ON public.institution_courses TO anon, authenticated;
GRANT SELECT ON public.institution_scholarships TO anon, authenticated;
