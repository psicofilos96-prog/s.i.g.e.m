-- AK — Estação da Direção: E2E transacional (termina em RAISE ⇒ rollback, nada persiste).
-- Conta autenticada sintética SEM capability (Direção sem poder / outra escola / IDOR):
-- todo reader consumido pelo painel deve recusar ou devolver vazio, e nenhuma linha muda.
DO $$
DECLARE s text; y text; n_before bigint; n_after bigint; r jsonb; k text; cnt int;
BEGIN
  SELECT school_id INTO s FROM public.institutional_school_record_versions LIMIT 1;
  SELECT id INTO y FROM public.institutional_academic_years LIMIT 1;
  SELECT (SELECT count(*) FROM public.school_communications) + (SELECT count(*) FROM public.school_pedagogical_records)
       + (SELECT count(*) FROM public.meal_service_records) + (SELECT count(*) FROM public.aee_services) INTO n_before;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN r := public.secretariat_overview_at(s, y, DATE '2027-03-10'); RAISE EXCEPTION 'leak secretariat';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  SELECT result_kind INTO k FROM public.diary_school_overview_at(s, DATE '2027-02-08', DATE '2027-03-10') LIMIT 1;
  IF k IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'leak diary %', k; END IF;
  SELECT result_kind INTO k FROM public.teaching_plans_overview_at(s, DATE '2027-03-10') LIMIT 1;
  IF k IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'leak plans %', k; END IF;
  BEGIN PERFORM * FROM public.school_communications_at(s); GET DIAGNOSTICS cnt = ROW_COUNT; IF cnt > 0 THEN RAISE EXCEPTION 'leak comm'; END IF;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.aee_services_at(s, NULL, NULL); GET DIAGNOSTICS cnt = ROW_COUNT; IF cnt > 0 THEN RAISE EXCEPTION 'leak aee'; END IF;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.meal_services_at(s, DATE '2027-02-08', DATE '2027-03-10', NULL); GET DIAGNOSTICS cnt = ROW_COUNT; IF cnt > 0 THEN RAISE EXCEPTION 'leak meals'; END IF;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.school_pedagogical_records_at(s, NULL, NULL, NULL, NULL); GET DIAGNOSTICS cnt = ROW_COUNT; IF cnt > 0 THEN RAISE EXCEPTION 'leak records'; END IF;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  SELECT count(*) INTO cnt FROM public.attendance_closing_versions; IF cnt > 0 THEN RAISE EXCEPTION 'leak closings'; END IF; -- RLS
  RESET ROLE;
  SELECT (SELECT count(*) FROM public.school_communications) + (SELECT count(*) FROM public.school_pedagogical_records)
       + (SELECT count(*) FROM public.meal_service_records) + (SELECT count(*) FROM public.aee_services) INTO n_after;
  IF n_after <> n_before THEN RAISE EXCEPTION 'indirect write'; END IF;
  RAISE EXCEPTION 'ak-e2e-ok: denied-all no-write';
END $$;
