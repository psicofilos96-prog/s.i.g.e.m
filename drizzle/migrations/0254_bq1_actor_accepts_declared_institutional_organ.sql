-- BQ.1: o ator real da sessão do Administrador Geral é o órgão institucional declarado na instalação (actor_nature imutável), não pessoa fictícia.
CREATE OR REPLACE FUNCTION public.institutional_actor_person()
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  me := public.s_current_person();
  IF me IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = me AND p.actor_nature IN ('pessoa-natural','orgao-institucional')) THEN RETURN me; END IF;
  IF public.current_principal_id() IS NOT NULL THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'secretariat:natural-person-required';
END $function$;
REVOKE ALL ON FUNCTION public.institutional_actor_person() FROM PUBLIC, anon;