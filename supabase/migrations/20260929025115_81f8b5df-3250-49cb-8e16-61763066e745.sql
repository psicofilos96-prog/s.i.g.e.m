CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- Escopo sempre concreto: atuação de escola expande para as turmas DAQUELA escola;
  -- atuação sem escola nem turma não concede nada (nunca escopo de rede implícito).
  SELECT r.capability_id, e.id, p.id, p.version,
    cls.school_id,
    cls.id,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  JOIN public.institutional_classes cls
    ON (e.class_id IS NOT NULL AND cls.id = e.class_id AND (e.school_id IS NULL OR cls.school_id = e.school_id))
    OR (e.class_id IS NULL AND e.school_id IS NOT NULL AND cls.school_id = e.school_id)
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
$function$;

CREATE OR REPLACE FUNCTION public.can_read_institutional_class(_class text, _school text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.institutional_engagements e
    WHERE e.person_id = public.current_person_id()
      AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
      AND (e.class_id = _class OR (e.class_id IS NULL AND e.school_id IS NOT NULL AND e.school_id = _school))
  )
$function$;