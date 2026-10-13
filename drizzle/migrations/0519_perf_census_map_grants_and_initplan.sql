-- PERF.LOADING.4: Mapa do Censo 2026 recusava (EXECUTE ausente) e estourava tempo.
GRANT EXECUTE ON FUNCTION public.census_can_read_network() TO authenticated;

-- Mesma regra; checagens de rede avaliadas uma vez por consulta (initplan) em vez de por linha.
DROP POLICY IF EXISTS "infra: escola própria ou rede com capability" ON public.school_infrastructure_observations;
CREATE POLICY "infra: escola própria ou rede com capability" ON public.school_infrastructure_observations
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_network_capability('consultar-censo-escolar'::text))
    OR (SELECT public.has_network_capability('manter-cadastro-unidade-escolar'::text))
    OR (SELECT public.has_network_capability('consultar-quadro-profissional-da-rede'::text))
    OR public.has_school_capability('manter-cadastro-unidade-escolar'::text, school_id)
    OR public.has_school_capability('consultar-supervisao-da-propria-escola'::text, school_id)
    OR public.has_school_capability('consultar-quadro-profissional-da-escola'::text, school_id)
  );