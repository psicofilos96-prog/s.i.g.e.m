-- Semântica Educacenso: "matrículas" = vínculos aluno×turma (enturmações); "alunos" = pessoas com matrícula na escola.
CREATE OR REPLACE FUNCTION public.census_official_reconciliation(_known_at timestamptz DEFAULT now())
RETURNS TABLE(school_id text, inep text, census_year text, issued_at timestamptz, source_ref text, receipt_version integer,
  measure text, official_value numeric, operational_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  WITH r AS (SELECT * FROM public.census_official_receipts_at(_known_at)),
  cls AS (SELECT c.school_id, count(*)::numeric n FROM public.institutional_classes c WHERE c.school_id IN (SELECT r.school_id FROM r) GROUP BY 1),
  stu AS (SELECT e.school_id, count(DISTINCT e.student_id)::numeric n FROM public.school_enrollments e
           WHERE e.school_id IN (SELECT r.school_id FROM r)
             AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id) GROUP BY 1),
  vin AS (SELECT p.school_id, count(*)::numeric n FROM public.class_enrollment_episodes p
           WHERE p.school_id IN (SELECT r.school_id FROM r) AND p.supersedes_id IS NULL GROUP BY 1),
  m(measure, op) AS (VALUES ('turmas','cls'),('matriculas_total','vin'),('alunos','stu'))
  SELECT r.school_id, r.inep, r.census_year, r.issued_at, r.source_ref, r.version, m.measure,
         nullif(r.measures->m.measure->>'value','')::numeric,
         CASE m.op WHEN 'cls' THEN (SELECT n FROM cls WHERE cls.school_id = r.school_id)
                   WHEN 'vin' THEN (SELECT n FROM vin WHERE vin.school_id = r.school_id)
                   ELSE (SELECT n FROM stu WHERE stu.school_id = r.school_id) END
    FROM r CROSS JOIN m
$$;