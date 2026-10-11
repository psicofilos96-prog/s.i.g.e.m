-- LOTE 14 — camada BO para Alimentação: contas sintéticas temporárias podem exercer capabilities de rede de cadastro técnico,
-- contratos e designação de inspetor; o que gravam fica invisível a contas reais e é apagado no cleanup.

CREATE OR REPLACE FUNCTION public.bo_fixture_network_engagement(_capability text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT a.engagement_id FROM public.bo_fixture_capability_grants f
  JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
  WHERE f.capability_id = _capability AND f.scope_level = 'rede' AND a.user_id = auth.uid()
    AND f.person_id = public.current_person_id() AND f.expires_at > now() AND a.engagement_id IS NOT NULL
    AND public.technical_automation_enabled()
  ORDER BY f.expires_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.bo_fixture_network_engagement(text) FROM PUBLIC, anon, authenticated, service_role;

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
  IF g IS NULL THEN g := public.bo_fixture_network_engagement(_capability); END IF;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meal_has_network(_caps text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
      WHERE c.policy_id IS NOT NULL AND c.scope_level = 'rede' AND c.capability_id = ANY(_caps))
    OR EXISTS (SELECT 1 FROM unnest(_caps) x WHERE public.bo_fixture_network_engagement(x) IS NOT NULL))
$fn$;
REVOKE ALL ON FUNCTION public.meal_has_network(text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meal_master_at(_kind text, _on date, _known_at timestamptz, _include_drafts boolean)
RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, valid_from date, valid_to date, payload jsonb,
              author_person_id uuid, recorded_at timestamptz, functional_validation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sp record; k timestamptz := coalesce(_known_at, now()); maint boolean; net boolean; fx boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO sp FROM public.meal_master_spec(_kind);
  IF sp.capability IS NULL THEN RAISE EXCEPTION 'meal:kind-unknown'; END IF;
  maint := public.meal_has_network(ARRAY[sp.capability,'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar']);
  net := maint OR public.meal_has_network(ARRAY['acompanhar-alimentacao-rede']);
  fx := public.bo_fixture_is_user(auth.uid());
  RETURN QUERY
  SELECT h.logical_id, h.version, h.status, h.school_id, h.valid_from, h.valid_to, h.payload, h.author_person_id, h.recorded_at,
         CASE WHEN h.kind = 'designacao-inspetor' THEN 'FUNCTIONAL_SOURCE_REQUIRED' END
  FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r
         WHERE r.kind = _kind AND r.recorded_at <= k ORDER BY r.logical_id, r.version DESC) h
  WHERE h.status <> 'retirada'
    AND (fx OR NOT EXISTS (SELECT 1 FROM public.meal_master_records z WHERE z.logical_id = h.logical_id AND public.bo_fixture_is_user(z.author_user_id)))
    AND (h.status = 'homologada' OR (coalesce(_include_drafts,false) AND maint))
    AND (_on IS NULL OR (h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on)))
    AND (net OR (h.school_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
           WHERE c.policy_id IS NOT NULL AND c.capability_id = 'consultar-alimentacao-escolar' AND c.scope_level = 'escola' AND c.school_id = h.school_id)))
  ORDER BY h.valid_from, h.logical_id LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_master_at(text, date, timestamptz, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_master_at(text, date, timestamptz, boolean) TO authenticated;

-- append-only continua; única exceção: DELETE durante bo_fixture_cleanup de registro de autor fixture da operação
CREATE OR REPLACE FUNCTION public.meal_master_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('sigem.bo_cleanup_op', true), '') <> ''
     AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.user_id = OLD.author_user_id AND a.operation_id = current_setting('sigem.bo_cleanup_op', true))
  THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'import:append-only';
END $$;
DROP TRIGGER IF EXISTS meal_master_records_append_only ON public.meal_master_records;
CREATE TRIGGER meal_master_records_append_only BEFORE UPDATE OR DELETE ON public.meal_master_records FOR EACH ROW EXECUTE FUNCTION public.meal_master_append_only();

CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final','manter-quadro-permanente-op',
      'manter-catalogo-tecnico-alimentar','manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao',
      'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar')
    THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_grant_capability(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_grant_capability(text,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup(_operation_id text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _a record; _n integer := 0;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.final_sheet_acts f WHERE f.actor_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id);
  DELETE FROM public.final_sheet_rule_versions r WHERE r.author_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id);
  LOOP
    DELETE FROM public.op_permanent_board_versions b
     WHERE b.author_user_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id)
       AND NOT EXISTS (SELECT 1 FROM public.op_permanent_board_versions n WHERE n.supersedes_id = b.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
  LOOP
    DELETE FROM public.meal_master_records m
     WHERE m.author_user_id IN (SELECT a.user_id FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id)
       AND NOT EXISTS (SELECT 1 FROM public.meal_master_records n WHERE n.supersedes_id = m.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
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