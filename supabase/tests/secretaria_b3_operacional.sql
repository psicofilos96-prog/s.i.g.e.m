-- Secretaria Escolar (pós-Diário) — regressão sem fixture: DML direto bloqueado, escritores
-- fechados sem sessão/capacidade, readers falham fechados e nada fica gravado.
-- O bloco termina com RAISE (transação descartada). Sucesso = 'secretaria-b3-ok'.
DO $sec$
DECLARE
  t text; f text; n_before bigint; n_after bigint;
  u text := '{"sub":"00000000-0000-0000-0000-00000005ec01","role":"authenticated"}';
BEGIN
  SELECT (SELECT count(*) FROM public.school_enrollments) + (SELECT count(*) FROM public.cycle_participations)
       + (SELECT count(*) FROM public.class_enrollment_episodes) + (SELECT count(*) FROM public.student_movement_events)
       + (SELECT count(*) FROM public.class_capacity_records) INTO n_before;

  FOREACH t IN ARRAY ARRAY['school_enrollments','cycle_participations','class_enrollment_episodes','class_allocation_ending_versions',
    'cycle_enrollment_ending_versions','student_movement_events','class_capacity_records','allocation_curricular_positions'] LOOP
    IF has_table_privilege('authenticated', 'public.'||t, 'INSERT') OR has_table_privilege('authenticated', 'public.'||t, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.'||t, 'DELETE') OR has_table_privilege('anon', 'public.'||t, 'INSERT')
      OR has_table_privilege('anon', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION 'direct-dml-open:%', t;
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY['constitute_cycle_enrollment','declare_cycle_participation','record_class_allocation_ending',
    'record_class_capacity','record_cycle_enrollment_ending','record_student_movement'] LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
               WHERE s.nspname = 'public' AND p.proname = f AND has_function_privilege('anon', p.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'anon-exec:%', f;
    END IF;
  END LOOP;

  -- Sem sessão: recusa.
  BEGIN
    PERFORM public.record_student_movement('mov-t', NULL, 'stu-x', NULL, 'tipo-x', 1, '2027-03-01', '{"schoolId":"esc-x"}', '{}', NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'movement-without-session-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'movement:%' THEN RAISE; END IF; END;

  -- Conta autenticada sem atuação: tipo não homologado ou capacidade ausente — nunca grava.
  PERFORM set_config('request.jwt.claims', u, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.record_student_movement('mov-t', NULL, 'stu-x', NULL, 'tipo-x', 1, '2027-03-01', '{"schoolId":"esc-x"}', '{}', NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'movement-without-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'movement:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.constitute_cycle_enrollment('insc-t', 'stu-x', 'esc-x', 'ano-x', '2027-02-01', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'enrollment-without-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%accepted%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.school_enrollments(id) VALUES ('insc-direto');
    RAISE EXCEPTION 'direct-insert-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.student_movements_known(NULL, NULL);
    RAISE EXCEPTION 'reader-null-school-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'movement:query-arguments-required%' THEN RAISE; END IF; END;
  RESET ROLE;

  SELECT (SELECT count(*) FROM public.school_enrollments) + (SELECT count(*) FROM public.cycle_participations)
       + (SELECT count(*) FROM public.class_enrollment_episodes) + (SELECT count(*) FROM public.student_movement_events)
       + (SELECT count(*) FROM public.class_capacity_records) INTO n_after;
  IF n_after <> n_before THEN RAISE EXCEPTION 'residue:% -> %', n_before, n_after; END IF;

  RAISE EXCEPTION 'secretaria-b3-ok';
END $sec$;
