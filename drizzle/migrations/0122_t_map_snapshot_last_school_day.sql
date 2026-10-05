-- T (decisão do proprietário 2026-10-05): fotografia = último dia letivo do mês pelo calendário oficial aplicável.
-- Só esse critério é aceito em novos rascunhos/homologações; datas civis, dia fixo ou datas digitadas são recusados.
CREATE OR REPLACE FUNCTION public.map_rule_definition_issue(_d jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE k text;
BEGIN
  IF _d IS NULL OR jsonb_typeof(_d) <> 'object' THEN RETURN 'map-rule:definition-required'; END IF;
  IF jsonb_typeof(_d -> 'coveredSchoolIds') <> 'array' OR jsonb_array_length(_d -> 'coveredSchoolIds') = 0 THEN RETURN 'map-rule:covered-schools-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_d -> 'coveredSchoolIds') x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = x)) THEN RETURN 'map-rule:unknown-school'; END IF;
  k := _d -> 'snapshotDate' ->> 'kind';
  IF k IS DISTINCT FROM 'ultimo-dia-letivo-do-mes-calendario-oficial' THEN RETURN 'map-rule:snapshot-date-must-be-last-school-day-of-official-calendar'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_d -> 'snapshotDate')) <> 1 THEN RETURN 'map-rule:snapshot-date-no-extra-parameters'; END IF;
  IF jsonb_typeof(_d -> 'cells') <> 'array' THEN RETURN 'map-rule:cells-required'; END IF;
  IF jsonb_typeof(_d -> 'blockingCellIds') <> 'array' THEN RETURN 'map-rule:blocking-cells-required'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.map_rule_definition_issue(jsonb) FROM PUBLIC, anon;