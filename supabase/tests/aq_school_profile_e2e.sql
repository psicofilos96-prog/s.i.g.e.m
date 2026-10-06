-- AQ — Ficha institucional. Bloco único que termina SEMPRE em RAISE ⇒ rollback integral.
-- versão cadastral → mudança → histórico → infraestrutura true/false/sem observação →
-- outra escola/IDOR → base superada → papel técnico recusado.
DO $t$
DECLARE r text := E'\n'; v1 uuid; v2 uuid; n int; ok boolean;
  A text := '{"sub":"00000000-0000-0000-0000-0000000a90aa","role":"authenticated"}';
  B text := '{"sub":"00000000-0000-0000-0000-0000000a90bb","role":"authenticated"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES
   ('00000000-0000-0000-0000-0000000a90a1','AQ rede'),('00000000-0000-0000-0000-0000000a90b1','AQ escola B');
  INSERT INTO user_person_links(user_id, person_id) VALUES
   ('00000000-0000-0000-0000-0000000a90aa','00000000-0000-0000-0000-0000000a90a1'),('00000000-0000-0000-0000-0000000a90bb','00000000-0000-0000-0000-0000000a90b1');
  INSERT INTO institutional_schools(id) VALUES ('aq-esc-b');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
   ('00000000-0000-0000-0000-0000000a90a1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01'),
   ('00000000-0000-0000-0000-0000000a90b1','cadastro-institucional-da-rede','escola','aq-esc-b','2020-01-01');
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES ('00000000-0000-0000-0000-00000000a9c1','teste-aq',1,'draft','2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
   VALUES ('00000000-0000-0000-0000-00000000a9c1','cadastro-institucional-da-rede','manter-cadastro-unidade-escolar','{network}');
  UPDATE capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000a9c1';

  PERFORM set_config('request.jwt.claims', A, true);
  v1 := register_school_record_version(NULL,NULL,'AQ Escola',NULL,NULL,'urbana',true,'2026-01-01',NULL,'decisao-teste','99999901',NULL,
          NULL,NULL,true,NULL,4,NULL,NULL,NULL,NULL);
  SELECT school_id INTO r FROM institutional_school_record_versions WHERE id=v1; r := E'\n' || 'ok 01 versão 1 criada' || E'\n';
  v2 := register_school_record_version((SELECT school_id FROM institutional_school_record_versions WHERE id=v1),v1,'AQ Escola Renomeada',NULL,'Centro','urbana',true,'2026-06-01','renomeação','decisao-teste',NULL,NULL,
          NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
  SELECT count(*) INTO n FROM institutional_school_record_versions WHERE school_id=(SELECT school_id FROM institutional_school_record_versions WHERE id=v1);
  r := r || 'ok 02 mudança preserva histórico: ' || (n=2)::text || E'\n';
  SELECT own_building IS NULL AND classroom_count IS NULL INTO ok FROM institutional_school_record_versions WHERE id=v2;
  r := r || 'ok 03 versão é retrato completo; omitido = não informado (NULL, nunca falso): ' || coalesce(ok,false)::text || E'\n';
  BEGIN PERFORM register_school_record_version((SELECT school_id FROM institutional_school_record_versions WHERE id=v1),v1,'Stale',NULL,NULL,NULL,true,'2026-07-01','x','d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    r := r || E'FALHA 04 base superada aceita\n';
  EXCEPTION WHEN others THEN r := r || 'ok 04 base superada recusada: ' || (SQLERRM ILIKE '%superada%')::text || E'\n'; END;

  PERFORM set_config('request.jwt.claims', B, true);
  BEGIN PERFORM register_school_record_version((SELECT school_id FROM institutional_school_record_versions WHERE id=v1),v2,'IDOR',NULL,NULL,NULL,true,'2026-08-01','x','d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    r := r || E'FALHA 05 outra escola alterou\n';
  EXCEPTION WHEN others THEN r := r || 'ok 05 outra escola/IDOR recusado: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;

  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM register_school_record_version(NULL,NULL,'Tecnico',NULL,NULL,NULL,true,'2026-01-01',NULL,'d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    r := r || E'FALHA 06 sem sessão gravou\n';
  EXCEPTION WHEN others THEN r := r || E'ok 06 papel técnico/sem pessoa recusado\n'; END;
  BEGIN PERFORM record_school_infrastructure_observation('aq-esc-b','agua','true'::jsonb,'2026-01-01',repeat('a',64),'x',NULL);
    r := r || E'FALHA 07 infraestrutura gravada sem pessoa\n';
  EXCEPTION WHEN others THEN r := r || E'ok 07 observação de infraestrutura sem pessoa recusada\n'; END;

  -- infraestrutura real importada: sim/não existem; ausência não é linha
  SELECT count(*) FILTER (WHERE value_boolean) > 0 AND count(*) FILTER (WHERE value_boolean = false) > 0 INTO ok FROM school_infrastructure_observations;
  r := r || 'ok 08 fonte tem sim e não distintos: ' || coalesce(ok,false)::text || E'\n';
  SELECT count(*) INTO n FROM school_infrastructure_observations WHERE num_nonnulls(value_boolean,value_integer,value_decimal,value_text,value_catalog) <> 1;
  r := r || 'ok 09 nenhuma observação vazia (ausência = sem linha): ' || (n=0)::text || E'\n';
  RAISE EXCEPTION 'RELATORIO-AQ %', r;
END $t$;
