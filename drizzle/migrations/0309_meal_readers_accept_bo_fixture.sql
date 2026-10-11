-- Leitores/guardas da Alimentação aceitavam só capability com política homologada; a concessão BO (conta técnica sintética,
-- sem política nem atuação, 2h) passa a valer também, apenas quando a própria sessão é conta BO. Contas reais: inalterado.
DO $m$
DECLARE f text; src text; nsrc text;
  pat text := 'c.policy_id IS NOT NULL';
  rep text := '(c.policy_id IS NOT NULL OR (c.policy_id IS NULL AND c.engagement_id IS NULL AND public.bo_fixture_is_user(auth.uid())))';
BEGIN
  FOREACH f IN ARRAY ARRAY['meal_can_read_receiving','meal_grant','meal_has_network','meal_kitchens_at','meal_master_at','meal_network_grant','meal_order_windows_at','meal_orders_at'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f;
    IF src IS NULL THEN RAISE EXCEPTION 'função ausente: %', f; END IF;
    IF position(pat in src) = 0 THEN RAISE NOTICE 'sem padrão em % (mantida)', f; CONTINUE; END IF;
    nsrc := replace(src, pat, rep);
    EXECUTE nsrc;
  END LOOP;
END $m$;