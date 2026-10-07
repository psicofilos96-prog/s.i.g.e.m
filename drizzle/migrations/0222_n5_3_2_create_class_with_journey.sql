-- N5.3.2 — criação da turma com jornada opcional, tudo-ou-nada: falha na jornada desfaz a turma.
CREATE OR REPLACE FUNCTION public.secretariat_create_class_with_journey(_school text, _year text, _code text, _name text, _valid_from date, _valid_until date,
  _composition jsonb, _shift jsonb, _capacity integer, _source_ref text, _journey jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r jsonb; j jsonb;
BEGIN
  r := public.secretariat_create_class(_school, _year, _code, _name, _valid_from, _valid_until, _composition, _shift, _capacity, _source_ref);
  IF _journey IS NOT NULL AND pg_catalog.jsonb_typeof(_journey) = 'array' AND pg_catalog.jsonb_array_length(_journey) > 0 THEN
    j := public.record_class_journey_version(r->>'class_id', NULL, 'constituicao', _valid_from, _valid_until, _source_ref, NULL, _journey);
    r := r || pg_catalog.jsonb_build_object('journey_version_id', j->>'version_id');
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_create_class_with_journey(text, text, text, text, date, date, jsonb, jsonb, integer, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_create_class_with_journey(text, text, text, text, date, date, jsonb, jsonb, integer, text, jsonb) TO authenticated;