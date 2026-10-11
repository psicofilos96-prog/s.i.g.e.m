CREATE OR REPLACE FUNCTION public.nei_case_assignees(_school text) RETURNS TABLE(user_id uuid, person_name text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role IN ('coordenador','tecnico') AND (g.scope_kind='rede' OR g.school_id=_school))) THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT g.user_id, pe.display_name, g.role
    FROM public.nei_role_grants g
    JOIN public.user_person_links l ON l.user_id = g.user_id
    JOIN public.institutional_persons pe ON pe.id = l.person_id
   WHERE EXISTS (SELECT 1 FROM public.nei_active_grants(g.user_id) a WHERE a.id = g.id) AND (g.scope_kind = 'rede' OR g.school_id = _school)
   ORDER BY 2;
END $$;