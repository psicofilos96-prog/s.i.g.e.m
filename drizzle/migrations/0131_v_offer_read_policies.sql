-- V.6/V.7: a mesma fronteira de leitura (can_read_offer_organization: leitura escolar existente, consulta da
-- organização da oferta na data-alvo, ou docência na turma) alcança as tabelas lidas pelos readers INVOKER.
-- Políticas aditivas, somente SELECT; nenhuma escrita é aberta.
CREATE POLICY "classes by offer organization boundary" ON public.institutional_classes FOR SELECT TO authenticated
  USING (public.can_read_offer_organization(id));
CREATE POLICY "class registry by offer organization boundary" ON public.institutional_class_record_versions FOR SELECT TO authenticated
  USING (public.can_read_offer_organization(class_id));
CREATE POLICY "journeys by offer organization boundary" ON public.class_journeys FOR SELECT TO authenticated
  USING (public.can_read_offer_organization(class_id));
CREATE POLICY "journey versions by offer organization boundary" ON public.class_journey_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_journeys j WHERE j.id = journey_id AND public.can_read_offer_organization(j.class_id)));
CREATE POLICY "journey intervals by offer organization boundary" ON public.class_journey_intervals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_journey_versions v JOIN public.class_journeys j ON j.id = v.journey_id
                 WHERE v.id = version_id AND public.can_read_offer_organization(j.class_id)));
CREATE POLICY "schedules by offer organization boundary" ON public.class_schedules FOR SELECT TO authenticated
  USING (public.can_read_offer_organization(class_id));
CREATE POLICY "schedule versions by offer organization boundary" ON public.class_schedule_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_schedules s WHERE s.id = schedule_id AND public.can_read_offer_organization(s.class_id)));
CREATE POLICY "schedule blocks by offer organization boundary" ON public.class_schedule_blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_schedule_versions v JOIN public.class_schedules s ON s.id = v.schedule_id
                 WHERE v.id = version_id AND public.can_read_offer_organization(s.class_id)));
CREATE POLICY "assignment versions by offer organization boundary" ON public.teaching_assignment_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = assignment_id AND public.can_read_offer_organization(a.class_id)));
