-- DocServ LOTE 03: portal do servidor. Alertas são projeção dos documentos; só a leitura do alerta é gravada.
CREATE TABLE IF NOT EXISTS public.docserv_alert_reads (
  user_id uuid NOT NULL,
  alert_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alert_key)
);
COMMENT ON TABLE public.docserv_alert_reads IS 'Marca de leitura de alerta do DocServ, por usuário. O alerta em si é derivado (rejeição, revisão urgente, vencido, vence em breve, tipo sem envio na temporada).';
GRANT SELECT ON public.docserv_alert_reads TO authenticated;
GRANT ALL ON public.docserv_alert_reads TO service_role;
ALTER TABLE public.docserv_alert_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv alert reads own" ON public.docserv_alert_reads;
CREATE POLICY "docserv alert reads own" ON public.docserv_alert_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.docserv_mark_alert_read(_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF _key IS NULL OR length(_key) > 200 THEN RAISE EXCEPTION 'docserv:invalid-key'; END IF;
  INSERT INTO public.docserv_alert_reads (user_id, alert_key) VALUES (auth.uid(), _key) ON CONFLICT DO NOTHING;
END $$;

-- Histórico completo de UM documento do próprio servidor (ou de quem pode lê-lo por RLS).
CREATE OR REPLACE FUNCTION public.docserv_document_history(_document uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'versions', coalesce((SELECT jsonb_agg(jsonb_build_object('version_id', v.id, 'version', v.version, 'path', v.storage_path, 'sha256', v.sha256,
        'mime', v.mime_type, 'size', v.size_bytes, 'issuer', v.issuer, 'issued_on', v.issued_on, 'valid_until', v.valid_until, 'season', v.season,
        'submitted_at', v.submitted_at, 'by_me', v.submitted_by = auth.uid(), 'via_school', v.school_id IS NOT NULL) ORDER BY v.version DESC)
      FROM public.docserv_document_versions v WHERE v.document_id = _document), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'kind', e.kind, 'status', e.status, 'note', e.note,
        'version', (SELECT v.version FROM public.docserv_document_versions v WHERE v.id = e.version_id), 'at', e.recorded_at, 'by_me', e.actor = auth.uid()) ORDER BY e.seq DESC)
      FROM public.docserv_document_events e WHERE e.document_id = _document), '[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.docserv_alert_reads_mine() RETURNS text[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(array_agg(alert_key), '{}') FROM public.docserv_alert_reads WHERE user_id = auth.uid()
$$;

-- Cleanup de fixture BO: só service_role, só linhas das contas da operação.
CREATE OR REPLACE FUNCTION public.docserv_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('sigem.docserv_cleanup_op', true), '') ~ '^bo-[0-9a-f]{12}$' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'docserv:append-only';
END $$;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_docserv(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer := 0; m integer; users uuid[]; docs uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  SELECT coalesce(array_agg(DISTINCT v.document_id), '{}') INTO docs FROM public.docserv_document_versions v WHERE v.submitted_by = ANY(users);
  IF EXISTS (SELECT 1 FROM public.docserv_document_versions v WHERE v.document_id = ANY(docs) AND NOT v.submitted_by = ANY(users))
     OR EXISTS (SELECT 1 FROM public.docserv_document_events e WHERE e.document_id = ANY(docs) AND NOT e.actor = ANY(users)) THEN
    RAISE EXCEPTION 'bo:docserv-mixed-chain'; END IF;
  PERFORM set_config('sigem.docserv_cleanup_op', _operation_id, true);
  DELETE FROM public.docserv_document_events e WHERE e.document_id = ANY(docs); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_document_versions v WHERE v.document_id = ANY(docs) AND v.previous_version_id IS NOT NULL; GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_document_versions v WHERE v.document_id = ANY(docs); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_audit_events a WHERE a.actor = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_alert_reads r WHERE r.user_id = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  PERFORM set_config('sigem.docserv_cleanup_op', '', true);
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.docserv_mark_alert_read(text), public.docserv_document_history(uuid), public.docserv_alert_reads_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_mark_alert_read(text), public.docserv_document_history(uuid), public.docserv_alert_reads_mine() TO authenticated;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_docserv(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_docserv(text) TO service_role;