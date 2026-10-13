-- PERF.LOADING.4: mesma regra de leitura de turmas, calculada em conjunto (antes: 2 funções por turma).
CREATE OR REPLACE FUNCTION public.readable_class_ids()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH me AS (SELECT public.current_person_id() AS pid),
  sch AS (
    SELECT s FROM public.school_capability_schools('consultar-organizacao-da-oferta') s
    UNION SELECT s FROM public.school_capability_schools('consultar-matricula-e-movimentacao') s
  ), offer AS (
    SELECT o.school_id, o.academic_year_id,
      public.offer_capability_on(o.school_id, (SELECT v.starts_on FROM public.institutional_academic_year_versions v
        WHERE v.academic_year_id = o.academic_year_id ORDER BY v.version DESC LIMIT 1)) AS ok
    FROM (SELECT DISTINCT c.school_id, c.academic_year_id FROM public.institutional_classes c) o
  ), eng AS (
    SELECT e.id, e.scope_level, e.class_id, e.school_id FROM public.institutional_engagements e, me
    WHERE e.person_id = me.pid
      AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
  ), eng_classes AS (
    SELECT e.class_id AS id FROM eng e WHERE e.scope_level = 'turma'
    UNION SELECT s.class_id FROM eng e JOIN public.institutional_engagement_scope_classes s ON s.engagement_id = e.id
      JOIN public.institutional_classes c ON c.id = s.class_id AND c.school_id = e.school_id
      WHERE e.scope_level = 'turmas'
    UNION SELECT c.id FROM eng e JOIN public.institutional_classes c ON c.school_id = e.school_id WHERE e.scope_level = 'escola'
  ), taught AS (
    SELECT a.class_id AS id FROM public.teaching_assignment_versions v JOIN public.teaching_assignments a ON a.id = v.assignment_id
      JOIN eng e ON e.id = v.engagement_id
    UNION SELECT a.class_id FROM public.teaching_substitution_versions sv JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
      JOIN public.teaching_assignments a ON a.id = s.assignment_id
      JOIN eng e ON e.id = sv.substitute_engagement_id
  )
  SELECT c.id FROM public.institutional_classes c
  LEFT JOIN offer o ON o.school_id IS NOT DISTINCT FROM c.school_id AND o.academic_year_id IS NOT DISTINCT FROM c.academic_year_id
  WHERE c.school_id IN (SELECT s FROM sch)
     OR COALESCE(o.ok, false)
     OR c.id IN (SELECT id FROM eng_classes)
     OR c.id IN (SELECT id FROM taught)
$function$;