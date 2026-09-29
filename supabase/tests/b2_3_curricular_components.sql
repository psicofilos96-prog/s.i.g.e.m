-- B2.3 — Componentes curriculares. Termina SEMPRE em exceção: tudo desfeito.
DO $t$
DECLARE r text := E'\n'; c1 text; v1 uuid; v2 uuid; v3 uuid; n int; ok boolean; s text; nm text;
  A text := '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';
  B text := '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';
  C text := '{"sub":"00000000-0000-0000-0000-00000000cccc","role":"authenticated"}';
  D text := '{"sub":"00000000-0000-0000-0000-00000000dddd","role":"authenticated"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES
   ('00000000-0000-0000-0000-0000000000a1','Rede'),('00000000-0000-0000-0000-0000000000b1','Sem cap'),
   ('00000000-0000-0000-0000-0000000000c1','Vencida'),('00000000-0000-0000-0000-0000000000d1','Escola');
  INSERT INTO user_person_links(user_id, person_id) VALUES
   ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-00000000bbbb','00000000-0000-0000-0000-0000000000b1'),
   ('00000000-0000-0000-0000-00000000cccc','00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-00000000dddd','00000000-0000-0000-0000-0000000000d1');
  INSERT INTO institutional_schools(id) VALUES ('esc-t');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
   ('00000000-0000-0000-0000-0000000000a1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000b1','professor','escola','esc-t','2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000c1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01','2021-01-01'),
   ('00000000-0000-0000-0000-0000000000d1','cadastro-institucional-da-rede','escola','esc-t','2020-01-01',NULL);
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES ('00000000-0000-0000-0000-00000000c003','teste-b23',1,'draft','2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
   SELECT '00000000-0000-0000-0000-00000000c003', engagement_kind_id, capability_id, scope_dimensions FROM capability_policy_rules r
   JOIN capability_policies p ON p.id=r.policy_id WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=2;
  UPDATE capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000c003';

  FOREACH s IN ARRAY ARRAY[B,C,D] LOOP
    PERFORM set_config('request.jwt.claims', s, true);
    BEGIN PERFORM register_curricular_component_version(NULL,NULL,'X',NULL,true,'2026-01-01',NULL,'ato'); r := r || E'FALHA recusa\n';
    EXCEPTION WHEN others THEN r := r || 'ok 01-03 sem cap/vencida/alcance escola: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', A, true);
  c1 := register_curricular_component_version(NULL,NULL,'Língua Portuguesa','LP',true,'2020-01-01',NULL,'ato-1');
  SELECT id INTO v1 FROM curricular_component_versions WHERE component_id=c1 AND version=1;
  r := r || 'ok 04 criação (ID independente do nome): ' || (c1 LIKE 'comp-%' AND v1 IS NOT NULL)::text || E'\n';
  -- Referência histórica: atuação aponta para o ID.
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, component_id, valid_from) VALUES
   ('00000000-0000-0000-0000-0000000000b1','professor','escola','esc-t',c1,'2020-01-01');

  BEGIN PERFORM register_curricular_component_version(c1,v1,'Língua Portuguesa','LP',true,'2020-01-01','x','ato'); r := r || E'FALHA 05\n';
  EXCEPTION WHEN others THEN r := r || 'ok 05 sem alteração não versiona: ' || (SQLERRM LIKE '%no-change%')::text || E'\n'; END;
  BEGIN PERFORM register_curricular_component_version(c1,v1,'Português',NULL,true,'2025-01-01','','ato'); r := r || E'FALHA 06\n';
  EXCEPTION WHEN others THEN r := r || 'ok 06 motivo obrigatório: ' || (SQLERRM LIKE '%reason-required%')::text || E'\n'; END;
  BEGIN PERFORM register_curricular_component_version(c1,v1,'Português',NULL,true,'2019-01-01','m','ato'); r := r || E'FALHA 07\n';
  EXCEPTION WHEN others THEN r := r || 'ok 07 vigência anterior à base: ' || (SQLERRM LIKE '%valid-from-before-base%')::text || E'\n'; END;

  PERFORM register_curricular_component_version(c1,v1,'Língua Portuguesa e Literatura','LPL',true,'2025-01-01','renomeação','ato-2');
  SELECT id INTO v2 FROM curricular_component_versions WHERE component_id=c1 AND version=2;
  SELECT official_name='Língua Portuguesa' INTO ok FROM curricular_component_versions WHERE id=v1;
  r := r || 'ok 08 correção por nova versão, v1 preservada: ' || (ok AND v2 IS NOT NULL)::text || E'\n';
  BEGIN PERFORM register_curricular_component_version(c1,v1,'Outro',NULL,true,'2025-06-01','m','ato'); r := r || E'FALHA 09\n';
  EXCEPTION WHEN others THEN r := r || 'ok 09 versão substituída recusada: ' || (SQLERRM LIKE '%base-superseded%')::text || E'\n'; END;

  PERFORM register_curricular_component_version(c1,v2,'Língua Portuguesa e Literatura','LPL',false,'2026-01-01','inativação','ato-3');
  SELECT id INTO v3 FROM curricular_component_versions WHERE component_id=c1 AND version=3;
  PERFORM register_curricular_component_version(c1,v3,'Língua Portuguesa e Literatura','LPL',true,'2026-02-01','reativação','ato-4');
  SELECT count(*) INTO n FROM curricular_component_versions WHERE component_id=c1;
  r := r || 'ok 10 inativação e reativação como versões: ' || (n=4)::text || E'\n';

  SELECT official_name INTO nm FROM curricular_components_at('2022-05-01') WHERE component_id=c1;
  r := r || 'ok 11 denominação na data do fato (2022): ' || (nm='Língua Portuguesa')::text || E'\n';
  SELECT is_active INTO ok FROM curricular_components_at('2026-01-15') WHERE component_id=c1;
  r := r || 'ok 12 situação na data (inativo em jan/2026): ' || (NOT ok)::text || E'\n';
  SELECT count(*) INTO n FROM curricular_components_at('2019-01-01') WHERE component_id=c1;
  r := r || 'ok 13 antes da vigência nada existe: ' || (n=0)::text || E'\n';
  SELECT count(*) INTO n FROM institutional_engagements WHERE component_id=c1;
  r := r || 'ok 14 referência histórica intacta pelo ID: ' || (n=1)::text || E'\n';

  BEGIN UPDATE curricular_component_versions SET official_name='Z' WHERE id=v1; r := r || E'FALHA 15\n';
  EXCEPTION WHEN others THEN r := r || E'ok 15 versão não editável\n'; END;
  BEGIN DELETE FROM curricular_component_versions WHERE id=v1; r := r || E'FALHA 16\n';
  EXCEPTION WHEN others THEN r := r || E'ok 16 versão não apagável\n'; END;
  BEGIN UPDATE institutional_curricular_components SET label='Z' WHERE id=c1; r := r || E'FALHA 17\n';
  EXCEPTION WHEN others THEN r := r || E'ok 17 identidade imutável\n'; END;
  RAISE EXCEPTION 'RELATORIO:%', r;
END $t$;
