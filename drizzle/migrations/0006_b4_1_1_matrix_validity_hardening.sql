-- B4.1.1 — Correções da auditoria técnica da B4.1 (aditiva; 0005 intacta).
-- 1) Ano letivo, escola e componente passam a ser validados em TODA a vigência da
--    versão da matriz, por segmentos: em cada ponto de mudança dentro da vigência
--    vale a versão de maior número com valid_from <= ponto (mesma regra canônica de
--    class_record_context/class_fact_context/curricular_components_at). Versões
--    futuras não valem antes do seu início; inativação posterior dentro da vigência
--    recusa. Vigência aberta ⇒ todas as mudanças registradas após o início contam.
-- 2) Retificação não pode apagar a versão predecessora efetiva (seu início deve ser
--    posterior ao início da predecessora), preservando a cadeia linear que torna a
--    ambiguidade do reader estruturalmente inalcançável.

CREATE FUNCTION public.b41_segment_points(_from date, _until date, _points date[])
RETURNS TABLE(at_date date) LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT _from UNION
  SELECT p FROM pg_catalog.unnest(_points) p WHERE p > _from AND (_until IS NULL OR p <= _until)
$fn$;

CREATE FUNCTION public.b41_school_active_throughout(_school text, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.b41_segment_points(_from, _until,
      ARRAY(SELECT v.valid_from FROM public.institutional_school_record_versions v WHERE v.school_id = _school)) s
    WHERE (SELECT v.active FROM public.institutional_school_record_versions v
           WHERE v.school_id = _school AND v.valid_from <= s.at_date
           ORDER BY v.version_number DESC LIMIT 1) IS DISTINCT FROM true)
$fn$;

CREATE FUNCTION public.b41_year_active_throughout(_year text, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.b41_segment_points(_from, _until,
      ARRAY(SELECT v.valid_from FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = _year)) s
    WHERE (SELECT v.is_active FROM public.institutional_academic_year_versions v
           WHERE v.academic_year_id = _year AND v.valid_from <= s.at_date
           ORDER BY v.version DESC LIMIT 1) IS DISTINCT FROM true)
$fn$;

CREATE FUNCTION public.b41_component_active_throughout(_component text, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.b41_segment_points(_from, _until,
      ARRAY(SELECT v.valid_from FROM public.curricular_component_versions v WHERE v.component_id = _component)) s
    WHERE (SELECT v.is_active FROM public.curricular_component_versions v
           WHERE v.component_id = _component AND v.valid_from <= s.at_date
           ORDER BY v.version DESC LIMIT 1) IS DISTINCT FROM true)
$fn$;

REVOKE ALL ON FUNCTION public.b41_segment_points(date, date, date[]),
  public.b41_school_active_throughout(text, date, date),
  public.b41_year_active_throughout(text, date, date),
  public.b41_component_active_throughout(text, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_curricular_matrix_version(
  _matrix text, _base_version_id uuid, _change_kind text, _official_name text,
  _valid_from date, _valid_until date, _reason text, _act_ref text,
  _items jsonb, _applicability jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  g uuid; _mid text; _vid uuid; _ver integer; _n text := nullif(pg_catalog.btrim(coalesce(_official_name,'')),'');
  b public.curricular_matrix_versions%ROWTYPE; it jsonb; ap jsonb; _pos integer := 0; _key text; _label text;
  _q numeric; _pred_from date;
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
    IF _change_kind = 'retificacao' THEN
      -- predecessora efetiva da base: maior versão anterior não oculta por retificação.
      SELECT p.valid_from INTO _pred_from FROM public.curricular_matrix_versions p
       WHERE p.matrix_id = _matrix AND p.version < b.version
         AND NOT EXISTS (SELECT 1 FROM public.curricular_matrix_versions r
                         WHERE r.supersedes_id = p.id AND r.change_kind = 'retificacao')
       ORDER BY p.version DESC LIMIT 1;
      IF _pred_from IS NOT NULL AND _valid_from <= _pred_from THEN
        RAISE EXCEPTION 'matrix:retification-must-start-after-predecessor'; END IF;
    END IF;
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
      IF NOT public.b41_component_active_throughout(it->>'component', _valid_from, _valid_until) THEN
        RAISE EXCEPTION 'matrix:component-inactive-in-validity'; END IF;
      SELECT v.official_name INTO _label FROM public.curricular_component_versions v
        WHERE v.component_id = it->>'component' AND v.valid_from <= _valid_from ORDER BY v.version DESC LIMIT 1;
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
      IF NOT public.b41_year_active_throughout(ap->>'id', _valid_from, _valid_until)
      THEN RAISE EXCEPTION 'matrix:academic-year-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, academic_year_id) VALUES (_vid, 'ano-letivo', ap->>'id');
    ELSIF ap->>'dimension' = 'escola' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:school-not-found'; END IF;
      IF NOT public.b41_school_active_throughout(ap->>'id', _valid_from, _valid_until)
      THEN RAISE EXCEPTION 'matrix:school-inactive'; END IF;
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

REVOKE ALL ON FUNCTION public.record_curricular_matrix_version(text, uuid, text, text, date, date, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_curricular_matrix_version(text, uuid, text, text, date, date, text, text, jsonb, jsonb) TO authenticated;

COMMENT ON COLUMN public.curricular_matrix_applicability.dimension IS
  'Tipo técnico de referência (FK de ano letivo B2.4, escola B2.1 ou valor de catálogo homologado B2.6 de qualquer esquema). Não é taxonomia normativa: o eixo de oferta (D1) e a semântica de combinação ficam por decidir.';
