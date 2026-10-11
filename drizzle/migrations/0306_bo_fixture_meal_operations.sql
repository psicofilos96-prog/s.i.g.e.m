-- LOTE 16 — Alimentação: a camada BO (contas técnicas sintéticas, 2h, cleanup) passa a exercer o fluxo operacional
-- (janela → pedido → autorização → programação → recebimento → estoque → execução → fechamento) só com writers canônicos.
-- Nenhuma conta real ganha permissão; catálogos sintéticos levam o marcador da operação e somem no cleanup.

-- 1) atuação da fixture vai junto da concessão (writers gravam author_engagement)
CREATE OR REPLACE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, e.scope_level, CASE WHEN e.scope_level = 'escola' THEN e.school_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  WHERE e.person_id = public.current_person_id()
    AND e.scope_level IN ('escola','rede')
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, 'rede', NULL::text
  FROM public.calendar_designated_capabilities(_on) d
  UNION ALL
  SELECT g.capability_id, g.engagement_id, NULL::uuid, NULL::integer, g.scope_level, g.school_id
  FROM public.sector_station_grants(_on) g
  UNION ALL
  SELECT f.capability_id, a.engagement_id, NULL::uuid, NULL::integer, f.scope_level, f.school_id
  FROM public.bo_fixture_capability_grants f
  JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
  WHERE f.person_id = public.current_person_id() AND a.user_id = auth.uid()
    AND f.expires_at > now() AND public.technical_automation_enabled()
$function$;

-- 2) allowlist estendida às capabilities operacionais da Alimentação
CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final','manter-quadro-permanente-op',
      'manter-catalogo-tecnico-alimentar','manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao',
      'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar',
      'manter-parametros-nutricionais','administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao','fechar-estoque-alimentar','exportar-relatorios-alimentacao',
      'consultar-alimentacao-escolar','submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-estoque-alimentar',
      'ajustar-estoque-alimentar','aprovar-inventario-alimentar','registrar-execucao-alimentacao','registrar-nao-conformidade-alimentar')
    THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $function$;

-- 3) catálogo sintético com marcador da operação (só esquemas da Alimentação)
CREATE OR REPLACE FUNCTION public.bo_fixture_attribute_value(_operation_id text, _scheme text, _suffix text, _label text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v text;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id) THEN RAISE EXCEPTION 'bo:unknown-operation'; END IF;
  IF _scheme NOT IN ('item-de-estoque-alimentar','unidade-de-medida-alimentar','refeicao-escolar') THEN RAISE EXCEPTION 'bo:scheme-not-allowlisted'; END IF;
  IF _suffix !~ '^[a-z0-9-]{1,30}$' THEN RAISE EXCEPTION 'bo:invalid-suffix'; END IF;
  v := _operation_id || '-' || _suffix;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, change_reason)
    VALUES (_scheme, v, 1, 'BO FIXTURE ' || left(_label, 60), 'homologada', 'bo-fixture:' || _operation_id);
  RETURN v;
END $function$;
REVOKE ALL ON FUNCTION public.bo_fixture_attribute_value(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_attribute_value(text,text,text,text) TO service_role;

-- 4) exceção única dos gatilhos append-only: DELETE de linha da própria operação BO durante o cleanup
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_row(_old jsonb)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE op text := current_setting('sigem.bo_cleanup_op', true);
BEGIN
  IF op IS NULL OR op !~ '^bo-[0-9a-f]{12}$' THEN RETURN false; END IF;
  IF _old ? 'author_user_id' AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op AND a.user_id::text = _old->>'author_user_id') THEN RETURN true; END IF;
  IF _old ? 'scheme_id' AND (_old->>'value_id') LIKE op || '-%' AND (_old->>'change_reason') = 'bo-fixture:' || op THEN RETURN true; END IF;
  IF _old ? 'execution_logical_id' AND EXISTS (SELECT 1 FROM public.meal_daily_executions e JOIN public.bo_fixture_accounts a ON a.user_id = e.author_user_id AND a.operation_id = op
       WHERE e.logical_id::text = _old->>'execution_logical_id') THEN RETURN true; END IF;
  RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_row(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.import_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'import:append-only';
END $function$;
CREATE OR REPLACE FUNCTION public.aa_ledger_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'aa:append-only';
END $function$;
CREATE OR REPLACE FUNCTION public.forbid_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'attribute_value_definitions' AND public.bo_fixture_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Fato oficial é imutável; correção gera nova versão';
END $function$;

-- 5) cleanup também apaga a cadeia operacional da Alimentação da operação (várias passadas respeitam FKs)
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup(_operation_id text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _a record; _n integer := 0; _t text; _pass int; _left int;
  _tables text[] := ARRAY['meal_execution_consumptions','meal_daily_executions','meal_operational_records','meal_stock_closings','meal_stock_counts',
    'meal_evidence_attachments','meal_nonconformities','meal_inventory_movements','meal_receipts','meal_fiscal_documents','meal_delivery_schedules',
    'meal_demand_consolidations','meal_order_opinions','meal_order_versions','meal_order_windows','meal_food_samples','meal_sensitive_access_events'];
  _users uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  SELECT coalesce(array_agg(a.user_id), '{}') INTO _users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  DELETE FROM public.final_sheet_acts f WHERE f.actor_id = ANY(_users);
  DELETE FROM public.final_sheet_rule_versions r WHERE r.author_id = ANY(_users);
  LOOP
    DELETE FROM public.op_permanent_board_versions b WHERE b.author_user_id = ANY(_users)
       AND NOT EXISTS (SELECT 1 FROM public.op_permanent_board_versions n WHERE n.supersedes_id = b.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
  FOR _pass IN 1..8 LOOP
    _left := 0;
    FOREACH _t IN ARRAY _tables LOOP
      BEGIN
        IF _t = 'meal_execution_consumptions' THEN
          DELETE FROM public.meal_execution_consumptions c WHERE c.execution_logical_id IN (SELECT e.logical_id FROM public.meal_daily_executions e WHERE e.author_user_id = ANY(_users));
        ELSE
          EXECUTE format('DELETE FROM public.%I x WHERE x.author_user_id = ANY($1)', _t) USING _users;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN _left := _left + 1;
      END;
    END LOOP;
    EXIT WHEN _left = 0;
  END LOOP;
  IF _left > 0 THEN RAISE EXCEPTION 'bo:meal-cleanup-incomplete'; END IF;
  LOOP
    DELETE FROM public.meal_master_records m WHERE m.author_user_id = ANY(_users)
       AND NOT EXISTS (SELECT 1 FROM public.meal_master_records n WHERE n.supersedes_id = m.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
  DELETE FROM public.attribute_value_definitions v WHERE v.value_id LIKE _operation_id || '-%' AND v.change_reason = 'bo-fixture:' || _operation_id;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  DELETE FROM public.bo_fixture_capability_grants g WHERE g.operation_id = _operation_id;
  FOR _a IN SELECT * FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id LOOP
    IF _a.engagement_id IS NOT NULL THEN
      DELETE FROM public.institutional_engagements e WHERE e.id = _a.engagement_id AND e.person_id = _a.person_id
        AND e.originating_act_ref = 'bo-fixture:' || _operation_id AND e.position_label_snapshot = 'BO FIXTURE';
      IF NOT FOUND THEN RAISE EXCEPTION 'bo:engagement-marker-mismatch'; END IF;
    END IF;
    DELETE FROM public.user_person_links l WHERE l.user_id = _a.user_id AND l.person_id = _a.person_id;
    DELETE FROM public.institutional_persons p WHERE p.id = _a.person_id
      AND p.institutional_identifier = 'bo-fixture:' || _operation_id || ':' || _a.user_id::text AND p.display_name = 'BO FIXTURE ' || _operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'bo:person-marker-mismatch'; END IF;
    DELETE FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _a.user_id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $function$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup(text) TO service_role;