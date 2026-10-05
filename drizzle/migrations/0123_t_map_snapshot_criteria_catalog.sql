-- T (complemento 2026-10-05): critério da fotografia é tipo estruturado e versionado, não regra eterna.
-- Catálogo fechado de tipos conhecidos com parâmetros validados; nenhum campo livre/expressão.
CREATE OR REPLACE FUNCTION public.map_snapshot_criterion_issue(_s jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE k text; keys text[]; d int; e record;
BEGIN
  IF _s IS NULL OR jsonb_typeof(_s) <> 'object' THEN RETURN 'map-rule:snapshot-date-required'; END IF;
  k := _s ->> 'kind';
  SELECT array_agg(x ORDER BY x) INTO keys FROM jsonb_object_keys(_s) x;
  IF k = 'ultimo-dia-letivo-do-mes-calendario-oficial' THEN
    IF keys <> ARRAY['kind'] THEN RETURN 'map-rule:snapshot-date-unexpected-parameters'; END IF;
    RETURN NULL;
  ELSIF k = 'dia-fixo-do-mes' THEN
    IF keys <> ARRAY['day','kind'] THEN RETURN 'map-rule:snapshot-date-unexpected-parameters'; END IF;
    IF jsonb_typeof(_s -> 'day') <> 'number' OR (_s ->> 'day') !~ '^[0-9]{1,2}$' THEN RETURN 'map-rule:snapshot-date-invalid-day'; END IF;
    d := (_s ->> 'day')::int;
    IF d < 1 OR d > 31 THEN RETURN 'map-rule:snapshot-date-invalid-day'; END IF;
    RETURN NULL;
  ELSIF k = 'data-definida-por-competencia' THEN
    IF keys <> ARRAY['dates','kind'] THEN RETURN 'map-rule:snapshot-date-unexpected-parameters'; END IF;
    IF jsonb_typeof(_s -> 'dates') <> 'object' OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_s -> 'dates')) THEN RETURN 'map-rule:snapshot-date-invalid-dates'; END IF;
    FOR e IN SELECT key, value FROM jsonb_each(_s -> 'dates') LOOP
      IF e.key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR jsonb_typeof(e.value) <> 'string'
         OR (e.value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR left(e.value #>> '{}', 7) <> e.key THEN
        RETURN 'map-rule:snapshot-date-invalid-dates';
      END IF;
      BEGIN PERFORM (e.value #>> '{}')::date; EXCEPTION WHEN others THEN RETURN 'map-rule:snapshot-date-invalid-dates'; END;
    END LOOP;
    RETURN NULL;
  END IF;
  RETURN 'map-rule:snapshot-date-unknown-criterion';
END $$;
REVOKE ALL ON FUNCTION public.map_snapshot_criterion_issue(jsonb) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.map_rule_definition_issue(_d jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE i text;
BEGIN
  IF _d IS NULL OR jsonb_typeof(_d) <> 'object' THEN RETURN 'map-rule:definition-required'; END IF;
  IF jsonb_typeof(_d -> 'coveredSchoolIds') <> 'array' OR jsonb_array_length(_d -> 'coveredSchoolIds') = 0 THEN RETURN 'map-rule:covered-schools-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_d -> 'coveredSchoolIds') x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = x)) THEN RETURN 'map-rule:unknown-school'; END IF;
  i := public.map_snapshot_criterion_issue(_d -> 'snapshotDate');
  IF i IS NOT NULL THEN RETURN i; END IF;
  IF jsonb_typeof(_d -> 'cells') <> 'array' THEN RETURN 'map-rule:cells-required'; END IF;
  IF jsonb_typeof(_d -> 'blockingCellIds') <> 'array' THEN RETURN 'map-rule:blocking-cells-required'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.map_rule_definition_issue(jsonb) FROM PUBLIC, anon;

-- Aplicabilidade: dentro da mesma regra lógica, a maior versão homologada vigente sucede as anteriores (sucessão explícita);
-- regras lógicas DISTINTAS simultâneas são todas devolvidas, e o consumidor falha por ambiguidade (sem "a mais nova").
CREATE OR REPLACE FUNCTION public.applicable_map_rule_for_school(_school text, _on date)
RETURNS TABLE(id text, version integer) LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT DISTINCT ON (r.id) r.id, r.version FROM public.map_competence_rules r
  WHERE r.status = 'homologada' AND r.valid_from <= _on AND (r.valid_until IS NULL OR r.valid_until >= _on)
    AND jsonb_typeof(r.definition -> 'coveredSchoolIds') = 'array' AND (r.definition -> 'coveredSchoolIds') ? _school
  ORDER BY r.id, r.version DESC
$$;