CREATE OR REPLACE FUNCTION public.activate_eb2_recurrence(
  p_client_id uuid,
  p_activation_order_id uuid,
  p_seller_id uuid DEFAULT NULL::uuid,
  p_seller_commission_percent numeric DEFAULT NULL::numeric,
  p_manual_activation boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    v_control_id UUID;
    v_start_date DATE;
    i INTEGER;
BEGIN
    -- Reuse the existing recurrence if this order was already activated.
    SELECT id
    INTO v_control_id
    FROM public.eb2_recurrence_control
    WHERE activation_order_id = p_activation_order_id
    LIMIT 1;

    IF v_control_id IS NOT NULL THEN
        RETURN v_control_id;
    END IF;

    -- The first recurring EB-2 installment becomes due 30 days after activation.
    v_start_date := (CURRENT_DATE + INTERVAL '30 days')::date;

    INSERT INTO public.eb2_recurrence_control (
        client_id,
        activation_order_id,
        activation_date,
        recurrence_start_date,
        total_installments,
        program_status,
        seller_id,
        seller_commission_percent,
        manual_activation
    ) VALUES (
        p_client_id,
        p_activation_order_id,
        CURRENT_DATE,
        v_start_date,
        20,
        'active',
        p_seller_id,
        p_seller_commission_percent,
        p_manual_activation
    )
    RETURNING id INTO v_control_id;

    FOR i IN 1..20 LOOP
        INSERT INTO public.eb2_recurrence_schedules (
            client_id,
            order_id,
            installment_number,
            due_date,
            amount_usd,
            status,
            seller_id
        ) VALUES (
            p_client_id,
            p_activation_order_id,
            i,
            (v_start_date + ((i - 1) * INTERVAL '1 month'))::date,
            999.00,
            'pending',
            p_seller_id
        );
    END LOOP;

    RETURN v_control_id;
END;
$function$;
