-- LOTE 10: capacidade sem turma valia para TODAS as turmas de todas as escolas; agora
-- escola-escopo só vale na própria escola, rede só com school_id nulo.
CREATE OR REPLACE FUNCTION public.can_read_class_roster(_class text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id = 'consultar-estudantes-da-turma'
      AND (c.class_id = _class
        OR (c.class_id IS NULL AND c.school_id IS NOT NULL AND c.school_id = (SELECT k.school_id FROM public.institutional_classes k WHERE k.id = _class))
        OR (c.class_id IS NULL AND c.school_id IS NULL)))
$function$;

-- LOTE 10: docente só lê a turma enquanto a atuação que fundamenta a atribuição estiver vigente.
CREATE OR REPLACE FUNCTION public.teaches_class(_class_id text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT public.current_person_id() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.teaching_assignment_versions v JOIN public.teaching_assignments a ON a.id = v.assignment_id
            JOIN public.institutional_engagements e ON e.id = v.engagement_id
            WHERE a.class_id = _class_id AND e.person_id = public.current_person_id()
              AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date))
    OR EXISTS (SELECT 1 FROM public.teaching_substitution_versions sv JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
            JOIN public.teaching_assignments a ON a.id = s.assignment_id
            JOIN public.institutional_engagements e ON e.id = sv.substitute_engagement_id
            WHERE a.class_id = _class_id AND e.person_id = public.current_person_id()
              AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)))
$function$;