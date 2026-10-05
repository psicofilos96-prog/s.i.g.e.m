-- 0099 — classificação administrativa (dependência/categoria/convênio). Termina SEMPRE em exceção: nada permanece.
DO $t$
DECLARE r text := E'\n'; v1 uuid; v2 uuid; ok boolean;
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a1','Teste');
  INSERT INTO user_person_links(user_id, person_id) VALUES ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from) VALUES ('00000000-0000-0000-0000-0000000000a1','administrador-geral-do-sigem','rede','2020-01-01');
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}',true);
  v1 := register_school_record_version('inep-99100012',NULL,'Teste Conveniada',NULL,NULL,'urbana',true,'2026-08-31',NULL,NULL,'99100012',NULL,'(22) 1; (22) 2','a@b.org',NULL,NULL,NULL,'privada','Confessional','Municipal');
  SELECT administrative_dependency='privada' AND private_school_category='Confessional' AND partnership_public_authority='Municipal' AND school_id='inep-99100012' INTO ok FROM institutional_school_record_versions WHERE id=v1;
  r := r || 'ok 01 classificação gravada como na fonte: ' || ok::text || E'\n';
  v2 := register_school_record_version('inep-99100012',v1,'Teste Conveniada',NULL,NULL,'urbana',true,'2026-09-01','x',NULL,NULL,NULL);
  SELECT administrative_dependency='privada' AND private_school_category='Confessional' INTO ok FROM institutional_school_record_versions WHERE id=v2;
  r := r || 'ok 02 herdada na nova versão (chamada antiga de 12 args): ' || ok::text || E'\n';
  SELECT count(*)=0 INTO ok FROM institutional_school_identifiers WHERE school_id='inep-99100012' AND identifier_kind='codigo-rede';
  r := r || 'ok 03 sem codigo-rede: ' || ok::text || E'\n';
  RAISE EXCEPTION 'RELATORIO-0099 %', r;
END $t$;
