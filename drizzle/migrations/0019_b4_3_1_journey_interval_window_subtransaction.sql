-- B4.3.1 — Corrige a janela de gravação de intervalos: o xmin da versão é o da subtransação
-- (savepoint), não o da transação principal, e a 0018 recusava intervalos legítimos gravados em
-- subtransação. A janela passa a ser um marcador transacional definido pelo próprio guard da versão.
CREATE OR REPLACE FUNCTION public.guard_class_journey_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _p public.class_journey_versions%ROWTYPE; _class text; _pt date;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO _p FROM public.class_journey_versions WHERE id = NEW.supersedes_id;
    IF _p.id IS NULL OR _p.journey_id <> NEW.journey_id OR NEW.version <> _p.version + 1 THEN
      RAISE EXCEPTION 'journey:invalid-chain';
    END IF;
    IF NEW.change_kind = 'sucessao' AND NEW.valid_from <= _p.valid_from THEN
      RAISE EXCEPTION 'journey:succession-must-start-later';
    END IF;
  END IF;
  SELECT class_id INTO _class FROM public.class_journeys WHERE id = NEW.journey_id;
  FOR _pt IN
    SELECT NEW.valid_from
    UNION SELECT h.valid_until + 1 FROM public.institutional_class_record_versions h
      WHERE h.class_id = _class AND h.valid_until IS NOT NULL AND h.valid_until >= NEW.valid_from
        AND (NEW.valid_until IS NULL OR h.valid_until < NEW.valid_until)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_at(_class, _pt, NULL)) THEN
      RAISE EXCEPTION 'journey:outside-class-validity';
    END IF;
  END LOOP;
  IF NEW.valid_until IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.class_at(_class, NEW.valid_until, NULL)) THEN
    RAISE EXCEPTION 'journey:outside-class-validity';
  END IF;
  PERFORM set_config('sigem.journey_open_' || replace(NEW.id::text, '-', ''), '1', true);
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.guard_class_journey_interval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF coalesce(current_setting('sigem.journey_open_' || replace(NEW.version_id::text, '-', ''), true), '') <> '1' THEN
    RAISE EXCEPTION 'journey:interval-after-version-closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_journey_intervals i WHERE i.version_id = NEW.version_id AND i.weekday = NEW.weekday
             AND i.starts_at < NEW.ends_at AND NEW.starts_at < i.ends_at) THEN
    RAISE EXCEPTION 'journey:interval-overlap';
  END IF;
  RETURN NEW;
END $fn$;
