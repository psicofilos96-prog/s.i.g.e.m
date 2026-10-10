-- LOTE 12 — leitura real agregada do fluxo 2026 (somente contagens, sem PII). Esperado = auditoria mestre.
with cur as (select * from class_enrollment_episodes e where not exists (select 1 from class_enrollment_episodes s where s.supersedes_id = e.id))
select
  (select count(*) from institutional_schools)                             as escolas,          -- 55
  (select count(*) from institutional_classes)                             as turmas,           -- 698
  (select count(*) from cur)                                               as vinculos_turma,   -- 10295
  (select count(distinct student_id) from cur)                             as alunos_distintos, -- 9763
  (select count(*) from school_enrollments)                                as matriculas,       -- 9811
  (select count(*) from student_school_day_observations)                   as jornada_decl,     -- 9692
  (select count(*) from student_school_day_intervals)                      as jornada_intervalos, -- 48092
  (select count(*) from staff_administrative_records)                      as pessoal_registros, -- 2016
  (select count(*) from school_infrastructure_observations)                as infra;            -- 2970
