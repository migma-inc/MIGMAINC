-- Create client_financial_processes table
CREATE TABLE IF NOT EXISTS public.client_financial_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    process_type TEXT NOT NULL CHECK (process_type IN ('initial', 'cos', 'transfer', 'eb3')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    total_steps INTEGER NOT NULL,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create financial_process_steps table
CREATE TABLE IF NOT EXISTS public.financial_process_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES public.client_financial_processes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    product_slug TEXT NOT NULL, -- Logical link to visa_products
    base_amount NUMERIC NOT NULL,
    amount_per_dependent NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped')),
    order_id UUID REFERENCES public.visa_orders(id) ON DELETE SET NULL, -- Linked when payment is made
    payment_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(process_id, step_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_processes_client_id ON public.client_financial_processes(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_steps_process_id ON public.financial_process_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_financial_steps_order_id ON public.financial_process_steps(order_id);

-- Enable RLS
ALTER TABLE public.client_financial_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_process_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_financial_processes

-- Drop existing policies if any to avoid errors on re-run
DROP POLICY IF EXISTS "Admins can view all financial processes" ON public.client_financial_processes;
DROP POLICY IF EXISTS "Admins can manage financial processes" ON public.client_financial_processes;
DROP POLICY IF EXISTS "Sellers can view financial processes for their leads" ON public.client_financial_processes;

-- Admins can view all
CREATE POLICY "Admins can view all financial processes"
    ON public.client_financial_processes
    FOR SELECT
    USING (
         auth.role() = 'authenticated' AND (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
            OR
            auth.email() LIKE '%@migmainc.com'
        )
    );

-- Admins can insert/update
CREATE POLICY "Admins can manage financial processes"
    ON public.client_financial_processes
    FOR ALL
    USING (
         auth.role() = 'authenticated' AND (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
            OR
            auth.email() LIKE '%@migmainc.com'
        )
    );

-- Sellers can view processes for their clients
CREATE POLICY "Sellers can view financial processes for their leads"
    ON public.client_financial_processes
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.sellers s
            JOIN public.service_requests sr ON sr.seller_id = s.seller_id_public
            WHERE s.user_id = auth.uid() AND sr.client_id = public.client_financial_processes.client_id
        )
    );

-- RLS Policies for financial_process_steps

DROP POLICY IF EXISTS "Admins can view all steps" ON public.financial_process_steps;
DROP POLICY IF EXISTS "Admins can manage steps" ON public.financial_process_steps;
DROP POLICY IF EXISTS "Sellers can view steps for their leads" ON public.financial_process_steps;

-- Admins can view all steps
CREATE POLICY "Admins can view all steps"
    ON public.financial_process_steps
    FOR SELECT
    USING (
         auth.role() = 'authenticated' AND (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
            OR
            auth.email() LIKE '%@migmainc.com'
        )
    );

-- Admins can manage steps
CREATE POLICY "Admins can manage steps"
    ON public.financial_process_steps
    FOR ALL
    USING (
         auth.role() = 'authenticated' AND (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
            OR
            auth.email() LIKE '%@migmainc.com'
        )
    );

-- Sellers can view steps if they can view the parent process
CREATE POLICY "Sellers can view steps for their leads"
    ON public.financial_process_steps
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.client_financial_processes p
            WHERE p.id = public.financial_process_steps.process_id
            AND (
                -- Same logic as parent table policy for seller
                EXISTS (
                    SELECT 1 FROM public.sellers s
                    JOIN public.service_requests sr ON sr.seller_id = s.seller_id_public
                    WHERE s.user_id = auth.uid() AND sr.client_id = p.client_id
                )
            )
        )
    );
