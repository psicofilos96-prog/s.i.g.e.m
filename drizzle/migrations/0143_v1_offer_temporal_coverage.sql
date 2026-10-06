-- V.1.4 (fechamento V): invariantes temporais com cobertura INTEGRAL da janela.
-- 0129 verificava matriz só no início/fim e jornada só no início/fim/inícios de versão: uma lacuna
-- intermediária (ex.: jornada jan–jun + ago–dez, matriz que deixa de valer no meio) passava.
-- Agora cada dia da janela é verificado; janela aberta vai até o fim do ano letivo da turma
-- (class_time_writable_target já limita a janela ao ano). Vínculo, lotação, atuação e titular da
-- substituição continuam exigindo UM registro que cubra a janela inteira (conservador: recusa lacunas
-- e também recusa coberturas por registros encadeados — documentado em docs/b4-v1-fechamento-oferta.md).
-- V.1.2: offer_capability_on só é chamado de funções DEFINER ⇒ sem EXECUTE para authenticated;
-- readers INVOKER da oferta não são executáveis por service_role (automação não lê fora da RLS).

CREATE FUNCTION public.offer_window_days(_class_id text, _from date, _until date) RETURNS SETOF date
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT d::date FROM pg_catalog.generate_series(_from::timestamp,
    coalesce(_until, (SELECT v.ends_on FROM public.institutional_classes c
       JOIN public.institutional_academic_year_versions v ON v.academic_year_id = c.academic_year_id
      WHERE c.id = _class_id ORDER BY v.version DESC LIMIT 1))::timestamp, interval '1 day') d
$fn$;
REVOKE ALL ON FUNCTION public.offer_window_days(text, date, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.offer_matrix_applicable_throughout(_school text, _class_id text, _mv uuid, _from date, _until date)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT _from IS NOT NULL AND _mv IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.offer_window_days(_class_id, _from, _until) d
    WHERE NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_school, _class_id, d, now()) m
                      WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id = _mv))
$fn$;
REVOKE ALL ON FUNCTION public.offer_matrix_applicable_throughout(text, text, uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Primeiro dia da janela em que algum bloco da versão não cabe na jornada vigente (NULL = cobertura integral).
CREATE FUNCTION public.offer_schedule_journey_gap(_class_id text, _version_id uuid, _from date, _until date)
RETURNS date LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT min(d) FROM public.offer_window_days(_class_id, _from, _until) d
  WHERE EXISTS (SELECT 1 FROM public.class_schedule_blocks x WHERE x.version_id = _version_id AND NOT EXISTS (
      SELECT 1 FROM public.class_journey_at(_class_id, d, now()) j
      WHERE j.result_kind = 'interval' AND j.weekday = x.weekday AND j.starts_at <= x.starts_at AND x.ends_at <= j.ends_at))
$fn$;
REVOKE ALL ON FUNCTION public.offer_schedule_journey_gap(text, uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_class_schedule_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _blocks jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _sid text; _head uuid; _hver integer; _vid uuid; _n integer; b jsonb; _mv uuid; _ik text;
  _comp text; _pt date; _checked uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'schedule');
  g := public.class_time_capability_grant('manter-grade-da-turma', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'schedule:reason-required'; END IF;
  IF _blocks IS NULL OR pg_catalog.jsonb_typeof(_blocks) <> 'array' OR pg_catalog.jsonb_array_length(_blocks) = 0 THEN
    RAISE EXCEPTION 'schedule:blocks-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:' || _class_id, 0));
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id;
  IF _sid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_schedule_versions v WHERE v.schedule_id = _sid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'schedule:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _sid IS NULL THEN
    _sid := 'csch-' || gen_random_uuid()::text;
    INSERT INTO public.class_schedules(id, class_id) VALUES (_sid, _class_id);
  END IF;
  INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id)
    VALUES (_sid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id())
    RETURNING id INTO _vid;
  _n := 0;
  FOR b IN SELECT * FROM pg_catalog.jsonb_array_elements(_blocks) LOOP
    IF b ? 'engagement_ids' THEN RAISE EXCEPTION 'schedule:responsibles-come-from-teaching-assignments'; END IF;
    _mv := nullif(b->>'matrix_version_id','')::uuid; _ik := nullif(b->>'item_key','');
    IF (_mv IS NULL) <> (_ik IS NULL) THEN RAISE EXCEPTION 'schedule:curricular-reference-incomplete'; END IF;
    _comp := NULL;
    IF _mv IS NOT NULL THEN
      SELECT i.component_id INTO _comp FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _mv AND i.item_key = _ik;
      IF NOT FOUND THEN RAISE EXCEPTION 'schedule:element-not-in-matrix'; END IF;
      IF NOT (_mv = ANY(_checked)) THEN
        IF NOT public.offer_matrix_applicable_throughout(_school, _class_id, _mv, _valid_from, _valid_until)
        THEN RAISE EXCEPTION 'schedule:matrix-not-applicable'; END IF;
        _checked := _checked || _mv;
      END IF;
      IF b ? 'component_id' AND (b->>'component_id') IS DISTINCT FROM _comp THEN RAISE EXCEPTION 'schedule:component-contradicts-item'; END IF;
    ELSIF b ? 'component_id' THEN
      RAISE EXCEPTION 'schedule:component-without-matrix-item';
    ELSIF NOT (b ? 'nature_value_id') THEN
      RAISE EXCEPTION 'schedule:curricular-reference-required';
    END IF;
    IF b ? 'nature_value_id' AND NOT public.attribute_value_homologated(b->>'nature_scheme_id', b->>'nature_value_id',
         (b->>'nature_value_version')::integer, _valid_from) THEN RAISE EXCEPTION 'schedule:nature-not-homologated'; END IF;
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id,
        nature_scheme_id, nature_value_id, nature_value_version, matrix_version_id, item_key)
      VALUES (_vid, b->>'block_key', (b->>'weekday')::smallint, (b->>'starts_at')::time, (b->>'ends_at')::time,
        _comp, b->>'nature_scheme_id', b->>'nature_value_id', (b->>'nature_value_version')::integer, _mv, _ik);
    _n := _n + 1;
  END LOOP;
  -- Sobreposição sem norma de paralelismo: recusada (nenhuma nova inconsistência nasce).
  IF EXISTS (SELECT 1 FROM public.class_schedule_blocks x JOIN public.class_schedule_blocks y
             ON x.version_id = _vid AND y.version_id = _vid AND x.id < y.id AND x.weekday = y.weekday
            AND x.starts_at < y.ends_at AND y.starts_at < x.ends_at) THEN RAISE EXCEPTION 'schedule:block-overlap'; END IF;
  -- Encaixe na jornada em TODOS os dias da janela (lacuna intermediária nunca passa).
  _pt := public.offer_schedule_journey_gap(_class_id, _vid, _valid_from, _valid_until);
  IF _pt IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _pt, now()) j WHERE j.result_kind = 'interval') THEN
      RAISE EXCEPTION 'schedule:journey-absent'; END IF;
    RAISE EXCEPTION 'schedule:block-outside-journey';
  END IF;
  RETURN pg_catalog.jsonb_build_object('schedule_id', _sid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'blocks', _n, 'engagement_id', g);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_teaching_assignment_version_v2(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _functional_link_logical_id uuid,
  _matrix_version_id uuid, _item_key text, _role_scheme_id text, _role_value_id text, _role_value_version integer,
  _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _aid text; _head uuid; _hver integer; _vid uuid; _mid text; _pt date; _post uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'assignment');
  g := public.class_time_capability_grant('manter-atribuicao-docente', _school, _valid_from);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'assignment:reason-required'; END IF;
  IF _engagement_id IS NULL OR _matrix_version_id IS NULL OR coalesce(_item_key,'') = '' THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF _role_value_id IS NOT NULL AND NOT public.attribute_value_homologated(_role_scheme_id, _role_value_id, _role_value_version, _valid_from) THEN
    RAISE EXCEPTION 'assignment:role-not-homologated'; END IF;
  _post := public.teaching_staff_fit('assignment', _engagement_id, _school, _functional_link_logical_id, _valid_from, _valid_until);
  SELECT v.matrix_id INTO _mid FROM public.curricular_matrix_versions v WHERE v.id = _matrix_version_id;
  IF _mid IS NULL OR NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _matrix_version_id AND i.item_key = _item_key)
  THEN RAISE EXCEPTION 'assignment:element-not-in-matrix'; END IF;
  IF NOT public.offer_matrix_applicable_throughout(_school, _class_id, _matrix_version_id, _valid_from, _valid_until)
  THEN RAISE EXCEPTION 'assignment:matrix-not-applicable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class_id, 0));
  IF _assignment_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = _assignment_id AND a.class_id = _class_id)
    THEN RAISE EXCEPTION 'assignment:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_assignment_versions v WHERE v.assignment_id = _assignment_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'assignment:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  END IF;
  -- Mesma atuação no mesmo elemento em outra atribuição sobreposta = duplicidade (co-responsabilidade = atuações distintas).
  IF EXISTS (SELECT 1 FROM public.teaching_assignment_effective_versions(now()) w
             JOIN public.teaching_assignment_versions v ON v.id = w.version_id
             JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
             WHERE v.assignment_id IS DISTINCT FROM _assignment_id AND v.engagement_id = _engagement_id
               AND v.matrix_version_id = _matrix_version_id AND v.item_key = _item_key
               AND w.effective_from <= coalesce(_valid_until, 'infinity'::date)
               AND coalesce(w.effective_until, 'infinity'::date) >= _valid_from)
  THEN RAISE EXCEPTION 'assignment:overlap'; END IF;
  IF _assignment_id IS NULL THEN
    _aid := 'ta-' || gen_random_uuid()::text;
    INSERT INTO public.teaching_assignments(id, class_id) VALUES (_aid, _class_id);
  ELSE _aid := _assignment_id; END IF;
  INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, valid_until,
      engagement_id, matrix_id, matrix_version_id, item_key, role_scheme_id, role_value_id, role_value_version,
      source_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id,
      functional_link_logical_id, posting_logical_id)
    VALUES (_aid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, _engagement_id, _mid, _matrix_version_id,
      _item_key, _role_scheme_id, _role_value_id, _role_value_version, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g,
      _functional_link_logical_id, _post)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('assignment_id', _aid, 'version_id', _vid, 'version', coalesce(_hver,0)+1);
END $fn$;

REVOKE EXECUTE ON FUNCTION public.offer_capability_on(text, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.class_journey_at(text, date, timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.class_schedule_at(text, date, timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.person_schedule_at(uuid, date, timestamptz) FROM service_role;
