-- B2.5.3: historical, explicit class -> period organization association.
-- The B2.4 preparatory table is empty before this migration. Its original
-- migration remains the historical record of the preparatory schema.
DO $empty$ BEGIN
  IF EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions)
  THEN RAISE EXCEPTION 'class-period:preexisting-links-require-reconciliation'; END IF;
END $empty$;

ALTER TABLE public.institutional_class_period_organization_versions
  ADD COLUMN segment_id uuid NOT NULL,
  ADD COLUMN authorizing_policy_id uuid NOT NULL REFERENCES public.capability_policies(id);
-- Roots of additional temporal segments have a global class version > 1.
DO $old_check$ DECLARE _name text; BEGIN
  SELECT c.conname INTO _name FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.institutional_class_period_organization_versions'::regclass
    AND c.contype = 'c' AND pg_catalog.pg_get_constraintdef(c.oid) LIKE '%supersedes_id IS NULL%';
  IF _name IS NULL THEN RAISE EXCEPTION 'class-period:expected-preparatory-check-missing'; END IF;
  EXECUTE format('ALTER TABLE public.institutional_class_period_organization_versions DROP CONSTRAINT %I', _name);
END $old_check$;
ALTER TABLE public.institutional_class_period_organization_versions
  ADD CONSTRAINT class_period_link_identity_segment_uk UNIQUE (id, class_id, segment_id),
  ADD CONSTRAINT class_period_link_segment_parent_fk
    FOREIGN KEY (supersedes_id, class_id, segment_id)
    REFERENCES public.institutional_class_period_organization_versions(id, class_id, segment_id),
  ADD CONSTRAINT class_period_link_no_self CHECK (supersedes_id IS DISTINCT FROM id);
CREATE UNIQUE INDEX class_period_link_segment_root_idx
  ON public.institutional_class_period_organization_versions(class_id, segment_id)
  WHERE supersedes_id IS NULL;
CREATE INDEX class_period_link_known_idx
  ON public.institutional_class_period_organization_versions(class_id, created_at);

REVOKE ALL ON public.institutional_class_period_organization_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.institutional_class_period_organization_versions TO authenticated, service_role;
DO $sandbox_acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE ALL ON public.institutional_class_period_organization_versions FROM sandbox_exec';
  END IF;
END $sandbox_acl$;

CREATE FUNCTION public.guard_class_period_link_chain()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $chain$
DECLARE _parent_version integer;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT p.version INTO _parent_version
    FROM public.institutional_class_period_organization_versions p WHERE p.id = NEW.supersedes_id;
    IF _parent_version IS NULL OR _parent_version >= NEW.version
    THEN RAISE EXCEPTION 'class-period:invalid-version-chain'; END IF;
  END IF;
  RETURN NEW;
END $chain$;
REVOKE ALL ON FUNCTION public.guard_class_period_link_chain() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER class_period_link_chain_guard
  AFTER INSERT ON public.institutional_class_period_organization_versions
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW
  EXECUTE FUNCTION public.guard_class_period_link_chain();

-- Deferred so replacement and left/right pieces can be inserted atomically.
-- The same per-class advisory lock serializes the writer and privileged INSERTs.
CREATE FUNCTION public.guard_class_period_link_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $overlap$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed'
  THEN RAISE EXCEPTION 'class-period:read-committed-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class-period:' || NEW.class_id, 0));
  IF EXISTS (
    SELECT 1 FROM public.institutional_class_period_organization_versions a
    JOIN public.institutional_class_period_organization_versions b
      ON b.class_id = a.class_id AND b.id > a.id
     AND pg_catalog.daterange(a.valid_from, a.valid_until, '[]') &&
         pg_catalog.daterange(b.valid_from, b.valid_until, '[]')
    WHERE a.class_id = NEW.class_id
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions x WHERE x.supersedes_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions y WHERE y.supersedes_id = b.id)
  ) THEN RAISE EXCEPTION 'class-period:overlapping-current-segments'; END IF;
  RETURN NEW;
END $overlap$;
REVOKE ALL ON FUNCTION public.guard_class_period_link_overlap() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER class_period_link_no_overlap
  AFTER INSERT ON public.institutional_class_period_organization_versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION public.guard_class_period_link_overlap();

-- Known heads are selected before filtering validOn. No global version shortcut.
CREATE FUNCTION public.class_period_organization_at(
  _class_id text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.institutional_class_period_organization_versions
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $at$
DECLARE _link public.institutional_class_period_organization_versions%ROWTYPE;
  _class public.institutional_classes%ROWTYPE;
  _record public.institutional_class_record_versions%ROWTYPE;
  _organization public.institutional_period_organizations%ROWTYPE;
  _org_active boolean; _year_active boolean; _year_start date; _year_end date;
  _count integer;
BEGIN
  IF _class_id IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'class-period:query-arguments-required'; END IF;
  WITH known AS (
    SELECT v.* FROM public.institutional_class_period_organization_versions v
    WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)
  ), heads AS (
    SELECT v.* FROM known v WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = v.id)
  )
  SELECT count(*)::integer INTO _count FROM heads h
  WHERE h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  IF _count > 1 THEN RAISE EXCEPTION 'class-period:ambiguous-temporal-state'; END IF;
  IF _count = 0 THEN RETURN; END IF;
  WITH known AS (
    SELECT v.* FROM public.institutional_class_period_organization_versions v
    WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)
  ), heads AS (
    SELECT v.* FROM known v WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = v.id)
  )
  SELECT h.* INTO _link FROM heads h
  WHERE h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  SELECT c.* INTO _class FROM public.institutional_classes c WHERE c.id = _class_id;
  SELECT r.* INTO _record FROM public.class_at(_class_id, _valid_on, _known_at) r;
  SELECT o.* INTO _organization FROM public.institutional_period_organizations o WHERE o.id = _link.organization_id;
  IF _class.id IS NULL OR _record.id IS NULL OR _record.administrative_status <> 'ativa'
     OR _organization.id IS NULL OR _organization.academic_year_id <> _class.academic_year_id
  THEN RETURN; END IF;
  SELECT v.is_active INTO _org_active FROM public.institutional_period_organization_versions v
  WHERE v.organization_id = _organization.id AND v.valid_from <= _valid_on
    AND (_known_at IS NULL OR v.created_at <= _known_at)
  ORDER BY v.version DESC LIMIT 1;
  SELECT y.is_active, y.starts_on, y.ends_on INTO _year_active, _year_start, _year_end
  FROM public.institutional_academic_year_versions y
  WHERE y.academic_year_id = _class.academic_year_id AND y.valid_from <= _valid_on
    AND (_known_at IS NULL OR y.created_at <= _known_at)
  ORDER BY y.version DESC LIMIT 1;
  IF _org_active IS DISTINCT FROM true OR _year_active IS DISTINCT FROM true
     OR _valid_on < _year_start OR _valid_on > _year_end THEN RETURN; END IF;
  RETURN NEXT _link;
END $at$;
REVOKE ALL ON FUNCTION public.class_period_organization_at(text, date, timestamptz)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.class_period_organization_at(text, date, timestamptz) TO authenticated;

-- Internal validation. NULL remains open; known future changes within the
-- official year are checked, while readers always revalidate the actual date.
CREATE FUNCTION public.class_period_link_context(
  _class_id text, _organization_id text, _from date, _until date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $context$
DECLARE _class public.institutional_classes%ROWTYPE;
  _organization public.institutional_period_organizations%ROWTYPE;
  _point date; _through date; _horizon date;
  _record public.institutional_class_record_versions%ROWTYPE;
  _org_active boolean; _year_active boolean; _year_start date; _year_end date;
BEGIN
  IF _from IS NULL OR (_until IS NOT NULL AND _until < _from)
  THEN RAISE EXCEPTION 'class-period:invalid-dates'; END IF;
  SELECT c.* INTO _class FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _class.id IS NULL THEN RAISE EXCEPTION 'class-period:class-not-found'; END IF;
  SELECT o.* INTO _organization FROM public.institutional_period_organizations o WHERE o.id = _organization_id;
  IF _organization.id IS NULL THEN RAISE EXCEPTION 'class-period:organization-not-found'; END IF;
  IF _organization.academic_year_id <> _class.academic_year_id
  THEN RAISE EXCEPTION 'class-period:organization-year-mismatch'; END IF;
  SELECT max(y.ends_on) INTO _horizon FROM public.institutional_academic_year_versions y
  WHERE y.academic_year_id = _class.academic_year_id;
  IF _horizon IS NULL THEN RAISE EXCEPTION 'class-period:year-unavailable'; END IF;
  IF _until IS NOT NULL THEN _horizon := _until; END IF;
  FOR _point, _through IN
    WITH checkpoints AS (
      SELECT _from AS at_date
      UNION SELECT v.valid_from FROM public.institutional_class_record_versions v
        WHERE v.class_id = _class_id AND v.valid_from > _from AND v.valid_from <= _horizon
      UNION SELECT v.valid_until + 1 FROM public.institutional_class_record_versions v
        WHERE v.class_id = _class_id AND v.valid_until IS NOT NULL
          AND v.valid_until >= _from AND v.valid_until < _horizon
      UNION SELECT v.valid_from FROM public.institutional_period_organization_versions v
        WHERE v.organization_id = _organization_id AND v.valid_from > _from AND v.valid_from <= _horizon
      UNION SELECT v.valid_from FROM public.institutional_academic_year_versions v
        WHERE v.academic_year_id = _class.academic_year_id AND v.valid_from > _from AND v.valid_from <= _horizon
    )
    SELECT at_date, coalesce(lead(at_date) OVER (ORDER BY at_date) - 1, _horizon)
    FROM checkpoints ORDER BY at_date
  LOOP
    SELECT r.* INTO _record FROM public.class_at(_class_id, _point, NULL) r;
    IF _record.id IS NULL OR _record.administrative_status <> 'ativa'
    THEN RAISE EXCEPTION 'class-period:class-inactive-or-unavailable'; END IF;
    SELECT v.is_active INTO _org_active FROM public.institutional_period_organization_versions v
    WHERE v.organization_id = _organization_id AND v.valid_from <= _point
    ORDER BY v.version DESC LIMIT 1;
    IF _org_active IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'class-period:organization-inactive-or-unavailable'; END IF;
    SELECT y.is_active, y.starts_on, y.ends_on INTO _year_active, _year_start, _year_end
    FROM public.institutional_academic_year_versions y
    WHERE y.academic_year_id = _class.academic_year_id AND y.valid_from <= _point
    ORDER BY y.version DESC LIMIT 1;
    IF _year_active IS DISTINCT FROM true OR _point < _year_start OR _through > _year_end
    THEN RAISE EXCEPTION 'class-period:year-incompatible'; END IF;
  END LOOP;
END $context$;
REVOKE ALL ON FUNCTION public.class_period_link_context(text, text, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

-- A boundary may coincide with a period's start, never with its interior.
CREATE FUNCTION public.class_period_link_boundary(_old_org text, _new_org text, _on date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $boundary$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.institutional_academic_periods p
    JOIN LATERAL (
      SELECT v.starts_on, v.ends_on, v.is_active
      FROM public.institutional_academic_period_versions v
      WHERE v.period_id = p.id AND v.valid_from <= _on
      ORDER BY v.version DESC LIMIT 1
    ) current_period ON true
    WHERE p.period_organization_id IN (_old_org, _new_org)
      AND current_period.is_active AND current_period.starts_on < _on
      AND current_period.ends_on >= _on
  ) THEN RAISE EXCEPTION 'class-period:boundary-cuts-official-period'; END IF;
END $boundary$;
REVOKE ALL ON FUNCTION public.class_period_link_boundary(text, text, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_class_period_organization_version(
  _class_id text, _base_version_id uuid, _operation text, _organization_id text,
  _valid_from date, _valid_until date, _reason text, _act_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $record$
DECLARE _identity public.institutional_classes%ROWTYPE;
  _base public.institutional_class_period_organization_versions%ROWTYPE;
  _grant record; _person_id uuid; _next_version integer; _result uuid;
  _left boolean; _right boolean; _recorded_at timestamptz; _segment uuid;
  _frontier record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class-period:unauthenticated'; END IF;
  IF _class_id IS NULL OR _valid_from IS NULL OR _organization_id IS NULL
  THEN RAISE EXCEPTION 'class-period:required-arguments'; END IF;
  IF _operation NOT IN ('register', 'switch', 'correct') OR _operation IS NULL
  THEN RAISE EXCEPTION 'class-period:invalid-operation'; END IF;
  IF coalesce(pg_catalog.btrim(_reason), '') = '' OR coalesce(pg_catalog.btrim(_act_ref), '') = ''
  THEN RAISE EXCEPTION 'class-period:act-and-reason-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from
  THEN RAISE EXCEPTION 'class-period:invalid-dates'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class-period:' || _class_id, 0));
  SELECT c.* INTO _identity FROM public.institutional_classes c WHERE c.id = _class_id FOR UPDATE;
  IF _identity.id IS NULL THEN RAISE EXCEPTION 'class-period:class-not-found'; END IF;
  SELECT g.* INTO _grant FROM public.class_registry_school_grant(
    'manter-organizacao-de-periodos-da-turma', _identity.school_id) g;
  IF _grant.engagement_id IS NULL THEN RAISE EXCEPTION 'class-period:school-capability-required'; END IF;
  _person_id := public.current_person_id();
  IF _person_id IS NULL THEN RAISE EXCEPTION 'class-period:person-required'; END IF;
  IF _operation = 'register' THEN
    IF _base_version_id IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.institutional_class_period_organization_versions v WHERE v.class_id = _class_id
    ) THEN RAISE EXCEPTION 'class-period:first-association-required'; END IF;
  ELSE
    SELECT v.* INTO _base FROM public.institutional_class_period_organization_versions v
    WHERE v.id = _base_version_id AND v.class_id = _class_id;
    IF _base.id IS NULL THEN RAISE EXCEPTION 'class-period:base-not-found'; END IF;
    IF EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions v WHERE v.supersedes_id = _base.id)
    THEN RAISE EXCEPTION 'class-period:base-superseded'; END IF;
    IF _operation = 'switch' THEN
      IF _organization_id = _base.organization_id OR _valid_from <= _base.valid_from
         OR (_base.valid_until IS NOT NULL AND _valid_from > _base.valid_until)
      THEN RAISE EXCEPTION 'class-period:invalid-switch'; END IF;
    ELSIF (_base.valid_until IS NOT NULL AND _valid_from > _base.valid_until)
       OR (_valid_until IS NOT NULL AND _valid_until < _base.valid_from)
    THEN RAISE EXCEPTION 'class-period:correction-must-intersect-base'; END IF;
  END IF;
  _left := _base.id IS NOT NULL AND _valid_from > _base.valid_from;
  _right := _operation = 'correct' AND _valid_until IS NOT NULL
    AND (_base.valid_until IS NULL OR _valid_until < _base.valid_until);
  -- Validate every piece before the first insert. A correction never borrows
  -- the client's school; authorization and context use the persisted identity.
  IF _left THEN PERFORM public.class_period_link_context(
    _class_id, _base.organization_id, _base.valid_from, _valid_from - 1); END IF;
  PERFORM public.class_period_link_context(_class_id, _organization_id, _valid_from, _valid_until);
  IF _right THEN PERFORM public.class_period_link_context(
    _class_id, _base.organization_id, _valid_until + 1, _base.valid_until); END IF;
  -- Rebuild the prospective current timeline without writing. This includes
  -- unchanged neighbouring heads as well as every piece created by this act.
  -- A correction may create two frontiers; checking only its first date is unsafe.
  FOR _frontier IN
    WITH planned AS (
      SELECT v.organization_id, v.valid_from, v.valid_until
      FROM public.institutional_class_period_organization_versions v
      WHERE v.class_id = _class_id AND v.id IS DISTINCT FROM _base.id
        AND NOT EXISTS (
          SELECT 1 FROM public.institutional_class_period_organization_versions successor
          WHERE successor.supersedes_id = v.id
        )
      UNION ALL
      SELECT _base.organization_id, _base.valid_from, _valid_from - 1 WHERE _left
      UNION ALL
      SELECT _organization_id, _valid_from, _valid_until
      UNION ALL
      SELECT _base.organization_id, _valid_until + 1, _base.valid_until WHERE _right
    )
    SELECT DISTINCT prior.organization_id AS prior_org,
      next.organization_id AS next_org, next.valid_from AS boundary_on
    FROM planned prior JOIN planned next
      ON prior.valid_until IS NOT NULL AND prior.valid_until + 1 = next.valid_from
    WHERE prior.organization_id <> next.organization_id
    ORDER BY boundary_on, prior_org, next_org
  LOOP
    PERFORM public.class_period_link_boundary(
      _frontier.prior_org, _frontier.next_org, _frontier.boundary_on);
  END LOOP;
  SELECT coalesce(max(v.version), 0) + 1 INTO _next_version
  FROM public.institutional_class_period_organization_versions v WHERE v.class_id = _class_id;
  _recorded_at := pg_catalog.clock_timestamp();
  IF _left THEN
    INSERT INTO public.institutional_class_period_organization_versions
      (class_id, segment_id, version, supersedes_id, organization_id, valid_from, valid_until,
       change_reason, originating_act_ref, recorded_by, recorded_by_person_id,
       recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (_class_id, _base.segment_id, _next_version, _base.id, _base.organization_id,
            _base.valid_from, _valid_from - 1, _reason, _act_ref, auth.uid(), _person_id,
            _grant.engagement_id, _grant.policy_id, _recorded_at);
    _next_version := _next_version + 1;
  END IF;
  _segment := CASE WHEN _left OR _operation IN ('register', 'switch')
    THEN gen_random_uuid() ELSE _base.segment_id END;
  INSERT INTO public.institutional_class_period_organization_versions
    (class_id, segment_id, version, supersedes_id, organization_id, valid_from, valid_until,
     change_reason, originating_act_ref, recorded_by, recorded_by_person_id,
     recorded_via_engagement_id, authorizing_policy_id, created_at)
  VALUES (_class_id, _segment, _next_version,
          CASE WHEN _left OR _operation IN ('register', 'switch') THEN NULL ELSE _base.id END,
          _organization_id, _valid_from, _valid_until, _reason, _act_ref, auth.uid(), _person_id,
          _grant.engagement_id, _grant.policy_id, _recorded_at)
  RETURNING id INTO _result;
  _next_version := _next_version + 1;
  IF _right THEN
    INSERT INTO public.institutional_class_period_organization_versions
      (class_id, segment_id, version, organization_id, valid_from, valid_until,
       change_reason, originating_act_ref, recorded_by, recorded_by_person_id,
       recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (_class_id, gen_random_uuid(), _next_version, _base.organization_id,
            _valid_until + 1, _base.valid_until, _reason, _act_ref, auth.uid(), _person_id,
            _grant.engagement_id, _grant.policy_id, _recorded_at);
  END IF;
  RETURN _result;
END $record$;
REVOKE ALL ON FUNCTION public.record_class_period_organization_version(text, uuid, text, text, date, date, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_class_period_organization_version(text, uuid, text, text, date, date, text, text)
  TO authenticated;
