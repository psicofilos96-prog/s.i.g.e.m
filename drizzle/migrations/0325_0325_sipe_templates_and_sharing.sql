-- SIPE.1: modelos de planejamento versionados (Secretaria) e compartilhamento seletivo professor→professor.
CREATE TABLE public.sipe_plan_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL CHECK (scope_key ~ '^(rede|escola:[A-Za-z0-9_-]+)$'),
  segment_key text NOT NULL CHECK (length(btrim(segment_key)) BETWEEN 1 AND 60),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.sipe_plan_template_versions(id),
  plan_mode text NOT NULL CHECK (plan_mode IN ('unidocente','por-componente')),
  day_fields jsonb NOT NULL,
  change_reason text,
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, segment_key, version)
);
GRANT SELECT ON public.sipe_plan_template_versions TO authenticated;
GRANT ALL ON public.sipe_plan_template_versions TO service_role;
ALTER TABLE public.sipe_plan_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sipe_tpl_read ON public.sipe_plan_template_versions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER sipe_tpl_immutable BEFORE UPDATE OR DELETE ON public.sipe_plan_template_versions FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

CREATE OR REPLACE FUNCTION public.record_sipe_plan_template(_scope text, _segment text, _expected_head uuid, _mode text, _fields jsonb, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.sipe_plan_template_versions; f jsonb; nid uuid; sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _scope = 'rede' THEN
    IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'configurar-modelo-planejamento' AND c.scope_level = 'rede') THEN RAISE EXCEPTION 'sipe:template-capability-missing'; END IF;
  ELSIF _scope ~ '^escola:' THEN
    sch := substr(_scope, 8);
    IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.capability_id IN ('configurar-modelo-planejamento','manter-modelo-de-documento-escolar') AND ((c.scope_level = 'escola' AND c.school_id = sch) OR c.scope_level = 'rede')) THEN RAISE EXCEPTION 'sipe:template-capability-missing'; END IF;
  ELSE RAISE EXCEPTION 'sipe:invalid-scope'; END IF;
  IF jsonb_typeof(_fields) <> 'array' OR jsonb_array_length(_fields) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'sipe:invalid-fields'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(_fields) LOOP
    IF jsonb_typeof(f) <> 'string' OR length(btrim(f #>> '{}')) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'sipe:invalid-fields'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('sipe-tpl:' || _scope || ':' || _segment));
  SELECT * INTO head FROM public.sipe_plan_template_versions t WHERE t.scope_key = _scope AND t.segment_key = btrim(_segment) ORDER BY t.version DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'sipe:stale-head'; END IF;
  IF head.id IS NOT NULL AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'sipe:reason-required'; END IF;
  INSERT INTO public.sipe_plan_template_versions(scope_key, segment_key, version, supersedes_id, plan_mode, day_fields, change_reason, author_user_id)
    VALUES (_scope, btrim(_segment), coalesce(head.version,0)+1, head.id, _mode, _fields, nullif(btrim(_reason),''), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_sipe_plan_template(text,text,uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sipe_plan_template(text,text,uuid,text,jsonb,text) TO authenticated;

-- Compartilhamento: ledger append-only; leitura do plano compartilhado só por reader DEFINER que confere o ledger.
CREATE TABLE public.teaching_plan_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  recipient_user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('compartilhado','revogado')),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teaching_plan_share_events TO authenticated;
GRANT ALL ON public.teaching_plan_share_events TO service_role;
ALTER TABLE public.teaching_plan_share_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tps_read ON public.teaching_plan_share_events FOR SELECT TO authenticated USING (actor_user_id = auth.uid() OR recipient_user_id = auth.uid());
CREATE TRIGGER tps_immutable BEFORE UPDATE OR DELETE ON public.teaching_plan_share_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

CREATE OR REPLACE FUNCTION public.sipe_my_schools() RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT e.school_id FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id
   WHERE l.user_id = auth.uid() AND e.school_id IS NOT NULL AND e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
     AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= CURRENT_DATE)
$$;
REVOKE ALL ON FUNCTION public.sipe_my_schools() FROM PUBLIC, anon, authenticated;

/** Colegas com atuação vigente numa escola em comum (só nome e conta), para escolher destinatário. */
CREATE OR REPLACE FUNCTION public.sipe_colleagues() RETURNS TABLE(user_id uuid, display_name text, school_id text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT DISTINCT l.user_id, p.display_name, e.school_id
    FROM public.institutional_engagements e JOIN public.user_person_links l ON l.person_id = e.person_id JOIN public.institutional_persons p ON p.id = e.person_id
   WHERE e.school_id IN (SELECT public.sipe_my_schools()) AND l.user_id <> auth.uid()
     AND e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
     AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= CURRENT_DATE)
   ORDER BY p.display_name;
END $$;
REVOKE ALL ON FUNCTION public.sipe_colleagues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sipe_colleagues() TO authenticated;

CREATE OR REPLACE FUNCTION public.share_teaching_plan(_plan text, _recipient uuid, _revoke boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pv public.teaching_plan_versions; nid uuid; active boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO pv FROM public.teaching_plan_versions v WHERE v.plan_id = _plan ORDER BY v.version DESC LIMIT 1;
  IF pv.id IS NULL OR pv.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'sipe:only-author-shares'; END IF;
  IF _recipient = auth.uid() THEN RAISE EXCEPTION 'sipe:self-share'; END IF;
  SELECT (e.event = 'compartilhado') INTO active FROM public.teaching_plan_share_events e WHERE e.plan_id = _plan AND e.recipient_user_id = _recipient ORDER BY e.recorded_at DESC LIMIT 1;
  IF coalesce(_revoke,false) THEN
    IF NOT coalesce(active,false) THEN RAISE EXCEPTION 'sipe:not-shared'; END IF;
  ELSE
    IF coalesce(active,false) THEN RAISE EXCEPTION 'sipe:already-shared'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sipe_colleagues() c WHERE c.user_id = _recipient AND c.school_id = pv.school_id) THEN RAISE EXCEPTION 'sipe:recipient-not-colleague'; END IF;
  END IF;
  INSERT INTO public.teaching_plan_share_events(plan_id, recipient_user_id, event, actor_user_id)
    VALUES (_plan, _recipient, CASE WHEN coalesce(_revoke,false) THEN 'revogado' ELSE 'compartilhado' END, auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.share_teaching_plan(text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_teaching_plan(text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.teaching_plans_shared_with_me() RETURNS SETOF public.teaching_plan_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT v.* FROM public.teaching_plan_versions v
   WHERE v.version = (SELECT max(x.version) FROM public.teaching_plan_versions x WHERE x.plan_id = v.plan_id)
     AND v.status <> 'arquivado'
     AND (SELECT e.event FROM public.teaching_plan_share_events e WHERE e.plan_id = v.plan_id AND e.recipient_user_id = auth.uid() ORDER BY e.recorded_at DESC LIMIT 1) = 'compartilhado';
END $$;
REVOKE ALL ON FUNCTION public.teaching_plans_shared_with_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaching_plans_shared_with_me() TO authenticated;

-- Procedência de cópia adaptada a partir de plano compartilhado (o writer v2 só aceita cópia de estrutura própria).
CREATE TABLE public.teaching_plan_share_copies (
  new_plan_id text PRIMARY KEY,
  source_version_id uuid NOT NULL REFERENCES public.teaching_plan_versions(id),
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teaching_plan_share_copies TO authenticated;
GRANT ALL ON public.teaching_plan_share_copies TO service_role;
ALTER TABLE public.teaching_plan_share_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tpsc_read ON public.teaching_plan_share_copies FOR SELECT TO authenticated USING (author_user_id = auth.uid());
CREATE TRIGGER tpsc_immutable BEFORE UPDATE OR DELETE ON public.teaching_plan_share_copies FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

CREATE OR REPLACE FUNCTION public.record_shared_plan_copy(_new_plan text, _source_version uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions v WHERE v.plan_id = _new_plan AND v.author_user_id = auth.uid()) THEN RAISE EXCEPTION 'sipe:copy-not-own'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teaching_plans_shared_with_me() s WHERE s.id = _source_version) THEN RAISE EXCEPTION 'sipe:source-not-shared'; END IF;
  INSERT INTO public.teaching_plan_share_copies(new_plan_id, source_version_id, author_user_id) VALUES (_new_plan, _source_version, auth.uid());
  RETURN _new_plan;
END $$;
REVOKE ALL ON FUNCTION public.record_shared_plan_copy(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_shared_plan_copy(text,uuid) TO authenticated;