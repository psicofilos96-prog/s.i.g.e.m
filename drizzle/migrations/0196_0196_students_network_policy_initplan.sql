-- 0196: gargalo comprovado na BO.2 (9.763 linhas de estudantes em ~34 s para sessão de rede):
-- has_network_capability era avaliada por linha. Mesma semântica, avaliada uma vez por consulta (initplan).
ALTER POLICY "students by network capability" ON public.institutional_students
  USING ((SELECT public.has_network_capability('consultar-identidade-cadastral-do-estudante'::text)));