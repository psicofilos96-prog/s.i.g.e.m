-- Tecnologia L24 — prova SQL contra o banco vivo (somente leitura de catálogo; nada persiste).
-- Falha se: tabela tech_ sem RLS; anon com qualquer privilégio; authenticated com DML direta; função tech_ executável por anon.
DO $$
DECLARE _bad text;
BEGIN
  SELECT string_agg(c.relname, ',') INTO _bad FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'tech\_%' AND NOT c.relrowsecurity;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'sem RLS: %', _bad; END IF;
  SELECT string_agg(table_name || ':' || grantee || ':' || privilege_type, ',') INTO _bad FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name LIKE 'tech\_%'
     AND (grantee = 'anon' OR (grantee = 'authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')));
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'privilegio indevido: %', _bad; END IF;
  SELECT string_agg(p.proname, ',') INTO _bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE '%tech\_%' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'funcao anon: %', _bad; END IF;
  RAISE NOTICE 'tech24 ok';
END $$;
