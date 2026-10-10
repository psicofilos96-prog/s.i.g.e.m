DROP POLICY IF EXISTS "leitura autenticada" ON public.school_infrastructure_observations;
REVOKE ALL ON public.school_infrastructure_observations FROM anon;
CREATE POLICY "infra: escola própria ou rede com capability"
  ON public.school_infrastructure_observations FOR SELECT TO authenticated
  USING (
    public.has_network_capability('consultar-censo-escolar')
    OR public.has_network_capability('manter-cadastro-unidade-escolar')
    OR public.has_network_capability('consultar-quadro-profissional-da-rede')
    OR public.has_school_capability('manter-cadastro-unidade-escolar', school_id)
    OR public.has_school_capability('consultar-supervisao-da-propria-escola', school_id)
    OR public.has_school_capability('consultar-quadro-profissional-da-escola', school_id)
  );