-- B2.1 — Unidades escolares. Bloco único que termina SEMPRE em exceção:
-- tudo é desfeito e a mensagem final traz o relatório. Nada permanece.
DO $t$
DECLARE r text := E'\n'; sid text; v1 uuid; v2 uuid; v3 uuid; anexo text; n int; ok boolean; s text;
  A text := '{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}';
  B text := '{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}';
  C text := '{"sub":"00000000-0000-0000-0000-00000000cccc","role":"authenticated"}';
  D text := '{"sub":"00000000-0000-0000-0000-00000000dddd","role":"authenticated"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES
   ('00000000-0000-0000-0000-0000000000a1','Cadastro rede'),('00000000-0000-0000-0000-0000000000b1','Sem capacidade'),
   ('00000000-0000-0000-0000-0000000000c1','Vencida'),('00000000-0000-0000-0000-0000000000d1','Alcance escola');
  INSERT INTO user_person_links(user_id, person_id) VALUES
   ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-00000000bbbb','00000000-0000-0000-0000-0000000000b1'),
   ('00000000-0000-0000-0000-00000000cccc','00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-00000000dddd','00000000-0000-0000-0000-0000000000d1');
  INSERT INTO institutional_schools(id) VALUES ('esc-teste-escopo');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
   ('00000000-0000-0000-0000-0000000000a1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000b1','docencia',NULL,NULL,'2020-01-01',NULL),
   ('00000000-0000-0000-0000-0000000000c1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01','2021-01-01'),
   ('00000000-0000-0000-0000-0000000000d1','cadastro-institucional-da-rede','escola','esc-teste-escopo','2020-01-01',NULL);
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES ('00000000-0000-0000-0000-00000000c001','teste-b21',1,'draft','2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
   VALUES ('00000000-0000-0000-0000-00000000c001','cadastro-institucional-da-rede','manter-cadastro-unidade-escolar','{network}');
  UPDATE capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000c001';

  -- 01–03 recusas de autorização
  FOREACH s IN ARRAY ARRAY[B,C,D] LOOP
    PERFORM set_config('request.jwt.claims', s, true);
    BEGIN PERFORM register_school_record_version(CASE WHEN s=D THEN 'esc-teste-escopo' END,NULL,'X',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato',NULL,NULL);
      r := r || 'FALHA recusa ' || s || E'\n';
    EXCEPTION WHEN others THEN r := r || 'ok 01-03 recusa: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', A, true);
  -- 04 criação; 05 zeros; 06 ausência
  v1 := register_school_record_version(NULL,NULL,'Escola Um',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-1','00012345','007');
  SELECT school_id INTO sid FROM institutional_school_record_versions WHERE id=v1;
  r := r || 'ok 04 criada, id interno gerado: ' || (sid LIKE 'esc-%')::text || E'\n';
  SELECT string_agg(value, ',' ORDER BY identifier_kind) INTO s FROM institutional_school_identifiers WHERE school_id=sid;
  r := r || 'ok 05 zeros preservados (007,00012345): ' || (s = '007,00012345')::text || E'\n';
  SELECT (address IS NULL AND district IS NULL AND location_kind IS NULL AND phone IS NULL AND institutional_email IS NULL AND own_building IS NULL AND hard_access IS NULL AND classroom_count IS NULL) INTO ok FROM institutional_school_record_versions WHERE id=v1;
  r := r || 'ok 06 ausência permanece nula: ' || ok::text || E'\n';
  -- 07/08 duplicidades
  BEGIN PERFORM register_school_record_version(NULL,NULL,'Escola Dois',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-2','00012345',NULL); r := r || E'FALHA 07\n';
  EXCEPTION WHEN others THEN r := r || 'ok 07 INEP duplicado: ' || (SQLERRM LIKE '%inep-in-use%')::text || E'\n'; END;
  BEGIN PERFORM register_school_record_version(NULL,NULL,'Escola Dois',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-2',NULL,'007'); r := r || E'FALHA 08\n';
  EXCEPTION WHEN others THEN r := r || 'ok 08 código duplicado: ' || (SQLERRM LIKE '%network-code-in-use%')::text || E'\n'; END;
  SELECT count(*) INTO n FROM institutional_school_record_versions WHERE official_name='Escola Dois';
  r := r || 'ok 09 sem resíduo: ' || (n=0)::text || E'\n';
  -- 10/11 nova versão
  BEGIN PERFORM register_school_record_version(sid,v1,'Escola Um Renomeada',NULL,NULL,'urbana',true,'2026-06-01',NULL,'ato-3',NULL,NULL); r := r || E'FALHA 10\n';
  EXCEPTION WHEN others THEN r := r || 'ok 10 justificativa exigida: ' || (SQLERRM LIKE 'Justificativa%')::text || E'\n'; END;
  v2 := register_school_record_version(sid,v1,'Escola Um Renomeada',NULL,NULL,'urbana',true,'2026-06-01','Lei de denominação','ato-3',NULL,NULL);
  SELECT count(*) INTO n FROM institutional_school_record_versions WHERE school_id=sid;
  SELECT official_name='Escola Um' INTO ok FROM institutional_school_record_versions WHERE id=v1;
  r := r || 'ok 11-12 nova versão e anterior preservada: ' || (n=2 AND ok)::text || E'\n';
  SELECT official_name INTO s FROM institutional_school_record_versions WHERE school_id=sid AND valid_from<='2026-03-01' ORDER BY version_number DESC LIMIT 1;
  r := r || 'ok 13 vigência em 2026-03-01 = Escola Um: ' || (s='Escola Um')::text || E'\n';
  BEGIN PERFORM register_school_record_version(sid,v1,'Outra',NULL,NULL,NULL,true,'2026-07-01','x','ato-4',NULL,NULL); r := r || E'FALHA 14\n';
  EXCEPTION WHEN others THEN r := r || 'ok 14 base superada: ' || (SQLERRM LIKE 'Versão base superada%')::text || E'\n'; END;
  BEGIN PERFORM register_school_record_version(sid,v2,'Escola Um Renomeada',NULL,NULL,NULL,true,'2026-07-01','x','ato-4','99999999',NULL); r := r || E'FALHA 15\n';
  EXCEPTION WHEN others THEN r := r || 'ok 15 INEP não muda: ' || (SQLERRM LIKE 'INEP divergente%')::text || E'\n'; END;
  -- 16–18 inativação
  v3 := register_school_record_version(sid,v2,'Escola Um Renomeada',NULL,NULL,'urbana',false,'2026-12-01','Desativação','ato-5',NULL,NULL);
  SELECT count(*) INTO n FROM institutional_school_record_versions WHERE school_id=sid;
  SELECT active INTO ok FROM institutional_school_record_versions WHERE school_id=sid AND valid_from<='2026-11-30' ORDER BY version_number DESC LIMIT 1;
  r := r || 'ok 16-18 inativa como v3, história intacta, ativa antes da data: ' || (n=3 AND ok AND EXISTS(SELECT 1 FROM institutional_school_identifiers WHERE school_id=sid AND value='00012345'))::text || E'\n';
  -- 19 imutabilidade (como usuário autenticado)
  BEGIN SET LOCAL ROLE authenticated; UPDATE institutional_school_record_versions SET official_name='adulterada' WHERE id=v1; GET DIAGNOSTICS n = ROW_COUNT; RESET ROLE;
    r := r || 'ok 19 versão imutável (0 linhas): ' || (n=0)::text || E'\n';
  EXCEPTION WHEN others THEN RESET ROLE; r := r || E'ok 19 versão imutável (recusa)\n'; END;
  -- 20–23 vínculos
  BEGIN PERFORM record_school_link(NULL,NULL,sid,'Escola Dois','x',1,'2026-01-01',NULL,'ato',NULL); r := r || E'FALHA 20\n';
  EXCEPTION WHEN others THEN r := r || 'ok 20 associação por nome recusada: ' || (SQLERRM LIKE '%unknown-school%')::text || E'\n'; END;
  v3 := register_school_record_version(NULL,NULL,'Anexo A',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-6',NULL,NULL);
  SELECT school_id INTO anexo FROM institutional_school_record_versions WHERE id=v3;
  BEGIN PERFORM record_school_link(NULL,NULL,sid,anexo,'tipo-inexistente',1,'2026-01-01',NULL,'ato',NULL); r := r || E'FALHA 21\n';
  EXCEPTION WHEN others THEN r := r || 'ok 21 tipo não homologado: ' || (SQLERRM LIKE '%kind-not-homologated%')::text || E'\n'; END;
  INSERT INTO attribute_value_definitions(scheme_id,value_id,version,label,status,homologation_act_ref,valid_from) VALUES ('vinculo-entre-unidades','anexo-teste',1,'Anexo','homologada','ato-h','2020-01-01');
  r := r || 'ok 22 vínculo homologado registrado: ' || (record_school_link(NULL,NULL,sid,anexo,'anexo-teste',1,'2026-01-01',NULL,'ato',NULL) IS NOT NULL)::text || E'\n';
  PERFORM set_config('request.jwt.claims', B, true);
  BEGIN PERFORM record_school_link(NULL,NULL,sid,anexo,'anexo-teste',1,'2026-01-01',NULL,'ato',NULL); r := r || E'FALHA 23\n';
  EXCEPTION WHEN others THEN r := r || 'ok 23 vínculo sem capacidade: ' || (SQLERRM LIKE 'capability:%')::text || E'\n'; END;
  RAISE EXCEPTION 'RELATORIO-B21 %', r;
END $t$;
