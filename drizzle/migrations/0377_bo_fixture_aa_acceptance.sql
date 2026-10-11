CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
      'manter-modelo-de-documento-escolar','emitir-documento-escolar','consultar-documento-escolar','emitir-carteirinha-estudantil',
      'preparar-mapa-estatistico','oficializar-mapa-estatistico','preparar-censo-escolar','gerir-documentos-funcionais','validar-documentos-funcionais','administrar-docserv',
      'registrar-avaliacao-externa','homologar-avaliacao-externa','acompanhar-avaliacao-externa','manter-regras-avaliacao','homologar-regras-avaliacao',
      'acompanhar-infrequencia','registrar-busca-ativa','registrar-acompanhamento-ei','acompanhar-educacao-infantil')
    THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Append-only continua; só a limpeza da própria operação BO (marcador de sessão + autoria sintética) pode apagar.
CREATE OR REPLACE FUNCTION public.ext_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'avaliacao-externa:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.aa_rule_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'regra-avaliacao:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.ei_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN IF TG_OP = 'DELETE' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF; RAISE EXCEPTION 'educacao-infantil:append-only'; END $$;
CREATE OR REPLACE FUNCTION public.aa_outreach_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (public.bo_fixture_cleanup_row(to_jsonb(OLD))
    OR (TG_TABLE_NAME = 'aa_outreach_cases' AND current_setting('sigem.bo_cleanup_op', true) ~ '^bo-[0-9a-f]{12}$'
        AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = current_setting('sigem.bo_cleanup_op', true) AND a.user_id = OLD.opened_by)))
  THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'busca-ativa:append-only';
END $$;

CREATE FUNCTION public.bo_fixture_cleanup_aa(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _users uuid[]; _n int := 0; _c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO _users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.aa_outreach_events e WHERE e.author_user_id = ANY(_users) OR e.case_id IN (SELECT c.id FROM public.aa_outreach_cases c WHERE c.opened_by = ANY(_users));
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.aa_outreach_cases c WHERE c.opened_by = ANY(_users); GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.ei_feedback_events f WHERE f.author_user_id = ANY(_users); GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.ei_followup_versions v WHERE v.author_user_id = ANY(_users) AND NOT EXISTS (SELECT 1 FROM public.ei_followup_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  DELETE FROM public.ext_result_homologations h WHERE h.author_user_id = ANY(_users) OR h.result_version_id IN (SELECT v.id FROM public.ext_result_versions v WHERE v.author_user_id = ANY(_users));
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.ext_result_versions v WHERE v.author_user_id = ANY(_users) AND NOT EXISTS (SELECT 1 FROM public.ext_result_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  DELETE FROM public.aa_calc_rule_homologations h WHERE h.author_user_id = ANY(_users) OR h.rule_version_id IN (SELECT v.id FROM public.aa_calc_rule_versions v WHERE v.author_user_id = ANY(_users));
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  LOOP DELETE FROM public.aa_calc_rule_versions v WHERE v.author_user_id = ANY(_users) AND NOT EXISTS (SELECT 1 FROM public.aa_calc_rule_versions n WHERE n.supersedes_id = v.id);
    GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c; EXIT WHEN _c = 0; END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_aa(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_aa(text) TO service_role;