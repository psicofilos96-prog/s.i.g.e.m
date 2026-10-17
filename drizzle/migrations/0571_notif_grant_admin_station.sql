-- Decisão do proprietário 2026-10-17: Administrador e Supervisão configuram os avisos de infrequência.
-- A Supervisão (conta de setor) já passa; o Administrador Geral recebe a capacidade pela estação
-- administracao_geral (engagement sem política), que agora também é aceita.
CREATE OR REPLACE FUNCTION public.notif_grant(_capability text, _school text)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability
     AND (c.policy_id IS NOT NULL
          OR (c.engagement_id IS NULL AND public.current_principal_id() IS NOT NULL)
          OR EXISTS (SELECT 1 FROM public.institutional_engagements e
                      WHERE e.id = c.engagement_id AND e.engagement_kind_id = 'administrador-geral-do-sigem'
                        AND e.person_id = public.current_person_id()))
     AND (c.scope_level = 'rede' OR (_school IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school)) LIMIT 1;
  IF g IS NULL AND NOT (FOUND AND public.current_principal_id() IS NOT NULL) THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $function$;
REVOKE ALL ON FUNCTION public.notif_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;