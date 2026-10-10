-- AUD2026.2: normalizações DERIVADAS e append-only. Não são fato oficial, não têm autoria humana e nunca concedem acesso.
-- (a) Jornada declarada do estudante no Censo 2026 → intervalos dia/hora, só quando o literal inteiro é inequívoco.
CREATE TABLE public.student_school_day_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.student_school_day_observations(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL CHECK (ends_at > starts_at),
  parser text NOT NULL DEFAULT 'jornada-literal-v1',
  derived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id, weekday, starts_at, parser)
);
COMMENT ON TABLE public.student_school_day_intervals IS 'Derivado de student_school_day_observations (declaração censitária 2026); não é jornada oficial nem grade.';
GRANT SELECT ON public.student_school_day_intervals TO authenticated;
GRANT ALL ON public.student_school_day_intervals TO service_role;
ALTER TABLE public.student_school_day_intervals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segue a leitura da observação" ON public.student_school_day_intervals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_school_day_observations o WHERE o.id = observation_id));
CREATE INDEX student_school_day_intervals_obs_idx ON public.student_school_day_intervals (observation_id);

WITH parts AS (
  SELECT o.id, trim(p) AS part, count(*) OVER (PARTITION BY o.id) AS n,
         count(*) FILTER (WHERE trim(p) ~ '^(Segunda|Terça|Quarta|Quinta|Sexta)-feira, \d{2}:\d{2} às \d{2}:\d{2}$' OR trim(p) ~ '^(Sábado|Domingo), \d{2}:\d{2} às \d{2}:\d{2}$') OVER (PARTITION BY o.id) AS ok
  FROM public.student_school_day_observations o, unnest(string_to_array(o.schedule_literal, '|')) p
), parsed AS (
  SELECT id,
    CASE split_part(split_part(part, ',', 1), '-', 1) WHEN 'Segunda' THEN 1 WHEN 'Terça' THEN 2 WHEN 'Quarta' THEN 3 WHEN 'Quinta' THEN 4 WHEN 'Sexta' THEN 5 WHEN 'Sábado' THEN 6 WHEN 'Domingo' THEN 7 END AS wd,
    substring(part from '(\d{2}:\d{2}) às')::time AS s, substring(part from 'às (\d{2}:\d{2})$')::time AS e
  FROM parts WHERE n = ok
)
INSERT INTO public.student_school_day_intervals (observation_id, weekday, starts_at, ends_at)
SELECT DISTINCT id, wd, s, e FROM parsed
WHERE id NOT IN (SELECT id FROM parsed WHERE e <= s)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.aud2026_derived_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION '% é append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER student_school_day_intervals_no_update BEFORE UPDATE OR DELETE ON public.student_school_day_intervals
  FOR EACH ROW EXECUTE FUNCTION public.aud2026_derived_immutable();

-- (b) Conciliação de pessoal: registro administrativo × pessoa declarada no Censo, por nome normalizado.
-- Candidato nunca é fusão: nome isolado não identifica pessoa e não concede acesso.
CREATE TABLE public.staff_reconciliation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_record_id uuid NOT NULL REFERENCES public.staff_administrative_records(id),
  rule text NOT NULL CHECK (rule IN ('nome-normalizado-mesma-escola','nome-normalizado-rede')),
  outcome text NOT NULL CHECK (outcome IN ('candidato-unico','homonimo','sem-pessoa-censo','escola-sem-correspondencia')),
  candidate_person_id uuid REFERENCES public.institutional_persons(id),
  candidate_count integer NOT NULL,
  derived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_record_id, rule),
  CHECK ((outcome = 'candidato-unico') = (candidate_person_id IS NOT NULL))
);
COMMENT ON TABLE public.staff_reconciliation_candidates IS 'Fila de conciliação derivada; candidato exige conferência humana e nunca cria vínculo, lotação ou acesso.';
GRANT SELECT ON public.staff_reconciliation_candidates TO authenticated;
GRANT ALL ON public.staff_reconciliation_candidates TO service_role;
ALTER TABLE public.staff_reconciliation_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segue a leitura do registro administrativo" ON public.staff_reconciliation_candidates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff_administrative_records r WHERE r.id = staff_record_id));
CREATE TRIGGER staff_reconciliation_candidates_no_update BEFORE UPDATE OR DELETE ON public.staff_reconciliation_candidates
  FOR EACH ROW EXECUTE FUNCTION public.aud2026_derived_immutable();

WITH people AS (
  SELECT DISTINCT d.person_id, d.school_id, upper(regexp_replace(extensions.unaccent(trim(p.display_name)), '\s+', ' ', 'g')) AS nk
  FROM public.professional_census_declarations d JOIN public.institutional_persons p ON p.id = d.person_id
), recs AS (
  SELECT r.id, r.school_id, r.school_match, upper(regexp_replace(extensions.unaccent(trim(r.full_name)), '\s+', ' ', 'g')) AS nk,
         CASE WHEN r.source_kind = 'servidores-por-escola' THEN 'nome-normalizado-mesma-escola' ELSE 'nome-normalizado-rede' END AS rule
  FROM public.staff_administrative_records r
), m AS (
  SELECT r.id, r.rule, r.school_id, r.school_match,
    (SELECT count(DISTINCT p.person_id) FROM people p WHERE p.nk = r.nk AND (r.rule = 'nome-normalizado-rede' OR p.school_id = r.school_id)) AS c,
    (SELECT min(p.person_id::text) FROM people p WHERE p.nk = r.nk AND (r.rule = 'nome-normalizado-rede' OR p.school_id = r.school_id)) AS pid
  FROM recs r
)
INSERT INTO public.staff_reconciliation_candidates (staff_record_id, rule, outcome, candidate_person_id, candidate_count)
SELECT id, rule,
  CASE WHEN rule = 'nome-normalizado-mesma-escola' AND school_id IS NULL THEN 'escola-sem-correspondencia'
       WHEN c = 1 THEN 'candidato-unico' WHEN c > 1 THEN 'homonimo' ELSE 'sem-pessoa-censo' END,
  CASE WHEN NOT (rule = 'nome-normalizado-mesma-escola' AND school_id IS NULL) AND c = 1 THEN pid::uuid END,
  CASE WHEN rule = 'nome-normalizado-mesma-escola' AND school_id IS NULL THEN 0 ELSE c END
FROM m
ON CONFLICT DO NOTHING;
