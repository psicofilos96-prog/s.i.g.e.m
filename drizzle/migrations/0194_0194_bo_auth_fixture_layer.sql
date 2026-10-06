-- 0194: camada técnica ESTRITA de fixtures de autenticação da Frente BO.
-- Só prepara/remove pessoa+vínculo+atuação sintéticos BO ligados a usuário Auth criado pelo harness.
-- Sem SQL arbitrário, sem tabela/capability arbitrária; tipo de atuação deve existir na política homologada vigente.
-- EXECUTE só para service_role; gated por development_automation_enabled. Não cria política nem regra.
CREATE TABLE public.bo_fixture_accounts (
  operation_id text NOT NULL CHECK (operation_id ~ '^bo-[0-9a-f]{12}$'),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL UNIQUE,
  person_id uuid NOT NULL,
  engagement_id uuid,
  engagement_kind_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_id, user_id)
);
COMMENT ON TABLE public.bo_fixture_accounts IS 'Registro transitório de fixtures sintéticas BO; deve estar vazio fora de uma execução do harness.';
REVOKE ALL ON public.bo_fixture_accounts FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.bo_fixture_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bo_fixture_prepare(_operation_id text, _source_hash text, _user_id uuid, _kind text, _with_person boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _p uuid := gen_random_uuid(); _e uuid; _scope text; _school text; _class text; _other_school text; _other_class text;
  _td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' OR _source_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _user_id IS NULL OR EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = _user_id) THEN RAISE EXCEPTION 'bo:user-collision'; END IF;
  IF EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.user_id = _user_id) THEN RAISE EXCEPTION 'bo:already-prepared'; END IF;
  IF _kind IS NOT NULL AND _kind NOT IN ('administrador-geral-do-sigem','cadastro-institucional-da-rede','ciece-auditoria-coordenacao','ciece-estatistica',
      'direcao-escolar','gestao-pedagogica-da-rede','orientacao-pedagogica','professor','rh-profissionais-da-rede','secretaria-escolar') THEN RAISE EXCEPTION 'bo:kind-not-allowlisted'; END IF;
  IF _kind IS NOT NULL AND NOT _with_person THEN RAISE EXCEPTION 'bo:engagement-requires-person'; END IF;
  IF _kind IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id = r.policy_id
      WHERE p.status = 'homologated' AND r.engagement_kind_id = _kind
        AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated')) THEN
    RAISE EXCEPTION 'bo:kind-without-homologated-rule';
  END IF;
  SELECT s.id INTO _school FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO _other_school FROM public.institutional_schools s ORDER BY s.id OFFSET 1 LIMIT 1;
  SELECT c.id INTO _class FROM public.institutional_classes c WHERE c.school_id = _school ORDER BY c.id LIMIT 1;
  SELECT c.id INTO _other_class FROM public.institutional_classes c WHERE c.school_id = _other_school ORDER BY c.id LIMIT 1;
  IF NOT _with_person THEN
    RETURN jsonb_build_object('person', null, 'engagement', null, 'school', _school, 'class', _class, 'other_school', _other_school, 'other_class', _other_class);
  END IF;
  INSERT INTO public.institutional_persons(id, display_name, institutional_identifier, actor_nature)
    VALUES (_p, 'BO FIXTURE ' || _operation_id, 'bo-fixture:' || _operation_id || ':' || _user_id::text, 'pessoa-natural');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (_user_id, _p);
  IF _kind IS NOT NULL THEN
    _scope := CASE WHEN _kind IN ('direcao-escolar','orientacao-pedagogica','secretaria-escolar') THEN 'escola' WHEN _kind = 'professor' THEN 'turma' ELSE 'rede' END;
    INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, school_id, class_id, valid_from, valid_until, originating_act_ref)
      VALUES (_p, _kind, 'BO FIXTURE', _scope, CASE WHEN _scope <> 'rede' THEN _school END, CASE WHEN _scope = 'turma' THEN _class END,
        _td - 1, _td + 1, 'bo-fixture:' || _operation_id) RETURNING id INTO _e;
  END IF;
  INSERT INTO public.bo_fixture_accounts(operation_id, source_hash, user_id, person_id, engagement_id, engagement_kind_id)
    VALUES (_operation_id, _source_hash, _user_id, _p, _e, _kind);
  RETURN jsonb_build_object('person', _p, 'engagement', _e, 'scope', _scope, 'school', _school, 'class', _class, 'other_school', _other_school, 'other_class', _other_class);
END $$;

-- Revogação de fixture: encerra a vigência (valid_until = ontem) só da atuação BO registrada.
CREATE OR REPLACE FUNCTION public.bo_fixture_expire(_operation_id text, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _a record; _td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.engagement_id IS NULL THEN RAISE EXCEPTION 'bo:no-fixture-engagement'; END IF;
  UPDATE public.institutional_engagements e SET valid_until = _td - 1, valid_from = _td - 2
   WHERE e.id = _a.engagement_id AND e.originating_act_ref = 'bo-fixture:' || _operation_id AND e.position_label_snapshot = 'BO FIXTURE';
  IF NOT FOUND THEN RAISE EXCEPTION 'bo:marker-mismatch'; END IF;
END $$;

-- Cleanup: remove só linhas com TODOS os marcadores BO; qualquer referência extra (FK) faz a operação falhar inteira.
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup(_operation_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _a record; _n integer := 0;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  FOR _a IN SELECT * FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id LOOP
    IF _a.engagement_id IS NOT NULL THEN
      DELETE FROM public.institutional_engagements e WHERE e.id = _a.engagement_id AND e.person_id = _a.person_id
        AND e.originating_act_ref = 'bo-fixture:' || _operation_id AND e.position_label_snapshot = 'BO FIXTURE';
      IF NOT FOUND THEN RAISE EXCEPTION 'bo:engagement-marker-mismatch'; END IF;
    END IF;
    DELETE FROM public.user_person_links l WHERE l.user_id = _a.user_id AND l.person_id = _a.person_id;
    DELETE FROM public.institutional_persons p WHERE p.id = _a.person_id
      AND p.institutional_identifier = 'bo-fixture:' || _operation_id || ':' || _a.user_id::text AND p.display_name = 'BO FIXTURE ' || _operation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'bo:person-marker-mismatch'; END IF;
    DELETE FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _a.user_id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.bo_fixture_residue()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT jsonb_build_object(
    'registry', (SELECT count(*) FROM public.bo_fixture_accounts),
    'persons', (SELECT count(*) FROM public.institutional_persons WHERE institutional_identifier LIKE 'bo-fixture:%' OR display_name LIKE 'BO FIXTURE%'),
    'engagements', (SELECT count(*) FROM public.institutional_engagements WHERE originating_act_ref LIKE 'bo-fixture:%' OR position_label_snapshot = 'BO FIXTURE'),
    'endings', (SELECT count(*) FROM public.engagement_endings x JOIN public.institutional_engagements e ON e.id = x.engagement_id WHERE e.originating_act_ref LIKE 'bo-fixture:%'),
    'policies', (SELECT count(*) FROM public.capability_policies WHERE logical_policy_id ILIKE '%bo%fixture%' OR logical_policy_id ILIKE 'bo-%'))
$$;

REVOKE ALL ON FUNCTION public.bo_fixture_prepare(text,text,uuid,text,boolean), public.bo_fixture_expire(text,uuid), public.bo_fixture_cleanup(text), public.bo_fixture_residue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_prepare(text,text,uuid,text,boolean), public.bo_fixture_expire(text,uuid), public.bo_fixture_cleanup(text), public.bo_fixture_residue() TO service_role;