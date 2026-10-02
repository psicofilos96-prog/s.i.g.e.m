-- B2.5.1: duas competências independentes para a Secretaria Escolar.
-- A v1 e as 114 regras preexistentes da v2 permanecem intactas.
DO $b251$
DECLARE
  _v1 uuid;
  _v2 uuid;
BEGIN
  SELECT id INTO _v1 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft' FOR UPDATE;
  SELECT id INTO _v2 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  IF _v1 IS NULL OR _v2 IS NULL OR
     (SELECT count(*) FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario') <> 2
  THEN RAISE EXCEPTION 'b2_5_1:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 114
  THEN RAISE EXCEPTION 'b2_5_1:unexpected-policy-rule-count'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.capability_policy_rules r
    WHERE r.policy_id IN (_v1, _v2)
    GROUP BY r.policy_id, r.engagement_kind_id, r.capability_id, r.scope_dimensions
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.capability_policy_rules old_rule
    WHERE old_rule.policy_id = _v1 AND NOT EXISTS (
      SELECT 1 FROM public.capability_policy_rules new_rule
      WHERE new_rule.policy_id = _v2
        AND new_rule.engagement_kind_id = old_rule.engagement_kind_id
        AND new_rule.capability_id = old_rule.capability_id
        AND new_rule.scope_dimensions = old_rule.scope_dimensions
    )
  ) THEN RAISE EXCEPTION 'b2_5_1:policy-inheritance-or-duplicate'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.capability_policy_rules
    WHERE policy_id IN (_v1, _v2)
      AND capability_id IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')
  ) THEN RAISE EXCEPTION 'b2_5_1:capability-already-present'; END IF;

  INSERT INTO public.capability_policy_rules
    (policy_id, engagement_kind_id, capability_id, scope_dimensions)
  VALUES
    (_v2, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']::text[]),
    (_v2, 'secretaria-escolar', 'manter-organizacao-de-periodos-da-turma', ARRAY['school']::text[]);

  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 116 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2
        AND engagement_kind_id = 'secretaria-escolar'
        AND capability_id IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')
        AND scope_dimensions = ARRAY['school']::text[]) <> 2
  THEN RAISE EXCEPTION 'b2_5_1:policy-insert-failed'; END IF;
END $b251$;

-- Contrato de autorização para os futuros escritores B2.5.2/B2.5.4.
-- O helper escolar genérico admite atuação de rede; estas duas competências
-- exigem a atuação secretaria-escolar vigente NA PRÓPRIA escola.
CREATE FUNCTION public.class_registry_school_grant(_capability text, _school text)
RETURNS TABLE (engagement_id uuid, policy_id uuid, policy_version integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $grant$
  SELECT c.engagement_id, c.policy_id, c.policy_version
  FROM public.effective_scope_capabilities(current_date) c
  JOIN public.institutional_engagements e ON e.id = c.engagement_id
  JOIN public.capability_policy_rules r ON r.policy_id = c.policy_id
    AND r.engagement_kind_id = e.engagement_kind_id AND r.capability_id = c.capability_id
  WHERE auth.uid() IS NOT NULL
    AND _capability IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')
    AND _school IS NOT NULL
    AND c.capability_id = _capability
    AND c.scope_level = 'escola' AND c.school_id = _school
    AND e.engagement_kind_id = 'secretaria-escolar'
    AND r.scope_dimensions = ARRAY['school']::text[]
  ORDER BY c.policy_version DESC, c.engagement_id
  LIMIT 1
$grant$;
REVOKE EXECUTE ON FUNCTION public.class_registry_school_grant(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_registry_school_grant(text, text) TO authenticated;
