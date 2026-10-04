-- B4.6.8: autoridade do calendário por DESIGNAÇÃO EXPLÍCITA de conta (decisão expressa do usuário),
-- limitada às capacidades do calendário + manutenção de anos/períodos letivos; não homologa política.
CREATE TABLE public.calendar_authority_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  engagement_id uuid NOT NULL UNIQUE REFERENCES public.institutional_engagements(id),
  capabilities text[] NOT NULL,
  origin text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_authority_caps_limited CHECK (
    cardinality(capabilities) > 0 AND capabilities <@ ARRAY[
      'construir-calendario-da-rede','homologar-calendario-da-rede',
      'construir-norma-composicao-calendario-da-rede','homologar-norma-composicao-calendario-da-rede',
      'manter-anos-e-periodos-letivos']::text[]),
  CONSTRAINT calendar_authority_origin_required CHECK (btrim(origin) <> '')
);
GRANT SELECT ON public.calendar_authority_designations TO authenticated;
GRANT ALL ON public.calendar_authority_designations TO service_role;
ALTER TABLE public.calendar_authority_designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar authority designation" ON public.calendar_authority_designations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER calendar_authority_designations_immutable BEFORE UPDATE OR DELETE ON public.calendar_authority_designations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
REVOKE ALL ON public.calendar_authority_designations FROM anon;

-- Capacidades designadas vigentes da conta (conta exata + pessoa vinculada + atuação vigente).
CREATE OR REPLACE FUNCTION public.calendar_designated_capabilities(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(capability_id text, engagement_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT c, d.engagement_id
  FROM public.calendar_authority_designations d
  JOIN public.institutional_engagements e ON e.id = d.engagement_id
  CROSS JOIN LATERAL pg_catalog.unnest(d.capabilities) AS c
  WHERE auth.uid() IS NOT NULL AND d.user_id = auth.uid()
    AND d.person_id = public.current_person_id() AND e.person_id = d.person_id
    AND e.scope_level = 'rede'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= _on)
$$;
REVOKE ALL ON FUNCTION public.calendar_designated_capabilities(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_designated_capabilities(date) TO authenticated, service_role;

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
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, 'rede', NULL::text
  FROM public.calendar_designated_capabilities(_on) d
$function$;

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
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
  UNION ALL
  SELECT d.capability_id, d.engagement_id, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::text
  FROM public.calendar_designated_capabilities(_on) d
$function$;

CREATE OR REPLACE FUNCTION public.b2_4_authorizing_engagement()
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _engagement uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'b2_4:unauthenticated'; END IF;
  SELECT c.engagement_id INTO _engagement
  FROM public.effective_scope_capabilities(current_date) c
  JOIN public.institutional_engagements e ON e.id = c.engagement_id
  WHERE c.capability_id = 'manter-anos-e-periodos-letivos' AND c.scope_level = 'rede'
    AND (e.engagement_kind_id = 'cadastro-institucional-da-rede' OR c.policy_id IS NULL)
  LIMIT 1;
  IF _engagement IS NULL THEN RAISE EXCEPTION 'capability:manter-anos-e-periodos-letivos'; END IF;
  RETURN _engagement;
END $function$;

COMMENT ON TABLE public.calendar_authority_designations IS
  'B4.6.8: designação explícita, imutável, de UMA conta como autoridade do calendário da rede (decisão expressa do usuário). Capacidades limitadas por CHECK; nunca administração geral.';