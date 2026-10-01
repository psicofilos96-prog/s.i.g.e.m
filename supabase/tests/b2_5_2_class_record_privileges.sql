-- B2.5.2: privilégios efetivos e tentativas reais de DML/TRUNCATE.
-- Executar depois da migration, em conexão SQL transacional. Não cria fatos.
BEGIN;
CREATE TEMP TABLE b252_privilege_results (
  role_name text NOT NULL, table_name text NOT NULL, result text NOT NULL,
  PRIMARY KEY (role_name, table_name)
);
DO $privilege_test$
DECLARE
  test_role text;
  test_table text;
  test_privilege text;
  test_sql text;
  test_result text;
  test_roles text[] := ARRAY['anon','authenticated','service_role'];
BEGIN
  IF (SELECT pg_catalog.pg_get_userbyid(c.relowner)
      FROM pg_catalog.pg_class c
      WHERE c.oid = 'public.institutional_class_record_versions'::regclass)
     IS DISTINCT FROM
     (SELECT pg_catalog.pg_get_userbyid(p.proowner)
      FROM pg_catalog.pg_proc p
      WHERE p.oid = 'public.register_institutional_class(text,text,text,text,text,date,date,text)'::regprocedure)
    OR (SELECT pg_catalog.pg_get_userbyid(c.relowner)
        FROM pg_catalog.pg_class c
        WHERE c.oid = 'public.institutional_class_record_versions'::regclass)
       IS DISTINCT FROM
       (SELECT pg_catalog.pg_get_userbyid(p.proowner)
        FROM pg_catalog.pg_proc p
        WHERE p.oid = 'public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)'::regprocedure)
  THEN RAISE EXCEPTION 'b252:writer-owner-mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c,
      LATERAL pg_catalog.aclexplode(c.relacl) acl
    WHERE c.oid IN ('public.institutional_classes'::regclass,
                    'public.institutional_class_record_versions'::regclass)
      AND acl.grantee = 0
      AND acl.privilege_type IN
        ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN')
  ) THEN RAISE EXCEPTION 'b252:public-retains-destructive-privilege'; END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='sandbox_exec') THEN
    test_roles := test_roles || ARRAY['sandbox_exec']::text[];
  END IF;
  FOREACH test_role IN ARRAY test_roles LOOP
    FOR test_table IN SELECT pg_catalog.unnest(ARRAY[
      'public.institutional_classes','public.institutional_class_record_versions']) LOOP
      FOREACH test_privilege IN ARRAY ARRAY[
        'INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'] LOOP
        IF pg_catalog.has_table_privilege(test_role, test_table, test_privilege) THEN
          RAISE EXCEPTION 'b252:effective-privilege:%:%:%',
            test_role, test_table, test_privilege;
        END IF;
      END LOOP;
      IF test_role IN ('authenticated','service_role') AND
         NOT pg_catalog.has_table_privilege(test_role, test_table, 'SELECT') THEN
        RAISE EXCEPTION 'b252:missing-read:%:%', test_role, test_table;
      END IF;

      -- Na Cloud, postgres não possui SET OPTION para sandbox_exec. A ACL
      -- efetiva é verificada acima; as tentativas reais são condicionais à
      -- possibilidade de assumir o papel, sem criar usuário ou alterar grants.
      IF test_role = 'sandbox_exec' AND
         NOT pg_catalog.pg_has_role(current_user, test_role, 'SET') THEN
        INSERT INTO b252_privilege_results VALUES
          (test_role, test_table, 'PASS: ACL sem escrita; SET ROLE indisponível');
        CONTINUE;
      END IF;

      test_result := '';
      PERFORM pg_catalog.set_config('role', test_role, true);
      FOREACH test_privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
        test_sql := CASE test_privilege
          WHEN 'INSERT' THEN pg_catalog.format('INSERT INTO %s DEFAULT VALUES', test_table)
          WHEN 'UPDATE' THEN pg_catalog.format('UPDATE %s SET id=id WHERE false', test_table)
          WHEN 'DELETE' THEN pg_catalog.format('DELETE FROM %s WHERE false', test_table)
          ELSE pg_catalog.format('TRUNCATE TABLE %s', test_table)
        END;
        BEGIN
          EXECUTE test_sql;
          RAISE EXCEPTION 'b252:direct-operation-accepted:%:%:%',
            test_role, test_table, test_privilege;
        EXCEPTION WHEN insufficient_privilege THEN
          IF SQLERRM NOT LIKE 'permission denied for table %' THEN
            RAISE EXCEPTION 'b252:denial-not-acl:%:%:%:%',
              test_role, test_table, test_privilege, SQLERRM;
          END IF;
          test_result := test_result || test_privilege || '=ACL;';
        END;
      END LOOP;
      PERFORM pg_catalog.set_config('role', 'none', true);
      INSERT INTO b252_privilege_results VALUES (test_role, test_table, 'PASS: ' || test_result);
    END LOOP;
  END LOOP;

  IF NOT pg_catalog.has_function_privilege('authenticated',
      'public.register_institutional_class(text,text,text,text,text,date,date,text)', 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated',
      'public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
      'public.register_institutional_class(text,text,text,text,text,date,date,text)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
      'public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('service_role',
      'public.register_institutional_class(text,text,text,text,text,date,date,text)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('service_role',
      'public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b252:writer-execute-acl'; END IF;
  IF 'sandbox_exec' = ANY(test_roles) THEN
    IF pg_catalog.has_function_privilege('sandbox_exec',
         'public.register_institutional_class(text,text,text,text,text,date,date,text)', 'EXECUTE')
      OR pg_catalog.has_function_privilege('sandbox_exec',
         'public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'b252:sandbox-writer-execute-acl'; END IF;
  END IF;
END $privilege_test$;
SELECT role_name, table_name, result FROM b252_privilege_results ORDER BY role_name, table_name;
ROLLBACK;
