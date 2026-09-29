CREATE OR REPLACE FUNCTION public.scope_key_matches(_scope_key text, _class text, _period text, _scope jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT split_part(_scope_key,'|',1) = _class
     AND (_scope IS NULL OR (_scope->>'classId' = _class AND _scope->>'periodId' = _period))
     AND split_part(_scope_key,'|',3) IN (_period, coalesce(_scope->>'calendarPeriodId', _period))
$$;

CREATE OR REPLACE FUNCTION public.guard_closing_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.scope_key_matches(NEW.scope_key, NEW.class_id, NEW.period_id, NEW.scope) THEN
    RAISE EXCEPTION 'scope-mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER period_closing_events_scope BEFORE INSERT ON public.period_closing_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_closing_scope();

CREATE OR REPLACE FUNCTION public.guard_closing_version_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.scope_key_matches(NEW.scope_key, NEW.class_id, NEW.period_id, NEW.record->'scope') THEN
    RAISE EXCEPTION 'scope-mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER period_closing_versions_scope BEFORE INSERT ON public.period_closing_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_closing_version_scope();

CREATE OR REPLACE FUNCTION public.guard_instrument_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.scope_key_matches(NEW.closing_scope_key, NEW.class_id, NEW.period_id, NULL) THEN
    RAISE EXCEPTION 'scope-mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assessment_instruments_scope BEFORE INSERT ON public.assessment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.guard_instrument_scope();