-- ALIM-03 servidor: autorizar pedido sem teto homologado exige ciência explícita e registrada na versão.
-- O banco não calcula teto (sem regra homologada); só recusa autorização silenciosa.
ALTER TABLE public.meal_order_versions ADD COLUMN ceiling_ack text;

CREATE FUNCTION public.meal_order_ceiling_ack_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE ack text;
BEGIN
  IF NEW.status IN ('autorizado-total','autorizado-parcial','retificado') THEN
    ack := nullif(btrim(current_setting('sigem.meal_ceiling_ack', true)), '');
    IF ack IS NULL OR length(ack) < 10 THEN RAISE EXCEPTION 'meal:ceiling-ack-required'; END IF;
    NEW.ceiling_ack := ack;
  ELSE
    NEW.ceiling_ack := NULL;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_order_ceiling_ack_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meal_order_ceiling_ack_guard BEFORE INSERT ON public.meal_order_versions FOR EACH ROW EXECUTE FUNCTION public.meal_order_ceiling_ack_guard();

CREATE FUNCTION public.record_meal_order_with_ceiling(_logical uuid, _expected_version integer, _action text, _school text, _competence text, _lines jsonb, _reason text, _ceiling_ack text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
  PERFORM set_config('sigem.meal_ceiling_ack', coalesce(_ceiling_ack, ''), true);
  RETURN public.record_meal_order(_logical, _expected_version, _action, _school, _competence, _lines, _reason);
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_order_with_ceiling(uuid, integer, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_meal_order_with_ceiling(uuid, integer, text, text, text, jsonb, text, text) TO authenticated;