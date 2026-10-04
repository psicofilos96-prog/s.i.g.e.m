-- B4.6.4e — Revalidação bitemporal das referências dos recortes na RESOLUÇÃO (aditiva; 0023–0027 intactas).
-- O resolver privado deixa de comparar só IDs e janela: cada condição de um recorte que corresponde ao contexto é
-- revalidada na data consultada (_on) e no conhecimento informado (_known_at): só versões/encerramentos/registros com
-- instante de gravação <= _known_at e head calculado nesse conhecimento (nunca o head atual). Referência indisponível,
-- inválida ou ambígua vira linha explícita 'referencia-invalida:<motivo>' / 'referencia-indeterminada:<motivo>',
-- nunca candidato nem inferência. Recortes e registros não são alterados. Nenhuma norma de composição é criada.

-- 1. Estado da alocação em (_on, _known_at). NULL = válida.
CREATE FUNCTION public.calendar_allocation_state_at(_allocation text, _year text, _school text, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _n integer; _a public.class_enrollment_episodes%ROWTYPE; _ne integer; _x public.class_allocation_ending_versions%ROWTYPE; _yr text;
BEGIN
  SELECT count(*) INTO _n FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation AND a.created_at <= _known_at
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND s.created_at <= _known_at);
  IF _n = 0 THEN RETURN 'alocacao-desconhecida-no-instante'; END IF;
  IF _n > 1 THEN RETURN 'ambigua:alocacao'; END IF;
  SELECT a.* INTO _a FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation AND a.created_at <= _known_at
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND s.created_at <= _known_at);
  SELECT k.academic_year_id INTO _yr FROM public.institutional_classes k WHERE k.id = _a.class_id;
  IF _yr IS DISTINCT FROM _year THEN RETURN 'alocacao-outro-ano-letivo'; END IF;
  IF _school IS NOT NULL AND _a.school_id IS DISTINCT FROM _school THEN RETURN 'alocacao-outra-escola'; END IF;
  IF _a.valid_from > _on THEN RETURN 'alocacao-fora-de-vigencia-na-data'; END IF;
  SELECT count(*) INTO _ne FROM public.class_allocation_ending_versions x
   WHERE x.allocation_logical_id = _allocation AND x.created_at <= _known_at
     AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND s.created_at <= _known_at);
  IF _ne > 1 THEN RETURN 'ambigua:encerramento-da-alocacao'; END IF;
  IF _ne = 1 THEN
    SELECT x.* INTO _x FROM public.class_allocation_ending_versions x
     WHERE x.allocation_logical_id = _allocation AND x.created_at <= _known_at
       AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND s.created_at <= _known_at);
    IF NOT _x.annulled AND _x.ended_on < _on THEN RETURN 'alocacao-encerrada-na-data'; END IF;
  END IF;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_allocation_state_at(text, text, text, date, timestamptz) FROM PUBLIC, anon, authenticated;

-- 2. Estado de uma condição em (_on, _known_at). _school = escola declarada no recorte (coerência), se houver.
CREATE FUNCTION public.calendar_condition_state_at(_c public.calendar_version_applicability_conditions, _year text, _school text,
  _scope_allocation text, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _act boolean; _found boolean; _st text; _n integer; _p public.allocation_curricular_positions%ROWTYPE; _yr text; _s text;
BEGIN
  IF _c.condition_kind = 'escola' THEN
    SELECT v.active, true INTO _act, _found FROM public.institutional_school_record_versions v
     WHERE v.school_id = _c.school_id AND v.valid_from <= _on AND v.registered_at <= _known_at
     ORDER BY v.version_number DESC LIMIT 1;
    IF _found IS NULL THEN RETURN 'escola-sem-registro-conhecido'; END IF;
    IF _act IS NOT TRUE THEN RETURN 'escola-inativa-na-data'; END IF;
  ELSIF _c.condition_kind = 'valor-de-eixo' THEN
    IF NOT EXISTS (SELECT 1 FROM public.attribute_value_definitions d
       WHERE d.scheme_id = _c.scheme_id AND d.value_id = _c.value_id AND d.version = _c.value_version
         AND d.created_at <= _known_at AND d.status = 'homologada' AND (d.valid_from IS NULL OR d.valid_from <= _on)) THEN
      RETURN 'valor-nao-homologado-na-data'; END IF;
    SELECT d.status INTO _st FROM public.attribute_value_definitions d
     WHERE d.scheme_id = _c.scheme_id AND d.value_id = _c.value_id AND d.created_at <= _known_at
       AND (d.valid_from IS NULL OR d.valid_from <= _on)
     ORDER BY d.version DESC LIMIT 1;
    IF _st IS DISTINCT FROM 'homologada' THEN RETURN 'valor-sem-homologacao-vigente-na-data'; END IF;
  ELSIF _c.condition_kind = 'alocacao' THEN
    RETURN public.calendar_allocation_state_at(_c.allocation_logical_id, _year, _school, _on, _known_at);
  ELSIF _c.condition_kind = 'posicao-curricular' THEN
    SELECT count(*) INTO _n FROM public.allocation_curricular_positions p
     WHERE p.position_logical_id = _c.position_logical_id AND p.created_at <= _known_at
       AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id AND s.created_at <= _known_at);
    IF _n = 0 THEN RETURN 'posicao-desconhecida-no-instante'; END IF;
    IF _n > 1 THEN RETURN 'ambigua:posicao'; END IF;
    SELECT p.* INTO _p FROM public.allocation_curricular_positions p
     WHERE p.position_logical_id = _c.position_logical_id AND p.created_at <= _known_at
       AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions s WHERE s.supersedes_id = p.id AND s.created_at <= _known_at);
    IF _p.annulled THEN RETURN 'posicao-anulada'; END IF;
    IF _p.valid_from IS NULL OR _p.valid_from > _on OR (_p.valid_until IS NOT NULL AND _p.valid_until < _on) THEN
      RETURN 'posicao-fora-de-vigencia-na-data'; END IF;
    SELECT k.academic_year_id INTO _yr FROM public.institutional_classes k WHERE k.id = _p.class_id;
    IF _yr IS DISTINCT FROM _year THEN RETURN 'posicao-outro-ano-letivo'; END IF;
    IF _school IS NOT NULL AND _p.school_id IS DISTINCT FROM _school THEN RETURN 'posicao-outra-escola'; END IF;
    IF _scope_allocation IS NOT NULL AND _p.allocation_logical_id IS DISTINCT FROM _scope_allocation THEN
      RETURN 'contradicao-alocacao-posicao'; END IF;
    -- Coerência posição → alocação: a alocação da posição precisa ser válida na mesma data e conhecimento.
    _s := public.calendar_allocation_state_at(_p.allocation_logical_id, _year, _school, _on, _known_at);
    IF _s IS NOT NULL THEN
      RETURN CASE WHEN _s LIKE 'ambigua:%' THEN _s ELSE 'posicao-com-' || _s END; END IF;
  ELSE
    RETURN 'condicao-desconhecida';
  END IF;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_condition_state_at(public.calendar_version_applicability_conditions, text, text, text, date, timestamptz) FROM PUBLIC, anon, authenticated;

-- 3. Ano letivo da versão em (_on, _known_at).
CREATE FUNCTION public.calendar_year_state_at(_year text, _on date, _known_at timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT CASE WHEN (SELECT v.is_active AND v.starts_on <= _on AND v.ends_on >= _on
                    FROM public.institutional_academic_year_versions v
                    WHERE v.academic_year_id = _year AND v.valid_from <= _on AND v.created_at <= _known_at
                    ORDER BY v.version DESC LIMIT 1) IS TRUE THEN NULL ELSE 'ano-letivo-inativo-ou-desconhecido-na-data' END
$fn$;
REVOKE ALL ON FUNCTION public.calendar_year_state_at(text, date, timestamptz) FROM PUBLIC, anon, authenticated;

-- 4. Resolver PRIVADO (mesma assinatura/retorno). Preserva: knownAt da versão e do marcador, IS NOT TRUE (0026),
--    janela inclusiva e legado sem janela (0027), multiplicidade sem dominante.
CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz,
  _school text, _allocation text, _position text, _axis jsonb)
RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE cal record; v uuid; sc record; _cand integer := 0; _nowin integer := 0; _inv integer := 0;
  _yr text; _ys text; _ss text; _sschool text; _salloc text;
BEGIN
  IF _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'calendar-applicability:snapshot-required'; END IF;
  FOR cal IN SELECT k.id FROM public.institutional_calendars k ORDER BY k.id LOOP
    v := public.calendar_effective_version(cal.id, _on, _known_at);
    CONTINUE WHEN v IS NULL;
    IF NOT EXISTS (SELECT 1 FROM public.calendar_version_applicability_records a WHERE a.version_id = v AND a.created_at <= _known_at) THEN
      resolution := 'aplicabilidade-nao-registrada'; calendar_id := cal.id; version_id := v; scope_key := NULL; RETURN NEXT; CONTINUE;
    END IF;
    SELECT cv.academic_year_id INTO _yr FROM public.calendar_versions cv WHERE cv.id = v;
    _ys := public.calendar_year_state_at(_yr, _on, _known_at);
    FOR sc IN SELECT s.id, s.scope_key, w.scope_id AS has_window, w.window_from, w.window_until
              FROM public.calendar_version_applicability_scopes s
              LEFT JOIN public.calendar_version_applicability_scope_windows w ON w.scope_id = s.id
              WHERE s.version_id = v ORDER BY s.scope_key LOOP
      CONTINUE WHEN sc.has_window IS NOT NULL AND (_on < sc.window_from OR _on > sc.window_until);
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = sc.id AND (
          (x.condition_kind = 'escola' AND x.school_id = _school) OR
          (x.condition_kind = 'alocacao' AND x.allocation_logical_id = _allocation) OR
          (x.condition_kind = 'posicao-curricular' AND x.position_logical_id = _position) OR
          (x.condition_kind = 'valor-de-eixo' AND coalesce(_axis, '[]'::jsonb) @>
             pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('scheme', x.scheme_id, 'value', x.value_id, 'version', x.value_version)))) IS NOT TRUE);
      calendar_id := cal.id; version_id := v; scope_key := sc.scope_key;
      IF sc.has_window IS NULL THEN
        resolution := 'janela-nao-registrada'; _nowin := _nowin + 1; RETURN NEXT; CONTINUE;
      END IF;
      _ss := _ys;
      IF _ss IS NULL THEN
        SELECT max(x.school_id) FILTER (WHERE x.condition_kind = 'escola'), max(x.allocation_logical_id) FILTER (WHERE x.condition_kind = 'alocacao')
          INTO _sschool, _salloc FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = sc.id;
        SELECT st INTO _ss FROM (
          SELECT public.calendar_condition_state_at(x, _yr, _sschool, _salloc, _on, _known_at) AS st, x.condition_kind
          FROM public.calendar_version_applicability_conditions x WHERE x.scope_id = sc.id) q
          WHERE q.st IS NOT NULL ORDER BY (q.st LIKE 'ambigua:%') DESC, q.condition_kind, q.st LIMIT 1;
      END IF;
      IF _ss IS NULL THEN
        resolution := 'candidato'; _cand := _cand + 1;
      ELSIF _ss LIKE 'ambigua:%' THEN
        resolution := 'referencia-indeterminada:' || pg_catalog.substr(_ss, 9); _inv := _inv + 1;
      ELSE
        resolution := 'referencia-invalida:' || _ss; _inv := _inv + 1;
      END IF;
      RETURN NEXT;
    END LOOP;
  END LOOP;
  resolution := CASE WHEN _cand > 0 THEN 'bloqueado:regra-de-selecao-composicao-nao-homologada'
                     WHEN _nowin > 0 THEN 'indeterminado:janela-nao-registrada'
                     WHEN _inv > 0 THEN 'indeterminado:referencia-nao-revalidada'
                     ELSE 'sem-candidato' END;
  calendar_id := NULL; version_id := NULL; scope_key := NULL; RETURN NEXT;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_applicability_candidates(date, timestamptz, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
