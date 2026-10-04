-- B4.6.4f (aditiva; 0028 intacta). Bug confirmado pela auditoria: posição gravada para a turma antiga continuava
-- candidata depois de a alocação ser corrigida para outra turma da mesma escola/ano, porque a turma/escola do
-- snapshot da posição não era confrontada com o head da alocação conhecido em knownAt. Agora divergência é estado
-- inválido explícito; nada é movido nem inferido. knownAt anterior à correção continua vendo a coerência antiga.
CREATE OR REPLACE FUNCTION public.calendar_condition_state_at(_c public.calendar_version_applicability_conditions, _year text, _school text,
  _scope_allocation text, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _act boolean; _found boolean; _st text; _n integer; _p public.allocation_curricular_positions%ROWTYPE; _yr text; _s text; _ac text; _as text; _an integer;
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
    -- B4.6.4f: confronto explícito do snapshot da posição com o head da alocação conhecido em _known_at.
    SELECT count(*) INTO _an FROM public.class_enrollment_episodes e
     WHERE e.logical_id = _p.allocation_logical_id AND e.created_at <= _known_at
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id AND s.created_at <= _known_at);
    IF _an = 0 THEN RETURN 'posicao-com-alocacao-desconhecida-no-instante'; END IF;
    IF _an > 1 THEN RETURN 'ambigua:alocacao-da-posicao'; END IF;
    SELECT e.class_id, e.school_id INTO _ac, _as FROM public.class_enrollment_episodes e
     WHERE e.logical_id = _p.allocation_logical_id AND e.created_at <= _known_at
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id AND s.created_at <= _known_at);
    IF _as IS DISTINCT FROM _p.school_id THEN RETURN 'posicao-alocacao-outra-escola'; END IF;
    IF _ac IS DISTINCT FROM _p.class_id THEN RETURN 'posicao-alocacao-outra-turma'; END IF;
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
