-- B4.6.4d — Janelas temporais explícitas por recorte de aplicabilidade (aditiva; 0023–0026 intactas).
-- Cada recorte NOVO declara [window_from, window_until] (inclusivos), contida na vigência da versão e no ano letivo;
-- condições (escola, valor homologado, alocação, posição) são validadas ao longo da JANELA, não da versão inteira.
-- Recortes antigos (0025/0026) não recebem janela: ficam "janela-nao-registrada"; nada é inferido nem preenchido.
-- O resolver privado só considera um recorte quando a data está dentro da janela; mantém knownAt e o hardening
-- (predicado IS NOT TRUE) de 0026; múltiplos candidatos continuam preservados; nenhuma regra de composição é escolhida.

-- 1. Janela: filho imutável do recorte, gravado só na transação da versão.
CREATE TABLE public.calendar_version_applicability_scope_windows (
  scope_id uuid PRIMARY KEY REFERENCES public.calendar_version_applicability_scopes(id),
  window_from date NOT NULL,
  window_until date NOT NULL,
  CHECK (window_until >= window_from)
);
GRANT ALL ON public.calendar_version_applicability_scope_windows TO service_role;
REVOKE ALL ON public.calendar_version_applicability_scope_windows FROM PUBLIC, anon, authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendar_version_applicability_scope_windows FROM sandbox_exec';
  END IF;
END $acl$;
ALTER TABLE public.calendar_version_applicability_scope_windows ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_calendar_applicability_scope_windows BEFORE UPDATE OR DELETE ON public.calendar_version_applicability_scope_windows
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE FUNCTION public.guard_calendar_applicability_window() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _vid uuid;
BEGIN
  SELECT s.version_id INTO _vid FROM public.calendar_version_applicability_scopes s WHERE s.id = NEW.scope_id;
  IF _vid IS NULL OR coalesce(pg_catalog.current_setting('sigem.calendar_open_' || pg_catalog.replace(_vid::text, '-', ''), true), '') <> '1' THEN
    RAISE EXCEPTION 'calendar:child-after-version-closed';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER calendar_applicability_scope_windows_guard BEFORE INSERT ON public.calendar_version_applicability_scope_windows
  FOR EACH ROW EXECUTE FUNCTION public.guard_calendar_applicability_window();
REVOKE ALL ON FUNCTION public.guard_calendar_applicability_window() FROM PUBLIC, anon, authenticated;

-- 2. Ano letivo ativo e contendo a janela em todos os segmentos da janela.
CREATE FUNCTION public.calendar_window_year_issue(_year text, _from date, _until date)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM (SELECT _from AS at_date UNION SELECT p FROM public.b41_segment_points(_from, _until,
      ARRAY(SELECT v.valid_from FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = _year)) p) s
    WHERE NOT coalesce((SELECT v.is_active AND v.starts_on <= _from AND v.ends_on >= _until
           FROM public.institutional_academic_year_versions v
           WHERE v.academic_year_id = _year AND v.valid_from <= s.at_date
           ORDER BY v.version DESC LIMIT 1), false))
  THEN 'window-outside-academic-year' END
$fn$;
REVOKE ALL ON FUNCTION public.calendar_window_year_issue(text, date, date) FROM PUBLIC, anon, authenticated;

-- 3. Writer com janelas: snapshot completo numa transação. Cada recorte exige window_from/window_until.
CREATE FUNCTION public.record_calendar_version_with_windowed_applicability(
  _calendar text, _base_version_id uuid, _change_kind text,
  _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date,
  _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb, _applicability jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r jsonb; _vid uuid; s jsonb; c jsonb; _sid uuid; _row public.calendar_version_applicability_conditions%ROWTYPE;
  _issue text; _n integer := 0; _school text; _wf date; _wu date;
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
    IF s->>'window_from' IS NULL OR s->>'window_until' IS NULL THEN RAISE EXCEPTION 'calendar-applicability:window-required'; END IF;
    _wf := (s->>'window_from')::date; _wu := (s->>'window_until')::date;
    IF _wu < _wf THEN RAISE EXCEPTION 'calendar-applicability:window-inverted'; END IF;
    IF _wf < _valid_from OR (_valid_until IS NOT NULL AND _wu > _valid_until) THEN
      RAISE EXCEPTION 'calendar-applicability:window-outside-version'; END IF;
    _issue := public.calendar_window_year_issue(_academic_year_id, _wf, _wu);
    IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar-applicability:%', _issue; END IF;
    INSERT INTO public.calendar_version_applicability_scopes(version_id, scope_key, label)
      VALUES (_vid, s->>'scope_key', nullif(pg_catalog.btrim(coalesce(s->>'label','')),'')) RETURNING id INTO _sid;
    INSERT INTO public.calendar_version_applicability_scope_windows(scope_id, window_from, window_until) VALUES (_sid, _wf, _wu);
    _school := NULL;
    FOR c IN SELECT e FROM pg_catalog.jsonb_array_elements(s->'conditions') e LOOP
      INSERT INTO public.calendar_version_applicability_conditions(scope_id, condition_kind, school_id, scheme_id, value_id, value_version,
        allocation_logical_id, position_logical_id)
      VALUES (_sid, c->>'kind', c->>'school_id', c->>'scheme_id', c->>'value_id', (c->>'value_version')::integer,
        c->>'allocation_logical_id', c->>'position_logical_id')
      RETURNING * INTO _row;
      -- Validação ao longo da JANELA (segmentos de escola/valor; vigência de alocação/posição; mesmo ano letivo).
      _issue := public.calendar_applicability_condition_issue(_row, _academic_year_id, _wf, _wu);
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
    IF EXISTS (
      SELECT 1 FROM public.calendar_version_applicability_conditions xa
      JOIN public.calendar_version_applicability_conditions xp ON xp.scope_id = xa.scope_id AND xp.condition_kind = 'posicao-curricular'
      LEFT JOIN public.allocation_curricular_positions p ON p.position_logical_id = xp.position_logical_id
        AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions z WHERE z.supersedes_id = p.id)
      WHERE xa.scope_id = _sid AND xa.condition_kind = 'alocacao'
        AND p.allocation_logical_id IS DISTINCT FROM xa.allocation_logical_id) THEN
      RAISE EXCEPTION 'calendar-applicability:allocation-position-contradiction'; END IF;
    _n := _n + 1;
  END LOOP;
  -- Duplicata = mesmas condições com janelas que se sobrepõem (janelas disjuntas são recortes distintos).
  IF EXISTS (
    WITH sig AS (
      SELECT s.id, w.window_from, w.window_until, pg_catalog.string_agg(x.condition_kind || ':' || coalesce(x.school_id,
          x.scheme_id || '/' || x.value_id || '/' || x.value_version, x.allocation_logical_id, x.position_logical_id), '|'
          ORDER BY x.condition_kind, x.school_id, x.scheme_id, x.value_id, x.value_version, x.allocation_logical_id, x.position_logical_id) AS t
      FROM public.calendar_version_applicability_scopes s
      JOIN public.calendar_version_applicability_scope_windows w ON w.scope_id = s.id
      JOIN public.calendar_version_applicability_conditions x ON x.scope_id = s.id
      WHERE s.version_id = _vid GROUP BY s.id, w.window_from, w.window_until)
    SELECT 1 FROM sig a JOIN sig b ON a.id < b.id AND a.t = b.t
      AND a.window_from <= b.window_until AND b.window_from <= a.window_until) THEN
    RAISE EXCEPTION 'calendar-applicability:duplicate-scope'; END IF;
  INSERT INTO public.calendar_version_applicability_records(version_id, scope_count) VALUES (_vid, _n);
  RETURN r || pg_catalog.jsonb_build_object('applicability_scopes', _n, 'composition_rule', 'nao-homologada', 'windows', 'declaradas');
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_version_with_windowed_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_version_with_windowed_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- 4. O writer 0025/0026 (recortes sem janela) deixa de ser caminho do cliente.
REVOKE EXECUTE ON FUNCTION public.record_calendar_version_with_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.record_calendar_version_with_applicability(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb, jsonb) IS
  'DEPRECATED (B4.6.4d): recortes sem janela; sem EXECUTE para clientes. Use record_calendar_version_with_windowed_applicability.';

-- 5. Resolver PRIVADO: data dentro da janela; recorte sem janela registrada nunca vira candidato nem janela inferida.
CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz,
  _school text, _allocation text, _position text, _axis jsonb)
RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE cal record; v uuid; sc record; _cand integer := 0; _nowin integer := 0;
BEGIN
  IF _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'calendar-applicability:snapshot-required'; END IF;
  FOR cal IN SELECT k.id FROM public.institutional_calendars k ORDER BY k.id LOOP
    v := public.calendar_effective_version(cal.id, _on, _known_at);
    CONTINUE WHEN v IS NULL;
    IF NOT EXISTS (SELECT 1 FROM public.calendar_version_applicability_records a WHERE a.version_id = v AND a.created_at <= _known_at) THEN
      resolution := 'aplicabilidade-nao-registrada'; calendar_id := cal.id; version_id := v; scope_key := NULL; RETURN NEXT; CONTINUE;
    END IF;
    FOR sc IN SELECT s.id, s.scope_key, w.scope_id AS has_window, w.window_from, w.window_until
              FROM public.calendar_version_applicability_scopes s
              LEFT JOIN public.calendar_version_applicability_scope_windows w ON w.scope_id = s.id
              WHERE s.version_id = v ORDER BY s.scope_key LOOP
      CONTINUE WHEN sc.has_window IS NOT NULL AND (_on < sc.window_from OR _on > sc.window_until);
      IF NOT EXISTS (
        SELECT 1 FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = sc.id AND (
          (x.condition_kind = 'escola' AND x.school_id = _school) OR
          (x.condition_kind = 'alocacao' AND x.allocation_logical_id = _allocation) OR
          (x.condition_kind = 'posicao-curricular' AND x.position_logical_id = _position) OR
          (x.condition_kind = 'valor-de-eixo' AND coalesce(_axis, '[]'::jsonb) @>
             pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('scheme', x.scheme_id, 'value', x.value_id, 'version', x.value_version)))) IS NOT TRUE)
      THEN
        calendar_id := cal.id; version_id := v; scope_key := sc.scope_key;
        IF sc.has_window IS NULL THEN
          resolution := 'janela-nao-registrada'; _nowin := _nowin + 1;
        ELSE
          resolution := 'candidato'; _cand := _cand + 1;
        END IF;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
  resolution := CASE WHEN _cand > 0 THEN 'bloqueado:regra-de-selecao-composicao-nao-homologada'
                     WHEN _nowin > 0 THEN 'indeterminado:janela-nao-registrada'
                     ELSE 'sem-candidato' END;
  calendar_id := NULL; version_id := NULL; scope_key := NULL; RETURN NEXT;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_applicability_candidates(date, timestamptz, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
