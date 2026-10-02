
CREATE TABLE public.sigem_installation_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  state text NOT NULL DEFAULT 'nao-instalado' CHECK (state IN ('nao-instalado','instalado')),
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.sigem_installation_state(singleton) VALUES (true);
CREATE TABLE public.sigem_installer_designation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  installer_email text NOT NULL,
  designation_act_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sigem_installation_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_user_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  act_ref text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton)
);
CREATE TABLE public.engagement_endings (
  engagement_id uuid PRIMARY KEY REFERENCES public.institutional_engagements(id),
  ended_on date NOT NULL,
  act_ref text NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.account_credential_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('criacao','redefinicao','troca')),
  login text,
  recorded_by uuid NOT NULL,
  act_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sigem_installation_state, public.sigem_installation_acts, public.engagement_endings, public.account_credential_events TO authenticated;
GRANT ALL ON public.sigem_installation_state, public.sigem_installer_designation, public.sigem_installation_acts, public.engagement_endings, public.account_credential_events TO service_role;
ALTER TABLE public.sigem_installation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigem_installer_designation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigem_installation_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_endings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_credential_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state readable" ON public.sigem_installation_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "installation act readable" ON public.sigem_installation_acts FOR SELECT TO authenticated USING (true);
CREATE POLICY "endings readable by holders or own" ON public.engagement_endings FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-atuacoes-institucionais') OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = engagement_id AND e.person_id = public.current_person_id()));
CREATE POLICY "own or holder credential events" ON public.account_credential_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_network_capability('manter-contas-institucionais'));

CREATE OR REPLACE FUNCTION public.guard_installation_state() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Estado de instalação não pode ser excluído'; END IF;
  IF OLD.state = 'instalado' THEN RAISE EXCEPTION 'Instalação é irreversível'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER installation_state_irreversible BEFORE UPDATE OR DELETE ON public.sigem_installation_state FOR EACH ROW EXECUTE FUNCTION public.guard_installation_state();
CREATE TRIGGER installation_acts_immutable BEFORE UPDATE OR DELETE ON public.sigem_installation_acts FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER installer_designation_immutable BEFORE UPDATE OR DELETE ON public.sigem_installer_designation FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER engagement_endings_immutable BEFORE UPDATE OR DELETE ON public.engagement_endings FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER credential_events_immutable BEFORE UPDATE OR DELETE ON public.account_credential_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Leitura administrativa pelas atuações competentes
CREATE POLICY "holders read persons" ON public.institutional_persons FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-pessoas-institucionais') OR public.has_network_capability('manter-contas-institucionais') OR public.has_network_capability('manter-atuacoes-institucionais'));
CREATE POLICY "holders read links" ON public.user_person_links FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-contas-institucionais'));
CREATE POLICY "holders read engagements" ON public.institutional_engagements FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-atuacoes-institucionais'));
CREATE POLICY "holders read scope classes" ON public.institutional_engagement_scope_classes FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-atuacoes-institucionais'));
CREATE POLICY "holders read draft policies" ON public.capability_policies FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-politica-de-capacidades') OR public.has_network_capability('homologar-politica-de-capacidades'));
CREATE POLICY "holders read draft rules" ON public.capability_policy_rules FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-politica-de-capacidades') OR public.has_network_capability('homologar-politica-de-capacidades'));

-- Instalação única
CREATE OR REPLACE FUNCTION public.install_sigem(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _state text; _email text; _designated text; _person uuid; _eng uuid; _act uuid; _pstatus text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT state INTO _state FROM sigem_installation_state WHERE singleton FOR UPDATE;
  IF _state <> 'nao-instalado' THEN RAISE EXCEPTION 'install:already-installed'; END IF;
  SELECT lower(installer_email) INTO _designated FROM sigem_installer_designation WHERE singleton;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  IF _designated IS NULL OR _email IS NULL OR _email <> _designated THEN RAISE EXCEPTION 'install:not-designated'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'install:act-required'; END IF;
  IF coalesce(btrim(_engagement_kind_id),'') = '' THEN RAISE EXCEPTION 'install:engagement-kind-required'; END IF;
  SELECT status INTO _pstatus FROM capability_policies WHERE id = _policy_id FOR UPDATE;
  IF _pstatus IS NULL OR _pstatus <> 'draft' THEN RAISE EXCEPTION 'install:policy-not-draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM capability_policy_rules WHERE policy_id = _policy_id AND engagement_kind_id = _engagement_kind_id) THEN
    RAISE EXCEPTION 'install:engagement-kind-without-rules'; END IF;
  SELECT person_id INTO _person FROM user_person_links WHERE user_id = auth.uid();
  IF _person IS NULL THEN
    IF coalesce(btrim(_person_name),'') = '' THEN RAISE EXCEPTION 'install:person-name-required'; END IF;
    INSERT INTO institutional_persons(display_name, institutional_identifier) VALUES (btrim(_person_name), nullif(btrim(_person_identifier),'')) RETURNING id INTO _person;
    INSERT INTO user_person_links(user_id, person_id) VALUES (auth.uid(), _person);
  END IF;
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, valid_from, originating_act_ref)
  VALUES (_person, _engagement_kind_id, nullif(btrim(_position_label),''), 'rede', current_date, _act_ref) RETURNING id INTO _eng;
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref, valid_from = coalesce(valid_from, current_date) WHERE id = _policy_id;
  INSERT INTO sigem_installation_acts(executor_user_id, person_id, engagement_id, policy_id, act_ref) VALUES (auth.uid(), _person, _eng, _policy_id, _act_ref) RETURNING id INTO _act;
  UPDATE sigem_installation_state SET state = 'instalado', changed_at = now() WHERE singleton;
  RETURN _act;
END $$;

CREATE OR REPLACE FUNCTION public.am_designated_installer() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM sigem_installer_designation d JOIN auth.users u ON lower(u.email) = lower(d.installer_email) WHERE u.id = auth.uid())
    AND (SELECT state FROM sigem_installation_state WHERE singleton) = 'nao-instalado'
$$;

-- Pessoas
CREATE OR REPLACE FUNCTION public.register_person(_display_name text, _identifier text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_network_capability('manter-pessoas-institucionais') THEN RAISE EXCEPTION 'capability:manter-pessoas-institucionais'; END IF;
  IF coalesce(btrim(_display_name),'') = '' THEN RAISE EXCEPTION 'person:name-required'; END IF;
  IF nullif(btrim(_identifier),'') IS NOT NULL AND EXISTS (SELECT 1 FROM institutional_persons WHERE institutional_identifier = btrim(_identifier)) THEN
    RAISE EXCEPTION 'person:identifier-in-use'; END IF;
  INSERT INTO institutional_persons(display_name, institutional_identifier) VALUES (btrim(_display_name), nullif(btrim(_identifier),'')) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Atuações
CREATE OR REPLACE FUNCTION public.record_engagement(_person uuid, _kind text, _scope_level text, _school text, _class_ids text[], _component text, _period text, _valid_from date, _valid_until date, _act_ref text, _position_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _c text;
BEGIN
  IF NOT public.has_network_capability('manter-atuacoes-institucionais') THEN RAISE EXCEPTION 'capability:manter-atuacoes-institucionais'; END IF;
  IF NOT EXISTS (SELECT 1 FROM institutional_persons WHERE id = _person) THEN RAISE EXCEPTION 'engagement:person-missing'; END IF;
  IF coalesce(btrim(_kind),'') = '' THEN RAISE EXCEPTION 'engagement:kind-required'; END IF;
  IF _scope_level NOT IN ('rede','escola','turmas','turma') THEN RAISE EXCEPTION 'engagement:scope-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'engagement:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'engagement:invalid-validity'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'engagement:act-required'; END IF;
  IF _scope_level = 'turmas' AND coalesce(array_length(_class_ids,1),0) = 0 THEN RAISE EXCEPTION 'engagement:classes-required'; END IF;
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, school_id, class_id, component_id, period_id, valid_from, valid_until, originating_act_ref)
  VALUES (_person, btrim(_kind), nullif(btrim(_position_label),''), _scope_level,
    CASE WHEN _scope_level = 'rede' THEN NULL ELSE nullif(_school,'') END,
    CASE WHEN _scope_level = 'turma' THEN _class_ids[1] END,
    nullif(_component,''), nullif(_period,''), _valid_from, _valid_until, _act_ref) RETURNING id INTO _id;
  IF _scope_level = 'turmas' THEN
    FOREACH _c IN ARRAY _class_ids LOOP
      INSERT INTO institutional_engagement_scope_classes(engagement_id, class_id, originating_act_ref) VALUES (_id, _c, _act_ref);
    END LOOP;
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.end_engagement(_engagement uuid, _ended_on date, _act_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e record;
BEGIN
  IF NOT public.has_network_capability('manter-atuacoes-institucionais') THEN RAISE EXCEPTION 'capability:manter-atuacoes-institucionais'; END IF;
  SELECT * INTO _e FROM institutional_engagements WHERE id = _engagement FOR UPDATE;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'engagement:missing'; END IF;
  IF EXISTS (SELECT 1 FROM engagement_endings WHERE engagement_id = _engagement) THEN RAISE EXCEPTION 'engagement:already-ended'; END IF;
  IF _ended_on IS NULL OR _ended_on < _e.valid_from THEN RAISE EXCEPTION 'engagement:invalid-end'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'engagement:act-required'; END IF;
  INSERT INTO engagement_endings(engagement_id, ended_on, act_ref, recorded_by) VALUES (_engagement, _ended_on, _act_ref, auth.uid());
  UPDATE institutional_engagements SET valid_until = LEAST(coalesce(valid_until, _ended_on), _ended_on) WHERE id = _engagement;
END $$;

-- Contas (executado pelo servidor do SIGEM em nome do agente verificado)
CREATE OR REPLACE FUNCTION public.link_institutional_account(_actor uuid, _user uuid, _person uuid, _login text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  IF NOT EXISTS (SELECT 1 FROM institutional_persons WHERE id = _person) THEN RAISE EXCEPTION 'account:person-missing'; END IF;
  IF EXISTS (SELECT 1 FROM user_person_links WHERE person_id = _person) THEN RAISE EXCEPTION 'account:person-already-linked'; END IF;
  INSERT INTO user_person_links(user_id, person_id) VALUES (_user, _person);
  INSERT INTO account_credential_events(user_id, kind, login, recorded_by) VALUES (_user, 'criacao', _login, _actor);
END $$;

CREATE OR REPLACE FUNCTION public.authorize_account_action(_actor uuid, _user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  IF _user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_person_links WHERE user_id = _user) THEN RAISE EXCEPTION 'account:not-institutional'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_credential_reset(_actor uuid, _user uuid, _act_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.authorize_account_action(_actor, _user);
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'account:act-required'; END IF;
  INSERT INTO account_credential_events(user_id, kind, recorded_by, act_ref) VALUES (_user, 'redefinicao', _actor, _act_ref);
END $$;

CREATE OR REPLACE FUNCTION public.record_own_password_change() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  INSERT INTO account_credential_events(user_id, kind, recorded_by) VALUES (auth.uid(), 'troca', auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.password_change_required() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT kind IN ('criacao','redefinicao') FROM account_credential_events WHERE user_id = auth.uid() ORDER BY created_at DESC, id DESC LIMIT 1), false)
$$;

-- Política
CREATE OR REPLACE FUNCTION public.register_capability_policy_draft(_logical text, _supersedes uuid, _rules jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _v int; _r jsonb;
BEGIN
  IF NOT public.has_network_capability('registrar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:registrar-politica-de-capacidades'; END IF;
  IF coalesce(btrim(_logical),'') = '' THEN RAISE EXCEPTION 'policy:logical-required'; END IF;
  IF jsonb_typeof(_rules) <> 'array' OR jsonb_array_length(_rules) = 0 THEN RAISE EXCEPTION 'policy:rules-required'; END IF;
  PERFORM 1 FROM capability_policies WHERE logical_policy_id = _logical FOR UPDATE;
  IF _supersedes IS NOT NULL AND NOT EXISTS (SELECT 1 FROM capability_policies WHERE id = _supersedes AND logical_policy_id = _logical) THEN RAISE EXCEPTION 'policy:supersedes-mismatch'; END IF;
  SELECT coalesce(max(version),0)+1 INTO _v FROM capability_policies WHERE logical_policy_id = _logical;
  INSERT INTO capability_policies(logical_policy_id, version, supersedes_version_id, status) VALUES (_logical, _v, _supersedes, 'draft') RETURNING id INTO _id;
  FOR _r IN SELECT * FROM jsonb_array_elements(_rules) LOOP
    IF coalesce(_r->>'engagement_kind_id','') = '' OR coalesce(_r->>'capability_id','') = '' THEN RAISE EXCEPTION 'policy:invalid-rule'; END IF;
    INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
    VALUES (_id, _r->>'engagement_kind_id', _r->>'capability_id', coalesce(ARRAY(SELECT jsonb_array_elements_text(_r->'scope_dimensions')), '{}'));
  END LOOP;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record;
BEGIN
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  SELECT * INTO _p FROM capability_policies WHERE id = _policy FOR UPDATE;
  IF _p.id IS NULL OR _p.status <> 'draft' THEN RAISE EXCEPTION 'policy:not-draft'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'policy:act-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'policy:valid-from-required'; END IF;
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref, valid_from = _valid_from WHERE id = _policy;
END $$;

REVOKE ALL ON FUNCTION public.install_sigem(text,text,text,text,text,uuid), public.am_designated_installer(), public.register_person(text,text),
  public.record_engagement(uuid,text,text,text,text[],text,text,date,date,text,text), public.end_engagement(uuid,date,text),
  public.record_own_password_change(), public.password_change_required(), public.register_capability_policy_draft(text,uuid,jsonb),
  public.homologate_capability_policy(uuid,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.install_sigem(text,text,text,text,text,uuid), public.am_designated_installer(), public.register_person(text,text),
  public.record_engagement(uuid,text,text,text,text[],text,text,date,date,text,text), public.end_engagement(uuid,date,text),
  public.record_own_password_change(), public.password_change_required(), public.register_capability_policy_draft(text,uuid,jsonb),
  public.homologate_capability_policy(uuid,text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.link_institutional_account(uuid,uuid,uuid,text), public.authorize_account_action(uuid,uuid), public.record_credential_reset(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_institutional_account(uuid,uuid,uuid,text), public.authorize_account_action(uuid,uuid), public.record_credential_reset(uuid,uuid,text) TO service_role;
