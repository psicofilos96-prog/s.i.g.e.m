-- Decisão do proprietário 2026-10-13: cada conta de setor opera com as funções da sua estação.
-- As portas da Alimentação passam a aceitar a concessão da estação (sector_station_grants),
-- já homologada por regra versionada; autoria continua carimbada por author_principal_id.
CREATE OR REPLACE FUNCTION public.sector_holds_on(_capability text, _school text, _on date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sector_station_grants(_on) s
    WHERE s.capability_id = _capability
      AND (s.scope_level = 'rede' OR (_school IS NOT NULL AND s.school_id = _school)))
$$;
REVOKE ALL ON FUNCTION public.sector_holds_on(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sector_holds_on(text, text, date) TO authenticated;

DO $do$
DECLARE f record; def text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('meal_grant','meal_has_network','meal_can_read_receiving','meal_kitchens_at',
      'meal_network_grant','meal_network_grant_on','meal_order_windows_at','meal_orders_at','meal_master_at')
  LOOP
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'public.bo_fixture_is_user(auth.uid())', '(public.bo_fixture_is_user(auth.uid()) OR public.current_principal_id() IS NOT NULL)');
    def := replace(def, 'c.engagement_id IS NULL AND fx)', 'c.engagement_id IS NULL AND (fx OR public.current_principal_id() IS NOT NULL))');
    def := replace(def, 'c.policy_id IS NOT NULL AND c.scope_level = ''rede''', '(c.policy_id IS NOT NULL OR (c.engagement_id IS NULL AND public.current_principal_id() IS NOT NULL)) AND c.scope_level = ''rede''');
    IF f.proname = 'meal_grant' THEN
      def := replace(def, 'IF g IS NULL THEN RAISE EXCEPTION ''capability:%''', 'IF g IS NULL AND NOT public.sector_holds_on(_capability, _school, CURRENT_DATE) THEN RAISE EXCEPTION ''capability:%''');
    ELSIF f.proname = 'meal_network_grant' THEN
      def := replace(def, 'IF g IS NULL THEN RAISE EXCEPTION ''capability:%''', 'IF g IS NULL AND NOT public.sector_holds_on(_capability, NULL, CURRENT_DATE) THEN RAISE EXCEPTION ''capability:%''');
    ELSIF f.proname = 'meal_network_grant_on' THEN
      def := replace(def, 'IF g IS NULL THEN RAISE EXCEPTION ''capability:%''', 'IF g IS NULL AND NOT public.sector_holds_on(_capability, NULL, _on) THEN RAISE EXCEPTION ''capability:%''');
    END IF;
    EXECUTE def;
  END LOOP;
END $do$;