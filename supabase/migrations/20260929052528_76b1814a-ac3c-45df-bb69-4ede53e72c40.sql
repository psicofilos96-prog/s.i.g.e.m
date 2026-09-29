ALTER TABLE public.institutional_engagements ADD COLUMN scope_level text;
ALTER TABLE public.institutional_engagements ADD CONSTRAINT engagement_scope_shape CHECK (
  scope_level IS NULL
  OR (scope_level = 'rede'   AND school_id IS NULL AND class_id IS NULL)
  OR (scope_level = 'escola' AND school_id IS NOT NULL AND class_id IS NULL)
  OR (scope_level = 'turmas' AND school_id IS NOT NULL AND class_id IS NULL)
  OR (scope_level = 'turma'  AND class_id IS NOT NULL)
);
COMMENT ON COLUMN public.institutional_engagements.scope_level IS 'Alcance declarado: rede | escola | turmas | turma. NULL = nenhuma autoridade.';

CREATE TABLE public.institutional_engagement_scope_classes (
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (engagement_id, class_id)
);
GRANT SELECT ON public.institutional_engagement_scope_classes TO authenticated;
GRANT ALL ON public.institutional_engagement_scope_classes TO service_role;
ALTER TABLE public.institutional_engagement_scope_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own engagement scope classes" ON public.institutional_engagement_scope_classes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = engagement_id AND e.person_id = public.current_person_id()));
CREATE TRIGGER engagement_scope_classes_immutable BEFORE UPDATE OR DELETE ON public.institutional_engagement_scope_classes
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Turmas alcançadas por atuação (nível de turma). Nunca devolve turma nula.
CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, school_id text, class_id text, component_id text, period_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, cls.school_id, cls.id,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  JOIN public.institutional_classes cls ON
       (e.scope_level = 'turma'  AND cls.id = e.class_id AND (e.school_id IS NULL OR cls.school_id = e.school_id))
    OR (e.scope_level = 'turmas' AND cls.school_id = e.school_id
        AND EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s WHERE s.engagement_id = e.id AND s.class_id = cls.id))
    OR (e.scope_level = 'escola' AND cls.school_id = e.school_id)
    OR (e.scope_level = 'rede')
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
$function$;

-- Capacidades de nível institucional (escola ou rede), independentes de turmas existirem.
CREATE OR REPLACE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
 RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.capability_id, e.id, p.id, p.version, e.scope_level, CASE WHEN e.scope_level = 'escola' THEN e.school_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  WHERE e.person_id = public.current_person_id()
    AND e.scope_level IN ('escola','rede')
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
$function$;

CREATE OR REPLACE FUNCTION public.school_capability_grant(_capability text, _school text)
 RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_scope_capabilities(current_date) c
  WHERE _school IS NOT NULL AND c.capability_id = _capability
    AND ((c.scope_level = 'escola' AND c.school_id = _school)
      OR (c.scope_level = 'rede' AND EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school)))
  ORDER BY (c.scope_level = 'escola') DESC LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.has_school_capability(_capability text, _school text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.school_capability_grant(_capability, _school)) $function$;

CREATE OR REPLACE FUNCTION public.has_network_capability(_capability text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(current_date) c WHERE c.capability_id = _capability AND c.scope_level = 'rede') $function$;

CREATE OR REPLACE FUNCTION public.functional_grant(_school text)
 RETURNS record LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g record;
BEGIN
  SELECT * INTO g FROM public.school_capability_grant('manter-registro-funcional', _school);
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade manter-registro-funcional não concedida por política homologada para a escola'; END IF;
  RETURN g;
END $function$;

CREATE OR REPLACE FUNCTION public.can_read_institutional_class(_class text, _school text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.institutional_engagements e
    WHERE e.person_id = public.current_person_id()
      AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
      AND ((e.scope_level = 'turma' AND e.class_id = _class)
        OR (e.scope_level = 'turmas' AND e.school_id = _school AND EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s WHERE s.engagement_id = e.id AND s.class_id = _class))
        OR (e.scope_level = 'escola' AND e.school_id = _school))
  )
$function$;

CREATE OR REPLACE FUNCTION public.school_engagements_of_kinds(_school text, _on date, _kinds text[])
 RETURNS TABLE(engagement_id uuid, person_id uuid, person_name text, engagement_kind_id text, valid_from date, valid_until date, originating_act_ref text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.person_id, p.display_name, e.engagement_kind_id, e.valid_from, e.valid_until, e.originating_act_ref
  FROM institutional_engagements e JOIN institutional_persons p ON p.id = e.person_id
  WHERE public.has_school_capability('consultar-mapa-estatistico', _school)
    AND e.scope_level = 'escola' AND e.school_id = _school AND e.engagement_kind_id = ANY(_kinds)
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND EXISTS (SELECT 1 FROM attribute_value_definitions d WHERE d.scheme_id = 'tipo-de-atuacao' AND d.value_id = e.engagement_kind_id
                AND d.status = 'homologada' AND d.valid_from <= _on)
$function$;

-- Consulta de matrícula/movimentação no escopo de TURMA (Orientação com turmas explícitas).
CREATE POLICY "enrollments by class capability" ON public.school_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = school_enrollments.id
                 AND public.has_capability('consultar-matricula-e-movimentacao', p.class_id)));
CREATE POLICY "episodes by class capability" ON public.class_enrollment_episodes FOR SELECT TO authenticated
  USING (public.has_capability('consultar-matricula-e-movimentacao', class_id));
CREATE POLICY "movements by class capability" ON public.student_movement_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.student_id = student_movement_events.student_id
                 AND public.has_capability('consultar-matricula-e-movimentacao', p.class_id)));

REVOKE ALL ON FUNCTION public.effective_scope_capabilities(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_network_capability(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_capability_grant(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.functional_grant(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_network_capability(text) TO authenticated;