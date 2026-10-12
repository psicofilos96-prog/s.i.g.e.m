-- SIGEM Documentos L24: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text; bad int;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_numbering_rules','document_number_allocations','protocol_registrations','protocol_registration_events',
    'admin_case_files','admin_case_events','admin_case_dispatches','admin_case_dispatch_events','admin_case_inbox_acts','admin_case_acts',
    'admin_case_act_versions','admin_act_reviews','admin_act_signatures','admin_case_archival_events','admin_case_digitizations',
    'admin_case_access_grants','admin_case_sensitive_documents','admin_case_sensitive_access_log','admin_case_origin_links'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.admin_case_events', 'document_ref', 'SELECT') THEN RAISE EXCEPTION 'referência de anexo legível direto'; END IF;
  RAISE EXCEPTION 'doc24-ok';
END $$;
