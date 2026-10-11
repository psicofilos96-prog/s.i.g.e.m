ALTER TABLE public.teaching_plan_share_events ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.teaching_plan_share_events ALTER COLUMN recorded_at SET DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION public.share_teaching_plan(_plan text, _recipient uuid, _revoke boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pv public.teaching_plan_versions; nid uuid; active boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO pv FROM public.teaching_plan_versions v WHERE v.plan_id = _plan ORDER BY v.version DESC LIMIT 1;
  IF pv.id IS NULL OR pv.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'sipe:only-author-shares'; END IF;
  IF _recipient = auth.uid() THEN RAISE EXCEPTION 'sipe:self-share'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sipe-share:' || _plan || ':' || _recipient));
  SELECT (e.event = 'compartilhado') INTO active FROM public.teaching_plan_share_events e WHERE e.plan_id = _plan AND e.recipient_user_id = _recipient ORDER BY e.seq DESC LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.teaching_plans_shared_with_me() RETURNS SETOF public.teaching_plan_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT v.* FROM public.teaching_plan_versions v
   WHERE v.version = (SELECT max(x.version) FROM public.teaching_plan_versions x WHERE x.plan_id = v.plan_id)
     AND v.status <> 'arquivado'
     AND (SELECT e.event FROM public.teaching_plan_share_events e WHERE e.plan_id = v.plan_id AND e.recipient_user_id = auth.uid() ORDER BY e.seq DESC LIMIT 1) = 'compartilhado';
END $$;