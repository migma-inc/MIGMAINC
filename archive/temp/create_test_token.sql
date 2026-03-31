
DO $$
DECLARE
    v_client_id UUID;
    v_schedule_id UUID;
    v_seller_id UUID;
    v_token TEXT := 'TEST_SCHOLARSHIP_' || floor(random() * 10000)::text;
BEGIN
    -- 1. Get a client (victuribdev@gmail.com)
    SELECT id INTO v_client_id FROM clients WHERE email = 'victuribdev@gmail.com' LIMIT 1;

    -- 2. Get a seller
    SELECT id INTO v_seller_id FROM sellers LIMIT 1;

    -- 3. Get a pending scholarship schedule for this client
    SELECT id INTO v_schedule_id 
    FROM scholarship_recurrence_schedules 
    WHERE client_id = v_client_id AND status = 'pending'
    ORDER BY due_date ASC
    LIMIT 1;

    -- 4. Insert Prefill Token
    IF v_schedule_id IS NOT NULL THEN
        INSERT INTO checkout_prefill_tokens (
            token,
            product_slug,
            seller_id,
            client_data,
            expires_at
        ) VALUES (
            v_token,
            'scholarship-maintenance-fee',
            v_seller_id,
            jsonb_build_object(
                'clientName', 'Paulo Victor Test',
                'clientEmail', 'victuribdev@gmail.com',
                'scholarship_schedule_id', v_schedule_id
            ),
            NOW() + INTERVAL '1 day'
        );
        
        RAISE NOTICE 'Test Token Created: %', v_token;
        RAISE NOTICE 'Link: https://migmainc.com/checkout/visa/scholarship-maintenance-fee?prefill=%', v_token;
    ELSE
        RAISE NOTICE 'No pending schedule found for this client.';
    END IF;
END $$;
