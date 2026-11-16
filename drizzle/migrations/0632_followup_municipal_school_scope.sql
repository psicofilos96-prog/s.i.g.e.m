CREATE TABLE public.followup_school_scope_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 administrative_dependency text NOT NULL,
 location_kind text NOT NULL,
 valid_from date NOT NULL,
 decision_ref text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(administrative_dependency, location_kind, valid_from)
);
GRANT ALL ON public.followup_school_scope_decisions TO service_role;
ALTER TABLE public.followup_school_scope_decisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER followup_school_scope_decisions_immutable BEFORE UPDATE OR DELETE ON public.followup_school_scope_decisions FOR EACH ROW EXECUTE FUNCTION public.followup_seat_append_only();
-- Additive backfill: owner-authorized scope uses existing canonical classification values.
INSERT INTO public.followup_school_scope_decisions(administrative_dependency,location_kind,valid_from,decision_ref)
SELECT DISTINCT s.administrative_dependency,s.location_kind,DATE '2026-11-16','Decisão do proprietário 16/11/2026: acompanhamento somente escolas municipais urbanas e rurais; excluir conveniadas'
FROM (SELECT DISTINCT ON (school_id) * FROM public.institutional_school_record_versions WHERE valid_from <= DATE '2026-11-16' ORDER BY school_id,version_number DESC) s
WHERE s.administrative_dependency='municipal' AND s.location_kind IN ('urbana','rural');
CREATE OR REPLACE FUNCTION public.school_institutional_followup_grant(_capability text, _school text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE _on date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 IF auth.uid() IS NULL OR _school IS NULL OR _capability NOT IN ('consultar-acompanhamento-institucional','registrar-acompanhamento-institucional') THEN RETURN false; END IF;
 IF public.followup_seat_is_account() THEN
   IF NOT EXISTS (
     SELECT 1 FROM (
       SELECT s.administrative_dependency,s.location_kind
       FROM public.institutional_school_record_versions s
       WHERE s.school_id=_school AND s.valid_from <= _on
       ORDER BY s.version_number DESC LIMIT 1
     ) current_school
     JOIN public.followup_school_scope_decisions d
       ON d.administrative_dependency=current_school.administrative_dependency
       AND d.location_kind=current_school.location_kind
       AND d.valid_from <= _on
   ) THEN RETURN false; END IF;
   RETURN EXISTS (SELECT 1 FROM public.followup_seat_effective_grants(_on) g
     WHERE g.capability_id=_capability AND (g.scope_level='rede' OR g.scope_level='escola' AND g.school_id=_school));
 END IF;
 RETURN EXISTS (SELECT 1 FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id=_capability AND c.policy_id IS NOT NULL
     AND (c.scope_level='rede' OR c.scope_level='escola' AND c.school_id=_school));
END $function$;