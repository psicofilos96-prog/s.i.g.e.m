-- Frente U.5: categoria de designação da turma (sem efeito curricular), política de designação versionada,
-- homologação humana separada e reserva de códigos nunca reutilizados por escola+ano+categoria.

CREATE TABLE public.class_designation_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL CHECK (policy_key ~ '^[a-z0-9][a-z0-9-]*$'),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.class_designation_policy_versions(id),
  criterion_type text NOT NULL,
  criterion_params jsonb NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  provenance_note text,
  drafted_by uuid NOT NULL,
  drafted_by_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_key, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
COMMENT ON TABLE public.class_designation_policy_versions IS 'U.5: política de designação de turmas; rascunho append-only; vigor só por homologação humana distinta.';

CREATE TABLE public.class_designation_policy_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL UNIQUE REFERENCES public.class_designation_policy_versions(id),
  homologated_by uuid NOT NULL,
  homologated_by_person_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.class_designation_category_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  supersedes_id uuid REFERENCES public.class_designation_category_versions(id),
  category_id text NOT NULL CHECK (category_id ~ '^[a-z0-9][a-z0-9-]*$'),
  reason text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, sequence)
);
COMMENT ON TABLE public.class_designation_category_versions IS 'U.5: categoria de DESIGNAÇÃO da turma. Só nomeia/organiza; não cria, herda nem infere posição curricular (B3.3) e não resolve matriz (E3).';

CREATE TABLE public.class_designation_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  class_sequence integer NOT NULL CHECK (class_sequence >= 1),
  school_id text NOT NULL,
  academic_year_id text NOT NULL,
  category_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  designation text NOT NULL,
  policy_version_id uuid NOT NULL REFERENCES public.class_designation_policy_versions(id),
  reason text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, category_id, ordinal),
  UNIQUE (class_id, class_sequence)
);
COMMENT ON TABLE public.class_designation_reservations IS 'U.5: designação oficial; ordinal reservado para sempre em escola+ano+categoria (nunca reutilizado, nunca compactado).';

CREATE OR REPLACE FUNCTION public.class_designation_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'designation:append-only'; END $$;

CREATE TRIGGER class_designation_policy_versions_immutable BEFORE UPDATE OR DELETE ON public.class_designation_policy_versions FOR EACH ROW EXECUTE FUNCTION public.class_designation_immutable();
CREATE TRIGGER class_designation_policy_homologations_immutable BEFORE UPDATE OR DELETE ON public.class_designation_policy_homologations FOR EACH ROW EXECUTE FUNCTION public.class_designation_immutable();
CREATE TRIGGER class_designation_category_versions_immutable BEFORE UPDATE OR DELETE ON public.class_designation_category_versions FOR EACH ROW EXECUTE FUNCTION public.class_designation_immutable();
CREATE TRIGGER class_designation_reservations_immutable BEFORE UPDATE OR DELETE ON public.class_designation_reservations FOR EACH ROW EXECUTE FUNCTION public.class_designation_immutable();

GRANT SELECT ON public.class_designation_policy_versions, public.class_designation_policy_homologations,
  public.class_designation_category_versions, public.class_designation_reservations TO authenticated;
GRANT ALL ON public.class_designation_policy_versions, public.class_designation_policy_homologations,
  public.class_designation_category_versions, public.class_designation_reservations TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.class_designation_policy_versions, public.class_designation_policy_homologations,
  public.class_designation_category_versions, public.class_designation_reservations FROM authenticated, anon;

ALTER TABLE public.class_designation_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_designation_policy_homologations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_designation_category_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_designation_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designation policy readable" ON public.class_designation_policy_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "designation homologation readable" ON public.class_designation_policy_homologations FOR SELECT TO authenticated USING (true);
CREATE POLICY "designation category readable in scope" ON public.class_designation_category_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id AND public.can_read_institutional_class(c.school_id, c.id)));
CREATE POLICY "designation reservation readable in scope" ON public.class_designation_reservations FOR SELECT TO authenticated
  USING (public.can_read_institutional_class(school_id, class_id));

-- Critério estruturado fechado: só tipos conhecidos, parâmetros validados; nada de expressão/SQL/código.
CREATE OR REPLACE FUNCTION public.class_designation_criterion_issue(_type text, _params jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE _k text; _v jsonb;
BEGIN
  IF _type IS DISTINCT FROM 'ordinal-por-categoria' THEN RETURN 'designation:unknown-criterion'; END IF;
  IF _params IS NULL OR pg_catalog.jsonb_typeof(_params) <> 'object' THEN RETURN 'designation:invalid-params'; END IF;
  FOR _k IN SELECT pg_catalog.jsonb_object_keys(_params) LOOP
    IF _k NOT IN ('prefixes', 'first_ordinal', 'ordinal_width') THEN RETURN 'designation:invalid-params'; END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(_params->'prefixes') <> 'object' OR _params->'prefixes' = '{}'::jsonb THEN RETURN 'designation:invalid-params'; END IF;
  FOR _k, _v IN SELECT * FROM pg_catalog.jsonb_each(_params->'prefixes') LOOP
    IF _k !~ '^[a-z0-9][a-z0-9-]*$' OR pg_catalog.jsonb_typeof(_v) <> 'string' OR (_v #>> '{}') !~ '^[0-9]{1,2}$' THEN RETURN 'designation:invalid-params'; END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(_params->'first_ordinal') <> 'number' OR (_params->>'first_ordinal') !~ '^[0-9]+$' THEN RETURN 'designation:invalid-params'; END IF;
  IF pg_catalog.jsonb_typeof(_params->'ordinal_width') <> 'number' OR (_params->>'ordinal_width') !~ '^[1-3]$' THEN RETURN 'designation:invalid-params'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.designation_actor(OUT person_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'designation:no-session'; END IF;
  SELECT l.person_id INTO person_id FROM public.user_person_links l WHERE l.user_id = auth.uid();
  IF person_id IS NULL THEN RAISE EXCEPTION 'designation:no-person'; END IF;
END $$;

-- Rascunho e homologação: capability de rede de catálogos, pessoas distintas.
CREATE OR REPLACE FUNCTION public.draft_class_designation_policy(_policy_key text, _expected_version integer, _criterion_type text, _criterion_params jsonb, _valid_from date, _valid_until date, _provenance_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _head public.class_designation_policy_versions; _issue text; _id uuid;
BEGIN
  _person := public.designation_actor();
  IF NOT public.has_network_capability('manter-catalogos-institucionais') THEN RAISE EXCEPTION 'designation:capability'; END IF;
  _issue := public.class_designation_criterion_issue(_criterion_type, _criterion_params);
  IF _issue IS NOT NULL THEN RAISE EXCEPTION '%', _issue; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'designation:invalid-validity'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('designation-policy:' || _policy_key));
  SELECT * INTO _head FROM public.class_designation_policy_versions WHERE policy_key = _policy_key ORDER BY version DESC LIMIT 1;
  IF coalesce(_head.version, 0) <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'designation:stale-head'; END IF;
  INSERT INTO public.class_designation_policy_versions(policy_key, version, supersedes_id, criterion_type, criterion_params, valid_from, valid_until, provenance_note, drafted_by, drafted_by_person_id)
  VALUES (_policy_key, coalesce(_head.version, 0) + 1, _head.id, _criterion_type, _criterion_params, _valid_from, _valid_until, nullif(pg_catalog.btrim(_provenance_note), ''), auth.uid(), _person)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.homologate_class_designation_policy(_policy_version_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _v public.class_designation_policy_versions; _id uuid;
BEGIN
  _person := public.designation_actor();
  IF NOT public.has_network_capability('manter-catalogos-institucionais') THEN RAISE EXCEPTION 'designation:capability'; END IF;
  IF _reason IS NULL OR pg_catalog.btrim(_reason) = '' THEN RAISE EXCEPTION 'designation:reason-required'; END IF;
  SELECT * INTO _v FROM public.class_designation_policy_versions WHERE id = _policy_version_id FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'designation:policy-not-found'; END IF;
  IF _v.drafted_by_person_id = _person THEN RAISE EXCEPTION 'designation:same-person'; END IF;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason)
  VALUES (_v.id, auth.uid(), _person, pg_catalog.btrim(_reason)) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Política vigente: só versões homologadas; nova versão da mesma chave substitui; chaves distintas sobrepostas => ambiguidade.
CREATE OR REPLACE FUNCTION public.applicable_class_designation_policy(_on date)
RETURNS SETOF public.class_designation_policy_versions LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT DISTINCT ON (v.policy_key) v.* FROM public.class_designation_policy_versions v
  JOIN public.class_designation_policy_homologations h ON h.policy_version_id = v.id
  WHERE v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on)
  ORDER BY v.policy_key, v.version DESC
$$;

CREATE OR REPLACE FUNCTION public.designation_school_engagement(_school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _eng uuid;
BEGIN
  SELECT g.engagement_id INTO _eng FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _school) g;
  IF _eng IS NULL THEN RAISE EXCEPTION 'designation:capability'; END IF;
  RETURN _eng;
END $$;

CREATE OR REPLACE FUNCTION public.designation_year_writable(_year text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _state text;
BEGIN
  SELECT s.state INTO _state FROM public.academic_year_operational_state_at(_year) s;
  IF _state IS NULL THEN RAISE EXCEPTION 'designation:year-without-state'; END IF;
  IF _state NOT IN ('em-preparacao', 'operacional') THEN RAISE EXCEPTION 'designation:year-not-writable'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_designation_category(_class text, _category text, _expected_sequence integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _eng uuid; _c public.institutional_classes; _head public.class_designation_category_versions; _id uuid;
BEGIN
  _person := public.designation_actor();
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'designation:class-not-found'; END IF;
  _eng := public.designation_school_engagement(_c.school_id);
  PERFORM public.designation_year_writable(_c.academic_year_id);
  IF _category IS NULL OR _category !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'designation:invalid-category'; END IF;
  IF _reason IS NULL OR pg_catalog.btrim(_reason) = '' THEN RAISE EXCEPTION 'designation:reason-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('designation-category:' || _class));
  SELECT * INTO _head FROM public.class_designation_category_versions WHERE class_id = _class ORDER BY sequence DESC LIMIT 1;
  IF coalesce(_head.sequence, 0) <> coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'designation:stale-head'; END IF;
  INSERT INTO public.class_designation_category_versions(class_id, sequence, supersedes_id, category_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_class, coalesce(_head.sequence, 0) + 1, _head.id, _category, pg_catalog.btrim(_reason), auth.uid(), _person, _eng) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Designação oficial: exige UMA política homologada vigente, categoria registrada e coberta; menor ordinal NUNCA usado.
CREATE OR REPLACE FUNCTION public.assign_class_designation(_class text, _expected_sequence integer, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _eng uuid; _c public.institutional_classes; _cat text; _n integer; _p public.class_designation_policy_versions;
  _prefix text; _first integer; _width integer; _ord integer; _seq integer; _designation text;
BEGIN
  _person := public.designation_actor();
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'designation:class-not-found'; END IF;
  _eng := public.designation_school_engagement(_c.school_id);
  PERFORM public.designation_year_writable(_c.academic_year_id);
  IF _reason IS NULL OR pg_catalog.btrim(_reason) = '' THEN RAISE EXCEPTION 'designation:reason-required'; END IF;
  SELECT pg_catalog.count(*) INTO _n FROM public.applicable_class_designation_policy(CURRENT_DATE);
  IF _n = 0 THEN RAISE EXCEPTION 'designation:no-homologated-policy'; END IF;
  IF _n > 1 THEN RAISE EXCEPTION 'designation:ambiguous-policies'; END IF;
  SELECT * INTO STRICT _p FROM public.applicable_class_designation_policy(CURRENT_DATE);
  SELECT v.category_id INTO _cat FROM public.class_designation_category_versions v WHERE v.class_id = _class ORDER BY v.sequence DESC LIMIT 1;
  IF _cat IS NULL THEN RAISE EXCEPTION 'designation:category-not-registered'; END IF;
  _prefix := _p.criterion_params->'prefixes'->>_cat;
  IF _prefix IS NULL THEN RAISE EXCEPTION 'designation:rule-not-defined'; END IF;
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

REVOKE ALL ON FUNCTION public.class_designation_criterion_issue(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.designation_actor() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.designation_school_engagement(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.designation_year_writable(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.class_designation_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.applicable_class_designation_policy(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applicable_class_designation_policy(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.class_designation_criterion_issue(text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.draft_class_designation_policy(text, integer, text, jsonb, date, date, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.homologate_class_designation_policy(uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_class_designation_category(text, text, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assign_class_designation(text, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.draft_class_designation_policy(text, integer, text, jsonb, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_class_designation_policy(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_class_designation_category(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_class_designation(text, integer, text) TO authenticated;
