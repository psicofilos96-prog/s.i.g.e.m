-- B4.6.6 — Autorização, writers da norma de composição, homologação funcional do calendário e leitores autorizados.
-- Aditiva; 0023–0031 intactas (funções substituídas com a MESMA assinatura).
-- Decisões expressas do usuário (2026-10-04): (1) toda conta autenticada consulta calendários HOMOLOGADOS; rascunho só
-- com capacidade exata de construção; (2) Supervisão Escolar constrói e homologa a norma de composição; (3) regra
-- desejada: um único calendário aplicável (exclusividade) — a norma continua DADO gravado pela Supervisão, não código.
-- Nenhuma política é homologada aqui; regras novas só na v2 draft. Nenhum calendário, norma ou seed real.

-- 1. Regras exatas na v2 draft (apenas as duas novas).
DO $b466p$
DECLARE _v1 uuid; _v2 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario') THEN
    RAISE NOTICE 'b4_6_6:no-capability-policy-present; rules deferred'; RETURN;
  END IF;
  SELECT id INTO _v1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft' FOR UPDATE;
  SELECT id INTO _v2 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  IF _v1 IS NULL OR _v2 IS NULL THEN RAISE EXCEPTION 'b4_6_6:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 119
  THEN RAISE EXCEPTION 'b4_6_6:unexpected-policy-rule-count'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id IN
      ('construir-norma-composicao-calendario-da-rede','homologar-norma-composicao-calendario-da-rede'))
  THEN RAISE EXCEPTION 'b4_6_6:capability-already-present'; END IF;
  INSERT INTO public.capability_policy_rules (policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (_v2, 'gestao-pedagogica-da-rede', 'construir-norma-composicao-calendario-da-rede', ARRAY['network']::text[]),
    (_v2, 'gestao-pedagogica-da-rede', 'homologar-norma-composicao-calendario-da-rede', ARRAY['network']::text[]);
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 121
     OR (SELECT status FROM public.capability_policies WHERE id = _v2) <> 'draft'
  THEN RAISE EXCEPTION 'b4_6_6:policy-insert-failed'; END IF;
END $b466p$;

-- 2. Teste de capacidade exata de rede SEM exceção (para decidir visibilidade). Privado.
CREATE FUNCTION public.calendar_has_network_capability(_cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.capability_id = _cap AND c.scope_level = 'rede');
$fn$;
REVOKE ALL ON FUNCTION public.calendar_has_network_capability(text) FROM PUBLIC, anon, authenticated;

-- 3. Writer da norma: versão + multiplicidade + regras de dimensão + vínculos de efeito + marcador, numa transação.
CREATE FUNCTION public.record_calendar_composition_norm_version(
  _norm_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date,
  _act_ref text, _reason text, _multiplicity text, _dimension_rules jsonb, _effect_bindings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid; _nid text; _ver integer; b public.calendar_composition_norm_versions%ROWTYPE; _vid uuid; x jsonb; _iss text;
BEGIN
  g := public.calendar_network_grant('construir-norma-composicao-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'composition-norm:person-link-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'composition-norm:valid-from-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'composition-norm:act-required'; END IF;
  IF _multiplicity IS NULL THEN RAISE EXCEPTION 'composition-norm:multiplicity-required'; END IF;
  IF pg_catalog.jsonb_typeof(coalesce(_dimension_rules,'null')) <> 'array' OR pg_catalog.jsonb_typeof(coalesce(_effect_bindings,'null')) <> 'array'
  THEN RAISE EXCEPTION 'composition-norm:arrays-required'; END IF;
  IF _norm_id IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'composition-norm:invalid-change-kind'; END IF;
    _nid := 'ccn-' || gen_random_uuid(); _ver := 1;
    INSERT INTO public.calendar_composition_norms(id) VALUES (_nid);
  ELSE
    IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION 'composition-norm:invalid-change-kind'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('composition-norm:' || _norm_id, 0));
    SELECT * INTO b FROM public.calendar_composition_norm_versions v WHERE v.norm_id = _norm_id ORDER BY v.version DESC LIMIT 1;
    IF b.id IS NULL THEN RAISE EXCEPTION 'composition-norm:not-found'; END IF;
    IF b.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'composition-norm:base-superseded'; END IF;
    _nid := _norm_id; _ver := b.version + 1;
  END IF;
  INSERT INTO public.calendar_composition_norm_versions(norm_id, version, supersedes_id, change_kind, valid_from, valid_until,
    originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_nid, _ver, b.id, _change_kind, _valid_from, _valid_until, pg_catalog.btrim(_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), _pid, g) RETURNING id INTO _vid;
  INSERT INTO public.calendar_composition_norm_multiplicity(version_id, operation) VALUES (_vid, _multiplicity);
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_dimension_rules) e LOOP
    IF pg_catalog.jsonb_typeof(x) <> 'object' OR (SELECT array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(x) k)
       IS DISTINCT FROM ARRAY['dimensionId','onAbsence','operation'] THEN RAISE EXCEPTION 'composition-norm:dimension-rule-shape'; END IF;
    INSERT INTO public.calendar_composition_norm_dimension_rules(version_id, dimension_id, operation, on_absence)
      VALUES (_vid, x->>'dimensionId', x->>'operation', x->>'onAbsence');
  END LOOP;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_effect_bindings) e LOOP
    IF pg_catalog.jsonb_typeof(x) <> 'object' OR (SELECT array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(x) k)
       IS DISTINCT FROM ARRAY['dimensionId','effectContractVersion','effectPrimitive']
       OR pg_catalog.jsonb_typeof(x->'effectContractVersion') <> 'number' THEN RAISE EXCEPTION 'composition-norm:effect-binding-shape'; END IF;
    INSERT INTO public.calendar_composition_norm_effect_bindings(version_id, dimension_id, effect_primitive, effect_contract_version)
      VALUES (_vid, x->>'dimensionId', x->>'effectPrimitive', (x->>'effectContractVersion')::integer);
  END LOOP;
  INSERT INTO public.calendar_composition_norm_configuration_records(version_id) VALUES (_vid);
  _iss := public.calendar_composition_norm_configuration_issue(_vid, 'infinity');
  IF _iss IS NOT NULL THEN RAISE EXCEPTION 'composition-norm:configuration-%', _iss; END IF;
  RETURN pg_catalog.jsonb_build_object('normId', _nid, 'versionId', _vid, 'version', _ver, 'homologated', false);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_composition_norm_version(text, uuid, text, date, date, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_composition_norm_version(text, uuid, text, date, date, text, text, text, jsonb, jsonb) TO authenticated;

-- 4. Homologação/revogação da norma (competência distinta e exata; base esperada; cadeia pelo guard de 0030).
CREATE FUNCTION public.homologate_calendar_composition_norm(
  _version_id uuid, _expected_last_homologation_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid; _last public.calendar_composition_norm_homologations%ROWTYPE; _id uuid; _seq integer;
BEGIN
  g := public.calendar_network_grant('homologar-norma-composicao-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'composition-norm-homologation:person-link-required'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('homologada','revogada') THEN RAISE EXCEPTION 'composition-norm-homologation:invalid-decision'; END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION 'composition-norm-homologation:effective-from-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'composition-norm-homologation:act-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_versions v WHERE v.id = _version_id) THEN
    RAISE EXCEPTION 'composition-norm-homologation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('composition-norm-homologation:' || _version_id::text, 0));
  SELECT * INTO _last FROM public.calendar_composition_norm_homologations h WHERE h.version_id = _version_id ORDER BY h.sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_homologation_id THEN RAISE EXCEPTION 'composition-norm-homologation:base-superseded'; END IF;
  _seq := coalesce(_last.sequence, 0) + 1;
  INSERT INTO public.calendar_composition_norm_homologations(version_id, sequence, supersedes_id, decision, effective_from,
    homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_version_id, _seq, _last.id, _decision, _effective_from, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    'homologar-norma-composicao-calendario-da-rede', auth.uid(), _pid, g) RETURNING id INTO _id;
  RETURN pg_catalog.jsonb_build_object('recordId', _id, 'sequence', _seq, 'decision', _decision);
END $fn$;
REVOKE ALL ON FUNCTION public.homologate_calendar_composition_norm(uuid, uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_calendar_composition_norm(uuid, uuid, text, date, text, text) TO authenticated;

-- 5. Homologação do calendário FUNCIONAL: exige snapshot íntegro, aplicabilidade registrada e norma de composição
--    homologada vigente em effective_from (conhecida agora). Grava ledger com proveniência. Revogação exige motivo.
CREATE OR REPLACE FUNCTION public.homologate_calendar_version(
  _calendar_version_id uuid, _expected_last_homologation_id uuid, _decision text,
  _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid; v public.calendar_versions%ROWTYPE; _last public.calendar_version_homologations%ROWTYPE;
  _issue text; _norm text; _id uuid; _seq integer;
BEGIN
  g := public.calendar_network_grant('homologar-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'calendar-homologation:person-link-required'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('homologada','revogada') THEN RAISE EXCEPTION 'calendar-homologation:invalid-decision'; END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION 'calendar-homologation:effective-from-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:act-required'; END IF;
  SELECT * INTO v FROM public.calendar_versions WHERE id = _calendar_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'calendar-homologation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-homologation:' || v.id::text, 0));
  SELECT * INTO _last FROM public.calendar_version_homologations h WHERE h.calendar_version_id = v.id ORDER BY h.sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_homologation_id THEN RAISE EXCEPTION 'calendar-homologation:base-superseded'; END IF;
  IF _last.decision = _decision THEN RAISE EXCEPTION 'calendar-homologation:repeated-decision'; END IF;
  IF _effective_from < v.valid_from OR (v.valid_until IS NOT NULL AND _effective_from > v.valid_until) THEN
    RAISE EXCEPTION 'calendar-homologation:outside-version-validity'; END IF;
  IF _decision = 'revogada' THEN
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:reason-required'; END IF;
  ELSE
    _issue := public.calendar_version_reference_issue(v.id, pg_catalog.clock_timestamp());
    IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar-homologation:snapshot-%', _issue; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.calendar_version_applicability_records a WHERE a.version_id = v.id) THEN
      RAISE EXCEPTION 'calendar-homologation:blocked-applicability-undeclared-d5'; END IF;
    SELECT x.state INTO _norm FROM public.calendar_composition_norm_state_at(_effective_from, pg_catalog.clock_timestamp()) x WHERE x.norm_id IS NULL;
    IF _norm IS DISTINCT FROM 'norma-homologada' THEN
      RAISE EXCEPTION 'calendar-homologation:blocked-composition-norm-%', coalesce(_norm, 'desconhecida'); END IF;
  END IF;
  _seq := coalesce(_last.sequence, 0) + 1;
  INSERT INTO public.calendar_version_homologations(calendar_version_id, sequence, supersedes_id, decision, effective_from,
    homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (v.id, _seq, _last.id, _decision, _effective_from, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    'homologar-calendario-da-rede', auth.uid(), _pid, g) RETURNING id INTO _id;
  RETURN pg_catalog.jsonb_build_object('recordId', _id, 'sequence', _seq, 'decision', _decision, 'calendarVersionId', v.id);
END $fn$;
REVOKE ALL ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) TO authenticated;

-- 6. Snapshot de leitura validado: knownAt não pode estar no futuro (nunca prevê conhecimento).
CREATE FUNCTION public.calendar_snapshot_issue(_from date, _to date, _known_at timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT CASE WHEN _from IS NULL OR _to IS NULL OR _known_at IS NULL THEN 'argumentos-ausentes'
              WHEN _to < _from THEN 'intervalo-invertido'
              WHEN (_to - _from) + 1 > 400 THEN 'intervalo-maior-que-400-dias'
              ELSE NULL END;
$fn$;
REVOKE ALL ON FUNCTION public.calendar_snapshot_issue(date, date, timestamptz) FROM PUBLIC, anon, authenticated;

-- 7. Leitores por calendário (mesma assinatura de 0023). Sem sessão ⇒ access-denied. Não construtor só vê o que é
--    homologado na data; inexistente, rascunho ou não homologado têm a MESMA resposta (sem oráculo).
CREATE OR REPLACE FUNCTION public.calendar_at(_calendar_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, valid_on date, known_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _v uuid; _hs text; _b boolean;
BEGIN
  valid_on := _on; known_at := _known_at;
  IF auth.uid() IS NULL OR _calendar_id IS NULL OR _on IS NULL OR _known_at IS NULL OR _known_at > pg_catalog.clock_timestamp() THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN; END IF;
  _b := public.calendar_has_network_capability('construir-calendario-da-rede');
  BEGIN
    _v := public.calendar_effective_version(_calendar_id, _on, _known_at);
    _hs := CASE WHEN _v IS NULL THEN 'sem-versao-vigente' ELSE public.calendar_version_homologation_state(_v, _on, _known_at) END;
  EXCEPTION WHEN OTHERS THEN _hs := 'cadeia-invalida'; END;
  result_kind := CASE WHEN _hs = 'homologada' THEN 'homologada' WHEN _b THEN _hs ELSE 'access-denied' END;
  RETURN NEXT;
END $fn$;
CREATE OR REPLACE FUNCTION public.calendar_day_at(_calendar_id text, _date date, _known_at timestamptz)
RETURNS TABLE(result_kind text, valid_on date, known_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT x.result_kind, x.valid_on, x.known_at FROM public.calendar_at(_calendar_id, _date, _known_at) x;
$fn$;
REVOKE ALL ON FUNCTION public.calendar_at(text, date, timestamptz), public.calendar_day_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_at(text, date, timestamptz), public.calendar_day_at(text, date, timestamptz) TO authenticated;

-- 8. Dias de UM calendário em lote (≤400, UM knownAt). Não construtor: nenhum dia homologado ⇒ access-denied integral.
CREATE FUNCTION public.calendar_days_at(_calendar_id text, _from date, _to date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _b boolean; _iss text; d date; _days jsonb := '[]'::jsonb; _rows jsonb; _hs text; _any boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  _iss := public.calendar_snapshot_issue(_from, _to, _known_at);
  IF _iss IS NULL AND _known_at > pg_catalog.clock_timestamp() THEN _iss := 'known-at-no-futuro'; END IF;
  IF _iss IS NOT NULL OR _calendar_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','snapshot-invalido','detail', coalesce(_iss,'calendario-ausente')); END IF;
  _b := public.calendar_has_network_capability('construir-calendario-da-rede');
  FOR d IN SELECT g::date FROM pg_catalog.generate_series(_from, _to, '1 day'::interval) g LOOP
    BEGIN
      SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::jsonb), max(r.homologation_state)
        INTO _rows, _hs FROM public.calendar_day_declarations(_calendar_id, d, _known_at) r;
    EXCEPTION WHEN OTHERS THEN _rows := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('day_state','cadeia-invalida')); _hs := NULL; END;
    IF _hs = 'homologada' THEN _any := true;
      _days := _days || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d, 'state', 'homologada', 'rows', _rows));
    ELSIF _b THEN
      _days := _days || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d, 'state', coalesce(_hs, 'sem-estado'), 'rows', _rows));
    ELSE
      _days := _days || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d, 'state', 'nao-homologado-na-data'));
    END IF;
  END LOOP;
  IF NOT _b AND NOT _any THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','lido','audience', CASE WHEN _b THEN 'construcao' ELSE 'homologados' END,
    'snapshot', pg_catalog.jsonb_build_object('from', _from, 'to', _to, 'knownAt', _known_at), 'calendarId', _calendar_id, 'days', _days);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_days_at(text, date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_days_at(text, date, date, timestamptz) TO authenticated;

-- 9. Lista de calendários/versões conhecidas em knownAt. Não construtor: só versões com homologação vigente conhecida.
CREATE FUNCTION public.calendar_list_at(_known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _b boolean; _out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  IF _known_at IS NULL OR _known_at > pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','snapshot-invalido'); END IF;
  _b := public.calendar_has_network_capability('construir-calendario-da-rede');
  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('calendarId', v.calendar_id, 'versionId', v.id, 'version', v.version,
      'changeKind', v.change_kind, 'academicYearId', v.academic_year_id, 'periodOrganizationId', v.period_organization_id,
      'validFrom', v.valid_from, 'validTo', v.valid_until, 'actId', v.originating_act_ref, 'recordedAt', v.created_at,
      'lastHomologation', (SELECT pg_catalog.jsonb_build_object('recordId', h.id, 'sequence', h.sequence, 'decision', h.decision,
          'effectiveFrom', h.effective_from, 'recordedAt', h.created_at)
        FROM public.calendar_version_homologations h WHERE h.calendar_version_id = v.id AND h.created_at <= _known_at ORDER BY h.sequence DESC LIMIT 1))
      ORDER BY v.calendar_id, v.version), '[]'::jsonb) INTO _out
    FROM public.calendar_versions v
   WHERE v.created_at <= _known_at AND (_b OR (SELECT h.decision FROM public.calendar_version_homologations h
       WHERE h.calendar_version_id = v.id AND h.created_at <= _known_at ORDER BY h.sequence DESC LIMIT 1) = 'homologada');
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','lido','audience', CASE WHEN _b THEN 'construcao' ELSE 'homologados' END,
    'knownAt', _known_at, 'versions', _out);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_list_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_list_at(timestamptz) TO authenticated;

-- 10. Tipos de dia (somente construção; rótulos para os demais chegam pelas declarações dos dias homologados).
CREATE FUNCTION public.calendar_day_types_at(_known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.calendar_has_network_capability('construir-calendario-da-rede') THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  IF _known_at IS NULL OR _known_at > pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','snapshot-invalido'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','lido','knownAt', _known_at, 'versions',
    coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dayTypeId', t.day_type_id, 'versionId', t.id, 'version', t.version,
      'changeKind', t.change_kind, 'label', t.label, 'schoolDayEffect', t.school_day_effect, 'actId', t.originating_act_ref, 'recordedAt', t.created_at)
      ORDER BY t.day_type_id, t.version) FROM public.calendar_day_type_versions t WHERE t.created_at <= _known_at), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_day_types_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_day_types_at(timestamptz) TO authenticated;

-- 11. Metadado da norma em (on, knownAt). Construtor/homologador da norma: estado de todas as versões aplicáveis.
--     Demais autenticados: apenas a norma homologada vigente; qualquer outro estado ⇒ access-denied.
CREATE FUNCTION public.calendar_composition_norm_at(_on date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _b boolean; _rows jsonb; _final text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  IF _on IS NULL OR _known_at IS NULL OR _known_at > pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','snapshot-invalido'); END IF;
  _b := public.calendar_has_network_capability('construir-norma-composicao-calendario-da-rede')
     OR public.calendar_has_network_capability('homologar-norma-composicao-calendario-da-rede');
  SELECT x.state INTO _final FROM public.calendar_composition_norm_state_at(_on, _known_at) x WHERE x.norm_id IS NULL;
  IF NOT _b AND _final IS DISTINCT FROM 'norma-homologada' THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('normId', x.norm_id, 'versionId', x.version_id, 'state', x.state,
      'detail', x.detail, 'version', v.version, 'validFrom', v.valid_from, 'validTo', v.valid_until, 'actId', v.originating_act_ref,
      'multiplicity', (SELECT m.operation FROM public.calendar_composition_norm_multiplicity m WHERE m.version_id = v.id),
      'dimensionRules', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dimensionId', d.dimension_id, 'operation', d.operation,
         'onAbsence', d.on_absence) ORDER BY d.dimension_id) FROM public.calendar_composition_norm_dimension_rules d WHERE d.version_id = v.id), '[]'::jsonb),
      'effectBindings', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dimensionId', e.dimension_id, 'effectPrimitive', e.effect_primitive,
         'effectContractVersion', e.effect_contract_version) ORDER BY e.dimension_id) FROM public.calendar_composition_norm_effect_bindings e WHERE e.version_id = v.id), '[]'::jsonb),
      'lastHomologationId', (SELECT h.id FROM public.calendar_composition_norm_homologations h WHERE h.version_id = v.id AND h.created_at <= _known_at ORDER BY h.sequence DESC LIMIT 1))
      ORDER BY x.norm_id, v.version), '[]'::jsonb) INTO _rows
    FROM public.calendar_composition_norm_state_at(_on, _known_at) x JOIN public.calendar_composition_norm_versions v ON v.id = x.version_id
   WHERE x.norm_id IS NOT NULL AND (_b OR x.state = 'homologada');
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','lido','audience', CASE WHEN _b THEN 'norma' ELSE 'homologados' END,
    'snapshot', pg_catalog.jsonb_build_object('on', _on, 'knownAt', _known_at), 'finalState', _final, 'versions', _rows);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_composition_norm_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_composition_norm_at(date, timestamptz) TO authenticated;

-- 12. Dia composto PRIVADO (INVOKER): contexto canônico do banco (alocação → escola/turma/ano, posição B3.3, eixos da
--     oferta B2.6 quando declarados — nunca inferidos) + norma + candidatos + efeito final sob EXCLUSIVIDADE.
--     Mesmas regras da ponte: null ≠ false, true×false = conflito, nada descartado, sem dominante.
CREATE FUNCTION public.calendar_composed_day_private(_on date, _known_at timestamptz, _allocation text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE ev jsonb; _ctx jsonb; _norm jsonb; _axis jsonb; _cands jsonb := '[]'::jsonb; c record;
  _block text; _n integer; _cal text; _ver uuid; _rows jsonb; _ds text; _hs text; _t integer; _f integer;
  _res text; _eff boolean;
BEGIN
  ev := public.calendar_composition_evidence_at(_on, _known_at, _allocation);
  _ctx := ev->'context';
  IF _ctx->>'state' IS DISTINCT FROM 'derivado' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', _ctx->>'state', 'context', _ctx); END IF;
  BEGIN
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('scheme', o.scheme_id, 'value', o.value_id, 'version', o.value_version)
      ORDER BY o.scheme_id, o.value_id), '[]'::jsonb) INTO _axis
      FROM public.class_offering_at(_ctx->>'class', _on, _known_at) o WHERE o.scheme_id IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', 'ambigua:oferta', 'context', _ctx);
  END;
  _ctx := _ctx || pg_catalog.jsonb_build_object('axis', _axis);
  _norm := ev->'norm';
  IF _norm->>'state' IS DISTINCT FROM 'norma-homologada' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'norma-indisponivel', 'detail', _norm->>'state', 'context', _ctx); END IF;
  IF _norm#>>'{configuration,multiplicity}' IS DISTINCT FROM 'exigir-exclusividade' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'composicao-indeterminada', 'detail', 'multiplicidade-nao-suportada-pelo-servidor:' ||
      coalesce(_norm#>>'{configuration,multiplicity}', 'ausente'), 'context', _ctx, 'norm', _norm); END IF;
  IF NOT (_norm->'effectBindings') @> '[{"effectPrimitive":"school_day_effect","effectContractVersion":1}]'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'efeito-nao-vinculado', 'context', _ctx, 'norm', _norm); END IF;

  _n := 0;
  FOR c IN SELECT x.resolution, x.calendar_id, x.version_id, pg_catalog.array_agg(x.scope_key ORDER BY x.scope_key) AS scopes
             FROM public.calendar_applicability_candidates(_on, _known_at, _ctx->>'school', _allocation, _ctx->>'position', _axis) x
            WHERE x.calendar_id IS NOT NULL GROUP BY x.resolution, x.calendar_id, x.version_id ORDER BY x.calendar_id, x.resolution LOOP
    _cands := _cands || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('resolution', c.resolution, 'calendarId', c.calendar_id,
      'versionId', c.version_id, 'scopes', pg_catalog.to_jsonb(c.scopes)));
    IF c.resolution = 'candidato' THEN _n := _n + 1; _cal := c.calendar_id; _ver := c.version_id;
    ELSE _block := coalesce(_block, c.resolution); END IF;
  END LOOP;
  IF _block IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'composicao-indeterminada', 'detail', _block, 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;
  IF _n = 0 THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'sem-calendario-aplicavel', 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;
  IF _n > 1 THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'exclusividade-violada', 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::jsonb), max(r.day_state), max(r.homologation_state),
         count(*) FILTER (WHERE r.school_day_effect IS TRUE), count(*) FILTER (WHERE r.school_day_effect IS FALSE)
    INTO _rows, _ds, _hs, _t, _f FROM public.calendar_day_declarations(_cal, _on, _known_at) r;
  IF _hs IS DISTINCT FROM 'homologada' THEN _res := 'calendario-nao-homologado';
  ELSIF _ds IN ('sem-versao-vigente','referencia-b2-4-invalida') THEN _res := 'composicao-indeterminada';
  ELSIF _t > 0 AND _f > 0 THEN _res := 'conflito';
  ELSIF _t > 0 THEN _res := 'letivo'; _eff := true;
  ELSIF _f > 0 THEN _res := 'nao-letivo'; _eff := false;
  ELSE _res := 'efeito-nao-declarado'; END IF;
  RETURN pg_catalog.jsonb_build_object('on', _on, 'result', _res, 'schoolDayEffect', _eff, 'detail', _ds, 'context', _ctx, 'norm', _norm,
    'candidates', _cands, 'calendarId', _cal, 'versionId', _ver, 'homologationState', _hs, 'declarations', _rows);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_composed_day_private(date, timestamptz, text) FROM PUBLIC, anon, authenticated;

-- 13. Fronteira autorizada do dia composto (lote ≤400, UM knownAt). Autorização ANTES de qualquer detalhe:
--     sessão + (consultar-matricula-e-movimentacao na escola OU leitura da turma). Alocação inexistente e não
--     autorizada têm a MESMA resposta, sem metadado. A decisão final é do servidor; o cliente só a consome.
CREATE FUNCTION public.calendar_composed_days_at(_allocation text, _from date, _to date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _school text; _class text; _iss text; d date; _days jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR coalesce(pg_catalog.btrim(_allocation),'') = '' THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  SELECT a.school_id, a.class_id INTO _school, _class FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id)
   ORDER BY a.created_at DESC LIMIT 1;
  IF _class IS NULL OR NOT (public.has_school_capability('consultar-matricula-e-movimentacao', _school) OR public.can_read_class_roster(_class)) THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','access-denied'); END IF;
  _iss := public.calendar_snapshot_issue(_from, _to, _known_at);
  IF _iss IS NULL AND _known_at > pg_catalog.clock_timestamp() THEN _iss := 'known-at-no-futuro'; END IF;
  IF _iss IS NOT NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','snapshot-invalido','detail', _iss); END IF;
  FOR d IN SELECT g::date FROM pg_catalog.generate_series(_from, _to, '1 day'::interval) g LOOP
    BEGIN
      _days := _days || pg_catalog.jsonb_build_array(public.calendar_composed_day_private(d, _known_at, _allocation));
    EXCEPTION WHEN OTHERS THEN
      _days := _days || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d, 'result', 'fonte-indisponivel', 'detail', SQLSTATE));
    END;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.6/1','state','lido','authorizes', false, 'publishes', false,
    'snapshot', pg_catalog.jsonb_build_object('from', _from, 'to', _to, 'knownAt', _known_at), 'allocation', _allocation, 'days', _days);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_composed_days_at(text, date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_composed_days_at(text, date, date, timestamptz) TO authenticated;
