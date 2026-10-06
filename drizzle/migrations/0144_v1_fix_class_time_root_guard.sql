-- V.1.5: o E2E positivo revelou que guard_class_time_root (0129) referenciava NEW.schedule_id ao inserir
-- em class_journey_versions (plpgsql não faz curto-circuito em campos de NEW), quebrando TODA gravação de
-- jornada. Correção: um ramo por tabela, sem tocar campo inexistente. Mesma regra (raiz só se a entidade
-- não tem versão alguma).
CREATE OR REPLACE FUNCTION public.guard_class_time_root() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _j jsonb;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    _j := pg_catalog.to_jsonb(NEW);
    IF TG_TABLE_NAME = 'class_journey_versions' THEN
      IF EXISTS (SELECT 1 FROM public.class_journey_versions v WHERE v.journey_id = _j->>'journey_id')
      THEN RAISE EXCEPTION 'journey:invalid-chain'; END IF;
    ELSIF TG_TABLE_NAME = 'class_schedule_versions' THEN
      IF EXISTS (SELECT 1 FROM public.class_schedule_versions v WHERE v.schedule_id = _j->>'schedule_id')
      THEN RAISE EXCEPTION 'schedule:invalid-chain'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_class_time_root() FROM PUBLIC, anon, authenticated, service_role;
