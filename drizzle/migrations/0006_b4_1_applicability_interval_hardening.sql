-- B4.1: valida escola e ano em cada mudança de vigência dentro de intervalo delimitado.
-- Aditiva: mantém a assinatura, ACL, RLS e todas as migrations publicadas.
-- Sem término explícito, a validação cobre o início sem presumir horizonte infinito.

CREATE OR REPLACE FUNCTION public.record_curricular_matrix_version(
  _matrix text, _base_version_id uuid, _change_kind text, _official_name text,
  _valid_from date, _valid_until date, _reason text, _act_ref text,
  _items jsonb, _applicability jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  g uuid; _mid text; _vid uuid; _ver integer; _n text := nullif(pg_catalog.btrim(coalesce(_official_name,'')),'');
  b public.curricular_matrix_versions%ROWTYPE; it jsonb; ap jsonb; _pos integer := 0; _key text; _label text;
  _q numeric; _u_end date := coalesce(_valid_until, 'infinity'::date);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'matrix:session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.capability_id = 'manter-matrizes-curriculares' AND c.scope_level = 'rede' LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-matrizes-curriculares'; END IF;
  IF _n IS NULL THEN RAISE EXCEPTION 'matrix:name-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'matrix:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'matrix:ends-before-start'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'matrix:act-required'; END IF;
  IF _items IS NULL OR pg_catalog.jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'matrix:items-required'; END IF;
  IF _applicability IS NULL OR pg_catalog.jsonb_typeof(_applicability) <> 'array' THEN RAISE EXCEPTION 'matrix:applicability-required'; END IF;

  IF _matrix IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'matrix:invalid-change-kind'; END IF;
    _mid := 'mat-' || gen_random_uuid(); _ver := 1;
    INSERT INTO public.institutional_curricular_matrices(id) VALUES (_mid);
  ELSE
    IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION 'matrix:invalid-change-kind'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('matrix:' || _matrix, 0));
    SELECT * INTO b FROM public.curricular_matrix_versions v WHERE v.matrix_id = _matrix ORDER BY v.version DESC LIMIT 1;
    IF b.id IS NULL THEN RAISE EXCEPTION 'matrix:not-found'; END IF;
    IF _base_version_id IS DISTINCT FROM b.id THEN RAISE EXCEPTION 'matrix:base-superseded'; END IF;
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'matrix:reason-required'; END IF;
    IF _change_kind = 'sucessao' AND _valid_from <= b.valid_from THEN RAISE EXCEPTION 'matrix:succession-must-start-after-base'; END IF;
    _mid := _matrix; _ver := b.version + 1;
  END IF;

  INSERT INTO public.curricular_matrix_versions(matrix_id, version, supersedes_id, change_kind, official_name, valid_from, valid_until,
    change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_mid, _ver, b.id, _change_kind, _n, _valid_from, _valid_until,
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), pg_catalog.btrim(_act_ref), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO _vid;

  FOR it IN SELECT x FROM pg_catalog.jsonb_array_elements(_items) x LOOP
    _key := nullif(it->>'key',''); IF _key IS NULL THEN _key := 'item-' || pg_catalog.substr(gen_random_uuid()::text, 1, 8); END IF;
    IF _key !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'matrix:item-key-invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _vid AND i.item_key = _key) THEN
      RAISE EXCEPTION 'matrix:item-key-duplicate'; END IF;
    IF (it ? 'component') = (it ? 'element') THEN RAISE EXCEPTION 'matrix:item-reference-required'; END IF;
    _label := NULL;
    IF it ? 'component' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_curricular_components c WHERE c.id = it->>'component') THEN
        RAISE EXCEPTION 'matrix:component-not-found'; END IF;
      SELECT c.official_name INTO _label FROM public.curricular_components_at(_valid_from) c
        WHERE c.component_id = it->>'component' AND c.is_active;
      IF _label IS NULL OR EXISTS (SELECT 1 FROM public.curricular_component_versions cv
          WHERE cv.component_id = it->>'component' AND NOT cv.is_active AND cv.valid_from > _valid_from AND cv.valid_from <= _u_end)
      THEN RAISE EXCEPTION 'matrix:component-inactive-in-validity'; END IF;
    ELSE
      IF it->'element'->>'scheme' IS DISTINCT FROM 'elemento-de-matriz-curricular'
        OR NOT public.attribute_value_homologated('elemento-de-matriz-curricular', it->'element'->>'value',
             (it->'element'->>'version')::integer, _valid_from)
      THEN RAISE EXCEPTION 'matrix:item-element-not-homologated'; END IF;
    END IF;
    _q := NULL;
    IF it ? 'quantity' AND it->>'quantity' IS NOT NULL THEN
      _q := (it->>'quantity')::numeric;
      IF _q < 0 THEN RAISE EXCEPTION 'matrix:quantity-invalid'; END IF;
      IF NOT (it ? 'unit') OR it->'unit' = 'null'::jsonb THEN RAISE EXCEPTION 'matrix:unit-required'; END IF;
      IF it->'unit'->>'scheme' IS DISTINCT FROM 'unidade-de-carga-da-matriz'
        OR NOT public.attribute_value_homologated('unidade-de-carga-da-matriz', it->'unit'->>'value',
             (it->'unit'->>'version')::integer, _valid_from)
      THEN RAISE EXCEPTION 'matrix:unit-not-homologated'; END IF;
    ELSIF it ? 'unit' AND it->'unit' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'matrix:quantity-required';
    END IF;
    INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot,
      element_scheme_id, element_value_id, element_value_version, quantity, unit_scheme_id, unit_value_id, unit_value_version)
    VALUES (_vid, _key, _pos, it->>'component', _label,
      CASE WHEN it ? 'element' THEN 'elemento-de-matriz-curricular' END, it->'element'->>'value', (it->'element'->>'version')::integer,
      _q, CASE WHEN _q IS NOT NULL THEN 'unidade-de-carga-da-matriz' END,
      CASE WHEN _q IS NOT NULL THEN it->'unit'->>'value' END, CASE WHEN _q IS NOT NULL THEN (it->'unit'->>'version')::integer END);
    _pos := _pos + 1;
  END LOOP;

  FOR ap IN SELECT x FROM pg_catalog.jsonb_array_elements(_applicability) x LOOP
    IF ap->>'dimension' = 'ano-letivo' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_academic_years y WHERE y.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:academic-year-not-found'; END IF;
      IF EXISTS (
        WITH checkpoints AS (
          SELECT _valid_from AS at_date
          UNION
          SELECT yv.valid_from FROM public.institutional_academic_year_versions yv
          WHERE yv.academic_year_id = ap->>'id'
            AND yv.valid_from > _valid_from AND yv.valid_from <= coalesce(_valid_until, _valid_from)
        )
        SELECT 1 FROM checkpoints d
        LEFT JOIN LATERAL (
          SELECT yv.is_active FROM public.institutional_academic_year_versions yv
          WHERE yv.academic_year_id = ap->>'id' AND yv.valid_from <= d.at_date
          ORDER BY yv.version DESC LIMIT 1
        ) effective ON true
        WHERE effective.is_active IS DISTINCT FROM true
      ) THEN RAISE EXCEPTION 'matrix:academic-year-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, academic_year_id) VALUES (_vid, 'ano-letivo', ap->>'id');
    ELSIF ap->>'dimension' = 'escola' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:school-not-found'; END IF;
      IF EXISTS (
        WITH checkpoints AS (
          SELECT _valid_from AS at_date
          UNION
          SELECT sv.valid_from FROM public.institutional_school_record_versions sv
          WHERE sv.school_id = ap->>'id'
            AND sv.valid_from > _valid_from AND sv.valid_from <= coalesce(_valid_until, _valid_from)
        )
        SELECT 1 FROM checkpoints d
        LEFT JOIN LATERAL (
          SELECT sv.active FROM public.institutional_school_record_versions sv
          WHERE sv.school_id = ap->>'id' AND sv.valid_from <= d.at_date
          ORDER BY sv.version_number DESC LIMIT 1
        ) effective ON true
        WHERE effective.active IS DISTINCT FROM true
      ) THEN RAISE EXCEPTION 'matrix:school-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, school_id) VALUES (_vid, 'escola', ap->>'id');
    ELSIF ap->>'dimension' = 'atributo' THEN
      IF NOT public.attribute_value_homologated(ap->>'scheme', ap->>'value', (ap->>'version')::integer, _valid_from) THEN
        RAISE EXCEPTION 'matrix:applicability-value-not-homologated'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, scheme_id, value_id, value_version)
        VALUES (_vid, 'atributo', ap->>'scheme', ap->>'value', (ap->>'version')::integer);
    ELSE
      RAISE EXCEPTION 'matrix:applicability-dimension-invalid';
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('matrix_id', _mid, 'version_id', _vid, 'version', _ver);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'matrix:applicability-duplicate';
END $fn$;
