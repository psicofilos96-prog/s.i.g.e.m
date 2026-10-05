-- U.1: service_role sem DML; vigência pelo ano letivo canônico; ambiguidade por categoria; cadeia íntegra.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.class_designation_policy_versions, public.class_designation_policy_homologations,
  public.class_designation_category_versions, public.class_designation_reservations FROM service_role;

CREATE OR REPLACE FUNCTION public.class_designation_policy_chain_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE _pred public.class_designation_policy_versions;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN RAISE EXCEPTION 'designation:chain-root-not-v1'; END IF;
    IF EXISTS (SELECT 1 FROM public.class_designation_policy_versions v WHERE v.policy_key = NEW.policy_key) THEN RAISE EXCEPTION 'designation:chain-second-root'; END IF;
  ELSE
    SELECT * INTO _pred FROM public.class_designation_policy_versions WHERE id = NEW.supersedes_id;
    IF _pred.id IS NULL OR _pred.policy_key <> NEW.policy_key THEN RAISE EXCEPTION 'designation:chain-foreign-predecessor'; END IF;
    IF NEW.version <> _pred.version + 1 THEN RAISE EXCEPTION 'designation:chain-version-gap'; END IF;
    IF EXISTS (SELECT 1 FROM public.class_designation_policy_versions v WHERE v.supersedes_id = NEW.supersedes_id) THEN RAISE EXCEPTION 'designation:chain-fork'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER class_designation_policy_chain BEFORE INSERT ON public.class_designation_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.class_designation_policy_chain_guard();
REVOKE ALL ON FUNCTION public.class_designation_policy_chain_guard() FROM PUBLIC, anon, authenticated, service_role;

-- Data canônica de aplicabilidade: início oficial (starts_on) da versão vigente do ano letivo.
CREATE OR REPLACE FUNCTION public.designation_year_valid_on(_year text) RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _d date;
BEGIN
  SELECT v.starts_on INTO _d FROM public.institutional_academic_year_versions v
   WHERE v.academic_year_id = _year ORDER BY v.version DESC LIMIT 1;
  IF _d IS NULL THEN RAISE EXCEPTION 'designation:year-without-dates'; END IF;
  RETURN _d;
END $$;
REVOKE ALL ON FUNCTION public.designation_year_valid_on(text) FROM PUBLIC, anon, authenticated, service_role;

-- Políticas homologadas vigentes que cobrem a categoria; versão mais alta por chave, mas cadeia legada
-- incoerente (versões sem predecessor correto) torna a chave inconsistente => excluída e sinalizada.
CREATE OR REPLACE FUNCTION public.designation_policies_for_category(_category text, _on date)
RETURNS TABLE(policy public.class_designation_policy_versions, chain_ok boolean) LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH heads AS (
    SELECT DISTINCT ON (v.policy_key) v.* FROM public.class_designation_policy_versions v
    JOIN public.class_designation_policy_homologations h ON h.policy_version_id = v.id
    WHERE v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on)
    ORDER BY v.policy_key, v.version DESC
  )
  SELECT h::public.class_designation_policy_versions,
    NOT EXISTS (
      SELECT 1 FROM public.class_designation_policy_versions x
      LEFT JOIN public.class_designation_policy_versions p ON p.id = x.supersedes_id
      WHERE x.policy_key = h.policy_key
        AND ((x.supersedes_id IS NULL AND x.version <> 1)
          OR (x.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.policy_key <> x.policy_key OR x.version <> p.version + 1)))
    ) OR (SELECT pg_catalog.count(*) FROM public.class_designation_policy_versions y WHERE y.policy_key = h.policy_key) <> h.version
  FROM heads h
  WHERE h.criterion_params->'prefixes' ? _category
$$;
REVOKE ALL ON FUNCTION public.designation_policies_for_category(text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_class_designation(_class text, _expected_sequence integer, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _eng uuid; _c public.institutional_classes; _cat text; _n integer; _bad integer; _p public.class_designation_policy_versions;
  _on date; _prefix text; _first integer; _width integer; _ord integer; _seq integer; _designation text;
BEGIN
  _person := public.designation_actor();
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'designation:class-not-found'; END IF;
  _eng := public.designation_school_engagement(_c.school_id);
  PERFORM public.designation_year_writable(_c.academic_year_id);
  IF _reason IS NULL OR pg_catalog.btrim(_reason) = '' THEN RAISE EXCEPTION 'designation:reason-required'; END IF;
  SELECT v.category_id INTO _cat FROM public.class_designation_category_versions v WHERE v.class_id = _class ORDER BY v.sequence DESC LIMIT 1;
  IF _cat IS NULL THEN RAISE EXCEPTION 'designation:category-not-registered'; END IF;
  _on := public.designation_year_valid_on(_c.academic_year_id);
  SELECT pg_catalog.count(*), pg_catalog.count(*) FILTER (WHERE NOT f.chain_ok) INTO _n, _bad FROM public.designation_policies_for_category(_cat, _on) f;
  IF _bad > 0 THEN RAISE EXCEPTION 'designation:policy-chain-inconsistent'; END IF;
  IF _n = 0 THEN RAISE EXCEPTION 'designation:rule-not-defined'; END IF;
  IF _n > 1 THEN RAISE EXCEPTION 'designation:ambiguous-policies'; END IF;
  SELECT (f.policy).* INTO STRICT _p FROM public.designation_policies_for_category(_cat, _on) f;
  _prefix := _p.criterion_params->'prefixes'->>_cat;
  _first := (_p.criterion_params->>'first_ordinal')::integer;
  _width := (_p.criterion_params->>'ordinal_width')::integer;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('designation:' || _c.school_id || ':' || _c.academic_year_id || ':' || _cat));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('designation-class:' || _class));
  SELECT coalesce(max(r.class_sequence), 0) INTO _seq FROM public.class_designation_reservations r WHERE r.class_id = _class;
  IF _seq <> coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'designation:stale-head'; END IF;
  SELECT coalesce(max(r.ordinal) + 1, _first) INTO _ord FROM public.class_designation_reservations r
   WHERE r.school_id = _c.school_id AND r.academic_year_id = _c.academic_year_id AND r.category_id = _cat;
  IF _ord < _first THEN _ord := _first; END IF;
  IF pg_catalog.length(_ord::text) > _width THEN RAISE EXCEPTION 'designation:ordinal-exhausted'; END IF;
  _designation := _prefix || pg_catalog.lpad(_ord::text, _width, '0');
  INSERT INTO public.class_designation_reservations(class_id, class_sequence, school_id, academic_year_id, category_id, ordinal, designation, policy_version_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_class, _seq + 1, _c.school_id, _c.academic_year_id, _cat, _ord, _designation, _p.id, pg_catalog.btrim(_reason), auth.uid(), _person, _eng);
  RETURN _designation;
END $$;
