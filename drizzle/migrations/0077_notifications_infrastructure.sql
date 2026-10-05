-- Comunicação e notificações: evento de domínio (outbox) ≠ notificação (entrega por destinatário).
-- Canal único real: in-app. E-mail/push/SMS só como interface no código, sem envio.
-- Capabilities sem regra de política: manter-comunicacao-institucional (rede), emitir-notificacao (escola|rede).

CREATE FUNCTION public.notif_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (_school IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school)) LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.notif_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Contas que detêm a capability na escola (ou rede) na data, pela mesma política homologada.
CREATE FUNCTION public.notif_capability_holders(_capability text, _school text, _on date) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT DISTINCT u.user_id FROM public.institutional_engagements e
  JOIN public.user_person_links u ON u.person_id = e.person_id
  JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id AND r.capability_id = _capability
  JOIN public.capability_policies p ON p.id = r.policy_id AND p.status = 'homologated'
  WHERE e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologated' AND s.valid_from <= _on)
    AND (e.scope_level = 'rede' OR (e.scope_level = 'escola' AND e.school_id = _school))
$fn$;
REVOKE ALL ON FUNCTION public.notif_capability_holders(text, text, date) FROM PUBLIC, anon, authenticated, service_role;

-- Responsáveis com autorização vigente para o educando, na seção exigida.
CREATE FUNCTION public.notif_guardians(_student text, _school text, _section text, _on date) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT DISTINCT a.guardian_user_id FROM public.guardian_authorizations a
  WHERE a.student_id = _student AND a.school_id = _school AND a.event_kind <> 'revogacao'
    AND _section = ANY(a.sections) AND a.valid_from <= _on AND (a.valid_until IS NULL OR a.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
$fn$;
REVOKE ALL ON FUNCTION public.notif_guardians(text, text, text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.notification_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL CHECK (template_key ~ '^[a-z0-9-]{3,80}$'),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.notification_template_versions(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  allowed_variables text[] NOT NULL DEFAULT '{}',
  external_summary text NOT NULL CHECK (length(external_summary) BETWEEN 1 AND 120),
  mandatory boolean NOT NULL,
  retired boolean NOT NULL DEFAULT false,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
COMMENT ON COLUMN public.notification_template_versions.external_summary IS 'Texto sem variáveis para canais externos (push/e-mail/SMS): nunca carrega dado do evento.';
CREATE TABLE public.notification_delivery_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.notification_delivery_rules(id),
  event_kind text NOT NULL CHECK (event_kind ~ '^[a-z0-9-]{3,80}$'),
  template_key text NOT NULL,
  recipient_basis text NOT NULL CHECK (recipient_basis IN ('capability-na-escola','responsavel-autorizado')),
  basis_capability text, basis_section text,
  retired boolean NOT NULL DEFAULT false,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK ((recipient_basis = 'capability-na-escola' AND basis_capability IS NOT NULL) OR (recipient_basis = 'responsavel-autorizado' AND basis_section IS NOT NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE CHECK (length(event_key) BETWEEN 8 AND 200),
  event_kind text NOT NULL,
  school_id text NOT NULL,
  subject_student_id text,
  payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object'),
  deep_link text CHECK (deep_link IS NULL OR deep_link ~ '^/[A-Za-z0-9/_\-?=&.%]*$'),
  expires_at timestamptz,
  emitted_by uuid NOT NULL, emitted_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_event_cancellations (
  event_id uuid PRIMARY KEY REFERENCES public.notification_events(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  cancelled_by uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id),
  rule_version_id uuid NOT NULL REFERENCES public.notification_delivery_rules(id),
  template_version_id uuid NOT NULL REFERENCES public.notification_template_versions(id),
  recipient_user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'in-app' CHECK (channel IN ('in-app')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, recipient_user_id, channel)
);
CREATE INDEX notification_deliveries_recipient ON public.notification_deliveries (recipient_user_id, recorded_at DESC);
CREATE TABLE public.notification_reads (
  delivery_id uuid PRIMARY KEY REFERENCES public.notification_deliveries(id),
  read_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, event_kind text NOT NULL, opted_out boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_preferences_user ON public.notification_preferences (user_id, event_kind, recorded_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['notification_template_versions','notification_delivery_rules','notification_events','notification_event_cancellations','notification_deliveries','notification_reads','notification_preferences'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
END $$;

-- Modelos e regras ----------------------------------------------------------------------------
CREATE FUNCTION public.record_notification_template(_key text, _base uuid, _title text, _body text, _vars text[], _external text, _mandatory boolean, _retire boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE cur public.notification_template_versions; r uuid; v text;
BEGIN
  PERFORM public.notif_grant('manter-comunicacao-institucional', NULL);
  PERFORM pg_advisory_xact_lock(hashtext('ntpl:' || _key));
  SELECT * INTO cur FROM public.notification_template_versions WHERE template_key = _key ORDER BY version DESC LIMIT 1;
  IF cur.id IS DISTINCT FROM _base THEN RAISE EXCEPTION 'notif:base-superseded'; END IF;
  IF _external ~ '\{\{' THEN RAISE EXCEPTION 'notif:external-summary-has-variables'; END IF;
  FOR v IN SELECT (regexp_matches(_title || ' ' || _body, '\{\{([a-z0-9_]+)\}\}', 'g'))[1] LOOP
    IF NOT v = ANY(coalesce(_vars,'{}')) THEN RAISE EXCEPTION 'notif:undeclared-variable'; END IF;
  END LOOP;
  INSERT INTO public.notification_template_versions(template_key, version, supersedes_id, title, body, allowed_variables, external_summary, mandatory, retired, reason, author_user_id)
  VALUES (_key, coalesce(cur.version,0)+1, cur.id, _title, _body, coalesce(_vars,'{}'), _external, _mandatory, coalesce(_retire,false), nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_notification_rule(_logical uuid, _base uuid, _kind text, _template text, _basis text, _cap text, _section text, _retire boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE cur public.notification_delivery_rules; lid uuid := coalesce(_logical, gen_random_uuid()); r uuid;
BEGIN
  PERFORM public.notif_grant('manter-comunicacao-institucional', NULL);
  PERFORM pg_advisory_xact_lock(hashtext('nrule:' || lid));
  SELECT * INTO cur FROM public.notification_delivery_rules WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS DISTINCT FROM _base THEN RAISE EXCEPTION 'notif:base-superseded'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_template_versions WHERE template_key = _template) THEN RAISE EXCEPTION 'notif:template-unknown'; END IF;
  INSERT INTO public.notification_delivery_rules(logical_id, version, supersedes_id, event_kind, template_key, recipient_basis, basis_capability, basis_section, retired, reason, author_user_id)
  VALUES (lid, coalesce(cur.version,0)+1, cur.id, _kind, _template, _basis, _cap, _section, coalesce(_retire,false), nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO r; RETURN r;
END $fn$;

-- Emissão (outbox idempotente) + despacho (retry seguro) ------------------------------------------
CREATE FUNCTION public.dispatch_notification_event(_event uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE ev public.notification_events; ru record; tp public.notification_template_versions; u uuid; n integer := 0; c integer;
BEGIN
  SELECT * INTO ev FROM public.notification_events WHERE id = _event;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'notif:event-unknown'; END IF;
  PERFORM public.notif_grant('emitir-notificacao', ev.school_id);
  IF EXISTS (SELECT 1 FROM public.notification_event_cancellations WHERE event_id = ev.id) THEN RETURN 0; END IF;
  IF ev.expires_at IS NOT NULL AND ev.expires_at <= now() THEN RETURN 0; END IF;
  FOR ru IN SELECT r.* FROM public.notification_delivery_rules r
             WHERE r.event_kind = ev.event_kind AND NOT r.retired AND NOT EXISTS (SELECT 1 FROM public.notification_delivery_rules s WHERE s.supersedes_id = r.id) LOOP
    SELECT * INTO tp FROM public.notification_template_versions t WHERE t.template_key = ru.template_key ORDER BY t.version DESC LIMIT 1;
    CONTINUE WHEN tp.id IS NULL OR tp.retired;
    FOR u IN SELECT * FROM (
        SELECT public.notif_capability_holders(ru.basis_capability, ev.school_id, CURRENT_DATE) WHERE ru.recipient_basis = 'capability-na-escola'
        UNION SELECT public.notif_guardians(ev.subject_student_id, ev.school_id, ru.basis_section, CURRENT_DATE) WHERE ru.recipient_basis = 'responsavel-autorizado' AND ev.subject_student_id IS NOT NULL
      ) x(uid) WHERE uid IS NOT NULL LOOP
      IF NOT tp.mandatory AND coalesce((SELECT p.opted_out FROM public.notification_preferences p WHERE p.user_id = u AND p.event_kind = ev.event_kind ORDER BY p.recorded_at DESC LIMIT 1), false) THEN CONTINUE; END IF;
      INSERT INTO public.notification_deliveries(event_id, rule_version_id, template_version_id, recipient_user_id)
      VALUES (ev.id, ru.id, tp.id, u) ON CONFLICT (event_id, recipient_user_id, channel) DO NOTHING;
      GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
    END LOOP;
  END LOOP;
  RETURN n;
END $fn$;

CREATE FUNCTION public.emit_notification_event(_event_key text, _kind text, _school text, _student text, _payload jsonb, _deep_link text, _expires timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; r uuid; k text; allowed text[];
BEGIN
  g := public.notif_grant('emitir-notificacao', _school);
  SELECT id INTO r FROM public.notification_events WHERE event_key = _event_key;
  IF r IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.notification_events WHERE id = r AND school_id = _school AND event_kind = _kind) THEN RAISE EXCEPTION 'notif:event-key-conflict'; END IF;
    PERFORM public.dispatch_notification_event(r); RETURN r;
  END IF;
  SELECT coalesce(array_agg(DISTINCT v), '{}') INTO allowed FROM public.notification_delivery_rules ru
    JOIN public.notification_template_versions t ON t.template_key = ru.template_key, unnest(t.allowed_variables) v
   WHERE ru.event_kind = _kind;
  FOR k IN SELECT jsonb_object_keys(coalesce(_payload,'{}')) LOOP
    IF NOT k = ANY(allowed) THEN RAISE EXCEPTION 'notif:payload-key-not-declared'; END IF;
    IF jsonb_typeof(_payload->k) <> 'string' OR length(_payload->>k) > 120 THEN RAISE EXCEPTION 'notif:payload-value-invalid'; END IF;
  END LOOP;
  IF _student IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'notif:student-not-in-school'; END IF;
  INSERT INTO public.notification_events(event_key, event_kind, school_id, subject_student_id, payload, deep_link, expires_at, emitted_by, emitted_engagement)
  VALUES (_event_key, _kind, _school, _student, coalesce(_payload,'{}'), _deep_link, _expires, auth.uid(), g) RETURNING id INTO r;
  PERFORM public.dispatch_notification_event(r);
  RETURN r;
END $fn$;

CREATE FUNCTION public.cancel_notification_event(_event uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE ev public.notification_events;
BEGIN
  SELECT * INTO ev FROM public.notification_events WHERE id = _event;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'notif:event-unknown'; END IF;
  PERFORM public.notif_grant('emitir-notificacao', ev.school_id);
  INSERT INTO public.notification_event_cancellations(event_id, reason, cancelled_by) VALUES (_event, _reason, auth.uid()) ON CONFLICT DO NOTHING;
END $fn$;

-- Destinatário: ainda autorizado AGORA pela mesma base da regra?
CREATE FUNCTION public.notif_still_authorized(_delivery uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.notification_deliveries d
    JOIN public.notification_events ev ON ev.id = d.event_id
    JOIN public.notification_delivery_rules ru ON ru.id = d.rule_version_id
    WHERE d.id = _delivery AND d.recipient_user_id = auth.uid()
      AND ((ru.recipient_basis = 'capability-na-escola' AND auth.uid() IN (SELECT public.notif_capability_holders(ru.basis_capability, ev.school_id, CURRENT_DATE)))
        OR (ru.recipient_basis = 'responsavel-autorizado' AND auth.uid() IN (SELECT public.notif_guardians(ev.subject_student_id, ev.school_id, ru.basis_section, CURRENT_DATE)))))
$fn$;
REVOKE ALL ON FUNCTION public.notif_still_authorized(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Leitura do próprio destinatário -------------------------------------------------------------------
CREATE FUNCTION public.my_notifications(_limit integer, _before timestamptz)
RETURNS TABLE(delivery_id uuid, event_kind text, title text, body text, mandatory boolean, has_link boolean, read_at timestamptz, recorded_at timestamptz, still_authorized boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY
  SELECT d.id, ev.event_kind,
    (SELECT coalesce(string_agg(CASE WHEN i % 2 = 1 THEN coalesce(ev.payload->>p, '—') ELSE p END, '' ORDER BY i), '') FROM unnest(regexp_split_to_array(t.title, '\{\{|\}\}')) WITH ORDINALITY AS s(p, o), LATERAL (SELECT o - 1 AS i) z),
    (SELECT coalesce(string_agg(CASE WHEN i % 2 = 1 THEN coalesce(ev.payload->>p, '—') ELSE p END, '' ORDER BY i), '') FROM unnest(regexp_split_to_array(t.body, '\{\{|\}\}')) WITH ORDINALITY AS s(p, o), LATERAL (SELECT o - 1 AS i) z),
    t.mandatory, ev.deep_link IS NOT NULL, rd.read_at, d.recorded_at, public.notif_still_authorized(d.id)
  FROM public.notification_deliveries d
  JOIN public.notification_events ev ON ev.id = d.event_id
  JOIN public.notification_template_versions t ON t.id = d.template_version_id
  LEFT JOIN public.notification_reads rd ON rd.delivery_id = d.id
  WHERE d.recipient_user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.notification_event_cancellations c WHERE c.event_id = ev.id)
    AND (ev.expires_at IS NULL OR ev.expires_at > now())
    AND (_before IS NULL OR d.recorded_at < _before)
  ORDER BY d.recorded_at DESC LIMIT least(greatest(coalesce(_limit, 30), 1), 100);
END $fn$;

CREATE FUNCTION public.my_unread_notification_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT count(*)::integer FROM public.notification_deliveries d JOIN public.notification_events ev ON ev.id = d.event_id
  WHERE d.recipient_user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.notification_reads r WHERE r.delivery_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM public.notification_event_cancellations c WHERE c.event_id = ev.id)
    AND (ev.expires_at IS NULL OR ev.expires_at > now())
$fn$;

-- Abrir: só o destinatário; revalida autorização; marca lida; devolve link apenas se ainda autorizado.
CREATE FUNCTION public.open_notification(_delivery uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE d public.notification_deliveries; ev public.notification_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO d FROM public.notification_deliveries WHERE id = _delivery AND recipient_user_id = auth.uid();
  IF d.id IS NULL THEN RAISE EXCEPTION 'notif:not-found'; END IF;
  SELECT * INTO ev FROM public.notification_events WHERE id = d.event_id;
  INSERT INTO public.notification_reads(delivery_id) VALUES (d.id) ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.notification_event_cancellations c WHERE c.event_id = ev.id) THEN RETURN jsonb_build_object('status','cancelada'); END IF;
  IF ev.expires_at IS NOT NULL AND ev.expires_at <= now() THEN RETURN jsonb_build_object('status','expirada'); END IF;
  IF NOT public.notif_still_authorized(d.id) THEN RETURN jsonb_build_object('status','acesso-revogado'); END IF;
  RETURN jsonb_build_object('status','ok','link', ev.deep_link);
END $fn$;

CREATE FUNCTION public.set_notification_preference(_kind text, _opted_out boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  INSERT INTO public.notification_preferences(user_id, event_kind, opted_out) VALUES (auth.uid(), _kind, _opted_out);
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'record_notification_template(text,uuid,text,text,text[],text,boolean,boolean,text)',
    'record_notification_rule(uuid,uuid,text,text,text,text,text,boolean,text)',
    'dispatch_notification_event(uuid)','emit_notification_event(text,text,text,text,jsonb,text,timestamptz)',
    'cancel_notification_event(uuid,text)','my_notifications(integer,timestamptz)','my_unread_notification_count()',
    'open_notification(uuid)','set_notification_preference(text,boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;