-- Y.1: reader de edição aplicável usava record não atribuído quando nenhuma edição cobre a data.
CREATE OR REPLACE FUNCTION public.curricular_reference_edition_applicable_on(_source_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, edition_id uuid, revision_no integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE r record; prev date; best_id uuid; best_rev integer;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'reference:effective-date-required'; END IF;
  FOR r IN SELECT * FROM public.curricular_reference_edition_chain(_source_id, _known_at) LOOP
    IF r.valid_from IS NULL OR (prev IS NOT NULL AND r.valid_from < prev) THEN
      RETURN QUERY SELECT 'ambiguo'::text, NULL::uuid, NULL::integer; RETURN; END IF;
    prev := r.valid_from;
    IF r.valid_from <= _on THEN best_id := r.edition_id; best_rev := r.revision_no; END IF;
  END LOOP;
  IF best_id IS NULL THEN RETURN QUERY SELECT 'nao-definido'::text, NULL::uuid, NULL::integer; RETURN; END IF;
  RETURN QUERY SELECT 'aplicavel'::text, best_id, best_rev;
END $fn$;
