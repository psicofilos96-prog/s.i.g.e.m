-- 0613 / pré-checagem do ESQUEMA DE HOMOLOGAÇÃO antes da migration.
-- Somente leitura, sem dados de estudantes, contas de teste ou concessões.
-- Não certifica que a conexão seja um clone: a equipe deve verificar isso antes de aplicar a migration.
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

DO $preflight$
DECLARE
  dep record;
  result_signature text;
  role_name text;
  followup_name text;
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'followup-preflight:transaction-must-be-read-only';
  END IF;
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'followup-preflight:unsupported-postgresql-version';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      RAISE EXCEPTION 'followup-preflight:missing-role:%', role_name;
    END IF;
  END LOOP;
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL
    OR pg_catalog.pg_get_function_result(pg_catalog.to_regprocedure('auth.uid()')) <> 'uuid' THEN
    RAISE EXCEPTION 'followup-preflight:auth-uid-signature';
  END IF;
  IF pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.sha256(bytea)') IS NULL THEN
    RAISE EXCEPTION 'followup-preflight:missing-cryptographic-functions';
  END IF;

  -- As colunas abaixo são consumidas diretamente pela migration ou pelos readers.
  FOR dep IN SELECT * FROM (VALUES
    ('sigem_capability_catalog', 'capability_id', 'text'),
    ('sigem_capability_catalog', 'origin', 'text'),
    ('institutional_schools', 'id', 'text'),
    ('institutional_school_identifiers', 'school_id', 'text'),
    ('institutional_school_identifiers', 'identifier_kind', 'text'),
    ('institutional_school_identifiers', 'value', 'text'),
    ('institutional_school_record_versions', 'school_id', 'text'),
    ('institutional_school_record_versions', 'version_number', 'integer'),
    ('institutional_school_record_versions', 'official_name', 'text'),
    ('institutional_persons', 'id', 'uuid'),
    ('institutional_persons', 'display_name', 'text'),
    ('institutional_persons', 'actor_nature', 'text'),
    ('user_person_links', 'user_id', 'uuid'),
    ('user_person_links', 'person_id', 'uuid')
  ) AS required(table_name, column_name, expected_type)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = dep.table_name
        AND c.relkind IN ('r', 'p') AND a.attname = dep.column_name
        AND a.attnum > 0 AND NOT a.attisdropped
        AND CASE dep.expected_type
          WHEN 'text' THEN a.atttypid IN ('pg_catalog.text'::regtype, 'pg_catalog.varchar'::regtype)
          WHEN 'uuid' THEN a.atttypid = 'pg_catalog.uuid'::regtype
          WHEN 'integer' THEN a.atttypid = 'pg_catalog.int4'::regtype
          ELSE false
        END
    ) THEN
      RAISE EXCEPTION 'followup-preflight:missing-or-incompatible-column:%.%:%',
        dep.table_name, dep.column_name, dep.expected_type;
    END IF;
  END LOOP;

  IF pg_catalog.to_regprocedure('public.effective_scope_capabilities(date)') IS NULL THEN
    RAISE EXCEPTION 'followup-preflight:missing-effective-scope-function';
  END IF;
  result_signature := pg_catalog.pg_get_function_result(
    pg_catalog.to_regprocedure('public.effective_scope_capabilities(date)')
  );
  IF result_signature NOT LIKE 'TABLE(%'
    OR pg_catalog.strpos(result_signature, 'capability_id text') = 0
    OR pg_catalog.strpos(result_signature, 'policy_id uuid') = 0
    OR pg_catalog.strpos(result_signature, 'scope_level text') = 0
    OR pg_catalog.strpos(result_signature, 'school_id text') = 0 THEN
    RAISE EXCEPTION 'followup-preflight:incompatible-effective-scope-return';
  END IF;

  -- A migration é aditiva e cria estes objetos sem IF NOT EXISTS. Interromper se já aplicados.
  FOREACH followup_name IN ARRAY ARRAY[
    'school_institutional_followup_visits',
    'school_institutional_followup_actions',
    'school_institutional_followup_updates',
    'school_institutional_followup_bundles'
  ] LOOP
    IF pg_catalog.to_regclass('public.' || followup_name) IS NOT NULL THEN
      RAISE EXCEPTION 'followup-preflight:migration-already-present:%', followup_name;
    END IF;
  END LOOP;

  -- A 0613 usa CREATE FUNCTION (não CREATE OR REPLACE). Qualquer função
  -- preexistente desta família, inclusive overload, indica esquema não virgem
  -- e deve interromper antes de tocar no clone. RPC com overload poderia ainda
  -- tornar a resolução PostgREST ambígua.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'school\\_institutional\\_followup\\_%' ESCAPE '\\'
        OR p.proname LIKE 'record\\_school\\_institutional\\_followup\\_%' ESCAPE '\\')
  ) THEN
    RAISE EXCEPTION 'followup-preflight:preexisting-function-family';
  END IF;

  -- CREATE INDEX também exige nomes livres no esquema, mesmo se a tabela
  -- homônima ainda não existir. Verificar todos os nomes explícitos da 0613.
  FOREACH followup_name IN ARRAY ARRAY[
    'school_institutional_followup_visits_school_date',
    'school_institutional_followup_actions_school',
    'school_institutional_followup_updates_action'
  ] LOOP
    IF pg_catalog.to_regclass('public.' || followup_name) IS NOT NULL THEN
      RAISE EXCEPTION 'followup-preflight:preexisting-index-name:%', followup_name;
    END IF;
  END LOOP;

  -- A resolução por escola/INEP no leitor não pode multiplicar escolas.
  IF EXISTS (
    SELECT 1 FROM public.institutional_school_identifiers
    WHERE identifier_kind = 'inep'
    GROUP BY school_id HAVING count(*) > 1
    LIMIT 1
  ) THEN RAISE EXCEPTION 'followup-preflight:duplicate-inep-by-school'; END IF;

  RAISE NOTICE 'FOLLOWUP_0613_PREFLIGHT_READONLY_OK — assinatura estrutural mínima compatível; não substitui clone integral ou homologação.';
END $preflight$;

ROLLBACK;
