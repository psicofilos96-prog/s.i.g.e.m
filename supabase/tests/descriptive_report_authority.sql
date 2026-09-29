-- Executado dentro de transação com ROLLBACK: nenhum dado fictício permanece.
BEGIN;
\set ON_ERROR_STOP 0
INSERT INTO public.institutional_persons(id, display_name) VALUES
 ('00000000-0000-0000-0000-0000000000a1','A'),('00000000-0000-0000-0000-0000000000b1','B');
INSERT INTO public.user_person_links VALUES
 ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000bbbb','00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, class_id, valid_from) VALUES
 ('00000000-0000-0000-0000-0000000000a1','docencia-ei','T1','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000b1','docencia-ei','T1','2020-01-01');
INSERT INTO public.capability_policies(id, logical_policy_id, version, status) VALUES ('00000000-0000-0000-0000-00000000c001','teste',1,'draft');
INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
 VALUES ('00000000-0000-0000-0000-00000000c001','docencia-ei','oficializar-parecer-descritivo','{class}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}',true);
\echo '1 falha fechada (política em rascunho) — esperado capability-missing'
SELECT public.officialize_descriptive_report('S1','T1','P1',NULL,'texto',ARRAY['bncc:EI01CG01'],'');
RESET ROLE;
UPDATE public.capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000c001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000aaaa","role":"authenticated"}',true);
\echo '2 v1 oficializada'
SELECT public.officialize_descriptive_report('S1','T1','P1',NULL,'texto',ARRAY['bncc:EI01CG01'],'') IS NOT NULL AS v1;
\echo '3 isolamento de turma — esperado capability-missing'
SELECT public.officialize_descriptive_report('S1','T2','P1',NULL,'texto',NULL,'');
\echo '4 concorrência: B tenta a partir de base nula — esperado concurrent-change'
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000bbbb","role":"authenticated"}',true);
SELECT public.officialize_descriptive_report('S1','T1','P1',NULL,'outro',NULL,'');
\echo '5 correção v2 a partir da vigente'
SELECT public.officialize_descriptive_report('S1','T1','P1',(SELECT id FROM public.descriptive_report_versions WHERE version_number=1 AND logical_report_id='parecer:S1|T1|P1'),'texto 2',NULL,'ajuste') IS NOT NULL AS v2;
\echo '6 imutabilidade — esperado 0 linhas alteradas ou erro'
UPDATE public.descriptive_report_versions SET report_text='x';
\echo '7 cadeia'
SELECT version_number, supersedes_version_id IS NOT NULL AS encadeada FROM public.descriptive_report_versions ORDER BY 1;
ROLLBACK;
