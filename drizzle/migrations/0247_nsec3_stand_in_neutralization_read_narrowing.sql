-- NSEC.3: a lista de neutralizações de stand-ins temporais deixa de ser legível em bloco.
-- Os readers bitemporais (INVOKER) consultam só por chave exata via temporal_field_unknown,
-- que passa a SECURITY DEFINER e devolve apenas booleano; motivo/operação técnica não saem mais.
CREATE OR REPLACE FUNCTION public.temporal_field_unknown(_table text, _id text, _field text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.temporal_stand_in_neutralizations n WHERE n.target_table = _table AND n.target_id = _id AND n.field = _field)
$function$;
REVOKE ALL ON FUNCTION public.temporal_field_unknown(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temporal_field_unknown(text, text, text) TO authenticated;

DROP POLICY IF EXISTS "leitura autenticada" ON public.temporal_stand_in_neutralizations;
REVOKE SELECT ON public.temporal_stand_in_neutralizations FROM authenticated;