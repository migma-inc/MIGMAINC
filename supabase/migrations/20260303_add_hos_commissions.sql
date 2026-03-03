-- Migration to add Head of Sales Commissions logic

-- 1. Permitir que order_id seja nulo, pois comissões de gestor não estão atreladas a um order específico
ALTER TABLE public.seller_commissions ALTER COLUMN order_id DROP NOT NULL;

-- 2. Função para pegar o percentual do gestor baseado no tier de vendas
CREATE OR REPLACE FUNCTION public.get_hos_commission_percentage(p_net_amount DECIMAL)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_net_amount < 20000.00 THEN
    RETURN 0.5;
  ELSIF p_net_amount < 40000.00 THEN
    RETURN 1.0;
  ELSIF p_net_amount < 60000.00 THEN
    RETURN 2.0;
  ELSIF p_net_amount < 80000.00 THEN
    RETURN 3.0;
  ELSIF p_net_amount < 100000.00 THEN
    RETURN 4.0;
  ELSE
    RETURN 5.0;
  END IF;
END;
$$;

-- 3. Função para recalcular o montante de comissão consolidada do mês pro HOS
CREATE OR REPLACE FUNCTION public.recalculate_hos_monthly_commissions(p_hos_id TEXT, p_month DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hos_seller_record RECORD;
  v_team_net_amount DECIMAL(10, 2) := 0;
  v_commission_percentage DECIMAL(5, 2);
  v_commission_amount DECIMAL(10, 2);
  v_month_start DATE;
BEGIN
  -- p_hos_id is the head_of_sales_id (UUID string) from the sellers table
  SELECT * INTO v_hos_seller_record FROM public.sellers WHERE id = p_hos_id::uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_month_start := DATE_TRUNC('month', p_month)::DATE;

  -- Obter a soma total de valores líquidos das comissões geradas pela equipe no mês
  SELECT COALESCE(SUM(sc.net_amount_usd), 0) INTO v_team_net_amount
  FROM public.seller_commissions sc
  JOIN public.sellers s ON s.seller_id_public = sc.seller_id
  WHERE s.head_of_sales_id = p_hos_id::uuid
    AND sc.calculation_method != 'hos_monthly_bonus'
    AND DATE_TRUNC('month', sc.created_at)::DATE = v_month_start;

  -- Se não houve vendas com valor líquido aplicável no mês
  IF v_team_net_amount <= 0 THEN
    DELETE FROM public.seller_commissions
    WHERE seller_id = v_hos_seller_record.seller_id_public
      AND calculation_method = 'hos_monthly_bonus'
      AND DATE_TRUNC('month', created_at)::DATE = v_month_start;
    RETURN;
  END IF;

  -- Obter a % referente ao valor vendido pela equipe
  v_commission_percentage := public.get_hos_commission_percentage(v_team_net_amount);
  
  -- Calcular o total da comissão ganha
  v_commission_amount := ROUND(v_team_net_amount * v_commission_percentage / 100.0, 2);

  -- Inserir ou atualizar na tabela
  IF EXISTS (
    SELECT 1 FROM public.seller_commissions
    WHERE seller_id = v_hos_seller_record.seller_id_public
      AND calculation_method = 'hos_monthly_bonus'
      AND DATE_TRUNC('month', created_at)::DATE = v_month_start
  ) THEN
    UPDATE public.seller_commissions
    SET
      net_amount_usd = v_team_net_amount,
      commission_percentage = v_commission_percentage,
      commission_amount_usd = v_commission_amount,
      updated_at = NOW()
    WHERE seller_id = v_hos_seller_record.seller_id_public
      AND calculation_method = 'hos_monthly_bonus'
      AND DATE_TRUNC('month', created_at)::DATE = v_month_start;
  ELSE
    INSERT INTO public.seller_commissions (
      seller_id,
      order_id,
      net_amount_usd,
      commission_percentage,
      commission_amount_usd,
      calculation_method,
      available_for_withdrawal_at,
      withdrawn_amount,
      reserved_amount,
      created_at,
      updated_at
    ) VALUES (
      v_hos_seller_record.seller_id_public,
      NULL,
      v_team_net_amount,
      v_commission_percentage,
      v_commission_amount,
      'hos_monthly_bonus',
      NOW(),
      0,
      0,
      v_month_start,
      NOW()
    );
  END IF;
END;
$$;

-- 4. Atualizar o gatilho principal de comissões
CREATE OR REPLACE FUNCTION public.trigger_calculate_seller_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_seller public.sellers%ROWTYPE;
BEGIN
  -- Lógica existente:
  IF (NEW.payment_status = 'completed') AND 
     (NEW.seller_id IS NOT NULL AND NEW.seller_id != '') AND
     (
       (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') OR
       (OLD.seller_id IS NULL OR OLD.seller_id != NEW.seller_id)
     ) THEN
    
    PERFORM calculate_seller_commission(NEW.id, 'monthly_accumulated');
    
    -- NOVIDADE: Recalcular comissão do Head of Sales
    SELECT * INTO v_seller FROM public.sellers WHERE seller_id_public = NEW.seller_id;
    
    IF v_seller.head_of_sales_id IS NOT NULL THEN
      PERFORM recalculate_hos_monthly_commissions(v_seller.head_of_sales_id::text, DATE_TRUNC('month', NEW.created_at)::DATE);
    END IF;

  END IF;
  
  RETURN NEW;
END;
$function$;
