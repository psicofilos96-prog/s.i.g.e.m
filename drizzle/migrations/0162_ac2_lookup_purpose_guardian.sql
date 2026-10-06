-- AC.2: localização exata de responsável também é auditada no mesmo registro de buscas.
ALTER TABLE public.exact_lookup_events DROP CONSTRAINT exact_lookup_events_purpose_check;
ALTER TABLE public.exact_lookup_events ADD CONSTRAINT exact_lookup_events_purpose_check
  CHECK (purpose = ANY (ARRAY['localizar-aluno'::text, 'localizar-servidor'::text, 'localizar-responsavel'::text]));