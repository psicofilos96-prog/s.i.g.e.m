-- Concessão escolar BO sai sem atuação; o ato precisa de author_engagement (bq1_actor). Só para conta BO da própria sessão,
-- a atuação marcada da fixture é devolvida — mesmo padrão de bo_fixture_network_engagement na rede.
CREATE OR REPLACE FUNCTION public.meal_grant_on(_capability text, _school text, _on date)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE g uuid; found_any boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','registrar-restricao-alimentar','consultar-restricao-alimentar',
                         'publicar-cardapio-escolar','registrar-estoque-alimentar',
                         'submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-nao-conformidade-alimentar',
                         'ajustar-estoque-alimentar','aprovar-inventario-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id, true INTO g, found_any FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY c.policy_version DESC NULLS LAST, c.engagement_id NULLS LAST LIMIT 1;
  IF NOT coalesce(found_any, false) THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  IF g IS NULL AND public.bo_fixture_is_user(auth.uid()) THEN
    SELECT a.engagement_id INTO g FROM public.bo_fixture_accounts a
      JOIN public.bo_fixture_capability_grants f ON f.user_id = a.user_id AND f.operation_id = a.operation_id
     WHERE a.user_id = auth.uid() AND f.capability_id = _capability AND f.expires_at > now()
       AND ((f.scope_level = 'escola' AND f.school_id = _school) OR f.scope_level = 'rede')
     LIMIT 1;
  END IF;
  RETURN g;
END $function$;