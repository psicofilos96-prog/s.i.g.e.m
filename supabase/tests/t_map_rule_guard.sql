-- T — prova transacional (termina em ROLLBACK; nada persiste). Dados sintéticos.
BEGIN;
INSERT INTO public.map_competence_rules(id, version, status, valid_from, valid_until, definition)
VALUES ('t-sintetica', 1, 'rascunho', '2027-01-01', '2027-12-31', '{"coveredSchoolIds":["x"],"snapshotDate":{"kind":"dia-do-mes","day":10},"cells":[],"blockingCellIds":[]}');
DO $$ BEGIN
  BEGIN UPDATE public.map_competence_rules SET definition = '{}' WHERE id='t-sintetica';
    RAISE EXCEPTION 'falha: definição de rascunho alterada'; EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM LIKE 'falha%' THEN RAISE; END IF; END;
  BEGIN UPDATE public.map_competence_rules SET status='homologada' WHERE id='t-sintetica';
    RAISE EXCEPTION 'falha: homologada sem autoria'; EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM LIKE 'falha%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.map_competence_rules WHERE id='t-sintetica';
    RAISE EXCEPTION 'falha: regra apagada'; EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM LIKE 'falha%' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','public.record_map_competence_rule_draft(text,integer,date,date,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'falha: anon executa'; END IF;
  IF has_function_privilege('service_role','public.homologate_map_competence_rule(text,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'falha: service_role homologa'; END IF;
  IF has_function_privilege('service_role','public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid)','EXECUTE') THEN RAISE EXCEPTION 'falha: _actor ativo'; END IF;
  IF has_table_privilege('authenticated','public.statistical_map_versions','INSERT') THEN RAISE EXCEPTION 'falha: DML direto'; END IF;
  RAISE NOTICE 't-map-tests-ok';
END $$;
ROLLBACK;
