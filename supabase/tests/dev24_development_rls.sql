-- DEV L24 — prova de fechamento sobre TODAS as tabelas dev_: RLS ligada, anon sem leitura, sem DML direta de authenticated,
-- trigger append-only, writers fora do alcance de anon e nenhuma coluna de progressão/promoção/remuneração.
-- Exceção declarada: verificação pública de certificado (código opaco, sem dado pessoal) é executável por anon.
DO $$
DECLARE bad text[] := '{}'; r record;
BEGIN
  FOR r IN SELECT c.oid, c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
           WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'dev\_%' LOOP
    IF NOT r.relrowsecurity THEN bad := bad || ('sem RLS: ' || r.relname); END IF;
    IF has_table_privilege('anon', r.oid, 'SELECT') THEN bad := bad || ('anon lê: ' || r.relname); END IF;
    IF has_table_privilege('authenticated', r.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') THEN bad := bad || ('DML direta: ' || r.relname); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = r.oid AND NOT t.tgisinternal) THEN bad := bad || ('sem append-only: ' || r.relname); END IF;
  END LOOP;
  FOR r IN SELECT a.attrelid::regclass::text AS t, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace s ON s.oid = c.relnamespace
           WHERE s.nspname = 'public' AND c.relname LIKE 'dev\_%' AND a.attnum > 0 AND a.attname ~ '(progress|promoc|remuner|salari|gratific|enquadr)' LOOP
    bad := bad || ('efeito funcional: ' || r.t || '.' || r.attname);
  END LOOP;
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
           WHERE s.nspname = 'public' AND p.prosecdef AND (p.proname LIKE '%\_dev\_%' OR p.proname LIKE 'dev\_%') LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE') AND r.proname NOT IN ('verify_dev_certificate','verify_dev_certification') THEN bad := bad || ('anon executa: ' || r.proname); END IF;
  END LOOP;
  IF cardinality(bad) > 0 THEN RAISE EXCEPTION 'DEV L24 falhou: %', array_to_string(bad, '; '); END IF;
  RAISE NOTICE 'DEV L24 ok';
END $$;
