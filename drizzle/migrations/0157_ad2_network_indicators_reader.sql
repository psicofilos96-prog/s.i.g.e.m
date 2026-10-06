-- AD.2: leitor único dos indicadores da rede. SECURITY INVOKER (a RLS de quem consulta vale), STABLE (nunca escreve).
-- Estados: available | zero | unknown | unavailable. Zero só quando a sessão está autorizada no recorte E a fonte já está
-- constituída; fonte vazia = "não constituída" (unavailable); sem autorização ou nada legível = unknown.
-- Temporalidade: vigência pela data do fato (_on) e conhecimento por _known_at; nunca contagem bruta de tabela.
CREATE OR REPLACE FUNCTION public.network_indicators_at(_on date, _known_at timestamptz DEFAULT NULL, _school text DEFAULT NULL, _year text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $$
DECLARE
  k timestamptz := coalesce(_known_at, now());
  out jsonb := '{}'::jsonb;
  n bigint; tot bigint; bk jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ad:session-required' USING ERRCODE = '42501'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'ad:as-of-required'; END IF;

  -- 1. Escolas ativas (versão cadastral vigente na data, conhecida até k)
  WITH v AS (
    SELECT DISTINCT ON (r.school_id) r.school_id, r.active, r.administrative_dependency, r.location_kind
      FROM public.institutional_school_record_versions r
     WHERE r.valid_from <= _on AND r.registered_at <= k AND (_school IS NULL OR r.school_id = _school)
     ORDER BY r.school_id, r.version_number DESC)
  SELECT (SELECT count(*) FROM v WHERE active), (SELECT count(*) FROM v),
         jsonb_build_object(
           'escola', (SELECT coalesce(jsonb_object_agg(school_id, 1), '{}'::jsonb) FROM v WHERE active),
           'dependencia', (SELECT coalesce(jsonb_object_agg(coalesce(x.d,'não informado'), x.c), '{}'::jsonb) FROM (SELECT administrative_dependency d, count(*) c FROM v WHERE active GROUP BY 1) x),
           'localizacao', (SELECT coalesce(jsonb_object_agg(coalesce(x.d,'não informado'), x.c), '{}'::jsonb) FROM (SELECT location_kind d, count(*) c FROM v WHERE active GROUP BY 1) x))
    INTO n, tot, bk;
  out := out || jsonb_build_object('escolas-ativas', CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.institutional_school_record_versions) THEN jsonb_build_object('state','unavailable','reason','Cadastro das escolas ainda não constituído.')
    WHEN tot = 0 THEN jsonb_build_object('state','unknown','reason','Nenhuma versão cadastral vigente na data para o recorte.')
    WHEN n = 0 THEN jsonb_build_object('state','zero','value',0,'reason','Versões vigentes lidas; nenhuma ativa.','breakdown',bk)
    ELSE jsonb_build_object('state','available','value',n,'breakdown',bk) END
    || jsonb_build_object('source','institutional_school_record_versions'));

  -- 2. Infraestrutura declarada (última observação por escola+atributo vigente na data)
  WITH o AS (
    SELECT DISTINCT ON (x.school_id, x.attribute_id) x.school_id
      FROM public.school_infrastructure_observations x
     WHERE x.valid_from <= _on AND x.known_at <= k AND (_school IS NULL OR x.school_id = _school)
     ORDER BY x.school_id, x.attribute_id, x.valid_from DESC, x.known_at DESC)
  SELECT (SELECT count(*) FROM o), (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb) FROM (SELECT school_id s, count(*) c FROM o GROUP BY 1) q) INTO n, bk;
  out := out || jsonb_build_object('infraestrutura-declarada', CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.school_infrastructure_observations) THEN jsonb_build_object('state','unavailable','reason','Infraestrutura ainda não constituída.')
    WHEN n = 0 THEN jsonb_build_object('state','unknown','reason','Nenhuma observação vigente na data para o recorte; ausência não prova zero itens.')
    ELSE jsonb_build_object('state','available','value',n,'breakdown',jsonb_build_object('escola',bk)) END
    || jsonb_build_object('source','school_infrastructure_observations'));

  -- 3. Matrículas vigentes (abertas até a data, não substituídas, sem encerramento até a data)
  IF (_school IS NULL AND NOT public.has_network_capability('consultar-matricula-e-movimentacao'))
     OR (_school IS NOT NULL AND NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN
    out := out || jsonb_build_object('matriculas-vigentes', jsonb_build_object('state','unknown','reason','Sua atuação não autoriza consultar matrículas neste recorte.','source','school_enrollments'));
  ELSE
    WITH e AS (
      SELECT x.school_id FROM public.school_enrollments x
       WHERE x.opened_on <= _on AND x.created_at <= k AND (_school IS NULL OR x.school_id = _school) AND (_year IS NULL OR x.academic_year_id = _year)
         AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = x.id AND s.created_at <= k)
         AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings z WHERE z.enrollment_id = x.id AND z.ended_on <= _on AND z.created_at <= k))
    SELECT (SELECT count(*) FROM e), (SELECT coalesce(jsonb_object_agg(s, c), '{}'::jsonb) FROM (SELECT school_id s, count(*) c FROM e GROUP BY 1) q) INTO n, bk;
    SELECT count(*) INTO tot FROM public.school_enrollments;
    out := out || jsonb_build_object('matriculas-vigentes', CASE
      WHEN tot = 0 THEN jsonb_build_object('state','unavailable','reason','Matrículas ainda não constituídas.')
      WHEN n = 0 THEN jsonb_build_object('state','zero','value',0,'reason','Fonte constituída e autorizada; nenhuma matrícula vigente no recorte.')
      ELSE jsonb_build_object('state','available','value',n,'breakdown',jsonb_build_object('escola',bk)) END
      || jsonb_build_object('source','school_enrollments + school_enrollment_endings'));
  END IF;

  -- 4. Mapa oficial: exige versão oficializada
  SELECT count(*) INTO n FROM public.statistical_map_versions v JOIN public.statistical_maps m ON m.id = v.map_id
   WHERE v.snapshot_date <= _on AND v.recorded_at <= k AND (_school IS NULL OR m.school_id = _school);
  out := out || jsonb_build_object('mapa-oficial', CASE WHEN n = 0
    THEN jsonb_build_object('state','unavailable','reason','Nenhuma versão oficializada do Mapa legível no recorte.')
    ELSE jsonb_build_object('state','available','value',n,'reason','Versões oficializadas do Mapa (quantidade de versões).') END
    || jsonb_build_object('source','statistical_map_versions'));

  -- 5. Contagens operacionais: fonte vazia = não constituída; com dados = contagem vigente na data
  SELECT count(*) INTO tot FROM public.class_schedule_blocks;
  SELECT count(*) INTO n FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id
    JOIN public.class_schedules s ON s.id = v.schedule_id JOIN public.institutional_classes c ON c.id = s.class_id
   WHERE v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on) AND v.created_at <= k
     AND NOT EXISTS (SELECT 1 FROM public.class_schedule_versions w WHERE w.supersedes_id = v.id AND w.created_at <= k)
     AND (_school IS NULL OR c.school_id = _school);
  out := out || jsonb_build_object('blocos-ofertados', CASE WHEN tot = 0
    THEN jsonb_build_object('state','unavailable','reason','Grade ainda sem blocos constituídos (Frente V sem operação humana).')
    WHEN n = 0 THEN jsonb_build_object('state','zero','value',0,'reason','Grades constituídas; nenhum bloco vigente no recorte.')
    ELSE jsonb_build_object('state','available','value',n) END || jsonb_build_object('source','class_schedule_blocks'));

  SELECT count(*) INTO tot FROM public.lesson_record_versions;
  SELECT count(DISTINCT l.class_id || '|' || l.lesson_date) INTO n FROM public.lesson_record_versions l JOIN public.institutional_classes c ON c.id = l.class_id
   WHERE l.lesson_date <= _on AND l.concluded_at <= k AND (_school IS NULL OR c.school_id = _school) AND (_year IS NULL OR l.academic_year_id = _year);
  out := out || jsonb_build_object('aulas-registradas', CASE WHEN tot = 0
    THEN jsonb_build_object('state','unavailable','reason','Nenhuma aula registrada no Diário (2027 sem operação).')
    WHEN n = 0 THEN jsonb_build_object('state','unknown','reason','Nenhuma aula legível no recorte com sua atuação.')
    ELSE jsonb_build_object('state','available','value',n) END || jsonb_build_object('source','lesson_record_versions'));

  SELECT count(*) INTO tot FROM public.assessment_instrument_status_events;
  SELECT count(DISTINCT e.instrument_id) INTO n FROM public.assessment_instrument_status_events e
   JOIN public.assessment_instruments i ON i.id = e.instrument_id JOIN public.institutional_classes c ON c.id = i.class_id
   WHERE e.applied_on IS NOT NULL AND e.applied_on <= _on AND e.acted_at <= k AND (_school IS NULL OR c.school_id = _school);
  out := out || jsonb_build_object('avaliacoes-aplicadas', CASE WHEN tot = 0
    THEN jsonb_build_object('state','unavailable','reason','Nenhuma aplicação de instrumento registrada.')
    WHEN n = 0 THEN jsonb_build_object('state','unknown','reason','Nenhuma aplicação legível no recorte com sua atuação.')
    ELSE jsonb_build_object('state','available','value',n) END || jsonb_build_object('source','assessment_instrument_status_events'));

  SELECT count(*) INTO tot FROM public.school_pedagogical_records;
  SELECT count(*) INTO n FROM public.school_pedagogical_records r
   WHERE r.occurred_on <= _on AND r.recorded_at <= k AND r.event_kind <> 'anulacao' AND (_school IS NULL OR r.school_id = _school)
     AND NOT EXISTS (SELECT 1 FROM public.school_pedagogical_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k);
  out := out || jsonb_build_object('acompanhamentos-registrados', CASE WHEN tot = 0
    THEN jsonb_build_object('state','unavailable','reason','Nenhum registro de acompanhamento (capacidades ainda não homologadas).')
    WHEN n = 0 THEN jsonb_build_object('state','unknown','reason','Nenhum registro legível no recorte com sua atuação.')
    ELSE jsonb_build_object('state','available','value',n) END || jsonb_build_object('source','school_pedagogical_records'));

  -- 6. Indicadores sem avaliador agregado ligado: explicados, nunca zero
  SELECT count(*) INTO tot FROM public.student_movement_events;
  out := out || jsonb_build_object('saldo-movimentacao', jsonb_build_object('state','unavailable','source','student_movement_events','reason',
    CASE WHEN tot = 0 THEN 'Movimentações ainda não constituídas (sem início efetivo).' ELSE 'Saldo exige polo institucional por fato; avaliador agregado ainda não ligado.' END));
  SELECT count(*) INTO tot FROM public.allocation_curricular_positions;
  out := out || jsonb_build_object('posicoes-com-matriz', jsonb_build_object('state','unavailable','source','allocation_curricular_positions','reason',
    CASE WHEN tot = 0 THEN 'Sem posições curriculares registradas.' ELSE 'Proporção exige resolução E1–E4 por alocação; não agregada nesta leitura.' END));
  SELECT count(*) INTO tot FROM public.teaching_assignment_versions;
  out := out || jsonb_build_object('cobertura-docente', jsonb_build_object('state','unavailable','source','teaching_assignment_versions','reason',
    CASE WHEN tot = 0 THEN 'Sem atribuições docentes registradas.' ELSE 'Cobertura exige cruzamento bloco × atribuição por data; ver relatório de necessidade de professor.' END));
  SELECT count(*) INTO tot FROM public.attendance_record_versions;
  out := out || jsonb_build_object('frequencia-registrada', jsonb_build_object('state','unavailable','source','attendance_record_versions','reason',
    CASE WHEN tot = 0 THEN 'Sem chamadas registradas.' ELSE 'Taxa de presença exige regra homologada de marcações; não calculada.' END));

  RETURN jsonb_build_object('as_of', _on, 'known_at', k, 'school', _school, 'year', _year, 'indicators', out);
END $$;
REVOKE ALL ON FUNCTION public.network_indicators_at(date, timestamptz, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.network_indicators_at(date, timestamptz, text, text) TO authenticated;