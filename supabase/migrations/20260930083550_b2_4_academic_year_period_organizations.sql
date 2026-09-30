-- B2.4: identidades institucionais e versões. Nenhum dado demonstrativo é importado.
-- A tabela de períodos existente continua sendo a identidade permanente.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.institutional_academic_periods) THEN
    RAISE EXCEPTION 'b2_4:legacy-periods-require-explicit-organization';
  END IF;
END $$;

CREATE TABLE public.institutional_academic_years (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.institutional_academic_year_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.institutional_academic_year_versions(id),
  official_name text NOT NULL CHECK (btrim(official_name) <> ''),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_active boolean NOT NULL,
  valid_from date NOT NULL,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, version), UNIQUE (supersedes_id),
  CHECK (ends_on >= starts_on),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> '')
);

-- A organização é a representação institucional do AssessmentPeriodStructure.
CREATE TABLE public.institutional_period_organizations (
  id text PRIMARY KEY,
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, academic_year_id)
);
CREATE TABLE public.institutional_period_organization_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.institutional_period_organizations(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.institutional_period_organization_versions(id),
  official_name text NOT NULL CHECK (btrim(official_name) <> ''),
  is_active boolean NOT NULL,
  valid_from date NOT NULL,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, version), UNIQUE (supersedes_id),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> '')
);

-- Referência preparada para a etapa proprietária da Turma. B2.4 não cria
-- atribuições, não oferece função de escrita e não escolhe uma organização.
-- Sem uma versão vigente desta associação, consumidores falham fechados.
CREATE TABLE public.institutional_class_period_organization_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.institutional_class_period_organization_versions(id),
  organization_id text NOT NULL REFERENCES public.institutional_period_organizations(id),
  valid_from date NOT NULL,
  valid_until date,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, version), UNIQUE (supersedes_id),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> '')
);
CREATE INDEX class_period_organization_versions_class_idx
  ON public.institutional_class_period_organization_versions(class_id, version DESC);

ALTER TABLE public.institutional_academic_periods
  ADD COLUMN period_organization_id text NOT NULL;
ALTER TABLE public.institutional_academic_periods
  ADD CONSTRAINT institutional_period_organization_year_fk
  FOREIGN KEY (period_organization_id, academic_year_id)
  REFERENCES public.institutional_period_organizations(id, academic_year_id);
CREATE INDEX institutional_periods_organization_idx
  ON public.institutional_academic_periods(period_organization_id);

CREATE TABLE public.institutional_academic_period_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id text NOT NULL REFERENCES public.institutional_academic_periods(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.institutional_academic_period_versions(id),
  official_name text NOT NULL CHECK (btrim(official_name) <> ''),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_active boolean NOT NULL,
  valid_from date NOT NULL,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, version), UNIQUE (supersedes_id),
  CHECK (ends_on >= starts_on),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> '')
);
CREATE INDEX institutional_period_versions_current_idx
  ON public.institutional_academic_period_versions(period_id, version DESC);

GRANT SELECT ON public.institutional_academic_years,
  public.institutional_academic_year_versions,
  public.institutional_period_organizations,
  public.institutional_period_organization_versions,
  public.institutional_class_period_organization_versions,
  public.institutional_academic_period_versions TO authenticated;
GRANT ALL ON public.institutional_academic_years,
  public.institutional_academic_year_versions,
  public.institutional_period_organizations,
  public.institutional_period_organization_versions,
  public.institutional_class_period_organization_versions,
  public.institutional_academic_period_versions TO service_role;
ALTER TABLE public.institutional_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_academic_year_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_period_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_period_organization_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_class_period_organization_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_academic_period_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "linked accounts read academic years" ON public.institutional_academic_years
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "linked accounts read academic year versions" ON public.institutional_academic_year_versions
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "linked accounts read period organizations" ON public.institutional_period_organizations
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "linked accounts read period organization versions" ON public.institutional_period_organization_versions
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "class scope reads period organization association" ON public.institutional_class_period_organization_versions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.institutional_classes c
            WHERE c.id = class_id AND public.can_read_institutional_class(c.id, c.school_id))
  );
CREATE POLICY "linked accounts read academic period versions" ON public.institutional_academic_period_versions
  FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE TRIGGER institutional_years_immutable BEFORE UPDATE OR DELETE ON public.institutional_academic_years
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_year_versions_immutable BEFORE UPDATE OR DELETE ON public.institutional_academic_year_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_period_organizations_immutable BEFORE UPDATE OR DELETE ON public.institutional_period_organizations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_period_organization_versions_immutable BEFORE UPDATE OR DELETE ON public.institutional_period_organization_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_class_period_organization_versions_immutable BEFORE UPDATE OR DELETE ON public.institutional_class_period_organization_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER institutional_period_versions_immutable BEFORE UPDATE OR DELETE ON public.institutional_academic_period_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Toda escrita usa a mesma capacidade da atuação vigente com alcance de rede.
CREATE OR REPLACE FUNCTION public.b2_4_authorizing_engagement()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _engagement uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'b2_4:unauthenticated'; END IF;
  SELECT c.engagement_id INTO _engagement
  FROM public.effective_scope_capabilities(current_date) c
  JOIN public.institutional_engagements e ON e.id = c.engagement_id
  WHERE c.capability_id = 'manter-anos-e-periodos-letivos'
    AND c.scope_level = 'rede'
    AND e.engagement_kind_id = 'cadastro-institucional-da-rede'
  LIMIT 1;
  IF _engagement IS NULL THEN RAISE EXCEPTION 'capability:manter-anos-e-periodos-letivos'; END IF;
  RETURN _engagement;
END $$;
REVOKE ALL ON FUNCTION public.b2_4_authorizing_engagement() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.register_academic_year_version(
  _year text, _base_version_id uuid, _official_name text, _starts_on date,
  _ends_on date, _is_active boolean, _valid_from date, _reason text, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g uuid; _id text; _base public.institutional_academic_year_versions%ROWTYPE;
  _name text := nullif(btrim(coalesce(_official_name, '')), '');
BEGIN
  _g := public.b2_4_authorizing_engagement();
  IF _name IS NULL THEN RAISE EXCEPTION 'year:name-required'; END IF;
  IF _starts_on IS NULL OR _ends_on IS NULL OR _starts_on > _ends_on THEN RAISE EXCEPTION 'year:invalid-dates'; END IF;
  IF _is_active IS NULL THEN RAISE EXCEPTION 'year:status-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'year:valid-from-required'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'year:act-required'; END IF;
  IF _year IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'year:unexpected-base'; END IF;
    _id := 'ano-' || gen_random_uuid();
    INSERT INTO public.institutional_academic_years(id) VALUES (_id);
    INSERT INTO public.institutional_academic_year_versions
      (academic_year_id, version, official_name, starts_on, ends_on, is_active,
       valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, 1, _name, _starts_on, _ends_on, _is_active,
            _valid_from, btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
    RETURN _id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('academic-year:' || _year));
  SELECT * INTO _base FROM public.institutional_academic_year_versions
    WHERE academic_year_id = _year ORDER BY version DESC LIMIT 1;
  IF _base.id IS NULL THEN RAISE EXCEPTION 'year:not-found'; END IF;
  IF _base_version_id IS DISTINCT FROM _base.id THEN RAISE EXCEPTION 'year:base-superseded'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'year:reason-required'; END IF;
  IF _valid_from < _base.valid_from THEN RAISE EXCEPTION 'year:valid-from-before-base'; END IF;
  IF NOT _is_active AND EXISTS (
    SELECT 1 FROM public.institutional_period_organizations o
    JOIN public.institutional_academic_periods p ON p.period_organization_id = o.id
    JOIN public.institutional_academic_period_versions v ON v.period_id = p.id
    WHERE o.academic_year_id = _year
      AND v.version = (SELECT max(v2.version) FROM public.institutional_academic_period_versions v2 WHERE v2.period_id = p.id)
      AND v.is_active
  ) THEN RAISE EXCEPTION 'year:active-periods'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.institutional_period_organizations o
    JOIN public.institutional_academic_periods p ON p.period_organization_id = o.id
    JOIN public.institutional_academic_period_versions v ON v.period_id = p.id
    WHERE o.academic_year_id = _year
      AND v.version = (SELECT max(v2.version) FROM public.institutional_academic_period_versions v2 WHERE v2.period_id = p.id)
      AND v.is_active AND (v.starts_on < _starts_on OR v.ends_on > _ends_on)
  ) THEN RAISE EXCEPTION 'year:period-outside-bounds'; END IF;
  IF _base.official_name = _name AND _base.starts_on = _starts_on AND _base.ends_on = _ends_on
    AND _base.is_active = _is_active AND _base.valid_from = _valid_from THEN RAISE EXCEPTION 'year:no-change'; END IF;
  INSERT INTO public.institutional_academic_year_versions
    (academic_year_id, version, supersedes_id, official_name, starts_on, ends_on,
     is_active, valid_from, change_reason, originating_act_ref, recorded_by,
     recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_year, _base.version + 1, _base.id, _name, _starts_on, _ends_on,
          _is_active, _valid_from, btrim(_reason), btrim(_act_ref), auth.uid(),
          public.current_person_id(), _g);
  RETURN _year;
END $$;
REVOKE ALL ON FUNCTION public.register_academic_year_version(text, uuid, text, date, date, boolean, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_academic_year_version(text, uuid, text, date, date, boolean, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_period_organization_version(
  _organization text, _year text, _base_version_id uuid, _official_name text,
  _is_active boolean, _valid_from date, _reason text, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g uuid; _id text; _base public.institutional_period_organization_versions%ROWTYPE;
  _name text := nullif(btrim(coalesce(_official_name, '')), ''); _year_current public.institutional_academic_year_versions%ROWTYPE;
BEGIN
  _g := public.b2_4_authorizing_engagement();
  IF _name IS NULL THEN RAISE EXCEPTION 'organization:name-required'; END IF;
  IF _is_active IS NULL THEN RAISE EXCEPTION 'organization:status-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'organization:valid-from-required'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'organization:act-required'; END IF;
  IF _year IS NULL THEN RAISE EXCEPTION 'organization:year-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('academic-year:' || _year));
  SELECT * INTO _year_current FROM public.institutional_academic_year_versions
    WHERE academic_year_id = _year ORDER BY version DESC LIMIT 1;
  IF _year_current.id IS NULL OR NOT _year_current.is_active THEN RAISE EXCEPTION 'organization:year-unavailable'; END IF;
  IF _organization IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'organization:unexpected-base'; END IF;
    _id := 'org-periodos-' || gen_random_uuid();
    INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (_id, _year);
    INSERT INTO public.institutional_period_organization_versions
      (organization_id, version, official_name, is_active, valid_from, originating_act_ref,
       recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, 1, _name, _is_active, _valid_from, btrim(_act_ref),
            auth.uid(), public.current_person_id(), _g);
    RETURN _id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('period-organization:' || _organization));
  SELECT * INTO _base FROM public.institutional_period_organization_versions
    WHERE organization_id = _organization ORDER BY version DESC LIMIT 1;
  IF _base.id IS NULL THEN RAISE EXCEPTION 'organization:not-found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_period_organizations
                 WHERE id = _organization AND academic_year_id = _year) THEN RAISE EXCEPTION 'organization:year-mismatch'; END IF;
  IF _base_version_id IS DISTINCT FROM _base.id THEN RAISE EXCEPTION 'organization:base-superseded'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'organization:reason-required'; END IF;
  IF _valid_from < _base.valid_from THEN RAISE EXCEPTION 'organization:valid-from-before-base'; END IF;
  IF NOT _is_active AND EXISTS (
    SELECT 1 FROM public.institutional_academic_periods p
    JOIN public.institutional_academic_period_versions v ON v.period_id = p.id
    WHERE p.period_organization_id = _organization AND v.is_active
      AND v.version = (SELECT max(v2.version) FROM public.institutional_academic_period_versions v2 WHERE v2.period_id = p.id)
  ) THEN RAISE EXCEPTION 'organization:active-periods'; END IF;
  IF _base.official_name = _name AND _base.is_active = _is_active AND _base.valid_from = _valid_from
    THEN RAISE EXCEPTION 'organization:no-change'; END IF;
  INSERT INTO public.institutional_period_organization_versions
    (organization_id, version, supersedes_id, official_name, is_active, valid_from,
     change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_organization, _base.version + 1, _base.id, _name, _is_active, _valid_from,
          btrim(_reason), btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
  RETURN _organization;
END $$;
REVOKE ALL ON FUNCTION public.register_period_organization_version(text, text, uuid, text, boolean, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_period_organization_version(text, text, uuid, text, boolean, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_academic_period_version(
  _period text, _organization text, _base_version_id uuid, _official_name text,
  _starts_on date, _ends_on date, _is_active boolean, _valid_from date,
  _reason text, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g uuid; _id text; _year text; _base public.institutional_academic_period_versions%ROWTYPE;
  _year_current public.institutional_academic_year_versions%ROWTYPE;
  _org_current public.institutional_period_organization_versions%ROWTYPE;
  _name text := nullif(btrim(coalesce(_official_name, '')), '');
BEGIN
  _g := public.b2_4_authorizing_engagement();
  IF _organization IS NULL THEN RAISE EXCEPTION 'period:organization-required'; END IF;
  IF _name IS NULL THEN RAISE EXCEPTION 'period:name-required'; END IF;
  IF _starts_on IS NULL OR _ends_on IS NULL OR _starts_on > _ends_on THEN RAISE EXCEPTION 'period:invalid-dates'; END IF;
  IF _is_active IS NULL THEN RAISE EXCEPTION 'period:status-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'period:valid-from-required'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'period:act-required'; END IF;
  SELECT academic_year_id INTO _year FROM public.institutional_period_organizations WHERE id = _organization;
  IF _year IS NULL THEN RAISE EXCEPTION 'period:organization-not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('academic-year:' || _year));
  PERFORM pg_advisory_xact_lock(hashtext('period-organization:' || _organization));
  SELECT * INTO _year_current FROM public.institutional_academic_year_versions
    WHERE academic_year_id = _year ORDER BY version DESC LIMIT 1;
  SELECT * INTO _org_current FROM public.institutional_period_organization_versions
    WHERE organization_id = _organization ORDER BY version DESC LIMIT 1;
  IF _year_current.id IS NULL OR NOT _year_current.is_active THEN RAISE EXCEPTION 'period:year-unavailable'; END IF;
  IF _org_current.id IS NULL OR NOT _org_current.is_active THEN RAISE EXCEPTION 'period:organization-unavailable'; END IF;
  IF _starts_on < _year_current.starts_on OR _ends_on > _year_current.ends_on
    THEN RAISE EXCEPTION 'period:outside-year'; END IF;
  IF _period IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'period:unexpected-base'; END IF;
    _id := 'per-' || gen_random_uuid();
  ELSE
    SELECT * INTO _base FROM public.institutional_academic_period_versions
      WHERE period_id = _period ORDER BY version DESC LIMIT 1;
    IF _base.id IS NULL THEN RAISE EXCEPTION 'period:not-found'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_academic_periods
                   WHERE id = _period AND period_organization_id = _organization)
      THEN RAISE EXCEPTION 'period:organization-mismatch'; END IF;
    IF _base_version_id IS DISTINCT FROM _base.id THEN RAISE EXCEPTION 'period:base-superseded'; END IF;
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'period:reason-required'; END IF;
    IF _valid_from < _base.valid_from THEN RAISE EXCEPTION 'period:valid-from-before-base'; END IF;
    IF _base.official_name = _name AND _base.starts_on = _starts_on AND _base.ends_on = _ends_on
      AND _base.is_active = _is_active AND _base.valid_from = _valid_from THEN RAISE EXCEPTION 'period:no-change'; END IF;
    _id := _period;
  END IF;
  IF _is_active AND EXISTS (
    SELECT 1 FROM public.institutional_academic_periods p
    JOIN public.institutional_academic_period_versions v ON v.period_id = p.id
    WHERE p.period_organization_id = _organization AND p.id <> _id
      AND v.is_active AND v.version = (SELECT max(v2.version) FROM public.institutional_academic_period_versions v2 WHERE v2.period_id = p.id)
      AND daterange(v.starts_on, v.ends_on, '[]') && daterange(_starts_on, _ends_on, '[]')
  ) THEN RAISE EXCEPTION 'period:overlap'; END IF;
  IF _period IS NULL THEN
    INSERT INTO public.institutional_academic_periods
      (id, academic_year_id, period_organization_id, label, starts_on, ends_on)
    VALUES (_id, _year, _organization, _name, _starts_on, _ends_on);
    INSERT INTO public.institutional_academic_period_versions
      (period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
       originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, 1, _name, _starts_on, _ends_on, _is_active, _valid_from,
            btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
  ELSE
    INSERT INTO public.institutional_academic_period_versions
      (period_id, version, supersedes_id, official_name, starts_on, ends_on, is_active,
       valid_from, change_reason, originating_act_ref, recorded_by,
       recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, _base.version + 1, _base.id, _name, _starts_on, _ends_on, _is_active,
            _valid_from, btrim(_reason), btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.register_academic_period_version(text, text, uuid, text, date, date, boolean, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_academic_period_version(text, text, uuid, text, date, date, boolean, date, text, text) TO authenticated;

-- A v1 permanece intocada; esta migration só altera o rascunho v2 esperado.
DO $$ DECLARE _v1 uuid; _v2 uuid; BEGIN
  SELECT id INTO _v1 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft';
  SELECT id INTO _v2 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  IF _v1 IS NULL OR _v2 IS NULL OR EXISTS (
    SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version > 2
  ) THEN RAISE EXCEPTION 'b2_4:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 113
    THEN RAISE EXCEPTION 'b2_4:unexpected-policy-rule-count'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.capability_policy_rules
    WHERE policy_id = _v2 AND capability_id = 'manter-anos-e-periodos-letivos'
  ) THEN RAISE EXCEPTION 'b2_4:capability-already-present'; END IF;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  VALUES (_v2, 'cadastro-institucional-da-rede', 'manter-anos-e-periodos-letivos', '{network}');
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 114
    THEN RAISE EXCEPTION 'b2_4:policy-insert-failed'; END IF;
END $$;
