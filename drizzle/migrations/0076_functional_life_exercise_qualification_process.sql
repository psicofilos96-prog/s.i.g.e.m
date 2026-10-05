-- Departamento Pessoal: exercício (≠ lotação), habilitação/especialidade (≠ capability) e processo funcional.
-- Catálogos abertos, sem seed: funcao, habilitacao-profissional, natureza-de-processo-funcional.
-- Gravação: manter-registro-funcional na escola (functional_grant); leitura: consultar-registro-funcional na escola (RLS).

CREATE TABLE public.professional_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_exercises(id),
  functional_link_logical_id uuid NOT NULL,
  posting_logical_id uuid,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  function_id text NOT NULL, function_version integer NOT NULL,
  valid_from date NOT NULL, valid_until date,
  source_ref text, correction_reason text, revoked boolean NOT NULL DEFAULT false,
  author_user_id uuid, authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.professional_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_qualifications(id),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  qualification_id text NOT NULL, qualification_version integer NOT NULL,
  valid_from date, valid_until date,
  source_ref text, correction_reason text, revoked boolean NOT NULL DEFAULT false,
  author_user_id uuid, authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
COMMENT ON TABLE public.professional_qualifications IS 'Habilitação/especialidade declarada. Nunca concede capability: autorização vem só de atuação + política homologada.';
CREATE TABLE public.professional_functional_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_functional_processes(id),
  functional_link_logical_id uuid NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  process_kind_id text NOT NULL, process_kind_version integer NOT NULL,
  opened_on date NOT NULL, closed_on date,
  related_event_logical_id uuid,
  source_ref text, correction_reason text, revoked boolean NOT NULL DEFAULT false,
  author_user_id uuid, authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (closed_on IS NULL OR closed_on >= opened_on)
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['professional_exercises','professional_qualifications','professional_functional_processes'] LOOP
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (supersedes_id) WHERE supersedes_id IS NOT NULL', t || '_one_successor', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (school_id)', t || '_school', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation()', t || '_immutable', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_school_capability(''consultar-registro-funcional'', school_id))', t || ' by school capability', t);
  END LOOP;
END $$;

CREATE FUNCTION public.record_professional_exercise(_logical uuid, _base uuid, _link_logical uuid, _posting_logical uuid, _school text,
  _function text, _function_version integer, _valid_from date, _valid_until date, _source text, _correction_reason text, _revoke boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; cur public.professional_exercises; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO g FROM public.functional_grant(_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  IF NOT EXISTS (SELECT 1 FROM public.professional_functional_links WHERE logical_id = _link_logical) THEN RAISE EXCEPTION 'functional:link-unknown'; END IF;
  IF _posting_logical IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.professional_postings WHERE logical_id = _posting_logical AND functional_link_logical_id = _link_logical)
    THEN RAISE EXCEPTION 'functional:posting-not-of-link'; END IF;
  PERFORM public.require_catalog('funcao', _function, _function_version, _valid_from);
  PERFORM pg_advisory_xact_lock(hashtext('pex:' || _lid));
  SELECT * INTO cur FROM public.professional_exercises WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'functional:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'functional:reason-required'; END IF;
    IF cur.functional_link_logical_id <> _link_logical OR cur.school_id <> _school THEN RAISE EXCEPTION 'functional:identity-immutable'; END IF;
    IF cur.revoked THEN RAISE EXCEPTION 'functional:already-revoked'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'functional:base-unknown'; END IF;
  INSERT INTO public.professional_exercises(logical_id, version, supersedes_id, functional_link_logical_id, posting_logical_id, school_id, function_id, function_version,
    valid_from, valid_until, source_ref, correction_reason, revoked, author_user_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _link_logical, _posting_logical, _school, _function, _function_version, _valid_from, _valid_until, nullif(btrim(_source),''),
    nullif(btrim(_correction_reason),''), coalesce(_revoke,false), auth.uid(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $fn$;

CREATE FUNCTION public.record_professional_qualification(_logical uuid, _base uuid, _person uuid, _school text,
  _qualification text, _qualification_version integer, _valid_from date, _valid_until date, _source text, _correction_reason text, _revoke boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; cur public.professional_qualifications; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO g FROM public.functional_grant(_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  IF NOT EXISTS (SELECT 1 FROM public.professional_postings p JOIN public.professional_functional_links l ON l.logical_id = p.functional_link_logical_id
                 WHERE p.school_id = _school AND l.person_id = _person) THEN RAISE EXCEPTION 'functional:person-not-posted-in-school'; END IF;
  PERFORM public.require_catalog('habilitacao-profissional', _qualification, _qualification_version, _valid_from);
  PERFORM pg_advisory_xact_lock(hashtext('pq:' || _lid));
  SELECT * INTO cur FROM public.professional_qualifications WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'functional:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'functional:reason-required'; END IF;
    IF cur.person_id <> _person OR cur.school_id <> _school THEN RAISE EXCEPTION 'functional:identity-immutable'; END IF;
    IF cur.revoked THEN RAISE EXCEPTION 'functional:already-revoked'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'functional:base-unknown'; END IF;
  INSERT INTO public.professional_qualifications(logical_id, version, supersedes_id, person_id, school_id, qualification_id, qualification_version,
    valid_from, valid_until, source_ref, correction_reason, revoked, author_user_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _person, _school, _qualification, _qualification_version, _valid_from, _valid_until, nullif(btrim(_source),''),
    nullif(btrim(_correction_reason),''), coalesce(_revoke,false), auth.uid(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $fn$;

CREATE FUNCTION public.record_functional_process(_logical uuid, _base uuid, _link_logical uuid, _school text,
  _kind text, _kind_version integer, _opened date, _closed date, _related_event uuid, _source text, _correction_reason text, _revoke boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; cur public.professional_functional_processes; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO g FROM public.functional_grant(_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  IF NOT EXISTS (SELECT 1 FROM public.professional_functional_links WHERE logical_id = _link_logical) THEN RAISE EXCEPTION 'functional:link-unknown'; END IF;
  PERFORM public.require_catalog('natureza-de-processo-funcional', _kind, _kind_version, _opened);
  PERFORM pg_advisory_xact_lock(hashtext('pfp:' || _lid));
  SELECT * INTO cur FROM public.professional_functional_processes WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'functional:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'functional:reason-required'; END IF;
    IF cur.functional_link_logical_id <> _link_logical OR cur.school_id <> _school THEN RAISE EXCEPTION 'functional:identity-immutable'; END IF;
    IF cur.revoked THEN RAISE EXCEPTION 'functional:already-revoked'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'functional:base-unknown'; END IF;
  INSERT INTO public.professional_functional_processes(logical_id, version, supersedes_id, functional_link_logical_id, school_id, process_kind_id, process_kind_version,
    opened_on, closed_on, related_event_logical_id, source_ref, correction_reason, revoked, author_user_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _link_logical, _school, _kind, _kind_version, _opened, _closed, _related_event, nullif(btrim(_source),''),
    nullif(btrim(_correction_reason),''), coalesce(_revoke,false), auth.uid(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $fn$;

REVOKE ALL ON FUNCTION public.record_professional_exercise(uuid,uuid,uuid,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_professional_qualification(uuid,uuid,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_functional_process(uuid,uuid,uuid,text,text,integer,date,date,uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_professional_exercise(uuid,uuid,uuid,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_professional_qualification(uuid,uuid,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_functional_process(uuid,uuid,uuid,text,text,integer,date,date,uuid,text,text,boolean) TO authenticated;