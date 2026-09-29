-- B2.2 — Cadastro institucional de estudantes. Termina SEMPRE em exceção: tudo desfeito.
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
  s1 := register_student('Maria Souza',NULL,'2014-03-02',NULL,NULL,'[{"kind":"id-censo","version":1,"value":"123"}]','ato-1');
  SELECT count(*) INTO n FROM student_identity_versions WHERE student_id=s1;
  r := r || 'ok 04 criação v1: ' || (n=1)::text || E'\n';
  SELECT count(*) INTO n FROM school_enrollments WHERE student_id=s1; SELECT n + count(*) INTO n FROM class_enrollment_episodes WHERE student_id=s1;
  r := r || 'ok 05 sem matrícula/enturmação: ' || (n=0)::text || E'\n';
  SELECT (sex_value_id IS NULL AND social_name IS NULL) INTO ok FROM student_identity_versions WHERE student_id=s1;
  r := r || 'ok 06 ausência não preenchida: ' || ok::text || E'\n';
  SELECT count(*) INTO n FROM institutional_students WHERE id=s1;
  r := r || 'ok 07 consulta pela rede: ' || (n=1)::text || E'\n';
  BEGIN PERFORM register_student('Outra',NULL,NULL,NULL,NULL,'[{"kind":"id-censo","version":1,"value":"123"}]','ato'); r := r || E'FALHA 08\n';
  EXCEPTION WHEN others THEN r := r || 'ok 08 identificador duplicado: ' || (SQLERRM LIKE '%identifier-in-use%')::text || E'\n'; END;
  s2 := register_student('Maria Souza',NULL,'2014-03-02',NULL,NULL,'[{"kind":"id-censo","version":1,"value":"456"}]','ato-2');
  s3 := register_student('Maria Souza',NULL,NULL,NULL,NULL,'[]','ato-3');
  r := r || 'ok 09 homônimos distintos e sem identificador aceitos: ' || (s1<>s2 AND s2<>s3)::text || E'\n';
  BEGIN PERFORM register_student('Y',NULL,NULL,NULL,NULL,'[{"kind":"cpf","version":1,"value":"1"}]','ato'); r := r || E'FALHA 10\n';
  EXCEPTION WHEN others THEN r := r || 'ok 10 catálogo não homologado (identificador): ' || (SQLERRM LIKE '%catalog-not-homologated%')::text || E'\n'; END;
  BEGIN PERFORM register_student('Y',NULL,NULL,'feminino',1,'[]','ato'); r := r || E'FALHA 11\n';
  EXCEPTION WHEN others THEN r := r || 'ok 11 catálogo de sexo vazio recusado: ' || (SQLERRM LIKE '%catalog-not-homologated%')::text || E'\n'; END;
  SELECT id INTO v1 FROM student_identity_versions WHERE student_id=s1;
  BEGIN PERFORM record_student_identity_version(s1,v1,'Maria Souza',NULL,'2014-03-02',NULL,NULL,'x','ato'); r := r || E'FALHA 12\n';
  EXCEPTION WHEN others THEN r := r || 'ok 12 correção sem alteração recusada: ' || (SQLERRM LIKE '%no-change%')::text || E'\n'; END;
  v2 := record_student_identity_version(s1,v1,'Maria de Souza',NULL,'2014-03-02',NULL,NULL,'Certidão','ato-4');
  SELECT civil_name='Maria Souza' INTO ok FROM student_identity_versions WHERE id=v1;
  r := r || 'ok 13 nova versão, anterior preservada: ' || (ok AND v2 IS NOT NULL)::text || E'\n';
  BEGIN PERFORM record_student_identity_version(s1,v1,'Z',NULL,NULL,NULL,NULL,'x','ato'); r := r || E'FALHA 14\n';
  EXCEPTION WHEN others THEN r := r || 'ok 14 base superada: ' || (SQLERRM LIKE '%base-superseded%')::text || E'\n'; END;
  BEGIN UPDATE student_official_identifiers SET value='9' WHERE student_id=s1; r := r || E'FALHA 15\n';
  EXCEPTION WHEN others THEN r := r || E'ok 15 identificador imutável\n'; END;

  PERFORM set_config('request.jwt.claims', E, true);
  SELECT count(*) INTO n FROM institutional_students WHERE id=s1;
  r := r || 'ok 16 secretaria sem matrícula não navega: ' || (n=0)::text || E'\n';
  SELECT count(*) INTO n FROM locate_student_for_enrollment('id-censo','123');
  SELECT count(*) INTO ok FROM locate_student_for_enrollment('id-censo','123') WHERE display_name='Maria de Souza';
  r := r || 'ok 17 busca mínima por identificador exato: ' || (n=1)::text || E'\n';
  SELECT count(*) INTO n FROM locate_student_for_enrollment('id-censo','12');
  r := r || 'ok 18 sem busca parcial/nome: ' || (n=0)::text || E'\n';
  BEGIN PERFORM record_student_identity_version(s1,v2,'W',NULL,NULL,NULL,NULL,'x','ato'); r := r || E'FALHA 19\n';
  EXCEPTION WHEN others THEN r := r || 'ok 19 secretaria sem matrícula não corrige: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  PERFORM set_config('request.jwt.claims', B, true);
  BEGIN PERFORM locate_student_for_enrollment('id-censo','123'); r := r || E'FALHA 20\n';
  EXCEPTION WHEN others THEN r := r || E'ok 20 professor não localiza\n'; END;
  RAISE EXCEPTION 'RELATORIO:%', r;
END $t$;
