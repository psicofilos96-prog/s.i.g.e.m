-- L24: pessoas e atuações só por writers DEFINER; sem política de escrita, a concessão direta era inócua mas inconsistente.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.institutional_engagements FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.institutional_persons FROM authenticated, anon;