-- SOMENTE LEITURA. Não executa a limpeza nem autoriza qualquer exclusão.
-- Executar pelo canal de leitura Cloud; não pelo papel da aplicação.
SELECT pg_catalog.jsonb_build_object(
  'school_id', 'inep-99999901',
  'school_identity', (SELECT pg_catalog.to_jsonb(s) FROM public.institutional_schools s WHERE s.id = 'inep-99999901'),
  'school_versions', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) ORDER BY v.version_number)
    FROM public.institutional_school_record_versions v WHERE v.school_id = 'inep-99999901'),
  'school_identifiers', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id)
    FROM public.institutional_school_identifiers i WHERE i.school_id = 'inep-99999901'),
  'enrollments', (SELECT count(*) FROM public.school_enrollments WHERE school_id = 'inep-99999901'),
  'students', (SELECT count(DISTINCT student_id) FROM public.school_enrollments WHERE school_id = 'inep-99999901'),
  'classes', (SELECT count(*) FROM public.institutional_classes WHERE school_id = 'inep-99999901'),
  'fixture_staff', (SELECT count(*) FROM public.staff_administrative_records
    WHERE school_id = 'inep-99999901' AND source_kind = 'servidores-por-escola'
      AND source_file = 'Escola de teste (dados fictícios)'),
  'fixture_census', (SELECT count(*) FROM public.professional_census_declarations
    WHERE school_id = 'inep-99999901' AND technical_operation_id = '5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20'::uuid),
  'engagements', (SELECT count(*) FROM public.institutional_engagements WHERE school_id = 'inep-99999901'),
  'enrollment_provenance', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e)) FROM (
    SELECT technical_operation_id, originating_act_ref, count(*) AS n FROM public.school_enrollments
    WHERE school_id = 'inep-99999901' GROUP BY technical_operation_id, originating_act_ref
    ORDER BY technical_operation_id, originating_act_ref
  ) e),
  'protected_staff', (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)) FROM (
    SELECT source_kind, source_file, count(*) AS n,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.string_agg(pg_catalog.to_jsonb(s)::text, E'\n' ORDER BY s.id), 'UTF8')), 'hex') AS sha256
    FROM public.staff_administrative_records s WHERE source_file IN (
      'Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx', 'Relacao_Funcionarios_SEMED_por_Setor.xlsx')
    GROUP BY source_kind, source_file ORDER BY source_kind, source_file
  ) p),
  'other_schools', (SELECT count(*) FROM public.institutional_schools WHERE id <> 'inep-99999901'),
  'other_enrollments', (SELECT count(*) FROM public.school_enrollments WHERE school_id <> 'inep-99999901'),
  'other_classes', (SELECT count(*) FROM public.institutional_classes WHERE school_id <> 'inep-99999901')
);