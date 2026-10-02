CREATE TABLE public.professional_functional_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_functional_links(id),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  functional_registration text,
  link_nature_id text NOT NULL, link_nature_version integer NOT NULL,
  position_id text, position_version integer,
  valid_from date, valid_until date,
  originating_act_ref text, correction_reason text,
  author_user_id uuid, author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.professional_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_postings(id),
  functional_link_logical_id uuid NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  function_id text, function_version integer,
  functional_status_id text, functional_status_version integer,
  valid_from date, valid_until date,
  originating_act_ref text, correction_reason text,
  author_user_id uuid, author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.professional_functional_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.professional_functional_events(id),
  functional_link_logical_id uuid NOT NULL,
  posting_logical_id uuid,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  event_kind_id text NOT NULL, event_kind_version integer NOT NULL,
  occurred_on date,
  originating_act_ref text, correction_reason text,
  author_user_id uuid, author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
GRANT SELECT ON public.professional_functional_links, public.professional_postings, public.professional_functional_events TO authenticated;
GRANT ALL ON public.professional_functional_links, public.professional_postings, public.professional_functional_events TO service_role;
ALTER TABLE public.professional_functional_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_functional_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pfl_immutable BEFORE UPDATE OR DELETE ON public.professional_functional_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER pp_immutable BEFORE UPDATE OR DELETE ON public.professional_postings FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER pfe_immutable BEFORE UPDATE OR DELETE ON public.professional_functional_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE POLICY "postings by school capability" ON public.professional_postings FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-registro-funcional', school_id));
CREATE POLICY "functional events by school capability" ON public.professional_functional_events FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-registro-funcional', school_id));
CREATE POLICY "functional links via posting school" ON public.professional_functional_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professional_postings p WHERE p.functional_link_logical_id = logical_id
                 AND public.has_school_capability('consultar-registro-funcional', p.school_id)));

CREATE OR REPLACE FUNCTION public.functional_grant(_school text) RETURNS record
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g FROM public.effective_capabilities(current_date) ec
   WHERE ec.capability_id = 'manter-registro-funcional' AND ec.school_id = _school AND ec.class_id IS NULL LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade manter-registro-funcional não concedida por política homologada na escola'; END IF;
  RETURN g;
END $$;
REVOKE EXECUTE ON FUNCTION public.functional_grant(text) FROM anon, public, authenticated;

CREATE OR REPLACE FUNCTION public.require_catalog(_scheme text, _value text, _version integer, _on date) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF _value IS NULL THEN RETURN; END IF;
  IF NOT public.attribute_value_homologated(_scheme, _value, _version, coalesce(_on, current_date)) THEN
    RAISE EXCEPTION 'Valor % não homologado no catálogo %', _value, _scheme; END IF;
END $$;

-- Vínculo: exige que o gravador possa manter registro funcional em alguma escola da lotação informada.
CREATE OR REPLACE FUNCTION public.record_functional_link_version(_logical uuid, _base uuid, _person uuid, _registration text,
  _nature text, _nature_version integer, _position text, _position_version integer, _valid_from date, _valid_until date,
  _act_ref text, _correction_reason text, _authorizing_school text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT * INTO g FROM public.functional_grant(_authorizing_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  PERFORM public.require_catalog('natureza-de-vinculo-funcional', _nature, _nature_version, _valid_from);
  PERFORM public.require_catalog('cargo', _position, _position_version, _valid_from);
  PERFORM pg_advisory_xact_lock(hashtext('pfl:' || _lid));
  SELECT * INTO cur FROM professional_functional_links WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    IF cur.person_id <> _person THEN RAISE EXCEPTION 'Vínculo não muda de pessoa'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
  INSERT INTO professional_functional_links(logical_id, version, supersedes_id, person_id, functional_registration, link_nature_id, link_nature_version,
    position_id, position_version, valid_from, valid_until, originating_act_ref, correction_reason, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _person, _registration, _nature, _nature_version, _position, _position_version, _valid_from, _valid_until,
    _act_ref, _correction_reason, auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_posting_version(_logical uuid, _base uuid, _link_logical uuid, _school text,
  _function text, _function_version integer, _status text, _status_version integer, _valid_from date, _valid_until date,
  _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT * INTO g FROM public.functional_grant(_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  IF NOT EXISTS (SELECT 1 FROM professional_functional_links WHERE logical_id = _link_logical) THEN RAISE EXCEPTION 'Vínculo funcional inexistente'; END IF;
  PERFORM public.require_catalog('funcao', _function, _function_version, _valid_from);
  PERFORM public.require_catalog('situacao-funcional', _status, _status_version, _valid_from);
  PERFORM pg_advisory_xact_lock(hashtext('pp:' || _lid));
  SELECT * INTO cur FROM professional_postings WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    IF cur.functional_link_logical_id <> _link_logical THEN RAISE EXCEPTION 'Lotação não muda de vínculo'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
  INSERT INTO professional_postings(logical_id, version, supersedes_id, functional_link_logical_id, school_id, function_id, function_version,
    functional_status_id, functional_status_version, valid_from, valid_until, originating_act_ref, correction_reason, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _link_logical, _school, _function, _function_version, _status, _status_version, _valid_from, _valid_until,
    _act_ref, _correction_reason, auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_functional_event(_logical uuid, _base uuid, _link_logical uuid, _posting_logical uuid, _school text,
  _kind text, _kind_version integer, _occurred_on date, _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT * INTO g FROM public.functional_grant(_school) AS (engagement_id uuid, policy_id uuid, policy_version integer);
  IF NOT EXISTS (SELECT 1 FROM professional_functional_links WHERE logical_id = _link_logical) THEN RAISE EXCEPTION 'Vínculo funcional inexistente'; END IF;
  PERFORM public.require_catalog('natureza-de-alteracao-funcional', _kind, _kind_version, _occurred_on);
  PERFORM pg_advisory_xact_lock(hashtext('pfe:' || _lid));
  SELECT * INTO cur FROM professional_functional_events WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
  INSERT INTO professional_functional_events(logical_id, version, supersedes_id, functional_link_logical_id, posting_logical_id, school_id, event_kind_id,
    event_kind_version, occurred_on, originating_act_ref, correction_reason, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _link_logical, _posting_logical, _school, _kind, _kind_version, _occurred_on, _act_ref, _correction_reason,
    auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_functional_link_version(uuid,uuid,uuid,text,text,integer,text,integer,date,date,text,text,text),
  public.record_posting_version(uuid,uuid,uuid,text,text,integer,text,integer,date,date,text,text),
  public.record_functional_event(uuid,uuid,uuid,uuid,text,text,integer,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_functional_link_version(uuid,uuid,uuid,text,text,integer,text,integer,date,date,text,text,text),
  public.record_posting_version(uuid,uuid,uuid,text,text,integer,text,integer,date,date,text,text),
  public.record_functional_event(uuid,uuid,uuid,uuid,text,text,integer,date,text,text) TO authenticated;