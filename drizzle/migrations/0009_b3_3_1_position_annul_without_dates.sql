-- B3.3.1 — Anulação de posição não exige datas (a versão anulada herda a janela da base). Aditiva; 0008 intacta.
CREATE OR REPLACE FUNCTION public.record_allocation_curricular_position(_position_logical text, _base_version_id uuid,
  _allocation_logical text, _valid_from date, _valid_until date, _axes jsonb, _act_ref text, _reason text, _annul boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _alloc public.class_enrollment_episodes; _base public.allocation_curricular_positions; _ended date;
  _version integer := 1; _id uuid; ax jsonb; _schemes text[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'position:session-required'; END IF;
  IF coalesce(btrim(_position_logical), '') = '' OR coalesce(btrim(_allocation_logical), '') = '' THEN
    RAISE EXCEPTION 'position:arguments-required'; END IF;
  IF NOT coalesce(_annul, false) THEN
    IF _valid_from IS NULL THEN RAISE EXCEPTION 'position:valid-from-required'; END IF;
    IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'position:ending-before-start'; END IF;
  END IF;
  SELECT a.* INTO _alloc FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation_logical
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id);
  IF _alloc.id IS NULL THEN RAISE EXCEPTION 'position:allocation-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _alloc.school_id) THEN
    RAISE EXCEPTION 'position:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-position:' || _allocation_logical));
  IF _base_version_id IS NULL THEN
    IF coalesce(_annul, false) THEN RAISE EXCEPTION 'position:annul-requires-base'; END IF;
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
  IF NOT coalesce(_annul, false) THEN
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
    IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions p
       WHERE p.allocation_logical_id = _allocation_logical AND p.position_logical_id <> _position_logical AND NOT p.annulled
         AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id)
         AND p.valid_from <= coalesce(_valid_until, 'infinity'::date)
         AND coalesce(p.valid_until, 'infinity'::date) >= _valid_from) THEN
      RAISE EXCEPTION 'position:overlap';
    END IF;
  END IF;
  INSERT INTO public.allocation_curricular_positions(position_logical_id, version, supersedes_id, allocation_logical_id, school_id, class_id,
    valid_from, valid_until, annulled, originating_act_ref, change_reason, recorded_by)
  VALUES (_position_logical, _version, _base_version_id, _allocation_logical, _alloc.school_id, _alloc.class_id,
    CASE WHEN coalesce(_annul, false) THEN _base.valid_from ELSE _valid_from END,
    CASE WHEN coalesce(_annul, false) THEN _base.valid_until ELSE _valid_until END,
    coalesce(_annul, false), _act_ref, _reason, auth.uid())
  RETURNING id INTO _id;
  IF NOT coalesce(_annul, false) THEN
    INSERT INTO public.allocation_curricular_position_axes(position_version_id, scheme_id, value_id, value_version)
    SELECT _id, x->>'scheme', x->>'value', (x->>'version')::integer FROM jsonb_array_elements(_axes) x;
  END IF;
  RETURN _id;
END $fn$;
REVOKE ALL ON FUNCTION public.record_allocation_curricular_position(text, uuid, text, date, date, jsonb, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_allocation_curricular_position(text, uuid, text, date, date, jsonb, text, text, boolean) TO authenticated;
