-- 0103 — referência documental opcional (Frente A). Termina SEMPRE em exceção: tudo desfeito.
DO $t$
DECLARE r text := E'\n'; s1 text; s2 text; s3 text; v1 uuid; v2 uuid; n int; ok boolean; s text;
  A text := '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';
  B text := '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';
  C text := '{"sub":"00000000-0000-0000-0000-00000000cccc","role":"authenticated"}';
  D text := '{"sub":"00000000-0000-0000-0000-00000000dddd","role":"authenticated"}';
  E text := '{"sub":"00000000-0000-0000-0000-00000000eeee","role":"authenticated"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES
   ('00000000-0000-0000-0000-0000000000a1','Rede'),('00000000-0000-0000-0000-0000000000b1','Sem cap'),
   ('00000000-0000-0000-0000-0000000000c1','Vencida'),('00000000-0000-0000-0000-0000000000d1','Escola'),('00000000-0000-0000-0000-0000000000e1','Secretaria');
  INSERT INTO user_person_links(user_id, person_id) VALUES
   ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-00000000bbbb','00000000-0000-0000-0000-0000000000b1'),
   ('00000000-0000-0000-0000-00000000cccc','00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-00000000dddd','00000000-0000-0000-0000-0000000000d1'),
   ('00000000-0000-0000-0000-00000000eeee','00000000-0000-0000-0000-0000000000e1');
  INSERT INTO institutional_schools(id) VALUES ('esc-t');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
   ('00000000-0000-0000-0000-0000000000a1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000b1','professor','escola','esc-t','2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000c1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01','2021-01-01'),
   ('00000000-0000-0000-0000-0000000000d1','cadastro-institucional-da-rede','escola','esc-t','2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000e1','secretaria-escolar','escola','esc-t','2020-01-01',NULL);
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES ('00000000-0000-0000-0000-00000000c002','teste-b22',1,'draft','2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
   SELECT '00000000-0000-0000-0000-00000000c002', engagement_kind_id, capability_id, scope_dimensions FROM capability_policy_rules r
   JOIN capability_policies p ON p.id=r.policy_id WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=2;
  UPDATE capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000c002';
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES ('identificador-oficial-do-estudante','id-censo',1,'ID Censo','homologada'),('identificador-oficial-do-estudante','cpf',1,'CPF','rascunho');

  FOREACH s IN ARRAY ARRAY[B,C,D] LOOP
    PERFORM set_config('request.jwt.claims', s, true);
    BEGIN PERFORM register_student('X',NULL,NULL,NULL,NULL,'[]','ato'); r := r || E'FALHA recusa\n';
    EXCEPTION WHEN others THEN r := r || 'ok 01-03 recusa sem cap/vencida/escopo escola: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', A, true);
  s1 := register_student('Ana Ref Nula',NULL,NULL,NULL,NULL,'[]',NULL);
  SELECT count(*) INTO n FROM student_identity_versions WHERE student_id=s1 AND originating_act_ref IS NULL;
  r := r || 'ok A1 estudante sem referência (NULL) grava com NULL: ' || (n=1)::text || E'\n';
  s2 := register_student('Bia Ref Branca',NULL,NULL,NULL,NULL,'[]','   ');
  SELECT count(*) INTO n FROM student_identity_versions WHERE student_id=s2 AND originating_act_ref IS NULL;
  r := r || 'ok A2 branco normaliza para NULL: ' || (n=1)::text || E'\n';
  s3 := register_student('Caio Com Fonte',NULL,NULL,NULL,NULL,'[]','Planilha EducaCenso 2026');
  SELECT count(*) INTO n FROM student_identity_versions WHERE student_id=s3 AND originating_act_ref='Planilha EducaCenso 2026';
  r := r || 'ok A3 fonte informada preservada como proveniência: ' || (n=1)::text || E'\n';
  PERFORM set_config('request.jwt.claims', B, true);
  BEGIN PERFORM register_student('Sem cap',NULL,NULL,NULL,NULL,'[]',NULL); r := r || E'FALHA A4\n';
  EXCEPTION WHEN others THEN r := r || 'ok A4 sem capability continua recusado: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM register_student('Sem sessão',NULL,NULL,NULL,NULL,'[]',NULL); r := r || E'FALHA A5\n';
  EXCEPTION WHEN others THEN r := r || E'ok A5 sem sessão continua recusado: true\n'; END;
  SELECT count(*) INTO n FROM pg_proc WHERE pronamespace='public'::regnamespace AND pg_get_functiondef(oid) ~ 'act-required'
    AND proname NOT IN ('install_sigem','register_assessment_results');
  r := r || 'ok A6 nenhum gate act-required fora da história/retificação: ' || (n=0)::text || E'\n';
  RAISE EXCEPTION '%', r;
END $t$;
