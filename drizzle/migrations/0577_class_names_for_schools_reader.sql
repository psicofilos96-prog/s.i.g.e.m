CREATE OR REPLACE FUNCTION public.class_names_for_schools(_schools text[], _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(class_id text, name text, state text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH cls AS (
  SELECT c.id FROM public.institutional_classes c WHERE c.school_id = ANY(_schools)
),
obs AS (
  SELECT o.class_id, min(o.known_at)::date AS observed
  FROM public.class_source_observations o
  WHERE o.class_id IN (SELECT id FROM cls) AND (_known_at IS NULL OR o.recorded_at <= _known_at)
  GROUP BY o.class_id
),
known AS (
  SELECT v.* FROM public.institutional_class_record_versions v
  WHERE v.class_id IN (SELECT id FROM cls) AND (_known_at IS NULL OR v.created_at <= _known_at)
),
current_v AS (
  SELECT v.* FROM known v WHERE NOT EXISTS (SELECT 1 FROM known s WHERE s.supersedes_id = v.id)
),
flagged AS (
  SELECT cv.class_id, cv.name, cv.valid_from, cv.valid_until,
    EXISTS (SELECT 1 FROM public.temporal_stand_in_neutralizations n
            WHERE n.target_table = 'institutional_class_record_versions' AND n.target_id = cv.id::text AND n.field = 'valid_from') AS unknown_vf
  FROM current_v cv
),
eligible AS (
  SELECT f.class_id, f.name FROM flagged f LEFT JOIN obs o ON o.class_id = f.class_id
  WHERE (CASE WHEN f.unknown_vf THEN o.observed IS NOT NULL AND o.observed <= _valid_on ELSE f.valid_from <= _valid_on END)
    AND (f.valid_until IS NULL OR f.valid_until >= _valid_on)
),
counted AS (SELECT e.class_id, count(*) AS n, max(e.name) AS name FROM eligible e GROUP BY e.class_id)
SELECT c.class_id, c.name, 'ok'::text FROM counted c WHERE c.n = 1
UNION ALL
SELECT c.class_id, NULL, 'inconsistente'::text FROM counted c WHERE c.n > 1;
$$;
COMMENT ON FUNCTION public.class_names_for_schools(text[], date, timestamptz) IS 'Leitor em conjunto dos nomes vigentes das turmas de um conjunto de escolas; mesma semantica temporal de class_at (versao nao sucedida, valid_from desconhecido via neutralizacao + observacao, ambiguidade = inconsistente). Somente leitura, SECURITY INVOKER: a RLS das tabelas canonicas continua valendo.';
REVOKE EXECUTE ON FUNCTION public.class_names_for_schools(text[], date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_names_for_schools(text[], date, timestamptz) TO authenticated;