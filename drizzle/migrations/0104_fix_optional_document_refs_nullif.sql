-- Corrige 0103: NULLIF é construção SQL, não função de pg_catalog.
DO $mig$
DECLARE f record; d text; total int := 0;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_catalog.pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND pg_catalog.pg_get_functiondef(p.oid) LIKE '%pg_catalog.nullif(%' LOOP
    d := pg_catalog.replace(pg_catalog.pg_get_functiondef(f.oid), 'pg_catalog.nullif(', 'NULLIF(');
    EXECUTE d;
    total := total + 1;
  END LOOP;
  IF total < 22 THEN RAISE EXCEPTION '0104: esperadas >= 22 funções, corrigidas %', total; END IF;
END $mig$;