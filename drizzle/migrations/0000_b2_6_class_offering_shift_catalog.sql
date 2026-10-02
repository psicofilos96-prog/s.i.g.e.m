-- B2.6 — Classificação Institucional da Oferta e Turno da Turma.
-- Migrations históricas intactas; tudo aqui é aditivo ou endurecimento.

-- 1. Capability manter-catalogos-institucionais somente na v2 draft.
DO $b26$
DECLARE _v1 uuid; _v2 uuid;
BEGIN
  SELECT id INTO _v1 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft' FOR UPDATE;
  SELECT id INTO _v2 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  -- Banco remixado sem nenhuma política: não se inventa v1/v2; regra pendente.
  IF NOT EXISTS (SELECT 1 FROM public.capability_policies) THEN
    RAISE NOTICE 'b2_6:no-capability-policy-present; rule deferred'; RETURN;
  END IF;
  IF _v1 IS NULL OR _v2 IS NULL OR
     (SELECT count(*) FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario') <> 2
  THEN RAISE EXCEPTION 'b2_6:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 116
  THEN RAISE EXCEPTION 'b2_6:unexpected-policy-rule-count'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules
             WHERE policy_id IN (_v1, _v2) AND capability_id = 'manter-catalogos-institucionais')
  THEN RAISE EXCEPTION 'b2_6:capability-already-present'; END IF;
  INSERT INTO public.capability_policy_rules (policy_id, engagement_kind_id, capability_id, scope_dimensions)
  VALUES (_v2, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']::text[]);
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 117
  THEN RAISE EXCEPTION 'b2_6:policy-insert-failed'; END IF;
END $b26$;

-- 2. Turno: início de vigência obrigatório (tabela vazia; nenhuma linha viola).
ALTER TABLE public.class_shift_versions
  ADD CONSTRAINT class_shift_versions_valid_from_required CHECK (valid_from IS NOT NULL);

-- 3. Catálogo: proveniência aditiva das novas versões.
ALTER TABLE public.attribute_value_definitions
  ADD COLUMN recorded_by uuid,
  ADD COLUMN recorded_by_person_id uuid,
  ADD COLUMN change_reason text;

-- 4. Contexto institucional da turma para fatos associados (Oferta/Turno).
CREATE FUNCTION public.class_fact_context(_class_id text, _from date, _until date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _class public.institutional_classes%ROWTYPE;
  _point date; _through date; _horizon date;
  _record public.institutional_class_record_versions%ROWTYPE;
  _year_active boolean; _year_start date; _year_end date;
BEGIN
  IF _from IS NULL OR (_until IS NOT NULL AND _until < _from) THEN RAISE EXCEPTION 'class-fact:invalid-dates'; END IF;
  SELECT c.* INTO _class FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _class.id IS NULL THEN RAISE EXCEPTION 'class-fact:class-not-found'; END IF;
  SELECT max(y.ends_on) INTO _horizon FROM public.institutional_academic_year_versions y
  WHERE y.academic_year_id = _class.academic_year_id;
  IF _horizon IS NULL THEN RAISE EXCEPTION 'class-fact:year-unavailable'; END IF;
  IF _until IS NOT NULL THEN _horizon := _until; END IF;
  IF _horizon < _from THEN RAISE EXCEPTION 'class-fact:year-incompatible'; END IF;
  FOR _point, _through IN
    WITH checkpoints AS (
      SELECT _from AS at_date
      UNION SELECT v.valid_from FROM public.institutional_class_record_versions v
        WHERE v.class_id = _class_id AND v.valid_from > _from AND v.valid_from <= _horizon
      UNION SELECT v.valid_until + 1 FROM public.institutional_class_record_versions v
        WHERE v.class_id = _class_id AND v.valid_until IS NOT NULL AND v.valid_until >= _from AND v.valid_until < _horizon
      UNION SELECT v.valid_from FROM public.institutional_academic_year_versions v
        WHERE v.academic_year_id = _class.academic_year_id AND v.valid_from > _from AND v.valid_from <= _horizon
    )
    SELECT at_date, coalesce(lead(at_date) OVER (ORDER BY at_date) - 1, _horizon) FROM checkpoints ORDER BY at_date
  LOOP
    SELECT r.* INTO _record FROM public.class_at(_class_id, _point, NULL) r;
    IF _record.id IS NULL OR _record.administrative_status <> 'ativa'
    THEN RAISE EXCEPTION 'class-fact:class-inactive-or-unavailable'; END IF;
    SELECT y.is_active, y.starts_on, y.ends_on INTO _year_active, _year_start, _year_end
    FROM public.institutional_academic_year_versions y
    WHERE y.academic_year_id = _class.academic_year_id AND y.valid_from <= _point
    ORDER BY y.version DESC LIMIT 1;
    IF _year_active IS DISTINCT FROM true OR _point < _year_start OR _through > _year_end
    THEN RAISE EXCEPTION 'class-fact:year-incompatible'; END IF;
  END LOOP;
END $fn$;

-- 5. Writer de Oferta endurecido (mesma assinatura).
-- base nula ⇒ registro inicial; base do mesmo logical ⇒ correção;
-- base de outro logical ⇒ troca (fecha a base em _valid_from-1 e abre novo logical).
CREATE OR REPLACE FUNCTION public.record_class_offering_version(_logical text, _base_version_id uuid, _class text, _axes jsonb, _valid_from date, _valid_until date, _correction_reason text, _act_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE _school text; _v integer; _id uuid; _a jsonb; _base class_offering_versions%ROWTYPE; _switch boolean := false; _closing uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'offering:unauthenticated'; END IF;
  IF _class IS NULL OR coalesce(btrim(_logical), '') = '' THEN RAISE EXCEPTION 'offering:required-arguments'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'offering:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'offering:invalid-dates'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('class-offering:' || _class, 0));
  SELECT school_id INTO _school FROM institutional_classes WHERE id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'offering:class-not-found'; END IF;
  IF NOT public.has_school_capability('manter-organizacao-da-oferta-da-turma', _school) THEN
    RAISE EXCEPTION 'offering:school-capability-required'; END IF;
  IF jsonb_typeof(_axes) <> 'array' OR jsonb_array_length(_axes) = 0 THEN RAISE EXCEPTION 'offering:axis-required'; END IF;
  IF (SELECT count(DISTINCT a->>'scheme') FROM jsonb_array_elements(_axes) a) <> jsonb_array_length(_axes)
  THEN RAISE EXCEPTION 'offering:duplicate-axis'; END IF;
  FOR _a IN SELECT * FROM jsonb_array_elements(_axes) LOOP
    IF NOT public.attribute_value_homologated(_a->>'scheme', _a->>'value', (_a->>'version')::int, _valid_from) THEN
      RAISE EXCEPTION 'offering:value-not-homologated'; END IF;
  END LOOP;
  IF _base_version_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM class_offering_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'offering:logical-exists'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'offering:reason-required'; END IF;
    SELECT * INTO _base FROM class_offering_versions WHERE id = _base_version_id AND class_id = _class;
    IF _base.id IS NULL THEN RAISE EXCEPTION 'offering:base-not-found'; END IF;
    IF EXISTS (SELECT 1 FROM class_offering_versions WHERE supersedes_id = _base.id) THEN RAISE EXCEPTION 'offering:base-superseded'; END IF;
    IF _base.logical_id = _logical THEN
      _v := _base.version + 1;
    ELSE
      _switch := true;
      IF EXISTS (SELECT 1 FROM class_offering_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'offering:logical-exists'; END IF;
      IF _base.valid_from IS NULL OR _valid_from <= _base.valid_from
         OR (_base.valid_until IS NOT NULL AND _valid_from > _base.valid_until)
      THEN RAISE EXCEPTION 'offering:invalid-switch'; END IF;
      _v := 1;
    END IF;
  END IF;
  PERFORM public.class_fact_context(_class, _valid_from, _valid_until);
  IF EXISTS (SELECT 1 FROM class_offering_versions s WHERE s.class_id = _class AND s.id IS DISTINCT FROM _base.id
      AND NOT EXISTS (SELECT 1 FROM class_offering_versions n WHERE n.supersedes_id = s.id)
      AND daterange(coalesce(s.valid_from, '-infinity'::date), s.valid_until, '[]') && daterange(_valid_from, _valid_until, '[]'))
  THEN RAISE EXCEPTION 'offering:overlap'; END IF;
  IF _switch THEN
    INSERT INTO class_offering_versions(class_id, logical_id, version, supersedes_id, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
    VALUES (_class, _base.logical_id, _base.version + 1, _base.id, _base.valid_from, _valid_from - 1, _correction_reason, _act_ref, auth.uid())
    RETURNING id INTO _closing;
    INSERT INTO class_offering_axis_values(offering_version_id, scheme_id, value_id, value_version)
    SELECT _closing, scheme_id, value_id, value_version FROM class_offering_axis_values WHERE offering_version_id = _base.id;
  END IF;
  INSERT INTO class_offering_versions(class_id, logical_id, version, supersedes_id, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
  VALUES (_class, _logical, _v, CASE WHEN _switch THEN NULL ELSE _base_version_id END, _valid_from, _valid_until, _correction_reason, _act_ref, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO class_offering_axis_values(offering_version_id, scheme_id, value_id, value_version)
  SELECT _id, a->>'scheme', a->>'value', (a->>'version')::int FROM jsonb_array_elements(_axes) a;
  RETURN _id;
END $fn$;

-- 6. Writer de Turno endurecido (mesma assinatura; mesma semântica de operação).
CREATE OR REPLACE FUNCTION public.record_class_shift_version(_logical text, _base_version_id uuid, _class text, _shift_value text, _shift_version integer, _valid_from date, _valid_until date, _correction_reason text, _act_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE _school text; _v integer; _id uuid; _base class_shift_versions%ROWTYPE; _switch boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'shift:unauthenticated'; END IF;
  IF _class IS NULL OR coalesce(btrim(_logical), '') = '' THEN RAISE EXCEPTION 'shift:required-arguments'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'shift:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'shift:invalid-dates'; END IF;
  -- Lock pela TURMA: dois logical_id concorrentes da mesma turma são serializados.
  PERFORM pg_advisory_xact_lock(hashtextextended('class-shift:' || _class, 0));
  SELECT school_id INTO _school FROM institutional_classes WHERE id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'shift:class-not-found'; END IF;
  IF NOT public.has_school_capability('manter-turno-da-turma', _school) THEN RAISE EXCEPTION 'shift:school-capability-required'; END IF;
  IF NOT public.attribute_value_homologated('turno', _shift_value, _shift_version, _valid_from) THEN RAISE EXCEPTION 'shift:value-not-homologated'; END IF;
  IF _base_version_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM class_shift_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'shift:logical-exists'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'shift:reason-required'; END IF;
    SELECT * INTO _base FROM class_shift_versions WHERE id = _base_version_id AND class_id = _class;
    IF _base.id IS NULL THEN RAISE EXCEPTION 'shift:base-not-found'; END IF;
    IF EXISTS (SELECT 1 FROM class_shift_versions WHERE supersedes_id = _base.id) THEN RAISE EXCEPTION 'shift:base-superseded'; END IF;
    IF _base.logical_id = _logical THEN
      _v := _base.version + 1;
    ELSE
      _switch := true;
      IF EXISTS (SELECT 1 FROM class_shift_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'shift:logical-exists'; END IF;
      IF _valid_from <= _base.valid_from OR (_base.valid_until IS NOT NULL AND _valid_from > _base.valid_until)
      THEN RAISE EXCEPTION 'shift:invalid-switch'; END IF;
      _v := 1;
    END IF;
  END IF;
  PERFORM public.class_fact_context(_class, _valid_from, _valid_until);
  IF EXISTS (SELECT 1 FROM class_shift_versions s WHERE s.class_id = _class AND s.id IS DISTINCT FROM _base.id
      AND NOT EXISTS (SELECT 1 FROM class_shift_versions n WHERE n.supersedes_id = s.id)
      AND daterange(s.valid_from, s.valid_until, '[]') && daterange(_valid_from, _valid_until, '[]'))
  THEN RAISE EXCEPTION 'shift:overlap'; END IF;
  IF _switch THEN
    INSERT INTO class_shift_versions(class_id, logical_id, version, supersedes_id, shift_value_id, shift_value_version, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
    VALUES (_class, _base.logical_id, _base.version + 1, _base.id, _base.shift_value_id, _base.shift_value_version, _base.valid_from, _valid_from - 1, _correction_reason, _act_ref, auth.uid());
  END IF;
  INSERT INTO class_shift_versions(class_id, logical_id, version, supersedes_id, shift_value_id, shift_value_version, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
  VALUES (_class, _logical, _v, CASE WHEN _switch THEN NULL ELSE _base_version_id END, _shift_value, _shift_version, _valid_from, _valid_until, _correction_reason, _act_ref, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $fn$;

-- 7. Readers bitemporais (INVOKER: RLS da sessão se aplica).
CREATE FUNCTION public.class_offering_at(_class_id text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(offering_version_id uuid, logical_id text, version integer, valid_from date, valid_until date,
  correction_reason text, originating_act_ref text, created_at timestamptz,
  scheme_id text, value_id text, value_version integer, value_label text)
LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE _count integer;
BEGIN
  IF _class_id IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'offering:query-arguments-required'; END IF;
  WITH known AS (SELECT v.* FROM public.class_offering_versions v WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)),
       heads AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = k.id))
  SELECT count(*)::integer INTO _count FROM heads h
  WHERE h.valid_from IS NOT NULL AND h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  IF _count > 1 THEN RAISE EXCEPTION 'offering:ambiguous-temporal-state'; END IF;
  IF _count = 0 THEN RETURN; END IF;
  RETURN QUERY
  WITH known AS (SELECT v.* FROM public.class_offering_versions v WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)),
       heads AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = k.id))
  SELECT h.id, h.logical_id, h.version, h.valid_from, h.valid_until, h.correction_reason, h.originating_act_ref, h.created_at,
         a.scheme_id, a.value_id, a.value_version, d.label
  FROM heads h
  JOIN public.class_offering_axis_values a ON a.offering_version_id = h.id
  JOIN public.attribute_value_definitions d ON d.scheme_id = a.scheme_id AND d.value_id = a.value_id AND d.version = a.value_version
  WHERE h.valid_from IS NOT NULL AND h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on)
  ORDER BY a.scheme_id;
END $fn$;

CREATE FUNCTION public.class_shift_at(_class_id text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(shift_version_id uuid, logical_id text, version integer, valid_from date, valid_until date,
  correction_reason text, originating_act_ref text, created_at timestamptz,
  value_id text, value_version integer, value_label text)
LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE _count integer;
BEGIN
  IF _class_id IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'shift:query-arguments-required'; END IF;
  WITH known AS (SELECT v.* FROM public.class_shift_versions v WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)),
       heads AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = k.id))
  SELECT count(*)::integer INTO _count FROM heads h
  WHERE h.valid_from IS NOT NULL AND h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  IF _count > 1 THEN RAISE EXCEPTION 'shift:ambiguous-temporal-state'; END IF;
  IF _count = 0 THEN RETURN; END IF;
  RETURN QUERY
  WITH known AS (SELECT v.* FROM public.class_shift_versions v WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)),
       heads AS (SELECT k.* FROM known k WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = k.id))
  SELECT h.id, h.logical_id, h.version, h.valid_from, h.valid_until, h.correction_reason, h.originating_act_ref, h.created_at,
         h.shift_value_id, h.shift_value_version, d.label
  FROM heads h
  JOIN public.attribute_value_definitions d ON d.scheme_id = h.shift_scheme_id AND d.value_id = h.shift_value_id AND d.version = h.shift_value_version
  WHERE h.valid_from IS NOT NULL AND h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
END $fn$;

-- 8. Catálogo: valores homologados selecionáveis numa data (versão homologada mais recente por valor).
CREATE FUNCTION public.homologated_attribute_values(_scheme text, _on date)
RETURNS TABLE(scheme_id text, value_id text, version integer, label text, valid_from date, homologation_act_ref text)
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT DISTINCT ON (d.scheme_id, d.value_id) d.scheme_id, d.value_id, d.version, d.label, d.valid_from, d.homologation_act_ref
  FROM public.attribute_value_definitions d
  WHERE (_scheme IS NULL OR d.scheme_id = _scheme) AND d.status = 'homologada'
    AND (d.valid_from IS NULL OR _on IS NULL OR d.valid_from <= _on)
  ORDER BY d.scheme_id, d.value_id, d.version DESC
$fn$;

-- 9. Writer do catálogo: append-only, base esperada, lock por valor, rede.
CREATE FUNCTION public.record_attribute_value_version(_scheme text, _value text, _base_version integer, _label text,
  _status text, _valid_from date, _act_ref text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _current integer; _next integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'catalog:unauthenticated'; END IF;
  IF NOT public.has_network_capability('manter-catalogos-institucionais') THEN RAISE EXCEPTION 'catalog:network-capability-required'; END IF;
  IF _scheme IS NULL OR _scheme !~ '^[a-z0-9][a-z0-9-]*$' OR _value IS NULL OR _value !~ '^[a-z0-9][a-z0-9-]*$'
  THEN RAISE EXCEPTION 'catalog:invalid-identifier'; END IF;
  IF coalesce(pg_catalog.btrim(_label), '') = '' THEN RAISE EXCEPTION 'catalog:label-required'; END IF;
  IF _status IS NULL OR _status NOT IN ('rascunho', 'homologada') THEN RAISE EXCEPTION 'catalog:invalid-status'; END IF;
  IF _status = 'homologada' AND coalesce(pg_catalog.btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'catalog:homologation-act-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog:' || _scheme || ':' || _value, 0));
  SELECT max(d.version) INTO _current FROM public.attribute_value_definitions d WHERE d.scheme_id = _scheme AND d.value_id = _value;
  IF _base_version IS NULL THEN
    IF _current IS NOT NULL THEN RAISE EXCEPTION 'catalog:value-exists'; END IF;
    _next := 1;
  ELSE
    IF _current IS NULL THEN RAISE EXCEPTION 'catalog:base-not-found'; END IF;
    IF _base_version <> _current THEN RAISE EXCEPTION 'catalog:base-superseded'; END IF;
    IF coalesce(pg_catalog.btrim(_reason), '') = '' THEN RAISE EXCEPTION 'catalog:reason-required'; END IF;
    _next := _current + 1;
  END IF;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from,
    recorded_by, recorded_by_person_id, change_reason)
  VALUES (_scheme, _value, _next, pg_catalog.btrim(_label), _status,
    CASE WHEN _status = 'homologada' THEN pg_catalog.btrim(_act_ref) ELSE nullif(pg_catalog.btrim(coalesce(_act_ref, '')), '') END,
    _valid_from, auth.uid(), public.current_person_id(), nullif(pg_catalog.btrim(coalesce(_reason, '')), ''));
  RETURN _next;
END $fn$;

-- 10. ACL: escrita só pelos writers; nada anônimo.
REVOKE ALL ON public.class_offering_versions, public.class_offering_axis_values,
  public.class_shift_versions, public.attribute_value_definitions FROM anon, sandbox_exec;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.class_offering_versions,
  public.class_offering_axis_values, public.class_shift_versions, public.attribute_value_definitions FROM authenticated;
GRANT SELECT ON public.class_offering_versions, public.class_offering_axis_values,
  public.class_shift_versions, public.attribute_value_definitions TO authenticated, sandbox_exec;
GRANT ALL ON public.class_offering_versions, public.class_offering_axis_values,
  public.class_shift_versions, public.attribute_value_definitions TO service_role;

REVOKE EXECUTE ON FUNCTION
  public.record_class_offering_version(text, uuid, text, jsonb, date, date, text, text),
  public.record_class_shift_version(text, uuid, text, text, integer, date, date, text, text),
  public.record_attribute_value_version(text, text, integer, text, text, date, text, text),
  public.class_offering_at(text, date, timestamptz),
  public.class_shift_at(text, date, timestamptz),
  public.homologated_attribute_values(text, date),
  public.class_fact_context(text, date, date),
  public.attribute_value_homologated(text, text, integer, date),
  public.class_at(text, date, timestamptz),
  public.class_period_organization_at(text, date, timestamptz),
  public.record_institutional_class_version(text, uuid, text, text, text, text, date, date, text, text),
  public.register_institutional_class(text, text, text, text, text, date, date, text),
  public.record_class_period_organization_version(text, uuid, text, text, date, date, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.record_class_offering_version(text, uuid, text, jsonb, date, date, text, text),
  public.record_class_shift_version(text, uuid, text, text, integer, date, date, text, text),
  public.record_attribute_value_version(text, text, integer, text, text, date, text, text),
  public.class_offering_at(text, date, timestamptz),
  public.class_shift_at(text, date, timestamptz),
  public.homologated_attribute_values(text, date),
  public.attribute_value_homologated(text, text, integer, date),
  public.class_at(text, date, timestamptz),
  public.class_period_organization_at(text, date, timestamptz),
  public.record_institutional_class_version(text, uuid, text, text, text, text, date, date, text, text),
  public.register_institutional_class(text, text, text, text, text, date, date, text),
  public.record_class_period_organization_version(text, uuid, text, text, date, date, text, text)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.class_fact_context(text, date, date) TO service_role;
