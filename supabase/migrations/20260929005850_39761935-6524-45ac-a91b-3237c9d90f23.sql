CREATE TABLE public.institutional_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  institutional_identifier text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_person_links (
  user_id uuid PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.institutional_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  engagement_kind_id text NOT NULL,
  position_label_snapshot text,
  school_id text,
  class_id text,
  component_id text,
  period_id text,
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.capability_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_policy_id text NOT NULL,
  version integer NOT NULL,
  supersedes_version_id uuid REFERENCES public.capability_policies(id),
  status text NOT NULL DEFAULT 'draft',
  valid_from date,
  valid_until date,
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_policy_id, version)
);
CREATE TABLE public.capability_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  engagement_kind_id text NOT NULL,
  capability_id text NOT NULL,
  scope_dimensions text[] NOT NULL DEFAULT '{}'
);

GRANT SELECT ON public.institutional_persons, public.user_person_links, public.institutional_engagements, public.capability_policies, public.capability_policy_rules TO authenticated;
GRANT ALL ON public.institutional_persons, public.user_person_links, public.institutional_engagements, public.capability_policies, public.capability_policy_rules TO service_role;

ALTER TABLE public.institutional_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_person_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_policy_rules ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_person_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT person_id FROM public.user_person_links WHERE user_id = auth.uid()
$$;

CREATE POLICY "Own link" ON public.user_person_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own person" ON public.institutional_persons FOR SELECT TO authenticated USING (id = public.current_person_id());
CREATE POLICY "Own engagements" ON public.institutional_engagements FOR SELECT TO authenticated USING (person_id = public.current_person_id());
CREATE POLICY "Homologated policies" ON public.capability_policies FOR SELECT TO authenticated USING (status = 'homologated');
CREATE POLICY "Rules of homologated policies" ON public.capability_policy_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.capability_policies p WHERE p.id = policy_id AND p.status = 'homologated'));

CREATE OR REPLACE FUNCTION public.guard_homologated_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'homologated' THEN
    RAISE EXCEPTION 'Versão homologada é imutável; crie nova versão';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER capability_policies_immutable BEFORE UPDATE OR DELETE ON public.capability_policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_policy();

CREATE OR REPLACE FUNCTION public.guard_homologated_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.capability_policies p
             WHERE p.id = COALESCE(NEW.policy_id, OLD.policy_id) AND p.status = 'homologated') THEN
    RAISE EXCEPTION 'Regras de política homologada são imutáveis';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER capability_policy_rules_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.capability_policy_rules
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_rules();

CREATE OR REPLACE FUNCTION public.effective_capabilities(_on date DEFAULT current_date)
RETURNS TABLE (capability_id text, engagement_id uuid, policy_id uuid, policy_version integer,
               school_id text, class_id text, component_id text, period_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.capability_id, e.id, p.id, p.version,
    CASE WHEN 'school' = ANY(r.scope_dimensions) THEN e.school_id END,
    CASE WHEN 'class' = ANY(r.scope_dimensions) THEN e.class_id END,
    CASE WHEN 'component' = ANY(r.scope_dimensions) THEN e.component_id END,
    CASE WHEN 'period' = ANY(r.scope_dimensions) THEN e.period_id END
  FROM public.institutional_engagements e
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
  JOIN public.capability_policies p ON p.id = r.policy_id
  WHERE e.person_id = public.current_person_id()
    AND p.status = 'homologated'
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
$$;
REVOKE EXECUTE ON FUNCTION public.effective_capabilities(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.effective_capabilities(date) TO authenticated;