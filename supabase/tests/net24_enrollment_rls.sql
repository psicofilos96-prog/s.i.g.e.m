-- Organização da Rede L24 — RLS/LGPD das entidades acadêmicas canônicas.
-- Somente leitura de catálogo: nada persiste. Falha com RAISE se algum papel
-- de sessão puder gravar diretamente ou se anon puder ler.
DO $$
DECLARE t text; r text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_enrollments','cycle_participations','class_enrollment_episodes',
    'class_enrollment_episode_endings','class_capacity_records','student_movement_events',
    'guardian_authorizations','institutional_students','allocation_curricular_positions'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.'||t)::regclass) THEN
      RAISE EXCEPTION 'net24: RLS desligada em %', t; END IF;
    IF has_table_privilege('anon', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION 'net24: anon lê %', t; END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
        IF has_table_privilege(r, 'public.'||t, p) THEN
          RAISE EXCEPTION 'net24: % tem % direto em %', r, p, t; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'net24: ok';
END $$;
