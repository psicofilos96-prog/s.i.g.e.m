-- B4.2.5.1 — a fronteira de acesso do resumo da turma passa a ser EXATAMENTE a da leitura de posições B3.3
-- (allocation_curricular_positions: can_read_class_roster OR has_capability('consultar-matricula-e-movimentacao', turma)).
-- A 0016 usava só can_read_class_roster e negava a secretaria que lê as posições; corpo restante idêntico.
CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz,
  context_state text, gate_effect text, state text,
  matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid,
  allocation_count integer, total_allocations integer, resolved_allocations integer,
  column_keys text[], correspondence_ids text[],
  association_id text, association_version_id uuid, association_homologation_id uuid)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $fn$
DECLARE _k timestamptz := coalesce(_known_at, now()); _c record; _sp record;
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'resolution:class-and-date-required'; END IF;
  class_id := _class_id; valid_on := _on; known_at := _k;
  IF NOT (public.can_read_class_roster(_class_id) OR public.has_capability('consultar-matricula-e-movimentacao', _class_id)) THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN;
  END IF;
  SELECT * INTO _c FROM public.class_curricular_resolution_context_at(_class_id, _on, _k);
  context_state := _c.context_state; gate_effect := _c.gate_effect;

  result_kind := 'context';
  SELECT count(*)::int, count(*) FILTER (WHERE r.resolution_state = 'resolvida-por-posicao')::int
    INTO total_allocations, resolved_allocations FROM public.student_curricular_matrix_at(_school, _class_id, _on, _k) r;
  RETURN NEXT;
  total_allocations := NULL; resolved_allocations := NULL;

  IF _c.context_state = 'portao-resolvido' AND _c.gate_effect = 'associacao-explicita' THEN
    SELECT * INTO _sp FROM public.class_specific_curricular_matrix_at(_class_id, _on, _k);
    result_kind := 'specific-link'; state := _sp.resolution_state;
    matrix_id := _sp.matrix_id; matrix_version_id := _sp.matrix_version_id; matrix_homologation_id := _sp.matrix_homologation_id;
    column_keys := CASE WHEN _sp.column_key IS NULL THEN NULL ELSE ARRAY[_sp.column_key] END;
    association_id := _sp.association_id; association_version_id := _sp.association_version_id;
    association_homologation_id := _sp.association_homologation_id;
    RETURN NEXT; RETURN;
  END IF;

  FOR result_kind, state, matrix_id, matrix_version_id, matrix_homologation_id, allocation_count, column_keys, correspondence_ids IN
    SELECT 'matrix', 'resolvida-por-posicao', r.matrix_id, r.matrix_version_id, r.matrix_homologation_id, count(*)::int,
      array_agg(DISTINCT r.column_key ORDER BY r.column_key), array_agg(DISTINCT r.correspondence_id ORDER BY r.correspondence_id)
    FROM public.student_curricular_matrix_at(_school, _class_id, _on, _k) r WHERE r.resolution_state = 'resolvida-por-posicao'
    GROUP BY r.matrix_id, r.matrix_version_id, r.matrix_homologation_id ORDER BY r.matrix_id, r.matrix_version_id
  LOOP RETURN NEXT; END LOOP;

  matrix_id := NULL; matrix_version_id := NULL; matrix_homologation_id := NULL; column_keys := NULL; correspondence_ids := NULL;
  FOR state, allocation_count IN
    SELECT r.resolution_state, count(*)::int FROM public.student_curricular_matrix_at(_school, _class_id, _on, _k) r
    WHERE r.resolution_state <> 'resolvida-por-posicao' GROUP BY r.resolution_state ORDER BY r.resolution_state
  LOOP result_kind := 'unresolved-state'; RETURN NEXT; END LOOP;
END $fn$;

REVOKE ALL ON FUNCTION public.class_curricular_matrices_at(text, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_curricular_matrices_at(text, text, date, timestamptz) TO authenticated;
