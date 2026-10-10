-- AUD2026.MASTER — auditoria mestre 2026, SOMENTE LEITURA, sem PII (só INEP e contagens).
-- Fonte oficial: census_official_receipt_snapshots (última versão por escola) e class_census_declarations.
-- Leitor: precisa de SELECT em institutional_classes (o papel restrito do psql do sandbox NÃO tem; falha fechada).
-- Saída 1: linhas "school|inep|indicador|oficial|base|status". Saída 2: "assert|nome|valor" (valor≠0 = falha).
\set ON_ERROR_STOP on
\pset footer off
with rec as (
  select distinct on (r.school_id) r.school_id, r.inep, r.measures from public.census_official_receipt_snapshots r
  where r.census_year = '2026' order by r.school_id, r.version desc
), ep as (
  select e.* from public.class_enrollment_episodes e
  where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)
), en as (
  select s.* from public.school_enrollments s
  where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id)
), aee_cls as (
  select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'
), base as (
  select rec.school_id, rec.inep, rec.measures,
    (select count(*) from public.institutional_classes c where c.school_id = rec.school_id) turmas,
    (select count(distinct student_id) from en where en.school_id = rec.school_id) alunos,
    (select count(*) from ep where ep.school_id = rec.school_id) matriculas,
    (select count(*) from ep where ep.school_id = rec.school_id and ep.class_id in (select class_id from aee_cls)) aee,
    (select count(distinct person_id) from public.professional_census_declarations p where p.school_id = rec.school_id and p.function_literal ilike 'docente%') docentes,
    (select count(*) from public.school_infrastructure_observations i where i.school_id = rec.school_id) infra,
    (select count(*) from public.student_school_day_intervals d join public.student_school_day_observations o on o.id = d.observation_id where o.school_id = rec.school_id) jornada_intervalos
  from rec
)
select 'school', inep, k, oficial, valor, case when oficial is null then 'NAO_COMPARAVEL' when oficial = valor then 'MATCH' else 'DIFF' end
from base, lateral (values
  ('turmas', (measures->'turmas'->>'value')::int, turmas),
  ('alunos', (measures->'alunos'->>'value')::int, alunos),
  ('matriculas_total', (measures->'matriculas_total'->>'value')::int, matriculas),
  ('matriculas_aee', (measures->'matriculas_aee'->>'value')::int, aee),
  ('profissionais_docentes', (measures->'profissionais_docentes'->>'value')::int, docentes),
  ('infraestrutura_observacoes', null::int, infra),
  ('jornada_intervalos', null::int, jornada_intervalos)
) v(k, oficial, valor)
order by inep, k;

-- Asserts (0 = ok)
with ep as (select e.* from public.class_enrollment_episodes e where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
     en as (select s.* from public.school_enrollments s where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id)),
     q as (select class_id, value_text::int q from public.class_census_declarations where field = 'Quantidade de Alunos (as)' and value_text ~ '^[0-9]+$')
select 'assert', n, v from (values
 ('escolas_sem_recibo_2026', (select count(*) from public.institutional_schools s where not exists (select 1 from public.census_official_receipt_snapshots r where r.school_id = s.id and r.census_year = '2026'))),
 ('escolas_sem_inep', (select count(*) from public.institutional_schools s where not exists (select 1 from public.institutional_school_identifiers i where i.school_id = s.id and i.identifier_kind ilike '%inep%'))),
 ('inep_recibo_difere_cadastro', (select count(*) from public.census_official_receipt_snapshots r where not exists (select 1 from public.institutional_school_identifiers i where i.school_id = r.school_id and i.identifier_kind ilike '%inep%' and i.value = r.inep))),
 ('turma_qtd_alunos_difere_episodios', (select count(*) from q where q.q <> (select count(*) from ep where ep.class_id = q.class_id))),
 ('turma_sem_declaracao_qtd', (select count(*) from public.institutional_classes c where not exists (select 1 from q where q.class_id = c.id))),
 ('episodio_turma_orfa', (select count(*) from ep where not exists (select 1 from public.institutional_classes c where c.id = ep.class_id))),
 ('episodio_escola_difere_turma', (select count(*) from ep join public.institutional_classes c on c.id = ep.class_id where c.school_id <> ep.school_id)),
 ('episodio_sem_matricula', (select count(*) from ep where not exists (select 1 from public.school_enrollments s where s.id = ep.enrollment_id))),
 ('episodio_escola_difere_matricula', (select count(*) from ep join public.school_enrollments s on s.id = ep.enrollment_id where s.school_id <> ep.school_id)),
 ('matricula_sem_episodio', (select count(*) from en where not exists (select 1 from ep where ep.enrollment_id = en.id))),
 ('dup_aluno_turma', (select count(*) from (select student_id, class_id from ep group by 1,2 having count(*) > 1) t)),
 ('dup_aluno_escola', (select count(*) from (select student_id, school_id from en group by 1,2 having count(*) > 1) t)),
 ('aluno_sem_matricula', (select count(*) from public.institutional_students s where not exists (select 1 from en where en.student_id = s.id))),
 ('declaracao_profissional_turma_orfa', (select count(*) from public.professional_census_declarations p where p.class_id is not null and not exists (select 1 from public.institutional_classes c where c.id = p.class_id))),
 ('infra_escola_sem_observacao', (select count(*) from public.institutional_schools s where not exists (select 1 from public.school_infrastructure_observations i where i.school_id = s.id))),
 ('infra_com_autoria_humana_tecnica', (select count(*) from public.school_infrastructure_observations where technical_operation_id is not null and (author_user_id is not null or author_person_id is not null))),
 ('jornada_obs_turma_orfa', (select count(*) from public.student_school_day_observations o where o.class_id is not null and not exists (select 1 from public.institutional_classes c where c.id = o.class_id))),
 ('jornada_obs_escola_difere_turma', (select count(*) from public.student_school_day_observations o join public.institutional_classes c on c.id = o.class_id where c.school_id <> o.school_id)),
 ('escola_com_matricula_sem_jornada_turma', (select count(*) from public.institutional_schools s where exists (select 1 from public.class_enrollment_episodes e where e.school_id = s.id) and not exists (select 1 from public.student_school_day_observations o where o.school_id = s.id))),
 ('jornada_intervalo_invertido', (select count(*) from public.student_school_day_intervals where ends_at <= starts_at))
) a(n, v);

-- Totais de rede
select 'total', k, v from (values
 ('escolas', (select count(*) from public.institutional_schools)),
 ('turmas', (select count(*) from public.institutional_classes)),
 ('alunos_distintos', (select count(distinct student_id) from public.school_enrollments)),
 ('matriculas_escolares', (select count(*) from public.school_enrollments s where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id))),
 ('episodios_turma', (select count(*) from public.class_enrollment_episodes e where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id))),
 ('declaracoes_profissionais', (select count(*) from public.professional_census_declarations)),
 ('profissionais_distintos', (select count(distinct person_id) from public.professional_census_declarations)),
 ('infra_observacoes', (select count(*) from public.school_infrastructure_observations)),
 ('jornada_intervalos_turma', (select count(*) from public.student_school_day_intervals)),
 ('jornadas_profissionais', (select count(*) from public.professional_schedule_declarations))
) t(k, v);
