-- 0107: autoria "humana XOR operação técnica" em ano letivo/turma; identificadores externos; declarações
-- censitárias de turma, profissional e jornada; operações técnicas EducaCenso 2026 (turmas, profissionais, jornadas).
-- Writers humanos continuam exigindo sessão, pessoa, atuação e política. Nenhum app role executa núcleo/operação.

ALTER TABLE public.institutional_academic_year_versions
  ADD COLUMN technical_operation_id uuid REFERENCES public.technical_execution_operations(id);
ALTER TABLE public.institutional_academic_year_versions
  ALTER COLUMN recorded_by DROP NOT NULL,
  ALTER COLUMN recorded_by_person_id DROP NOT NULL,
  ALTER COLUMN recorded_via_engagement_id DROP NOT NULL;
ALTER TABLE public.institutional_academic_year_versions ADD CONSTRAINT academic_year_version_author_xor CHECK (
  (recorded_by IS NOT NULL AND recorded_by_person_id IS NOT NULL AND recorded_via_engagement_id IS NOT NULL AND technical_operation_id IS NULL)
  OR (recorded_by IS NULL AND recorded_by_person_id IS NULL AND recorded_via_engagement_id IS NULL AND technical_operation_id IS NOT NULL));

ALTER TABLE public.institutional_class_record_versions
  ADD COLUMN technical_operation_id uuid REFERENCES public.technical_execution_operations(id);
ALTER TABLE public.institutional_class_record_versions
  ALTER COLUMN recorded_by DROP NOT NULL,
  ALTER COLUMN recorded_by_person_id DROP NOT NULL,
  ALTER COLUMN recorded_via_engagement_id DROP NOT NULL,
  ALTER COLUMN authorizing_policy_id DROP NOT NULL,
  ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.institutional_class_record_versions ADD CONSTRAINT class_record_version_author_xor CHECK (
  (recorded_by IS NOT NULL AND recorded_by_person_id IS NOT NULL AND recorded_via_engagement_id IS NOT NULL AND authorizing_policy_id IS NOT NULL AND technical_operation_id IS NULL)
  OR (recorded_by IS NULL AND recorded_by_person_id IS NULL AND recorded_via_engagement_id IS NULL AND authorizing_policy_id IS NULL AND technical_operation_id IS NOT NULL));

ALTER TABLE public.professional_functional_links ADD COLUMN technical_operation_id uuid REFERENCES public.technical_execution_operations(id);
ALTER TABLE public.professional_exercises ADD COLUMN technical_operation_id uuid REFERENCES public.technical_execution_operations(id);
ALTER TABLE public.professional_functional_links ADD CONSTRAINT pfl_author_xor CHECK (NOT (technical_operation_id IS NOT NULL AND (author_user_id IS NOT NULL OR author_person_id IS NOT NULL OR authorizing_engagement_id IS NOT NULL)));
ALTER TABLE public.professional_exercises ADD CONSTRAINT pex_author_xor CHECK (NOT (technical_operation_id IS NOT NULL AND (author_user_id IS NOT NULL OR authorizing_engagement_id IS NOT NULL)));

CREATE OR REPLACE FUNCTION public.institutional_class_register_core(_school_id text, _academic_year_id text, _code text, _name text,
  _administrative_status text, _valid_from date, _valid_until date, _act_ref text,
  _recorded_by uuid, _person uuid, _engagement uuid, _policy uuid, _op uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE _school_name text; _year_name text; _class_id text; _recorded_at timestamptz;
BEGIN
  IF _school_id IS NULL OR _academic_year_id IS NULL THEN RAISE EXCEPTION 'class:context-required'; END IF;
  IF coalesce(pg_catalog.btrim(_name), '') = '' THEN RAISE EXCEPTION 'class:name-required'; END IF;
  IF _administrative_status IS NULL OR _administrative_status NOT IN ('ativa', 'inativa') THEN RAISE EXCEPTION 'class:invalid-status'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'class:invalid-dates'; END IF;
  IF (_op IS NULL) = (_recorded_by IS NULL) THEN RAISE EXCEPTION 'class:author-xor'; END IF;
  _act_ref := NULLIF(pg_catalog.btrim(_act_ref), '');
  SELECT c.school_name, c.year_name INTO _school_name, _year_name
  FROM public.class_record_context(_school_id, _academic_year_id, _valid_from, _valid_until) c;
  _class_id := 'turma-' || pg_catalog.gen_random_uuid();
  _recorded_at := pg_catalog.clock_timestamp();
  INSERT INTO public.institutional_classes (id, school_id, school_label_snapshot, academic_year_id, academic_year_label,
     code, name, valid_from, valid_until, originating_act_ref, created_at)
  VALUES (_class_id, _school_id, _school_name, _academic_year_id, _year_name,
          NULLIF(pg_catalog.btrim(_code), ''), pg_catalog.btrim(_name), _valid_from, _valid_until, _act_ref, _recorded_at);
  INSERT INTO public.institutional_class_record_versions (class_id, segment_id, version, code, name, administrative_status,
     valid_from, valid_until, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id,
     authorizing_policy_id, technical_operation_id, created_at)
  VALUES (_class_id, pg_catalog.gen_random_uuid(), 1, NULLIF(pg_catalog.btrim(_code), ''), pg_catalog.btrim(_name),
          _administrative_status, _valid_from, _valid_until, _act_ref, _recorded_by, _person, _engagement, _policy, _op, _recorded_at);
  RETURN _class_id;
END $f$;
REVOKE ALL ON FUNCTION public.institutional_class_register_core(text,text,text,text,text,date,date,text,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_institutional_class(_school_id text, _academic_year_id text, _code text, _name text,
  _administrative_status text, _valid_from date, _valid_until date, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE _grant record; _person_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class:unauthenticated'; END IF;
  IF _school_id IS NULL OR _academic_year_id IS NULL THEN RAISE EXCEPTION 'class:context-required'; END IF;
  SELECT g.* INTO _grant FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _school_id) g;
  IF _grant.engagement_id IS NULL THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
  _person_id := public.current_person_id();
  IF _person_id IS NULL THEN RAISE EXCEPTION 'class:person-required'; END IF;
  RETURN public.institutional_class_register_core(_school_id, _academic_year_id, _code, _name, _administrative_status,
    _valid_from, _valid_until, _act_ref, auth.uid(), _person_id, _grant.engagement_id, _grant.policy_id, NULL);
END $f$;

CREATE TABLE public.institutional_class_identifiers (
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  identifier_kind text NOT NULL CHECK (identifier_kind ~ '^[a-z0-9-]{2,40}$'),
  value text NOT NULL CHECK (pg_catalog.btrim(value) <> ''),
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, identifier_kind),
  UNIQUE (identifier_kind, value)
);
COMMENT ON TABLE public.institutional_class_identifiers IS 'Identificador externo da turma (ex.: código EducaCenso); nunca PK universal. Append-only.';
CREATE TABLE public.class_census_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  field text NOT NULL CHECK (pg_catalog.btrim(field) <> ''),
  value_text text NOT NULL CHECK (pg_catalog.btrim(value_text) <> ''),
  valid_from date NOT NULL,
  known_at timestamptz NOT NULL DEFAULT now(),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  source_locator text,
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  UNIQUE (source_hash, class_id, field)
);
COMMENT ON TABLE public.class_census_declarations IS 'Declaração literal da fonte censitária sobre a turma (tipo, etapa, organização, horário, contagens declaradas). Não é oferta/turno/matriz homologados; ausência = não informado.';
REVOKE ALL ON public.institutional_class_identifiers, public.class_census_declarations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.institutional_class_identifiers, public.class_census_declarations TO authenticated;
ALTER TABLE public.institutional_class_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_census_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura conforme turma" ON public.institutional_class_identifiers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id));
CREATE POLICY "leitura conforme turma" ON public.class_census_declarations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id));
CREATE TRIGGER class_identifiers_immutable BEFORE UPDATE OR DELETE ON public.institutional_class_identifiers FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_census_declarations_immutable BEFORE UPDATE OR DELETE ON public.class_census_declarations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.technical_identity_secrets (purpose text PRIMARY KEY, secret bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.technical_identity_secrets FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.technical_identity_secrets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.technical_identity_secrets(purpose, secret) VALUES ('cpf-fingerprint', extensions.gen_random_bytes(32));
CREATE TRIGGER technical_identity_secrets_immutable BEFORE UPDATE OR DELETE ON public.technical_identity_secrets FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.institutional_person_identifiers (
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  identifier_kind text NOT NULL CHECK (identifier_kind IN ('cpf-hmac', 'inep-pessoa')),
  value text NOT NULL CHECK (pg_catalog.btrim(value) <> ''),
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, identifier_kind),
  UNIQUE (identifier_kind, value)
);
COMMENT ON TABLE public.institutional_person_identifiers IS 'Chaves estáveis da pessoa: HMAC do CPF (segredo interno) e identificação única INEP. Sem leitura por app roles.';
REVOKE ALL ON public.institutional_person_identifiers FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.institutional_person_identifiers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER person_identifiers_immutable BEFORE UPDATE OR DELETE ON public.institutional_person_identifiers FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.professional_census_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  class_code text NOT NULL,
  class_id text REFERENCES public.institutional_classes(id),
  function_literal text NOT NULL,
  regime_literal text,
  functional_link_logical_id uuid,
  valid_from date NOT NULL,
  known_at timestamptz NOT NULL DEFAULT now(),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_locator text,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  UNIQUE (source_hash, person_id, school_id, class_code, function_literal)
);
COMMENT ON TABLE public.professional_census_declarations IS 'Profissional declarado em turma pelo EducaCenso (função na turma, regime). Evidência: não cria regência, atuação, login nem capability.';

CREATE TABLE public.professional_schedule_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.institutional_persons(id),
  person_ref text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  class_code text NOT NULL,
  class_id text REFERENCES public.institutional_classes(id),
  link_kind text NOT NULL,
  schedule_text text,
  weekly_minutes integer CHECK (weekly_minutes IS NULL OR weekly_minutes >= 0),
  total_minutes_declared integer CHECK (total_minutes_declared IS NULL OR total_minutes_declared >= 0),
  status text NOT NULL CHECK (status IN ('confirmado','divergente','incompleto','sem-correspondencia')),
  issues text[] NOT NULL DEFAULT '{}',
  valid_from date NOT NULL,
  known_at timestamptz NOT NULL DEFAULT now(),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_locator text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  UNIQUE (source_hash, source_locator, link_kind)
);
COMMENT ON TABLE public.professional_schedule_declarations IS 'Jornada declarada pela fonte (pessoa × turma × horário). Evidência para revisão; não é grade homologada nem cria pessoa/turma/vínculo. person_ref = id INEP da pessoa.';
REVOKE ALL ON public.professional_census_declarations, public.professional_schedule_declarations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.professional_census_declarations, public.professional_schedule_declarations TO authenticated;
ALTER TABLE public.professional_census_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_schedule_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura escolar" ON public.professional_census_declarations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.person_id = public.current_person_id()
    AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
    AND (e.scope_level = 'rede' OR e.school_id = professional_census_declarations.school_id)));
CREATE POLICY "leitura escolar" ON public.professional_schedule_declarations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.person_id = public.current_person_id()
    AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
    AND (e.scope_level = 'rede' OR e.school_id = professional_schedule_declarations.school_id)));
CREATE TRIGGER professional_census_declarations_immutable BEFORE UPDATE OR DELETE ON public.professional_census_declarations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER professional_schedule_declarations_immutable BEFORE UPDATE OR DELETE ON public.professional_schedule_declarations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.technical_cpf_valid(_cpf text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $f$
DECLARE d int[]; s int; r int; i int;
BEGIN
  IF _cpf IS NULL OR _cpf !~ '^[0-9]{11}$' OR _cpf ~ '^(.)\1{10}$' THEN RETURN false; END IF;
  d := ARRAY(SELECT pg_catalog.substr(_cpf, g, 1)::int FROM pg_catalog.generate_series(1, 11) g);
  s := 0; FOR i IN 1..9 LOOP s := s + d[i] * (11 - i); END LOOP; r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> d[10] THEN RETURN false; END IF;
  s := 0; FOR i IN 1..10 LOOP s := s + d[i] * (12 - i); END LOOP; r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = d[11];
END $f$;
CREATE OR REPLACE FUNCTION public.technical_cpf_hmac(_cpf text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $f$
  SELECT pg_catalog.encode(extensions.hmac(_cpf::bytea, s.secret, 'sha256'), 'hex') FROM public.technical_identity_secrets s WHERE s.purpose = 'cpf-fingerprint'
$f$;
REVOKE ALL ON FUNCTION public.technical_cpf_valid(text), public.technical_cpf_hmac(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_classes(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; r jsonb; d record; existing record; yid text; cid text; n int := 0; vf date := DATE '2026-08-31';
  m jsonb := _payload->'manifest'; cls jsonb := _payload->'classes'; y jsonb := _payload->'manifest'->'academic_year';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_classes' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF _snapshot IS DISTINCT FROM DATE '2026-07-31' THEN RAISE EXCEPTION 'technical:snapshot-mismatch'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(cls) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_typeof(y) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'class_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(cls) THEN RAISE EXCEPTION 'technical:count-classes'; END IF;
  IF (m->>'school_count')::int IS DISTINCT FROM (SELECT count(DISTINCT e->>'inep') FROM pg_catalog.jsonb_array_elements(cls) e) THEN RAISE EXCEPTION 'technical:count-schools'; END IF;
  IF y->>'census_year' IS DISTINCT FROM '2026' THEN RAISE EXCEPTION 'technical:academic-year-not-declared'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(cls) e GROUP BY e->>'code' HAVING count(*) > 1) THEN RAISE EXCEPTION 'technical:duplicate-class-code'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(cls) e WHERE coalesce(e->>'code','') !~ '^[0-9]{4,12}$' OR coalesce(pg_catalog.btrim(e->>'name'),'') = '') THEN RAISE EXCEPTION 'technical:class-row-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(cls) e WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers i WHERE i.identifier_kind='inep' AND i.value = e->>'inep' AND i.school_id = 'inep-' || (e->>'inep'))) THEN RAISE EXCEPTION 'technical:school-not-found'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(cls) e JOIN public.institutional_class_identifiers ci ON ci.identifier_kind='educacenso-turma' AND ci.value = e->>'code') THEN RAISE EXCEPTION 'technical:class-code-already-registered'; END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  SELECT v.academic_year_id INTO yid FROM public.institutional_academic_year_versions v WHERE v.official_name = y->>'official_name' ORDER BY v.version DESC LIMIT 1;
  IF yid IS NULL THEN
    yid := 'ano-' || pg_catalog.gen_random_uuid();
    INSERT INTO public.institutional_academic_years(id) VALUES (yid);
    INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from, change_reason, originating_act_ref, technical_operation_id)
    VALUES (yid, 1, y->>'official_name', (y->>'starts_on')::date, (y->>'ends_on')::date, true, (y->>'starts_on')::date, y->>'basis', m->>'source_ref', op);
    INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_academic_years', yid);
  END IF;
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(cls) LOOP
    cid := public.institutional_class_register_core('inep-' || (r->>'inep'), yid, r->>'code', r->>'name', 'ativa', vf, NULL, m->>'source_ref', NULL, NULL, NULL, NULL, op);
    INSERT INTO public.institutional_class_identifiers(class_id, identifier_kind, value, technical_operation_id) VALUES (cid, 'educacenso-turma', r->>'code', op);
    FOR d IN SELECT key, value FROM pg_catalog.jsonb_each_text(r->'declarations') LOOP
      INSERT INTO public.class_census_declarations(class_id, field, value_text, valid_from, source_hash, source_ref, source_locator, technical_operation_id)
      VALUES (cid, d.key, d.value, _snapshot, _source_hash, m->>'source_ref', r->>'locator', op);
    END LOOP;
    INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_classes', cid);
    n := n + 1;
  END LOOP;
  IF n <> pg_catalog.jsonb_array_length(cls) THEN RAISE EXCEPTION 'technical:written-count'; END IF;
  RETURN op;
END $f$;

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_professionals(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; p jsonb; r jsonb; existing record; pid uuid; pid2 uuid; h text; tid text; lk uuid; n int := 0; school text;
  m jsonb := _payload->'manifest'; ps jsonb := _payload->'persons';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_professionals' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF _snapshot IS DISTINCT FROM DATE '2026-07-31' THEN RAISE EXCEPTION 'technical:snapshot-mismatch'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(ps) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'person_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(ps) THEN RAISE EXCEPTION 'technical:count-persons'; END IF;
  IF (m->>'row_count')::int IS DISTINCT FROM (SELECT sum(pg_catalog.jsonb_array_length(e->'rows')) FROM pg_catalog.jsonb_array_elements(ps) e) THEN RAISE EXCEPTION 'technical:count-rows'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e WHERE NOT public.technical_cpf_valid(e->>'cpf') OR coalesce(e->>'inep_person','') !~ '^[0-9]{12}$' OR coalesce(pg_catalog.btrim(e->>'display_name'),'') = '') THEN RAISE EXCEPTION 'technical:person-identity-insufficient'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e GROUP BY e->>'cpf' HAVING count(*) > 1) OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e GROUP BY e->>'inep_person' HAVING count(*) > 1) THEN RAISE EXCEPTION 'technical:duplicate-person'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e, pg_catalog.jsonb_array_elements(e->'rows') x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers i WHERE i.identifier_kind='inep' AND i.value = x->>'inep_school')) THEN RAISE EXCEPTION 'technical:school-not-found'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  FOR p IN SELECT * FROM pg_catalog.jsonb_array_elements(ps) LOOP
    h := public.technical_cpf_hmac(p->>'cpf');
    SELECT person_id INTO pid FROM public.institutional_person_identifiers WHERE identifier_kind='cpf-hmac' AND value = h;
    SELECT person_id INTO pid2 FROM public.institutional_person_identifiers WHERE identifier_kind='inep-pessoa' AND value = p->>'inep_person';
    IF pid IS NOT NULL AND pid2 IS NOT NULL AND pid <> pid2 THEN RAISE EXCEPTION 'technical:identity-conflict'; END IF;
    pid := coalesce(pid, pid2);
    IF pid IS NULL THEN
      INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (pg_catalog.btrim(p->>'display_name'), 'pessoa-natural') RETURNING id INTO pid;
      INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_persons', pid::text);
    END IF;
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'cpf-hmac', h, op) ON CONFLICT DO NOTHING;
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'inep-pessoa', p->>'inep_person', op) ON CONFLICT DO NOTHING;
    FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(p->'rows') LOOP
      school := 'inep-' || (r->>'inep_school'); lk := NULL;
      IF r->>'link_nature' IS NOT NULL THEN
        SELECT x.functional_link_logical_id INTO lk FROM public.professional_exercises x JOIN public.professional_functional_links l ON l.logical_id = x.functional_link_logical_id
          WHERE x.technical_operation_id = op AND x.school_id = school AND l.person_id = pid AND l.link_nature_id = r->>'link_nature' LIMIT 1;
        IF lk IS NULL THEN
          lk := pg_catalog.gen_random_uuid();
          INSERT INTO public.professional_functional_links(logical_id, version, person_id, functional_registration, link_nature_id, link_nature_version, originating_act_ref, technical_operation_id)
          VALUES (lk, 1, pid, NULL, r->>'link_nature', 1, m->>'source_ref', op) RETURNING id::text INTO tid;
          INSERT INTO public.technical_execution_targets VALUES (op, 'professional_functional_links', tid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.professional_exercises x WHERE x.functional_link_logical_id = lk AND x.school_id = school AND x.function_id = r->>'function_id' AND x.technical_operation_id = op) THEN
          INSERT INTO public.professional_exercises(logical_id, version, functional_link_logical_id, school_id, function_id, function_version, valid_from, source_ref, revoked, technical_operation_id)
          VALUES (pg_catalog.gen_random_uuid(), 1, lk, school, r->>'function_id', 1, _snapshot, m->>'source_ref', false, op) RETURNING id::text INTO tid;
          INSERT INTO public.technical_execution_targets VALUES (op, 'professional_exercises', tid);
        END IF;
      END IF;
      INSERT INTO public.professional_census_declarations(person_id, school_id, class_code, class_id, function_literal, regime_literal, functional_link_logical_id, valid_from, source_hash, source_locator, technical_operation_id)
      VALUES (pid, school, r->>'class_code', (SELECT ci.class_id FROM public.institutional_class_identifiers ci WHERE ci.identifier_kind='educacenso-turma' AND ci.value = r->>'class_code'),
              r->>'function', r->>'regime', lk, _snapshot, _source_hash, r->>'locator', op)
      ON CONFLICT (source_hash, person_id, school_id, class_code, function_literal) DO NOTHING;
      n := n + 1;
    END LOOP;
  END LOOP;
  RETURN op;
END $f$;

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_professional_schedules(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; r jsonb; existing record; pid uuid; cid text; st text; iss text[]; n int := 0;
  m jsonb := _payload->'manifest'; rs jsonb := _payload->'rows';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_professional_schedules' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF _snapshot IS NULL OR _snapshot NOT IN (DATE '2026-07-31', DATE '2026-08-31') THEN RAISE EXCEPTION 'technical:snapshot-mismatch'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(rs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'row_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(rs) THEN RAISE EXCEPTION 'technical:count-rows'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e WHERE coalesce(e->>'person_ref','') !~ '^[0-9]{12}$' OR coalesce(e->>'locator','') = '' OR e->>'status' NOT IN ('confirmado','divergente','incompleto','sem-correspondencia') OR (e->>'valid_from')::date NOT IN (DATE '2026-07-31', DATE '2026-08-31')) THEN RAISE EXCEPTION 'technical:row-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers i WHERE i.identifier_kind='inep' AND i.value = e->>'inep_school')) THEN RAISE EXCEPTION 'technical:school-not-found'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(rs) LOOP
    SELECT person_id INTO pid FROM public.institutional_person_identifiers WHERE identifier_kind='inep-pessoa' AND value = r->>'person_ref';
    SELECT ci.class_id INTO cid FROM public.institutional_class_identifiers ci JOIN public.institutional_classes c ON c.id = ci.class_id
      WHERE ci.identifier_kind='educacenso-turma' AND ci.value = r->>'class_code' AND c.school_id = 'inep-' || (r->>'inep_school');
    st := r->>'status'; iss := ARRAY(SELECT pg_catalog.jsonb_array_elements_text(coalesce(r->'issues','[]'::jsonb)));
    IF pid IS NULL THEN iss := iss || 'pessoa-sem-correspondencia'::text; END IF;
    IF cid IS NULL THEN iss := iss || 'turma-sem-correspondencia'::text; END IF;
    IF pid IS NULL OR cid IS NULL THEN st := 'sem-correspondencia'; END IF;
    INSERT INTO public.professional_schedule_declarations(person_id, person_ref, school_id, class_code, class_id, link_kind, schedule_text, weekly_minutes, total_minutes_declared, status, issues, valid_from, source_hash, source_locator, technical_operation_id)
    VALUES (pid, r->>'person_ref', 'inep-' || (r->>'inep_school'), r->>'class_code', cid, r->>'link_kind', r->>'schedule', (r->>'weekly_minutes')::int, (r->>'total_minutes')::int, st, iss, (r->>'valid_from')::date, _source_hash, r->>'locator', op);
    n := n + 1;
  END LOOP;
  IF n <> pg_catalog.jsonb_array_length(rs) THEN RAISE EXCEPTION 'technical:written-count'; END IF;
  RETURN op;
END $f$;

REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_classes(text,text,date,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_professionals(text,text,date,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_professional_schedules(text,text,date,jsonb) FROM PUBLIC, anon, authenticated, service_role;