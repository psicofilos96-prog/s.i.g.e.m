-- NCARD.1b: a permissão de carteirinha vale por qualquer fonte efetiva de capability (política homologada, estação setorial,
-- fixture técnica com automação ligada), sempre só no escopo da escola. Antes só política homologada contava e contas de estação nunca emitiam.
ALTER TABLE public.student_card_issuances ALTER COLUMN actor_engagement DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.student_card_grant(_school text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid; found boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id, true INTO g, found FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'emitir-carteirinha-estudantil' AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY (c.policy_id IS NOT NULL) DESC, c.engagement_id NULLS LAST LIMIT 1;
  IF NOT coalesce(found, false) THEN RAISE EXCEPTION 'card:capability-missing'; END IF;
  RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.student_card_grant(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.student_card_storage_ok(_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (storage.foldername(_name))[2] IS DISTINCT FROM 'carteirinha' THEN RETURN false; END IF;
  PERFORM public.student_card_grant((storage.foldername(_name))[1]);
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.student_card_storage_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_storage_ok(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final','manter-quadro-permanente-op',
      'manter-catalogo-tecnico-alimentar','manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao',
      'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar',
      'manter-parametros-nutricionais','manter-planejamento-nutricional','administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao','fechar-estoque-alimentar','exportar-relatorios-alimentacao',
      'consultar-alimentacao-escolar','submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-estoque-alimentar',
      'ajustar-estoque-alimentar','aprovar-inventario-alimentar','registrar-execucao-alimentacao','registrar-nao-conformidade-alimentar',
      'manter-modelo-de-documento-escolar','emitir-documento-escolar','consultar-documento-escolar','emitir-carteirinha-estudantil')
    THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $function$;
