-- N4.3 — Mapa Estatístico: devolução própria da Estatística, ajustes auditáveis de célula,
-- exigência da competência anterior na abertura e projeção minimizada de mediação. Aditiva.

-- 1) Devolução: novo tipo de evento append-only, com motivo, base conferida e ator (pessoa ou principal setorial).
ALTER TABLE public.statistical_map_events ADD COLUMN IF NOT EXISTS principal_id uuid;
ALTER TABLE public.statistical_map_events DROP CONSTRAINT IF EXISTS statistical_map_events_kind_check;
ALTER TABLE public.statistical_map_events ADD CONSTRAINT statistical_map_events_kind_check
  CHECK (kind = ANY (ARRAY['observacoes','conferencia','abertura-correcao','devolucao']));
ALTER TABLE public.statistical_map_events ADD CONSTRAINT statistical_map_events_return_shape
  CHECK (kind <> 'devolucao' OR (coalesce(btrim(payload->>'reason'),'') <> '' AND (payload->>'conferenceEventId') IS NOT NULL AND (person_id IS NOT NULL OR principal_id IS NOT NULL)));

CREATE OR REPLACE FUNCTION public.return_statistical_map(_map uuid, _expected_conference uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school text; _last record; _id uuid; _person uuid := public.current_person_id(); _principal uuid := public.current_principal_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL AND _principal IS NULL THEN RAISE EXCEPTION 'session:actor-required'; END IF;
  SELECT school_id INTO _school FROM public.statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  -- Quem pode aprovar é quem pode devolver (mesma autoridade da Estatística; documentado em N4.3).
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'map:reason-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  -- Aprovado nunca volta a devolvido: pós-aprovação só por retificação (abertura de correção).
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE map_id = _map) AND public.open_map_correction_id(_map) IS NULL THEN
    RAISE EXCEPTION 'map:approved-use-rectification'; END IF;
  SELECT * INTO _last FROM public.statistical_map_events WHERE map_id = _map AND kind <> 'observacoes' ORDER BY recorded_at DESC, id DESC LIMIT 1;
  IF _last.id IS NULL OR _last.kind <> 'conferencia' THEN RAISE EXCEPTION 'map:nothing-sent'; END IF;
  IF _last.id IS DISTINCT FROM _expected_conference THEN RAISE EXCEPTION 'map:stale-head'; END IF;
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE conference_event_id = _last.id) THEN RAISE EXCEPTION 'map:conference-used'; END IF;
  INSERT INTO public.statistical_map_events(map_id, kind, payload, recorded_by, person_id, principal_id)
  VALUES (_map, 'devolucao', jsonb_build_object('reason', btrim(_reason), 'conferenceEventId', _last.id), auth.uid(), _person, _principal)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.return_statistical_map(uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.return_statistical_map(uuid, uuid, text) TO authenticated;

-- 2) Ajustes de célula: ledger append-only próprio; nunca toca fonte-base.
CREATE TABLE public.statistical_map_cell_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.statistical_maps(id),
  cell_id text NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.statistical_map_cell_adjustments(id),
  kind text NOT NULL CHECK (kind IN ('ajuste','anulacao')),
  calculated_value jsonb,
  adjusted_value jsonb,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  actor_side text NOT NULL CHECK (actor_side IN ('escola','estatistica')),
  recorded_by uuid NOT NULL,
  person_id uuid REFERENCES public.institutional_persons(id),
  principal_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (person_id IS NOT NULL OR principal_id IS NOT NULL),
  CHECK (kind <> 'ajuste' OR adjusted_value IS NOT NULL)
);
CREATE INDEX statistical_map_cell_adjustments_map ON public.statistical_map_cell_adjustments(map_id, cell_id);
GRANT SELECT ON public.statistical_map_cell_adjustments TO authenticated;
GRANT ALL ON public.statistical_map_cell_adjustments TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.statistical_map_cell_adjustments FROM anon, authenticated, service_role;
ALTER TABLE public.statistical_map_cell_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map adjustments read by map consult scope" ON public.statistical_map_cell_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statistical_maps m WHERE m.id = map_id AND public.has_school_capability('consultar-mapa-estatistico', m.school_id)));

CREATE OR REPLACE FUNCTION public.map_adjustment_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'map:adjustment-append-only'; END $$;
CREATE TRIGGER statistical_map_cell_adjustments_immutable BEFORE UPDATE OR DELETE ON public.statistical_map_cell_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.map_adjustment_immutable();

CREATE OR REPLACE FUNCTION public.record_map_cell_adjustment(_map uuid, _cell text, _expected_head uuid, _calculated jsonb, _adjusted jsonb, _reason text, _annul boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _m record; _def jsonb; _head uuid; _id uuid; _side text; _person uuid := public.current_person_id(); _principal uuid := public.current_principal_id(); _last record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL AND _principal IS NULL THEN RAISE EXCEPTION 'session:actor-required'; END IF;
  SELECT * INTO _m FROM public.statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  IF public.has_school_capability('oficializar-mapa-estatistico', _m.school_id) THEN _side := 'estatistica';
  ELSIF public.has_school_capability('preparar-mapa-estatistico', _m.school_id) THEN _side := 'escola';
  ELSE RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'map:reason-required'; END IF;
  -- Só células que a regra homologada da competência declara ajustáveis.
  SELECT definition INTO _def FROM public.map_competence_rules WHERE id = _m.rule_id AND version = _m.rule_version;
  IF _def IS NULL OR jsonb_typeof(_def->'adjustableCellIds') <> 'array'
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_def->'adjustableCellIds') x WHERE x = _cell) THEN
    RAISE EXCEPTION 'map:cell-not-adjustable'; END IF;
  IF NOT coalesce(_annul, false) AND _adjusted IS NULL THEN RAISE EXCEPTION 'map:adjusted-value-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  -- Oficial sem correção aberta é imutável; enviado (não devolvido) espera a Estatística.
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE map_id = _map) AND public.open_map_correction_id(_map) IS NULL THEN
    RAISE EXCEPTION 'map:official-open-correction-first'; END IF;
  SELECT * INTO _last FROM public.statistical_map_events WHERE map_id = _map AND kind <> 'observacoes' ORDER BY recorded_at DESC, id DESC LIMIT 1;
  IF _side = 'escola' AND _last.kind = 'conferencia' AND NOT EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE conference_event_id = _last.id) THEN
    RAISE EXCEPTION 'map:sent-awaiting-review'; END IF;
  SELECT a.id INTO _head FROM public.statistical_map_cell_adjustments a WHERE a.map_id = _map AND a.cell_id = _cell
    AND NOT EXISTS (SELECT 1 FROM public.statistical_map_cell_adjustments s WHERE s.supersedes_id = a.id);
  IF _head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'map:stale-head'; END IF;
  IF coalesce(_annul,false) AND _head IS NULL THEN RAISE EXCEPTION 'map:nothing-to-annul'; END IF;
  INSERT INTO public.statistical_map_cell_adjustments(map_id, cell_id, supersedes_id, kind, calculated_value, adjusted_value, reason, actor_side, recorded_by, person_id, principal_id)
  VALUES (_map, _cell, _head, CASE WHEN coalesce(_annul,false) THEN 'anulacao' ELSE 'ajuste' END, _calculated,
          CASE WHEN coalesce(_annul,false) THEN NULL ELSE _adjusted END, btrim(_reason), _side, auth.uid(), _person, _principal)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_map_cell_adjustment(uuid, text, uuid, jsonb, jsonb, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_map_cell_adjustment(uuid, text, uuid, jsonb, jsonb, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.map_adjustment_immutable() FROM PUBLIC, anon, authenticated, service_role;

-- 3) Regra: chaves opcionais tipadas (ajustáveis; exigência da competência anterior).
CREATE OR REPLACE FUNCTION public.map_rule_definition_issue(_d jsonb)
 RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
DECLARE i text;
BEGIN
  IF _d IS NULL OR jsonb_typeof(_d) <> 'object' THEN RETURN 'map-rule:definition-required'; END IF;
  IF jsonb_typeof(_d -> 'coveredSchoolIds') <> 'array' OR jsonb_array_length(_d -> 'coveredSchoolIds') = 0 THEN RETURN 'map-rule:covered-schools-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_d -> 'coveredSchoolIds') x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = x)) THEN RETURN 'map-rule:unknown-school'; END IF;
  i := public.map_snapshot_criterion_issue(_d -> 'snapshotDate');
  IF i IS NOT NULL THEN RETURN i; END IF;
  IF jsonb_typeof(_d -> 'cells') <> 'array' THEN RETURN 'map-rule:cells-required'; END IF;
  IF jsonb_typeof(_d -> 'blockingCellIds') <> 'array' THEN RETURN 'map-rule:blocking-cells-required'; END IF;
  IF _d ? 'adjustableCellIds' AND jsonb_typeof(_d -> 'adjustableCellIds') <> 'array' THEN RETURN 'map-rule:adjustable-cells-invalid'; END IF;
  IF _d ? 'requirePreviousCompetenceOfficial' AND jsonb_typeof(_d -> 'requirePreviousCompetenceOfficial') <> 'boolean' THEN RETURN 'map-rule:previous-requirement-invalid'; END IF;
  RETURN NULL;
END $function$;

-- 4) Abertura: competência anterior exigida (quando a regra declara) precisa de versão oficial.
--    Ausência de Mapa anterior NUNCA vale aprovação; só não se exige quando o mês anterior não é ano operacional.
CREATE OR REPLACE FUNCTION public.map_previous_competence_issue(_school text, _year integer, _month integer, _rule_id text, _rule_version integer)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE _req boolean; py integer := CASE WHEN _month = 1 THEN _year - 1 ELSE _year END; pm integer := CASE WHEN _month = 1 THEN 12 ELSE _month - 1 END; _pid uuid;
BEGIN
  SELECT coalesce((definition->>'requirePreviousCompetenceOfficial')::boolean, false) INTO _req FROM public.map_competence_rules WHERE id = _rule_id AND version = _rule_version;
  IF NOT coalesce(_req, false) THEN RETURN NULL; END IF;
  IF public.map_year_state_on(make_date(py, pm, 1)) <> 'operacional' THEN RETURN NULL; END IF;
  SELECT id INTO _pid FROM public.statistical_maps WHERE school_id = _school AND competence_year = py AND competence_month = pm;
  IF _pid IS NULL THEN RETURN 'map:previous-competence-missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE map_id = _pid) THEN RETURN 'map:previous-competence-not-official'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.map_previous_competence_issue(text, integer, integer, text, integer) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.open_statistical_map(_school text, _year integer, _month integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _r record; _first date; me uuid := public.current_person_id(); issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('preparar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF _month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'map:competence-invalid'; END IF;
  _first := make_date(_year, _month, 1);
  IF public.map_year_state_on(_first) <> 'operacional' THEN RAISE EXCEPTION 'map:year-not-operational'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map:' || _school || ':' || _year || ':' || _month));
  SELECT m.id INTO _id FROM public.statistical_maps m WHERE m.school_id = _school AND m.competence_year = _year AND m.competence_month = _month;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO STRICT _r FROM public.map_single_applicable_rule(_school, _first);
  issue := public.map_previous_competence_issue(_school, _year, _month, _r.id, _r.version);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  INSERT INTO public.statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by, opened_person_id)
  VALUES (_school, _year, _month, _r.id, _r.version, auth.uid(), me) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.open_statistical_map(text, integer, integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.open_statistical_map(text, integer, integer) TO authenticated;

-- 5) Mediação para o Mapa: projeção minimizada (sem nome de estudante) dos vínculos vigentes na data.
CREATE OR REPLACE FUNCTION public.map_mediation_projection_at(_school text, _on date)
RETURNS TABLE(assignment_logical_id uuid, assignment_version integer, mediator_engagement_id uuid, student_ref text, valid_from date, valid_to date, mediator_active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'map:date-required'; END IF;
  IF NOT public.has_school_capability('consultar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  RETURN QUERY SELECT m.logical_id, m.version, m.mediator_engagement_id, pg_catalog.md5(m.student_id), m.valid_from, m.valid_to, public.ah_engagement_active(m.mediator_engagement_id, _on)
    FROM public.inclusion_mediation_assignments m
   WHERE m.school_id = _school AND m.event_kind <> 'encerramento'
     AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id)
     AND m.valid_from <= _on AND (m.valid_to IS NULL OR m.valid_to >= _on);
END $$;
REVOKE ALL ON FUNCTION public.map_mediation_projection_at(text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.map_mediation_projection_at(text, date) TO authenticated;