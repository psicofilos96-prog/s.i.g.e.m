-- N5.4 — o estado de alocação do calendário também vê o término de turma registrado pela Secretaria.
CREATE OR REPLACE FUNCTION public.calendar_allocation_state_at(_allocation text, _year text, _school text, _on date, _known_at timestamp with time zone)
 RETURNS text LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
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
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = _a.id AND y.created_at <= _known_at AND y.ended_on < _on) THEN
    RETURN 'alocacao-encerrada-na-data'; END IF;
  RETURN NULL;
END $function$;