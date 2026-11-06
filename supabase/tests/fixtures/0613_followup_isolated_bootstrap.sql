-- Banco PostgreSQL efêmero EXCLUSIVO do GitHub Actions.
-- Contrato mínimo dos objetos canônicos já presentes no SIGEM. Não usar em produção.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT nullif((coalesce(nullif(current_setting('request.jwt.claims', true),''), '{}')::jsonb ->> 'sub'), '')::uuid
$$;

-- Mimic the minimum official Auth relations and JWT helper for the
-- isolated session-rotation regression (0614). Never use as prod schema.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at timestamptz
);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL,
  not_after timestamptz
);


CREATE TABLE public.sigem_capability_catalog (
  capability_id text PRIMARY KEY,
  origin text NOT NULL
);
CREATE TABLE public.institutional_schools (
  id text PRIMARY KEY
);
CREATE TABLE public.institutional_school_identifiers (
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  identifier_kind text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (school_id, identifier_kind),
  CONSTRAINT institutional_school_identifiers_kind_value_key UNIQUE (identifier_kind, value)
);
CREATE TABLE public.institutional_school_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  version_number integer NOT NULL,
  official_name text NOT NULL,
  UNIQUE (school_id, version_number)
);
CREATE TABLE public.institutional_persons (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  actor_nature text NOT NULL
);
CREATE TABLE public.user_person_links (
  user_id uuid NOT NULL UNIQUE,
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Canônicas mínimas para o contrato independente dos postos funcionais 0615.
-- A base oficial contém versões muito mais amplas destas estruturas.
CREATE TABLE public.institutional_sector_principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL
);
CREATE TABLE public.institutional_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  engagement_kind_id text NOT NULL,
  scope_level text NOT NULL,
  school_id text,
  valid_from date NOT NULL,
  valid_until date
);
CREATE TABLE public.capability_policies (
  id uuid PRIMARY KEY,
  version integer NOT NULL,
  status text NOT NULL,
  valid_from date,
  valid_until date,
  supersedes_version_id uuid
);
CREATE TABLE public.capability_policy_rules (
  policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  engagement_kind_id text NOT NULL,
  capability_id text NOT NULL
);
-- Gestão exclusivamente sintética; não reproduz concessão nem credencial real.
CREATE FUNCTION public.has_network_capability(_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() = '99999999-9999-4999-8999-999999999999'::uuid
    AND _capability IN ('manter-contas-institucionais','manter-atuacoes-institucionais')
$$;
REVOKE ALL ON FUNCTION public.has_network_capability(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.test_followup_capabilities (
  user_id uuid NOT NULL,
  capability_id text NOT NULL,
  policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope_level text NOT NULL CHECK (scope_level IN ('rede','escola')),
  school_id text,
  CHECK (scope_level = 'rede' OR school_id IS NOT NULL)
);
CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid,
  policy_version integer, scope_level text, school_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT c.capability_id, NULL::uuid, c.policy_id, 1, c.scope_level, c.school_id
  FROM public.test_followup_capabilities c WHERE c.user_id = auth.uid()
$$;
REVOKE ALL ON public.test_followup_capabilities FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.effective_scope_capabilities(date) FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.institutional_schools(id) VALUES ('school-a'),('school-b');
INSERT INTO public.institutional_school_identifiers(school_id,identifier_kind,value)
VALUES ('school-a','inep','33000001'),('school-b','inep','33000002');
INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name)
VALUES ('school-a',1,'Escola de Prova A'),('school-b',1,'Escola de Prova B');
INSERT INTO public.institutional_persons(id, display_name, actor_nature)
VALUES
  ('11111111-1111-4111-8111-111111111111','Servidor de Prova','pessoa-natural'),
  ('22222222-2222-4222-8222-222222222222','Gabinete de Prova','pessoa-natural'),
  ('33333333-3333-4333-8333-333333333333','Usuário sem Acesso','pessoa-natural'),
  ('44444444-4444-4444-8444-444444444444','Identidade institucional simulada','orgao-institucional'),
  ('55555555-5555-4555-8555-555555555555','Segundo Servidor de Prova','pessoa-natural');
INSERT INTO auth.users(id,email)
SELECT id, 'fixture-' || id::text || '@example.invalid'
FROM public.institutional_persons;
INSERT INTO auth.users(id,email,email_confirmed_at)
VALUES ('99999999-9999-4999-8999-999999999999','synthetic-admin@example.invalid',now());
INSERT INTO public.capability_policies(id,version,status,valid_from)
VALUES ('fafafafa-1111-4111-8111-fafafafafafa',1,'homologated',CURRENT_DATE-30);
INSERT INTO public.institutional_engagements
  (person_id,engagement_kind_id,scope_level,school_id,valid_from)
VALUES
  ('11111111-1111-4111-8111-111111111111','test-followup-writer','escola','school-a',CURRENT_DATE-30),
  ('55555555-5555-4555-8555-555555555555','test-followup-writer','escola','school-b',CURRENT_DATE-30),
  ('22222222-2222-4222-8222-222222222222','test-followup-cabinet','rede',NULL,CURRENT_DATE-30);
INSERT INTO public.capability_policy_rules(policy_id,engagement_kind_id,capability_id)
VALUES
  ('fafafafa-1111-4111-8111-fafafafafafa','test-followup-writer','registrar-acompanhamento-institucional'),
  ('fafafafa-1111-4111-8111-fafafafafafa','test-followup-writer','manter-contas-institucionais'),
  ('fafafafa-1111-4111-8111-fafafafafafa','test-followup-cabinet','consultar-acompanhamento-institucional'),
  ('fafafafa-1111-4111-8111-fafafafafafa','test-followup-cabinet','registrar-acompanhamento-institucional');

INSERT INTO public.user_person_links(user_id,person_id)
SELECT id,id FROM public.institutional_persons;
INSERT INTO public.test_followup_capabilities(user_id,capability_id,scope_level,school_id)
VALUES
 ('11111111-1111-4111-8111-111111111111','registrar-acompanhamento-institucional','escola','school-a'),
 ('22222222-2222-4222-8222-222222222222','consultar-acompanhamento-institucional','rede',NULL),
 ('44444444-4444-4444-8444-444444444444','registrar-acompanhamento-institucional','escola','school-a'),
 ('55555555-5555-4555-8555-555555555555','registrar-acompanhamento-institucional','escola','school-b');
