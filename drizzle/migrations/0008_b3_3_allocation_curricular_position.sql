-- B3.3 — Posição curricular individual da alocação (aditiva).
-- Fato filho da alocação (class_enrollment_episodes), append-only, com eixos abertos de catálogo homologado.
-- Não altera alocações, writers B3, policies de capacidade nem matrizes. Nenhum valor é semeado.
CREATE TABLE public.allocation_curricular_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_logical_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.allocation_curricular_positions(id),
  allocation_logical_id text NOT NULL,
  school_id text NOT NULL,
  class_id text NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  annulled boolean NOT NULL DEFAULT false,
  originating_act_ref text,
  change_reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (position_logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((version = 1) = (supersedes_id IS NULL))
);
CREATE INDEX allocation_curricular_positions_alloc_idx ON public.allocation_curricular_positions(allocation_logical_id);
CREATE INDEX allocation_curricular_positions_class_idx ON public.allocation_curricular_positions(school_id, class_id);

CREATE TABLE public.allocation_curricular_position_axes (
  position_version_id uuid NOT NULL REFERENCES public.allocation_curricular_positions(id),
  scheme_id text NOT NULL,
  value_id text NOT NULL,
  value_version integer NOT NULL,
  PRIMARY KEY (position_version_id, scheme_id)
);

GRANT SELECT ON public.allocation_curricular_positions, public.allocation_curricular_position_axes TO authenticated;
GRANT ALL ON public.allocation_curricular_positions, public.allocation_curricular_position_axes TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.allocation_curricular_positions, public.allocation_curricular_position_axes FROM authenticated;
REVOKE ALL ON public.allocation_curricular_positions, public.allocation_curricular_position_axes FROM anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.allocation_curricular_positions, public.allocation_curricular_position_axes FROM sandbox_exec';
  END IF;
END $$;

ALTER TABLE public.allocation_curricular_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_curricular_position_axes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions by roster or enrollment capability" ON public.allocation_curricular_positions FOR SELECT TO authenticated
  USING (public.can_read_class_roster(class_id) OR public.has_capability('consultar-matricula-e-movimentacao', class_id));
CREATE POLICY "position axes via readable position" ON public.allocation_curricular_position_axes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.allocation_curricular_positions p WHERE p.id = position_version_id));

CREATE TRIGGER immutable_allocation_positions BEFORE UPDATE OR DELETE ON public.allocation_curricular_positions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_allocation_position_axes BEFORE UPDATE OR DELETE ON public.allocation_curricular_position_axes
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Valor homologado em toda a janela: em cada ponto de segmento, a última versão do valor com valid_from <= ponto
-- deve estar homologada, e a versão citada deve já vigorar no início.
CREATE FUNCTION public.b33_value_homologated_throughout(_scheme text, _value text, _version integer, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT public.attribute_value_homologated(_scheme, _value, _version, _from)
    AND NOT EXISTS (
      SELECT 1 FROM public.b41_segment_points(_from, _until,
        ARRAY(SELECT d.valid_from FROM public.attribute_value_definitions d
              WHERE d.scheme_id = _scheme AND d.value_id = _value AND d.valid_from IS NOT NULL)) s
      WHERE (SELECT d.status FROM public.attribute_value_definitions d
             WHERE d.scheme_id = _scheme AND d.value_id = _value AND (d.valid_from IS NULL OR d.valid_from <= s.at_date)
             ORDER BY d.version DESC LIMIT 1) IS DISTINCT FROM 'homologada')
$fn$;

CREATE FUNCTION public.record_allocation_curricular_position(_position_logical text, _base_version_id uuid,
  _allocation_logical text, _valid_from date, _valid_until date, _axes jsonb, _act_ref text, _reason text, _annul boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _alloc public.class_enrollment_episodes; _base public.allocation_curricular_positions; _ended date;
  _version integer := 1; _id uuid; ax jsonb; _schemes text[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'position:session-required'; END IF;
  IF coalesce(btrim(_position_logical), '') = '' OR coalesce(btrim(_allocation_logical), '') = '' THEN
    RAISE EXCEPTION 'position:arguments-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'position:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'position:ending-before-start'; END IF;
  SELECT a.* INTO _alloc FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation_logical
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id);
  IF _alloc.id IS NULL THEN RAISE EXCEPTION 'position:allocation-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _alloc.school_id) THEN
    RAISE EXCEPTION 'position:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-position:' || _allocation_logical));
  IF _base_version_id IS NULL THEN
    IF _annul THEN RAISE EXCEPTION 'position:annul-requires-base'; END IF;
    IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions WHERE position_logical_id = _position_logical) THEN
      RAISE EXCEPTION 'position:logical-exists'; END IF;
  ELSE
    SELECT * INTO _base FROM public.allocation_curricular_positions WHERE id = _base_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'position:base-unknown'; END IF;
    IF _base.position_logical_id <> _position_logical THEN RAISE EXCEPTION 'position:base-other-logical'; END IF;
    IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions WHERE supersedes_id = _base_version_id) THEN
      RAISE EXCEPTION 'position:base-superseded'; END IF;
    IF _base.allocation_logical_id <> _allocation_logical THEN RAISE EXCEPTION 'position:allocation-immutable'; END IF;
    IF _base.annulled THEN RAISE EXCEPTION 'position:base-annulled'; END IF;
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'position:correction-reason-required'; END IF;
    _version := _base.version + 1;
  END IF;
  IF NOT _annul THEN
    _ended := public.b3_allocation_ended_on(_allocation_logical);
    IF _valid_from < _alloc.valid_from THEN RAISE EXCEPTION 'position:outside-allocation'; END IF;
    IF _ended IS NOT NULL AND (_valid_until IS NULL OR _valid_until > _ended OR _valid_from > _ended) THEN
      RAISE EXCEPTION 'position:outside-allocation'; END IF;
    IF _axes IS NULL OR jsonb_typeof(_axes) <> 'array' OR jsonb_array_length(_axes) = 0 THEN
      RAISE EXCEPTION 'position:axes-required'; END IF;
    FOR ax IN SELECT * FROM jsonb_array_elements(_axes) LOOP
      IF coalesce(ax->>'scheme', '') = '' OR coalesce(ax->>'value', '') = '' OR (ax->>'version') IS NULL THEN
        RAISE EXCEPTION 'position:axis-malformed'; END IF;
      IF (ax->>'scheme') = ANY (_schemes) THEN RAISE EXCEPTION 'position:axis-duplicated (%)', ax->>'scheme'; END IF;
      _schemes := _schemes || (ax->>'scheme');
      IF NOT public.b33_value_homologated_throughout(ax->>'scheme', ax->>'value', (ax->>'version')::integer, _valid_from, _valid_until) THEN
        RAISE EXCEPTION 'position:value-not-homologated (%/%)', ax->>'scheme', ax->>'value'; END IF;
    END LOOP;
    -- Posições sucessivas na mesma alocação são admitidas; sobreposição tornaria a leitura ambígua.
    IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions p
       WHERE p.allocation_logical_id = _allocation_logical AND p.position_logical_id <> _position_logical AND NOT p.annulled
         AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id)
         AND p.valid_from <= coalesce(_valid_until, 'infinity'::date)
         AND coalesce(p.valid_until, 'infinity'::date) >= _valid_from) THEN
      RAISE EXCEPTION 'position:overlap';
    END IF;
  ELSE
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'position:correction-reason-required'; END IF;
  END IF;
  INSERT INTO public.allocation_curricular_positions(position_logical_id, version, supersedes_id, allocation_logical_id, school_id, class_id,
    valid_from, valid_until, annulled, originating_act_ref, change_reason, recorded_by)
  VALUES (_position_logical, _version, _base_version_id, _allocation_logical, _alloc.school_id, _alloc.class_id,
    CASE WHEN _annul THEN _base.valid_from ELSE _valid_from END, CASE WHEN _annul THEN _base.valid_until ELSE _valid_until END,
    _annul, _act_ref, _reason, auth.uid())
  RETURNING id INTO _id;
  IF NOT _annul THEN
    INSERT INTO public.allocation_curricular_position_axes(position_version_id, scheme_id, value_id, value_version)
    SELECT _id, x->>'scheme', x->>'value', (x->>'version')::integer FROM jsonb_array_elements(_axes) x;
  END IF;
  RETURN _id;
END $fn$;

-- Leitura bitemporal: cada alocação vigente na data aparece; sem posição ⇒ campos de posição nulos (ausência explícita).
-- A posição só é devolvida enquanto a própria alocação vigora na data, então um término posterior da alocação a delimita.
CREATE FUNCTION public.allocation_curricular_positions_at(_school text, _class text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(allocation_id text, allocation_logical_id text, student_id text, school_id text, class_id text,
  position_version_id uuid, position_logical_id text, position_version integer, valid_from date, valid_until date,
  axes jsonb, originating_act_ref text, change_reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  IF _valid_on IS NULL OR (_school IS NULL AND _class IS NULL) THEN RAISE EXCEPTION 'position:query-arguments-required'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.allocation_curricular_positions p
    WHERE (_school IS NULL OR p.school_id = _school) AND (_class IS NULL OR p.class_id = _class)
      AND (_known_at IS NULL OR p.created_at <= _known_at) AND NOT p.annulled
      AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      AND p.valid_from <= _valid_on AND (p.valid_until IS NULL OR p.valid_until >= _valid_on)
    GROUP BY p.allocation_logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'position:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  WITH al AS (SELECT * FROM public.class_allocations_at(_school, _class, _valid_on, _known_at)),
  pos AS (
    SELECT p.* FROM public.allocation_curricular_positions p
    WHERE (_known_at IS NULL OR p.created_at <= _known_at) AND NOT p.annulled
      AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      AND p.valid_from <= _valid_on AND (p.valid_until IS NULL OR p.valid_until >= _valid_on))
  SELECT al.id, al.logical_id, al.student_id, al.school_id, al.class_id, pos.id, pos.position_logical_id, pos.version,
    pos.valid_from, pos.valid_until,
    CASE WHEN pos.id IS NULL THEN NULL ELSE (SELECT coalesce(jsonb_agg(jsonb_build_object('scheme', x.scheme_id, 'value', x.value_id, 'version', x.value_version) ORDER BY x.scheme_id), '[]'::jsonb)
      FROM public.allocation_curricular_position_axes x WHERE x.position_version_id = pos.id) END,
    pos.originating_act_ref, pos.change_reason, pos.created_at
  FROM al LEFT JOIN pos ON pos.allocation_logical_id = al.logical_id;
END $fn$;

REVOKE ALL ON FUNCTION public.b33_value_homologated_throughout(text, text, integer, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_allocation_curricular_position(text, uuid, text, date, date, jsonb, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.allocation_curricular_positions_at(text, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_allocation_curricular_position(text, uuid, text, date, date, jsonb, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocation_curricular_positions_at(text, text, date, timestamptz) TO authenticated;
