-- 0620 — exclusão explícita de registros do Acompanhamento institucional.
-- A exclusão remove fisicamente o conteúdo solicitado e seus dependentes; a auditoria
-- conserva somente metadados mínimos da operação, nunca o texto do registro excluído.

CREATE TABLE public.school_institutional_followup_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN ('visit','action','update')),
  record_id uuid NOT NULL,
  deleted_by uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
REVOKE ALL ON public.school_institutional_followup_deletion_audit
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_institutional_followup_deletion_audit ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.followup_deletion_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'followup:deletion-audit-immutable'; END $$;
REVOKE ALL ON FUNCTION public.followup_deletion_audit_immutable()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_deletion_audit_immutable
  BEFORE UPDATE OR DELETE ON public.school_institutional_followup_deletion_audit
  FOR EACH ROW EXECUTE FUNCTION public.followup_deletion_audit_immutable();

-- O gatilho continua bloqueando DML comum. A única exceção é DELETE dentro da RPC
-- SECURITY DEFINER abaixo, que define uma configuração transacional privada.
CREATE OR REPLACE FUNCTION public.school_institutional_followup_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('sigem.followup_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'followup:append-only';
END $$;

CREATE FUNCTION public.delete_school_institutional_followup_record(
  _kind text, _id uuid, _reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  _school text;
  _logical uuid;
  _action uuid;
  _metadata jsonb := '{}'::jsonb;
  _path text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF _kind NOT IN ('visit','action','update') OR _id IS NULL
    OR length(btrim(coalesce(_reason,''))) NOT BETWEEN 3 AND 500
  THEN RAISE EXCEPTION 'followup:delete-invalid'; END IF;

  IF _kind = 'visit' THEN
    SELECT v.school_id, v.logical_id INTO _school, _logical
    FROM public.school_institutional_followup_visits v WHERE v.id = _id FOR UPDATE;
    IF _school IS NULL THEN RAISE EXCEPTION 'followup:record-not-found'; END IF;
    SELECT jsonb_build_object(
      'visit_versions', count(*),
      'linked_actions', (SELECT count(*) FROM public.school_institutional_followup_actions a
        WHERE a.school_id = _school AND a.visit_logical_id = _logical),
      'linked_updates', (SELECT count(*) FROM public.school_institutional_followup_updates u
        JOIN public.school_institutional_followup_actions a ON a.id = u.action_id
        WHERE a.school_id = _school AND a.visit_logical_id = _logical),
      'linked_attachments', (SELECT count(*) FROM public.school_institutional_followup_attachments x
        JOIN public.school_institutional_followup_visits v ON v.id = x.visit_id
        WHERE v.logical_id = _logical AND v.school_id = _school)
    ) INTO _metadata
    FROM public.school_institutional_followup_visits v
    WHERE v.school_id = _school AND v.logical_id = _logical;
  ELSIF _kind = 'action' THEN
    SELECT a.school_id INTO _school FROM public.school_institutional_followup_actions a
      WHERE a.id = _id FOR UPDATE;
    IF _school IS NULL THEN RAISE EXCEPTION 'followup:record-not-found'; END IF;
    SELECT jsonb_build_object('linked_updates', count(*)) INTO _metadata
      FROM public.school_institutional_followup_updates u WHERE u.action_id = _id;
  ELSE
    SELECT a.school_id, u.action_id INTO _school, _action
    FROM public.school_institutional_followup_updates u
    JOIN public.school_institutional_followup_actions a ON a.id = u.action_id
    WHERE u.id = _id FOR UPDATE OF u;
    IF _school IS NULL THEN RAISE EXCEPTION 'followup:record-not-found'; END IF;
    _metadata := jsonb_build_object('parent_action_id', _action);
  END IF;

  -- A mesma capacidade que autoriza gravar no escopo escolar; o Gabinete,
  -- que possui somente consulta/administração de postos, não pode excluir.
  PERFORM public.school_institutional_followup_person(_school);

  INSERT INTO public.school_institutional_followup_deletion_audit
    (school_id, record_kind, record_id, deleted_by, reason, metadata)
  VALUES (_school, _kind, _id, auth.uid(), btrim(_reason), _metadata);

  PERFORM set_config('sigem.followup_delete', 'on', true);
  IF _kind = 'visit' THEN
    -- Remover também os objetos privados de armazenamento, não apenas seus metadados.
    IF to_regclass('storage.objects') IS NOT NULL THEN
      FOR _path IN
        SELECT x.storage_path
        FROM public.school_institutional_followup_attachments x
        JOIN public.school_institutional_followup_visits v ON v.id = x.visit_id
        WHERE v.school_id = _school AND v.logical_id = _logical
      LOOP
        EXECUTE 'DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2'
          USING 'followup-attachments', _path;
      END LOOP;
    END IF;
    DELETE FROM public.school_institutional_followup_updates u
      USING public.school_institutional_followup_actions a
      WHERE u.action_id = a.id AND a.school_id = _school AND a.visit_logical_id = _logical;
    DELETE FROM public.school_institutional_followup_attachments x
      USING public.school_institutional_followup_visits v
      WHERE x.visit_id = v.id AND v.school_id = _school AND v.logical_id = _logical;
    DELETE FROM public.school_institutional_followup_actions a
      WHERE a.school_id = _school AND a.visit_logical_id = _logical;
    DELETE FROM public.school_institutional_followup_bundles b
      WHERE b.visit_id IN (SELECT v.id FROM public.school_institutional_followup_visits v
        WHERE v.school_id = _school AND v.logical_id = _logical);
    DELETE FROM public.school_institutional_followup_visits v
      WHERE v.school_id = _school AND v.logical_id = _logical;
  ELSIF _kind = 'action' THEN
    DELETE FROM public.school_institutional_followup_updates WHERE action_id = _id;
    DELETE FROM public.school_institutional_followup_actions WHERE id = _id;
  ELSE
    DELETE FROM public.school_institutional_followup_updates WHERE id = _id;
  END IF;
  PERFORM set_config('sigem.followup_delete', '', true);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('sigem.followup_delete', '', true);
  RAISE;
END $$;
REVOKE ALL ON FUNCTION public.delete_school_institutional_followup_record(text,uuid,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_school_institutional_followup_record(text,uuid,text)
  TO authenticated;
