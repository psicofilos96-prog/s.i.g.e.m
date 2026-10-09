-- PERF.LOADING.2 — declarações do Censo de profissionais: mesma regra (atuação vigente da própria pessoa,
-- rede ou mesma escola), avaliada uma vez por consulta em vez de por linha.
CREATE OR REPLACE FUNCTION public.own_engagement_network_now()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.person_id = public.current_person_id()
  AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date) AND e.scope_level = 'rede') $$;

CREATE OR REPLACE FUNCTION public.own_engagement_schools_now()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT DISTINCT e.school_id FROM public.institutional_engagements e WHERE e.person_id = public.current_person_id()
  AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date) AND e.school_id IS NOT NULL $$;

GRANT EXECUTE ON FUNCTION public.own_engagement_network_now() TO authenticated;
GRANT EXECUTE ON FUNCTION public.own_engagement_schools_now() TO authenticated;

DROP POLICY IF EXISTS "leitura escolar" ON public.professional_census_declarations;
CREATE POLICY "leitura escolar" ON public.professional_census_declarations FOR SELECT TO authenticated
  USING ((SELECT public.own_engagement_network_now()) OR school_id IN (SELECT public.own_engagement_schools_now()));

CREATE INDEX IF NOT EXISTS perf_professional_census_declarations_person_idx ON public.professional_census_declarations (person_id);