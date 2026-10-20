DROP POLICY "Own engagements" ON public.institutional_engagements;
CREATE POLICY "Own engagements" ON public.institutional_engagements FOR SELECT TO authenticated
  USING (person_id = (SELECT public.current_person_id()));
DROP POLICY "holders read engagements" ON public.institutional_engagements;
CREATE POLICY "holders read engagements" ON public.institutional_engagements FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('manter-atuacoes-institucionais')));