-- PERF.LOADING.4: has_capability sem expandir capacidade × turma (rede = 698 linhas por capacidade).
-- Semântica idêntica a effective_capabilities(): rede/escola exigem turma existente (da escola);
-- designação vale sem turma; fixtures técnicas mantidas.
CREATE OR REPLACE FUNCTION public.has_capability(_capability text, _class text, _period text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.effective_capability_grants(current_date) g
    WHERE g.capability_id = _capability
      AND (_period IS NULL OR g.period_id IS NULL OR g.period_id = _period)
      AND (
        g.scope_level = 'designacao'
        OR (_class IS NOT NULL AND g.scope_level = 'turma' AND g.class_id = _class)
        OR (_class IS NOT NULL AND g.scope_level = 'rede'
            AND EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class))
        OR (_class IS NOT NULL AND g.scope_level = 'escola'
            AND EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class AND c.school_id = g.school_id))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.bo_fixture_capability_grants f
    JOIN public.bo_fixture_accounts a ON a.user_id = f.user_id AND a.person_id = f.person_id AND a.operation_id = f.operation_id
    JOIN public.institutional_classes cls ON cls.id = _class AND (f.scope_level = 'rede' OR cls.school_id = f.school_id)
    WHERE f.capability_id = _capability
      AND f.person_id = public.current_person_id() AND a.user_id = auth.uid()
      AND f.expires_at > now() AND public.technical_automation_enabled()
  )
$function$;