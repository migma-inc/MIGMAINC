-- Fix seller commissions to use the payment completion date as the month of competence
-- and keep per-order commission records consistent with the applied monthly tier.

CREATE OR REPLACE FUNCTION public.calculate_seller_commission(
  p_order_id UUID,
  p_calculation_method TEXT DEFAULT 'monthly_accumulated'
)
RETURNS UUID
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order RECORD;
  v_net_amount DECIMAL(10, 2);
  v_commission_percentage DECIMAL(5, 2);
  v_commission_amount DECIMAL(10, 2);
  v_commission_id UUID;
  v_order_json JSONB;
  v_effective_date TIMESTAMPTZ;
BEGIN
  SELECT
    id,
    seller_id,
    payment_status,
    total_price_usd,
    payment_metadata,
    payment_method,
    created_at,
    paid_at,
    team_id,
    team_name
  INTO v_order
  FROM public.visa_orders
  WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_status NOT IN ('completed', 'paid') THEN
    RAISE NOTICE 'Order % payment status is not commissionable: %', p_order_id, v_order.payment_status;
    RETURN NULL;
  END IF;

  IF v_order.seller_id IS NULL OR v_order.seller_id = '' THEN
    RAISE NOTICE 'Order % has no seller_id', p_order_id;
    RETURN NULL;
  END IF;

  v_effective_date := COALESCE(v_order.paid_at, v_order.created_at);

  IF p_calculation_method = 'monthly_accumulated' THEN
    PERFORM public.recalculate_monthly_commissions(v_order.seller_id, v_effective_date::DATE);

    SELECT id
    INTO v_commission_id
    FROM public.seller_commissions
    WHERE order_id = p_order_id;

    RETURN v_commission_id;
  END IF;

  v_order_json := jsonb_build_object(
    'total_price_usd', v_order.total_price_usd,
    'payment_metadata', v_order.payment_metadata,
    'payment_method', v_order.payment_method
  );

  v_net_amount := public.calculate_net_amount(v_order_json);

  IF v_net_amount <= 0 THEN
    RAISE NOTICE 'Order % has zero or negative net amount: %', p_order_id, v_net_amount;
    RETURN NULL;
  END IF;

  v_commission_percentage := public.get_commission_percentage(v_net_amount);
  v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);

  INSERT INTO public.seller_commissions (
    seller_id,
    order_id,
    net_amount_usd,
    commission_percentage,
    commission_amount_usd,
    calculation_method,
    created_at,
    updated_at,
    team_id,
    team_name
  )
  VALUES (
    v_order.seller_id,
    p_order_id,
    v_net_amount,
    v_commission_percentage,
    v_commission_amount,
    p_calculation_method,
    v_effective_date,
    NOW(),
    v_order.team_id,
    v_order.team_name
  )
  ON CONFLICT (order_id, seller_id, calculation_method) DO UPDATE
  SET
    seller_id = EXCLUDED.seller_id,
    net_amount_usd = EXCLUDED.net_amount_usd,
    commission_percentage = EXCLUDED.commission_percentage,
    commission_amount_usd = EXCLUDED.commission_amount_usd,
    calculation_method = EXCLUDED.calculation_method,
    created_at = EXCLUDED.created_at,
    updated_at = NOW(),
    team_id = EXCLUDED.team_id,
    team_name = EXCLUDED.team_name
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_monthly_commissions(
  p_seller_id TEXT,
  p_month_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  v_start_of_month TIMESTAMPTZ;
  v_end_of_month TIMESTAMPTZ;
  v_total_net_amount DECIMAL(10, 2);
  v_commission_percentage DECIMAL(5, 2);
  v_order_record RECORD;
  v_order_json JSONB;
  v_net_amount DECIMAL(10, 2);
  v_commission_amount DECIMAL(10, 2);
  v_effective_date TIMESTAMPTZ;
BEGIN
  v_start_of_month := DATE_TRUNC('month', p_month_date::TIMESTAMPTZ);
  v_end_of_month := DATE_TRUNC('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month' - INTERVAL '1 second';

  SELECT COALESCE(SUM(
    public.calculate_net_amount(jsonb_build_object(
      'total_price_usd', total_price_usd,
      'payment_metadata', payment_metadata,
      'payment_method', payment_method
    ))
  ), 0)
  INTO v_total_net_amount
  FROM public.visa_orders
  WHERE seller_id = p_seller_id
    AND payment_status IN ('completed', 'paid')
    AND COALESCE(paid_at, created_at) >= v_start_of_month
    AND COALESCE(paid_at, created_at) <= v_end_of_month;

  DELETE FROM public.seller_commissions sc
  WHERE sc.seller_id = p_seller_id
    AND sc.calculation_method = 'monthly_accumulated'
    AND sc.created_at >= v_start_of_month
    AND sc.created_at <= v_end_of_month
    AND NOT EXISTS (
      SELECT 1
      FROM public.visa_orders o
      WHERE o.id = sc.order_id
        AND o.seller_id = p_seller_id
        AND o.payment_status IN ('completed', 'paid')
        AND COALESCE(o.paid_at, o.created_at) >= v_start_of_month
        AND COALESCE(o.paid_at, o.created_at) <= v_end_of_month
    );

  IF v_total_net_amount <= 0 THEN
    RETURN;
  END IF;

  v_commission_percentage := public.get_commission_percentage(v_total_net_amount);

  FOR v_order_record IN
    SELECT
      id,
      total_price_usd,
      payment_metadata,
      payment_method,
      created_at,
      paid_at,
      team_id,
      team_name
    FROM public.visa_orders
    WHERE seller_id = p_seller_id
      AND payment_status IN ('completed', 'paid')
      AND COALESCE(paid_at, created_at) >= v_start_of_month
      AND COALESCE(paid_at, created_at) <= v_end_of_month
    ORDER BY COALESCE(paid_at, created_at), id
  LOOP
    v_order_json := jsonb_build_object(
      'total_price_usd', v_order_record.total_price_usd,
      'payment_metadata', v_order_record.payment_metadata,
      'payment_method', v_order_record.payment_method
    );

    v_net_amount := public.calculate_net_amount(v_order_json);

    IF v_net_amount <= 0 THEN
      DELETE FROM public.seller_commissions
      WHERE order_id = v_order_record.id;
      CONTINUE;
    END IF;

    v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
    v_effective_date := COALESCE(v_order_record.paid_at, v_order_record.created_at);

    INSERT INTO public.seller_commissions (
      seller_id,
      order_id,
      net_amount_usd,
      commission_percentage,
      commission_amount_usd,
      calculation_method,
      created_at,
      updated_at,
      team_id,
      team_name
    )
    VALUES (
      p_seller_id,
      v_order_record.id,
      v_net_amount,
      v_commission_percentage,
      v_commission_amount,
      'monthly_accumulated',
      v_effective_date,
      NOW(),
      v_order_record.team_id,
      v_order_record.team_name
    )
    ON CONFLICT (order_id, seller_id, calculation_method) DO UPDATE
    SET
      seller_id = EXCLUDED.seller_id,
      net_amount_usd = EXCLUDED.net_amount_usd,
      commission_percentage = EXCLUDED.commission_percentage,
      commission_amount_usd = EXCLUDED.commission_amount_usd,
      calculation_method = EXCLUDED.calculation_method,
      created_at = EXCLUDED.created_at,
      updated_at = NOW(),
      team_id = EXCLUDED.team_id,
      team_name = EXCLUDED.team_name;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_calculate_seller_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_old_effective_month DATE;
  v_new_effective_month DATE;
  v_old_seller public.sellers%ROWTYPE;
  v_new_seller public.sellers%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IN ('completed', 'paid')
      AND OLD.seller_id IS NOT NULL
      AND OLD.seller_id <> ''
    THEN
      v_old_effective_month := DATE_TRUNC('month', COALESCE(OLD.paid_at, OLD.created_at))::DATE;

      IF NEW.payment_status NOT IN ('completed', 'paid')
        OR NEW.seller_id IS NULL
        OR NEW.seller_id = ''
        OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
        OR DATE_TRUNC('month', COALESCE(NEW.paid_at, NEW.created_at))::DATE IS DISTINCT FROM v_old_effective_month
      THEN
        PERFORM public.recalculate_monthly_commissions(OLD.seller_id, v_old_effective_month);

        SELECT *
        INTO v_old_seller
        FROM public.sellers
        WHERE seller_id_public = OLD.seller_id;

        IF v_old_seller.head_of_sales_id IS NOT NULL THEN
          PERFORM public.recalculate_hos_monthly_commissions(v_old_seller.head_of_sales_id::TEXT, v_old_effective_month);
        ELSIF v_old_seller.role = 'head_of_sales' THEN
          PERFORM public.recalculate_hos_monthly_commissions(v_old_seller.id::TEXT, v_old_effective_month);
        END IF;
      END IF;
    END IF;

    IF NEW.payment_status IN ('completed', 'paid')
      AND NEW.seller_id IS NOT NULL
      AND NEW.seller_id <> ''
      AND (
        OLD.payment_status NOT IN ('completed', 'paid')
        OR OLD.seller_id IS DISTINCT FROM NEW.seller_id
        OR OLD.paid_at IS DISTINCT FROM NEW.paid_at
        OR DATE_TRUNC('month', COALESCE(OLD.paid_at, OLD.created_at))::DATE IS DISTINCT FROM DATE_TRUNC('month', COALESCE(NEW.paid_at, NEW.created_at))::DATE
      )
    THEN
      v_new_effective_month := DATE_TRUNC('month', COALESCE(NEW.paid_at, NEW.created_at))::DATE;

      PERFORM public.calculate_seller_commission(NEW.id, 'monthly_accumulated');

      SELECT *
      INTO v_new_seller
      FROM public.sellers
      WHERE seller_id_public = NEW.seller_id;

      IF v_new_seller.head_of_sales_id IS NOT NULL THEN
        PERFORM public.recalculate_hos_monthly_commissions(v_new_seller.head_of_sales_id::TEXT, v_new_effective_month);
      ELSIF v_new_seller.role = 'head_of_sales' THEN
        PERFORM public.recalculate_hos_monthly_commissions(v_new_seller.id::TEXT, v_new_effective_month);
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IN ('completed', 'paid')
      AND NEW.seller_id IS NOT NULL
      AND NEW.seller_id <> ''
    THEN
      v_new_effective_month := DATE_TRUNC('month', COALESCE(NEW.paid_at, NEW.created_at))::DATE;

      PERFORM public.calculate_seller_commission(NEW.id, 'monthly_accumulated');

      SELECT *
      INTO v_new_seller
      FROM public.sellers
      WHERE seller_id_public = NEW.seller_id;

      IF v_new_seller.head_of_sales_id IS NOT NULL THEN
        PERFORM public.recalculate_hos_monthly_commissions(v_new_seller.head_of_sales_id::TEXT, v_new_effective_month);
      ELSIF v_new_seller.role = 'head_of_sales' THEN
        PERFORM public.recalculate_hos_monthly_commissions(v_new_seller.id::TEXT, v_new_effective_month);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_calculate_seller_commission ON public.visa_orders;

CREATE TRIGGER trigger_calculate_seller_commission
  AFTER INSERT OR UPDATE OF payment_status, seller_id, paid_at
  ON public.visa_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_seller_commission();

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT DISTINCT
      seller_id,
      DATE_TRUNC('month', COALESCE(paid_at, created_at))::DATE AS effective_month
    FROM public.visa_orders
    WHERE seller_id IS NOT NULL
      AND seller_id <> ''
      AND payment_status IN ('completed', 'paid')
  LOOP
    PERFORM public.recalculate_monthly_commissions(v_row.seller_id, v_row.effective_month);
  END LOOP;
END $$;
