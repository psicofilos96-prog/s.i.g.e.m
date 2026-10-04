-- B4.6.4c — Hardening aditivo de 0025 (0025 intacta).
-- 1. Resolver: condição só é satisfeita se o predicado for TRUE; contexto NULL (UNKNOWN) nunca corresponde.
-- 2. Writer: alocação e posição no mesmo recorte não podem se contradizer.
CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz,
  _school text, _allocation text, _position text, _axis jsonb)
RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE cal record; v uuid; sc record; _cand integer := 0;
BEGIN
  IF _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'calendar-applicability:snapshot-required'; END IF;
  FOR cal IN SELECT k.id FROM public.institutional_calendars k ORDER BY k.id LOOP
    v := public.calendar_effective_version(cal.id, _on, _known_at);
    CONTINUE WHEN v IS NULL;
    IF NOT EXISTS (SELECT 1 FROM public.calendar_version_applicability_records a WHERE a.version_id = v AND a.created_at <= _known_at) THEN
      resolution := 'aplicabilidade-nao-registrada'; calendar_id := cal.id; version_id := v; scope_key := NULL; RETURN NEXT; CONTINUE;
    END IF;
    FOR sc IN SELECT s.id, s.scope_key FROM public.calendar_version_applicability_scopes s WHERE s.version_id = v ORDER BY s.scope_key LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = sc.id AND (
          (x.condition_kind = 'escola' AND x.school_id = _school) OR
          (x.condition_kind = 'alocacao' AND x.allocation_logical_id = _allocation) OR
          (x.condition_kind = 'posicao-curricular' AND x.position_logical_id = _position) OR
          (x.condition_kind = 'valor-de-eixo' AND coalesce(_axis, '[]'::jsonb) @>
             pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('scheme', x.scheme_id, 'value', x.value_id, 'version', x.value_version)))) IS NOT TRUE)
      THEN
        resolution := 'candidato'; calendar_id := cal.id; version_id := v; scope_key := sc.scope_key; RETURN NEXT; _cand := _cand + 1;
      END IF;
    END LOOP;
  END LOOP;
  resolution := CASE WHEN _cand = 0 THEN 'sem-candidato' ELSE 'bloqueado:regra-de-selecao-composicao-nao-homologada' END;
  calendar_id := NULL; version_id := NULL; scope_key := NULL; RETURN NEXT;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_applicability_candidates(date, timestamptz, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_calendar_version_with_applicability(
  _calendar text, _base_version_id uuid, _change_kind text,
  _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date,
  _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb, _applicability jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r jsonb; _vid uuid; s jsonb; c jsonb; _sid uuid; _row public.calendar_version_applicability_conditions%ROWTYPE;
  _issue text; _n integer := 0; _sigs text[] := ARRAY[]::text[]; _sig text; _school text;
BEGIN
  PERFORM public.calendar_network_grant('construir-calendario-da-rede');
  IF _applicability IS NULL OR pg_catalog.jsonb_typeof(_applicability) <> 'array' OR pg_catalog.jsonb_array_length(_applicability) = 0 THEN
    RAISE EXCEPTION 'calendar-applicability:scopes-required'; END IF;
  r := public.record_calendar_version(_calendar, _base_version_id, _change_kind, _academic_year_id, _period_organization_id,
    _valid_from, _valid_until, _act_ref, _reason, _periods, _ranges, _events, _days);
  _vid := (r->>'version_id')::uuid;
  FOR s IN SELECT e FROM pg_catalog.jsonb_array_elements(_applicability) e LOOP
    IF pg_catalog.jsonb_typeof(s->'conditions') IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(s->'conditions') = 0 THEN
      RAISE EXCEPTION 'calendar-applicability:conditions-required'; END IF;
    INSERT INTO public.calendar_version_applicability_scopes(version_id, scope_key, label)
      VALUES (_vid, s->>'scope_key', nullif(pg_catalog.btrim(coalesce(s->>'label','')),'')) RETURNING id INTO _sid;
    _school := NULL;
    FOR c IN SELECT e FROM pg_catalog.jsonb_array_elements(s->'conditions') e LOOP
      INSERT INTO public.calendar_version_applicability_conditions(scope_id, condition_kind, school_id, scheme_id, value_id, value_version,
        allocation_logical_id, position_logical_id)
      VALUES (_sid, c->>'kind', c->>'school_id', c->>'scheme_id', c->>'value_id', (c->>'value_version')::integer,
        c->>'allocation_logical_id', c->>'position_logical_id')
      RETURNING * INTO _row;
      _issue := public.calendar_applicability_condition_issue(_row, _academic_year_id, _valid_from, _valid_until);
      IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar-applicability:%', _issue; END IF;
      IF _row.condition_kind = 'escola' THEN _school := _row.school_id; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = _sid
               GROUP BY x.condition_kind, CASE WHEN x.condition_kind = 'valor-de-eixo' THEN x.scheme_id END HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'calendar-applicability:conflicting-conditions-in-scope'; END IF;
    IF _school IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.calendar_version_applicability_conditions x
      LEFT JOIN public.class_enrollment_episodes e ON x.condition_kind = 'alocacao' AND e.logical_id = x.allocation_logical_id
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes z WHERE z.supersedes_id = e.id)
      LEFT JOIN public.allocation_curricular_positions p ON x.condition_kind = 'posicao-curricular' AND p.position_logical_id = x.position_logical_id
        AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions z WHERE z.supersedes_id = p.id)
      WHERE x.scope_id = _sid AND x.condition_kind IN ('alocacao','posicao-curricular')
        AND coalesce(e.school_id, p.school_id) IS DISTINCT FROM _school) THEN
      RAISE EXCEPTION 'calendar-applicability:cross-school-reference'; END IF;
    -- B4.6.4c: alocação e posição no mesmo recorte devem referir a MESMA alocação (sem contradição).
    IF EXISTS (
      SELECT 1 FROM public.calendar_version_applicability_conditions xa
      JOIN public.calendar_version_applicability_conditions xp ON xp.scope_id = xa.scope_id AND xp.condition_kind = 'posicao-curricular'
      LEFT JOIN public.allocation_curricular_positions p ON p.position_logical_id = xp.position_logical_id
        AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions z WHERE z.supersedes_id = p.id)
      WHERE xa.scope_id = _sid AND xa.condition_kind = 'alocacao'
        AND p.allocation_logical_id IS DISTINCT FROM xa.allocation_logical_id) THEN
      RAISE EXCEPTION 'calendar-applicability:allocation-position-contradiction'; END IF;
    SELECT pg_catalog.string_agg(q.t, '|' ORDER BY q.t) INTO _sig FROM (
      SELECT x.condition_kind || ':' || coalesce(x.school_id, x.scheme_id || '/' || x.value_id || '/' || x.value_version,
        x.allocation_logical_id, x.position_logical_id) AS t
      FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = _sid) q;
    IF _sig = ANY(_sigs) THEN RAISE EXCEPTION 'calendar-applicability:duplicate-scope'; END IF;
    _sigs := _sigs || _sig; _n := _n + 1;
  END LOOP;
  INSERT INTO public.calendar_version_applicability_records(version_id, scope_count) VALUES (_vid, _n);
  RETURN r || pg_catalog.jsonb_build_object('applicability_scopes', _n, 'composition_rule', 'nao-homologada');
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_version_with_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_version_with_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;