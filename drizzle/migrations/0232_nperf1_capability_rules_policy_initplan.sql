-- NPERF.1: mesma semântica; has_network_capability não depende da linha, então avaliá-la uma vez por consulta (initplan) em vez de por linha.
ALTER POLICY "holders read draft rules" ON public.capability_policy_rules
  USING ((SELECT public.has_network_capability('registrar-politica-de-capacidades'::text)) OR (SELECT public.has_network_capability('homologar-politica-de-capacidades'::text)));
ALTER POLICY "policy managers read draft rules" ON public.capability_policy_rules
  USING ((SELECT public.has_network_capability('registrar-politica-de-capacidades'::text)) OR (SELECT public.has_network_capability('homologar-politica-de-capacidades'::text)));