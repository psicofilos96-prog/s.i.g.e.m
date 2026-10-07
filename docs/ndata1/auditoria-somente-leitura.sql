-- NDATA.1 — somente leitura. Rodar: psql -At -F'|' -f docs/ndata1/auditoria-somente-leitura.sql
select 'baseline.escolas', count(*) from public.institutional_schools;
select 'baseline.pessoas', count(*) from public.institutional_persons;
select 'baseline.vinculos', count(*) from public.institutional_engagements;
select 'baseline.turmas', count(*) from public.institutional_classes;
select 'baseline.alunos', count(*) from public.institutional_students;
select 'baseline.matriculas_versoes', count(*) from public.school_enrollments;
select 'baseline.episodios_versoes', count(*) from public.class_enrollment_episodes;
select 'baseline.participacoes_versoes', count(*) from public.cycle_participations;
select 'baseline.composicoes', count(*) from public.class_composition_versions;
select 'baseline.posicoes', count(*) from public.allocation_curricular_positions;
select 'baseline.calendarios', count(*) from public.calendar_versions;
select 'baseline.politicas_capacidade', count(*) from public.capability_policies;
-- órfãos / referências
select 'orfao.aluno_sem_pessoa', count(*) from public.institutional_students s where not exists (select 1 from public.institutional_student_persons p where p.student_id=s.id);
select 'orfao.matricula_aluno_inexistente', count(*) from public.school_enrollments e where not exists (select 1 from public.institutional_students s where s.id=e.student_id);
select 'orfao.matricula_escola_inexistente', count(*) from public.school_enrollments e where not exists (select 1 from public.institutional_schools s where s.id=e.school_id);
select 'orfao.episodio_turma_inexistente', count(*) from public.class_enrollment_episodes e where not exists (select 1 from public.institutional_classes c where c.id=e.class_id);
select 'orfao.vinculo_pessoa_inexistente', count(*) from public.institutional_engagements g where not exists (select 1 from public.institutional_persons p where p.id=g.person_id);
-- escopo de escola
select 'escopo.episodio_escola_difere_turma', count(*) from public.class_enrollment_episodes e join public.institutional_classes c on c.id=e.class_id where c.school_id<>e.school_id;
select 'escopo.vinculo_escola_difere_turma', count(*) from public.institutional_engagements g join public.institutional_classes c on c.id=g.class_id where g.school_id is not null and c.school_id<>g.school_id;
-- datas impossíveis
select 'data.vinculo_fim_antes_inicio', count(*) from public.institutional_engagements where valid_until < valid_from;
select 'data.participacao_fim_antes_inicio', count(*) from public.cycle_participations where valid_until < valid_from;
select 'data.encerramento_antes_inicio', count(*) from public.class_enrollment_episode_endings x join public.class_enrollment_episodes e on e.id=x.episode_id where x.ended_on < e.valid_from;
select 'data.matricula_futura_ou_antiga', count(*) from public.school_enrollments where opened_on > current_date + 400 or opened_on < date '1950-01-01';
-- duplicidades / vigente múltiplo
select 'dup.matricula_cabeca_multipla_mesmo_logico', count(*) from (select logical_id from public.school_enrollments s where not exists (select 1 from public.school_enrollments n where n.supersedes_id=s.id) group by logical_id having count(*)>1) t;
select 'dup.episodio_aberto_multiplo_mesma_participacao', count(*) from (select participation_logical_id from public.class_enrollment_episodes e where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id=e.id) and not exists (select 1 from public.class_enrollment_episode_endings x where x.episode_id=e.id) and participation_logical_id is not null group by participation_logical_id having count(*)>1) t;
select 'dup.inep_mesmo_valor_escolas_distintas', count(*) from (select value from public.institutional_school_identifiers where identifier_kind ilike '%inep%' group by value having count(distinct school_id)>1) t;
select 'inep.escola_sem_inep', count(*) from public.institutional_schools s where not exists (select 1 from public.institutional_school_identifiers i where i.school_id=s.id and i.identifier_kind ilike '%inep%');
select 'inep.formato_invalido', count(*) from public.institutional_school_identifiers where identifier_kind ilike '%inep%' and value !~ '^[0-9]{8}$';
-- cobertura
select 'cobertura.turma_sem_composicao', count(*) from public.institutional_classes c where not exists (select 1 from public.class_composition_versions v where v.class_id=c.id);
select 'cobertura.episodio_aberto_sem_posicao', count(*) from public.class_enrollment_episodes e where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id=e.id) and not exists (select 1 from public.class_enrollment_episode_endings x where x.episode_id=e.id) and not exists (select 1 from public.allocation_curricular_positions p where p.allocation_logical_id=e.logical_id);
select 'cobertura.matricula_sem_episodio', count(*) from public.school_enrollments s where not exists (select 1 from public.class_enrollment_episodes e where e.enrollment_id=s.id);
select 'cobertura.episodio_sem_matricula', count(*) from public.class_enrollment_episodes e where not exists (select 1 from public.school_enrollments s where s.id=e.enrollment_id);
select 'cobertura.pessoa_sem_vinculo', count(*) from public.institutional_persons p where not exists (select 1 from public.institutional_engagements g where g.person_id=p.id) and not exists (select 1 from public.institutional_student_persons sp where sp.person_id=p.id);
select 'cobertura.vinculo_sem_escola_nivel_escola', count(*) from public.institutional_engagements where scope_level='school' and school_id is null;
