-- T: regra de competência — rascunho só transita uma vez para homologada, sem alterar definição/vigência.
CREATE OR REPLACE FUNCTION public.guard_map_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Regra de competência não é apagada; crie nova versão'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'homologada' THEN RAISE EXCEPTION 'Regra homologada é imutável; crie nova versão'; END IF;
    IF NEW.status <> 'homologada'
       OR NEW.id IS DISTINCT FROM OLD.id OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.definition IS DISTINCT FROM OLD.definition OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.drafted_by IS DISTINCT FROM OLD.drafted_by OR NEW.drafted_person_id IS DISTINCT FROM OLD.drafted_person_id
       OR NEW.drafted_engagement_id IS DISTINCT FROM OLD.drafted_engagement_id
       OR NEW.homologated_by IS NULL OR NEW.homologated_person_id IS NULL OR NEW.homologated_at IS NULL THEN
      RAISE EXCEPTION 'Rascunho só transita para homologada, sem alterar definição, vigência ou autoria';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.guard_map_rule() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.applicable_map_rule(date) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.applicable_map_rule_for_school(text, date) FROM service_role;
DROP TRIGGER IF EXISTS map_rules_immutable ON public.map_competence_rules;
CREATE TRIGGER map_rules_immutable BEFORE UPDATE OR DELETE ON public.map_competence_rules FOR EACH ROW EXECUTE FUNCTION public.guard_map_rule();