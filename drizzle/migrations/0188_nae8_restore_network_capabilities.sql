-- NAE.8 — 0185 regrediu a allowlist de meal_network_grant_on e perdeu capabilities de 0182
-- (conferir/homologar conteúdo técnico, referências contratuais, designação de inspetor). Correção aditiva: união das listas.
CREATE OR REPLACE FUNCTION public.meal_network_grant_on(_capability text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede',
      'manter-planejamento-nutricional','manter-catalogo-tecnico-alimentar','manter-parametros-nutricionais',
      'administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'consolidar-demanda-alimentar','registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao',
      'exportar-relatorios-alimentacao','conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar',
      'manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao',
      'registrar-nao-conformidade-alimentar','transferir-estoque-alimentar','fechar-estoque-alimentar')
    THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant_on(text, date) FROM PUBLIC, anon, authenticated, service_role;