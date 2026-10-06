-- AD.2 (desempenho): atuação de rede já concede leitura de toda escola existente via has_school_capability;
-- esta política equivalente avalia a capacidade uma única vez (initplan), sem ampliar acesso.
CREATE POLICY "enrollments by network capability" ON public.school_enrollments
  FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('consultar-matricula-e-movimentacao')));
CREATE POLICY "enrollment endings by network capability" ON public.school_enrollment_endings
  FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('consultar-matricula-e-movimentacao')));