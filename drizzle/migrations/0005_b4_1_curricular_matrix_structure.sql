-- B4.1 — Matriz curricular canônica: estrutura institucional.
-- Aditiva. Migrations anteriores intactas. Nenhum valor institucional semeado.
-- Decisão institucional D4: capability manter-matrizes-curriculares {network}
-- concedida SOMENTE à atuação gestao-pedagogica-da-rede, SOMENTE na v2 draft.

-- 1. D4 na política v2 draft (v1 intacta, v2 continua draft).
DO $b41p$
DECLARE _v1 uuid; _v2 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.capability_policies) THEN
    RAISE NOTICE 'b4_1:no-capability-policy-present; rule deferred'; RETURN;
  END IF;
  SELECT id INTO _v1 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft' FOR UPDATE;
  SELECT id INTO _v2 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  IF _v1 IS NULL OR _v2 IS NULL OR
     (SELECT count(*) FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario') <> 2
  THEN RAISE EXCEPTION 'b4_1:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 116
  THEN RAISE EXCEPTION 'b4_1:unexpected-policy-rule-count'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules
             WHERE capability_id = 'manter-matrizes-curriculares' OR engagement_kind_id = 'gestao-pedagogica-da-rede')
  THEN RAISE EXCEPTION 'b4_1:capability-or-kind-already-present'; END IF;
  INSERT INTO public.capability_policy_rules (policy_id, engagement_kind_id, capability_id, scope_dimensions)
  VALUES (_v2, 'gestao-pedagogica-da-rede', 'manter-matrizes-curriculares', ARRAY['network']::text[]);
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 117
  THEN RAISE EXCEPTION 'b4_1:policy-insert-failed'; END IF;
END $b41p$;

-- 2. Identidade lógica da matriz.
CREATE TABLE public.institutional_curricular_matrices (
  id text PRIMARY KEY CHECK (id ~ '^mat-[0-9a-f-]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Versões da matriz: append-only; constituição, sucessão (nova vigência) ou retificação.
CREATE TABLE public.curricular_matrix_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_id text NOT NULL REFERENCES public.institutional_curricular_matrices(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.curricular_matrix_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  official_name text NOT NULL CHECK (btrim(official_name) <> ''),
  valid_from date NOT NULL,
  valid_until date,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (matrix_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK ((version = 1) = (change_kind = 'constituicao')),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> ''),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- 4. Itens: filhos imutáveis da versão. Componente por ID (B2.3) OU elemento de catálogo aberto.
--    Quantidade separada da unidade; unidade só por catálogo homologado.
CREATE TABLE public.curricular_matrix_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_versions(id),
  item_key text NOT NULL CHECK (item_key ~ '^[a-z0-9][a-z0-9-]*$'),
  position integer NOT NULL CHECK (position >= 0),
  component_id text REFERENCES public.institutional_curricular_components(id),
  component_label_snapshot text,
  element_scheme_id text, element_value_id text, element_value_version integer,
  quantity numeric CHECK (quantity IS NULL OR quantity >= 0),
  unit_scheme_id text, unit_value_id text, unit_value_version integer,
  UNIQUE (matrix_version_id, item_key),
  CHECK ((component_id IS NOT NULL) <> (element_value_id IS NOT NULL)),
  CHECK ((element_value_id IS NULL) = (element_scheme_id IS NULL) AND (element_value_id IS NULL) = (element_value_version IS NULL)),
  CHECK ((unit_value_id IS NULL) = (unit_scheme_id IS NULL) AND (unit_value_id IS NULL) = (unit_value_version IS NULL)),
  CHECK ((quantity IS NULL) = (unit_value_id IS NULL)),
  CHECK (component_id IS NULL OR component_label_snapshot IS NOT NULL)
);

-- 5. Aplicabilidade: somente IDs canônicos (ano letivo B2.4, escola B2.1, valor de catálogo B2.6).
CREATE TABLE public.curricular_matrix_applicability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_versions(id),
  dimension text NOT NULL CHECK (dimension IN ('ano-letivo','escola','atributo')),
  academic_year_id text REFERENCES public.institutional_academic_years(id),
  school_id text REFERENCES public.institutional_schools(id),
  scheme_id text, value_id text, value_version integer,
  CHECK ((dimension = 'ano-letivo') = (academic_year_id IS NOT NULL)),
  CHECK ((dimension = 'escola') = (school_id IS NOT NULL)),
  CHECK ((dimension = 'atributo') = (value_id IS NOT NULL)
     AND (value_id IS NULL) = (scheme_id IS NULL) AND (value_id IS NULL) = (value_version IS NULL))
);
CREATE UNIQUE INDEX curricular_matrix_applicability_unique ON public.curricular_matrix_applicability
  (matrix_version_id, dimension, coalesce(academic_year_id, school_id, scheme_id || ':' || value_id));

CREATE TRIGGER institutional_curricular_matrices_immutable BEFORE UPDATE OR DELETE ON public.institutional_curricular_matrices FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_versions_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_items_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_items FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_applicability_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_applicability FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- 6. ACL: leitura por contas vinculadas; nenhuma escrita direta.
GRANT SELECT ON public.institutional_curricular_matrices, public.curricular_matrix_versions,
  public.curricular_matrix_items, public.curricular_matrix_applicability TO authenticated;
GRANT ALL ON public.institutional_curricular_matrices, public.curricular_matrix_versions,
  public.curricular_matrix_items, public.curricular_matrix_applicability TO service_role;
REVOKE ALL ON public.institutional_curricular_matrices, public.curricular_matrix_versions,
  public.curricular_matrix_items, public.curricular_matrix_applicability FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.institutional_curricular_matrices,
  public.curricular_matrix_versions, public.curricular_matrix_items, public.curricular_matrix_applicability FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.institutional_curricular_matrices, public.curricular_matrix_versions,
      public.curricular_matrix_items, public.curricular_matrix_applicability FROM sandbox_exec;
  END IF;
END $acl$;
ALTER TABLE public.institutional_curricular_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_applicability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matrices readable by linked accounts" ON public.institutional_curricular_matrices FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix versions readable by linked accounts" ON public.curricular_matrix_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix items readable by linked accounts" ON public.curricular_matrix_items FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix applicability readable by linked accounts" ON public.curricular_matrix_applicability FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

-- 7. Reader bitemporal: versão vigente em _on conforme conhecida em _known_at.
--    Retificação conhecida oculta a versão retificada; sucessão encerra a anterior na véspera.
CREATE FUNCTION public.b41_raise(_code text) RETURNS boolean LANGUAGE plpgsql VOLATILE SET search_path TO '' AS $fn$
BEGIN RAISE EXCEPTION '%', _code; END $fn$;

CREATE FUNCTION public.curricular_matrices_at(_on date, _known_at timestamptz)
RETURNS TABLE(matrix_id text, version_id uuid, version integer, change_kind text, official_name text,
  valid_from date, valid_until date, effective_until date, originating_act_ref text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'matrix:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'matrix:known-at-required'; END IF;
  RETURN QUERY
  WITH known AS (
    SELECT v.* FROM public.curricular_matrix_versions v WHERE v.created_at <= _known_at
  ), eff AS (
    SELECT k.* FROM known k WHERE NOT EXISTS (
      SELECT 1 FROM known r WHERE r.supersedes_id = k.id AND r.change_kind = 'retificacao')
  ), win AS (
    SELECT e.*, LEAST(e.valid_until, (SELECT min(e2.valid_from) - 1 FROM eff e2
      WHERE e2.matrix_id = e.matrix_id AND e2.version > e.version)) AS eff_until
    FROM eff e
  ), hit AS (
    SELECT w.* FROM win w WHERE w.valid_from <= _on AND (w.eff_until IS NULL OR _on <= w.eff_until)
      AND (w.eff_until IS NULL OR w.eff_until >= w.valid_from)
  ), amb AS (
    SELECT h.matrix_id FROM hit h GROUP BY h.matrix_id HAVING count(*) > 1
  )
  SELECT h.matrix_id, h.id, h.version, h.change_kind, h.official_name, h.valid_from, h.valid_until,
         h.eff_until, h.originating_act_ref, h.created_at
  FROM hit h
  WHERE CASE WHEN EXISTS (SELECT 1 FROM amb) THEN public.b41_raise('matrix:ambiguous') ELSE true END
  ORDER BY h.official_name, h.matrix_id;
END $fn$;

CREATE FUNCTION public.curricular_matrix_items_at(_matrix text, _on date, _known_at timestamptz)
RETURNS TABLE(version_id uuid, item_key text, "position" integer, component_id text, component_label_snapshot text,
  element_scheme_id text, element_value_id text, element_value_version integer,
  quantity numeric, unit_scheme_id text, unit_value_id text, unit_value_version integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT i.matrix_version_id, i.item_key, i.position, i.component_id, i.component_label_snapshot,
    i.element_scheme_id, i.element_value_id, i.element_value_version,
    i.quantity, i.unit_scheme_id, i.unit_value_id, i.unit_value_version
  FROM public.curricular_matrices_at(_on, _known_at) m
  JOIN public.curricular_matrix_items i ON i.matrix_version_id = m.version_id
  WHERE m.matrix_id = _matrix
  ORDER BY i.position, i.item_key
$fn$;

CREATE FUNCTION public.curricular_matrix_applicability_at(_matrix text, _on date, _known_at timestamptz)
RETURNS TABLE(version_id uuid, dimension text, academic_year_id text, school_id text,
  scheme_id text, value_id text, value_version integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT a.matrix_version_id, a.dimension, a.academic_year_id, a.school_id, a.scheme_id, a.value_id, a.value_version
  FROM public.curricular_matrices_at(_on, _known_at) m
  JOIN public.curricular_matrix_applicability a ON a.matrix_version_id = m.version_id
  WHERE m.matrix_id = _matrix
  ORDER BY a.dimension, coalesce(a.academic_year_id, a.school_id, a.scheme_id || ':' || a.value_id)
$fn$;

-- 8. Writer único: constitui, sucede ou retifica uma versão inteira (cabeçalho + itens + aplicabilidade).
--    Esquemas de catálogo: 'elemento-de-matriz-curricular' (item não componente) e
--    'unidade-de-carga-da-matriz' (unidade). Ambos vazios até homologação ⇒ operações dependentes recusadas.
CREATE FUNCTION public.record_curricular_matrix_version(
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
      IF NOT coalesce((SELECT yv.is_active FROM public.institutional_academic_year_versions yv
          WHERE yv.academic_year_id = ap->>'id' AND yv.valid_from <= _valid_from ORDER BY yv.version DESC LIMIT 1), false)
      THEN RAISE EXCEPTION 'matrix:academic-year-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, academic_year_id) VALUES (_vid, 'ano-letivo', ap->>'id');
    ELSIF ap->>'dimension' = 'escola' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:school-not-found'; END IF;
      IF NOT coalesce((SELECT sv.active FROM public.institutional_school_record_versions sv
          WHERE sv.school_id = ap->>'id' AND sv.valid_from <= _valid_from ORDER BY sv.version_number DESC LIMIT 1), false)
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
REVOKE ALL ON FUNCTION public.curricular_matrices_at(date, timestamptz),
  public.curricular_matrix_items_at(text, date, timestamptz),
  public.curricular_matrix_applicability_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_matrices_at(date, timestamptz),
  public.curricular_matrix_items_at(text, date, timestamptz),
  public.curricular_matrix_applicability_at(text, date, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.b41_raise(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.b41_raise(text) TO authenticated;
