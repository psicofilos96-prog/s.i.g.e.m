-- B2.1 — Unidades escolares. Executado em transação com ROLLBACK: nada permanece.
BEGIN;
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
INSERT INTO public.institutional_persons(id, display_name) VALUES
 ('00000000-0000-0000-0000-0000000000a1','Cadastro rede'),('00000000-0000-0000-0000-0000000000b1','Sem capacidade'),
 ('00000000-0000-0000-0000-0000000000c1','Vencida'),('00000000-0000-0000-0000-0000000000d1','Alcance escola');
INSERT INTO public.user_person_links(user_id, person_id) VALUES
 ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000bbbb','00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000cccc','00000000-0000-0000-0000-0000000000c1'),
 ('00000000-0000-0000-0000-00000000dddd','00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.institutional_schools(id) VALUES ('esc-teste-escopo');
INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
 ('00000000-0000-0000-0000-0000000000a1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01',NULL),
 ('00000000-0000-0000-0000-0000000000b1','docencia','turma',NULL,'2020-01-01',NULL),
 ('00000000-0000-0000-0000-0000000000c1','cadastro-institucional-da-rede','rede',NULL,'2020-01-01','2021-01-01'),
 ('00000000-0000-0000-0000-0000000000d1','cadastro-institucional-da-rede','escola','esc-teste-escopo','2020-01-01',NULL);
INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES ('00000000-0000-0000-0000-00000000c001','teste-b21',1,'draft','2020-01-01');
INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
 VALUES ('00000000-0000-0000-0000-00000000c001','cadastro-institucional-da-rede','manter-cadastro-unidade-escolar','{network}');
UPDATE public.capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000c001';

\echo '01 sem capacidade — esperado capability:'
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}',true);
SELECT public.register_school_record_version(NULL,NULL,'X',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato',NULL,NULL);
\echo '02 atuação vencida — esperado capability:'
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000cccc","role":"authenticated"}',true);
SELECT public.register_school_record_version(NULL,NULL,'X',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato',NULL,NULL);
\echo '03 alcance escola (não rede) — esperado capability:'
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000dddd","role":"authenticated"}',true);
SELECT public.register_school_record_version('esc-teste-escopo',NULL,'X',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato',NULL,NULL);

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}',true);
\echo '04 criação com INEP e código com zeros à esquerda — esperado t'
SELECT public.register_school_record_version(NULL,NULL,'Escola Um',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-1','00012345','007') IS NOT NULL AS criada;
\echo '05 zeros preservados — esperado 00012345 e 007'
SELECT identifier_kind, value FROM public.institutional_school_identifiers i JOIN public.institutional_school_record_versions v ON v.school_id=i.school_id WHERE v.official_name='Escola Um' ORDER BY 1;
\echo '06 ausência continua ausência — esperado todos nulos'
SELECT address, district, location_kind, phone, institutional_email, own_building, hard_access, classroom_count FROM public.institutional_school_record_versions WHERE official_name='Escola Um';
\echo '07 INEP duplicado — esperado school:inep-in-use'
SELECT public.register_school_record_version(NULL,NULL,'Escola Dois',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-2','00012345',NULL);
\echo '08 código duplicado — esperado school:network-code-in-use'
SELECT public.register_school_record_version(NULL,NULL,'Escola Dois',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-2',NULL,'007');
\echo '09 falha não deixou resíduo — esperado 0'
SELECT count(*) FROM public.institutional_school_record_versions WHERE official_name='Escola Dois';
\echo '10 nova versão sem justificativa — esperado Justificativa obrigatória'
SELECT public.register_school_record_version((SELECT school_id FROM institutional_school_record_versions WHERE official_name='Escola Um'),(SELECT id FROM institutional_school_record_versions WHERE official_name='Escola Um'),'Escola Um Renomeada',NULL,NULL,'urbana',true,'2026-06-01',NULL,'ato-3',NULL,NULL);
\echo '11 nova versão com justificativa — esperado t'
SELECT public.register_school_record_version(s.school_id,s.id,'Escola Um Renomeada',NULL,NULL,'urbana',true,'2026-06-01','Lei de denominação','ato-3',NULL,NULL) IS NOT NULL FROM institutional_school_record_versions s WHERE official_name='Escola Um';
\echo '12 versão anterior preservada — esperado 2 linhas, v1 "Escola Um"'
SELECT version_number, official_name, supersedes_version_id IS NOT NULL AS encadeada FROM institutional_school_record_versions WHERE school_id=(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345') ORDER BY 1;
\echo '13 consulta pela vigência em 2026-03-01 — esperado Escola Um'
SELECT official_name FROM institutional_school_record_versions WHERE school_id=(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345') AND valid_from<='2026-03-01' ORDER BY version_number DESC LIMIT 1;
\echo '14 base superada — esperado Versão base superada'
SELECT public.register_school_record_version(s.school_id,s.id,'Outra',NULL,NULL,NULL,true,'2026-07-01','x','ato-4',NULL,NULL) FROM institutional_school_record_versions s WHERE version_number=1 AND official_name='Escola Um';
\echo '15 INEP não muda — esperado INEP divergente'
SELECT public.register_school_record_version(s.school_id,s.id,'Escola Um Renomeada',NULL,NULL,NULL,true,'2026-07-01','x','ato-4','99999999',NULL) FROM institutional_school_record_versions s WHERE version_number=2 AND official_name='Escola Um Renomeada';
\echo '16 inativação cria v3 — esperado t'
SELECT public.register_school_record_version(s.school_id,s.id,s.official_name,NULL,NULL,'urbana',false,'2026-12-01','Desativação','ato-5',NULL,NULL) IS NOT NULL FROM institutional_school_record_versions s WHERE version_number=2 AND official_name='Escola Um Renomeada';
\echo '17 histórico intacto e identificável — esperado 3 versões, identidade e INEP inalterados'
SELECT count(*), bool_and(school_id=(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345')) FROM institutional_school_record_versions WHERE school_id=(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345');
\echo '18 vigência antes da inativação continua ativa — esperado t'
SELECT active FROM institutional_school_record_versions WHERE school_id=(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345') AND valid_from<='2026-11-30' ORDER BY version_number DESC LIMIT 1;
\echo '19 imutabilidade de versão — esperado erro ou 0 linhas'
UPDATE institutional_school_record_versions SET official_name='adulterada' WHERE official_name='Escola Um';
\echo '20 vínculo por nome (unidade inexistente) — esperado school-link:unknown-school'
SELECT public.record_school_link(NULL,NULL,(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345'),'Escola Dois','anexo',1,'2026-01-01',NULL,'ato',NULL);
\echo '21 vínculo com tipo não homologado — esperado school-link:kind-not-homologated'
SELECT public.register_school_record_version(NULL,NULL,'Anexo A',NULL,NULL,NULL,true,'2026-01-01',NULL,'ato-6',NULL,NULL) IS NOT NULL;
SELECT public.record_school_link(NULL,NULL,(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345'),(SELECT school_id FROM institutional_school_record_versions WHERE official_name='Anexo A'),'tipo-inexistente',1,'2026-01-01',NULL,'ato',NULL);
\echo '22 vínculo com tipo homologado — esperado t'
INSERT INTO attribute_value_definitions(scheme_id,value_id,version,label,status,homologation_act_ref,valid_from) VALUES ('vinculo-entre-unidades','anexo-teste',1,'Anexo','homologated','ato-h','2020-01-01');
SELECT public.record_school_link(NULL,NULL,(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345'),(SELECT school_id FROM institutional_school_record_versions WHERE official_name='Anexo A'),'anexo-teste',1,'2026-01-01',NULL,'ato',NULL) IS NOT NULL;
\echo '23 vínculo sem capacidade — esperado capability:'
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}',true);
SELECT public.record_school_link(NULL,NULL,(SELECT school_id FROM institutional_school_identifiers WHERE value='00012345'),(SELECT school_id FROM institutional_school_record_versions WHERE official_name='Anexo A'),'anexo-teste',1,'2026-01-01',NULL,'ato',NULL);
ROLLBACK;
