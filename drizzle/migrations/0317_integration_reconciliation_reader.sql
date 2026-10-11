CREATE OR REPLACE FUNCTION public.integration_reconciliation_at()
RETURNS TABLE(check_key text, relation_key text, total bigint, issues bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH e AS (SELECT x.* FROM public.school_enrollments x
             WHERE NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = x.id)),
       ep AS (SELECT x.* FROM public.class_enrollment_episodes x
             WHERE NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = x.id)),
       idv AS (SELECT DISTINCT ON (student_id) student_id, lower(trim(civil_name)) nm, birth_date
               FROM public.student_identity_versions ORDER BY student_id, version DESC),
       dup AS (SELECT nm, birth_date FROM idv WHERE nm IS NOT NULL AND birth_date IS NOT NULL
               GROUP BY 1,2 HAVING count(DISTINCT student_id) > 1)
  SELECT 'matricula-sem-enturmacao', 'matricula->enturmacao', (SELECT count(*) FROM e),
         (SELECT count(*) FROM e WHERE NOT EXISTS (SELECT 1 FROM ep WHERE ep.enrollment_id = e.id))
  UNION ALL SELECT 'enturmacao-escola-divergente', 'enturmacao->matricula', (SELECT count(*) FROM ep),
         (SELECT count(*) FROM ep JOIN e ON e.id = ep.enrollment_id WHERE e.school_id <> ep.school_id)
  UNION ALL SELECT 'enturmacao-turma-inexistente', 'enturmacao->turma', (SELECT count(*) FROM ep),
         (SELECT count(*) FROM ep WHERE NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = ep.class_id))
  UNION ALL SELECT 'matricula-sem-inicio-declarado', 'matricula.vigencia', (SELECT count(*) FROM e),
         (SELECT count(*) FROM e WHERE e.opened_on IS NULL)
  UNION ALL SELECT 'estudante-em-mais-de-uma-escola', 'estudante->matricula', (SELECT count(DISTINCT student_id) FROM e),
         (SELECT count(*) FROM (SELECT student_id FROM e GROUP BY 1 HAVING count(DISTINCT school_id) > 1) t)
  UNION ALL SELECT 'identidade-duplicada-candidata', 'estudante.identidade', (SELECT count(*) FROM idv),
         (SELECT count(*) FROM dup)
$$;
REVOKE ALL ON FUNCTION public.integration_reconciliation_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integration_reconciliation_at() TO authenticated;
COMMENT ON FUNCTION public.integration_reconciliation_at() IS 'Reconciliação da camada semântica: só contagens sob a RLS de quem consulta; candidatos a duplicidade nunca são fundidos.';