-- B2.1.1 (0098) — referência documental opcional. Termina SEMPRE em exceção: nada permanece.
DO $t$
DECLARE r text := E'\n'; sid text; v1 uuid; v2 uuid; v3 uuid; s text; ok boolean;
  A text := '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a1','Cadastro rede');
  INSERT INTO user_person_links(user_id, person_id) VALUES ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until)
   VALUES ('00000000-0000-0000-0000-0000000000a1','administrador-geral-do-sigem','rede',NULL,'2020-01-01',NULL);
  PERFORM set_config('request.jwt.claims', A, true);
  -- 01 criação com NULL; 02 blank ⇒ NULL; 03 nova versão com NULL; 04 fonte real preservada
  v1 := register_school_record_version(NULL,NULL,'Teste Um',NULL,NULL,NULL,true,'2026-01-01',NULL,NULL,'99000001',NULL);
  SELECT school_id INTO sid FROM institutional_school_record_versions WHERE id=v1;
  SELECT (v.originating_act_ref IS NULL AND s2.originating_act_ref IS NULL AND i.originating_act_ref IS NULL
          AND v.authorizing_engagement_id IS NOT NULL AND v.capability_policy_id IS NOT NULL AND v.author_person_id IS NOT NULL) INTO ok
   FROM institutional_school_record_versions v JOIN institutional_schools s2 ON s2.id=v.school_id
   JOIN institutional_school_identifiers i ON i.school_id=v.school_id WHERE v.id=v1;
  r := r || 'ok 01 criação com NULL e auditoria: ' || ok::text || E'\n';
  v3 := register_school_record_version(NULL,NULL,'Teste Dois',NULL,NULL,NULL,true,'2026-01-01',NULL,'   ',NULL,NULL);
  SELECT originating_act_ref IS NULL INTO ok FROM institutional_school_record_versions WHERE id=v3;
  r := r || 'ok 02 blank normalizado: ' || ok::text || E'\n';
  v2 := register_school_record_version(sid,v1,'Teste Um B',NULL,NULL,NULL,true,'2026-06-01','correção',NULL,NULL,NULL);
  SELECT originating_act_ref IS NULL AND version_number=2 INTO ok FROM institutional_school_record_versions WHERE id=v2;
  r := r || 'ok 03 nova versão com NULL: ' || ok::text || E'\n';
  v3 := register_school_record_version(sid,v2,'Teste Um C',NULL,NULL,NULL,true,'2026-07-01','x','  Lei 1/2026  ',NULL,NULL);
  SELECT originating_act_ref INTO s FROM institutional_school_record_versions WHERE id=v3;
  r := r || 'ok 04 fonte preservada: ' || (s='Lei 1/2026')::text || E'\n';
  BEGIN PERFORM register_school_record_version(sid,v2,'X',NULL,NULL,NULL,true,'2026-08-01','x',NULL,NULL,NULL); r := r || E'FALHA 05\n';
  EXCEPTION WHEN others THEN r := r || 'ok 05 concorrência mantida: ' || (SQLERRM LIKE 'Versão base superada%')::text || E'\n'; END;
  BEGIN PERFORM register_school_record_version(NULL,NULL,'Y',NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,NULL); r := r || E'FALHA 06\n';
  EXCEPTION WHEN others THEN r := r || 'ok 06 vigência exigida: ' || (SQLERRM LIKE '%valid-from-required%')::text || E'\n'; END;
  BEGIN PERFORM register_school_record_version(NULL,NULL,'Z',NULL,NULL,NULL,true,'2026-01-01',NULL,NULL,'99000001',NULL); r := r || E'FALHA 07\n';
  EXCEPTION WHEN others THEN r := r || 'ok 07 INEP único: ' || (SQLERRM LIKE '%inep-in-use%')::text || E'\n'; END;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM register_school_record_version(NULL,NULL,'W',NULL,NULL,NULL,true,'2026-01-01',NULL,NULL,NULL,NULL); r := r || E'FALHA 08\n';
  EXCEPTION WHEN others THEN r := r || 'ok 08 sessão exigida: ' || (SQLERRM LIKE 'Sessão%')::text || E'\n'; END;
  RAISE EXCEPTION 'RELATORIO-B211 %', r;
END $t$;
