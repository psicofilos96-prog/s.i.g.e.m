CREATE FUNCTION public.infrequency_notification_configuration() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.notification_template_versions; r public.notification_delivery_rules;
BEGIN
 PERFORM public.notif_grant('manter-comunicacao-institucional',NULL);
 SELECT * INTO t FROM public.notification_template_versions WHERE template_key='infrequencia-responsavel' ORDER BY version DESC LIMIT 1;
 SELECT * INTO r FROM public.notification_delivery_rules WHERE event_kind='infrequencia-aviso' AND template_key='infrequencia-responsavel' ORDER BY recorded_at DESC,id LIMIT 1;
 RETURN jsonb_build_object('template_id',t.id,'rule_id',r.id,'rule_logical_id',r.logical_id,'version',coalesce(t.version,0),'title',coalesce(t.title,'Aviso de frequência escolar'),'body',coalesce(t.body,'A escola solicita seu comparecimento à Secretaria para conversar sobre a frequência escolar do estudante sob sua responsabilidade.'),'enabled',coalesce(NOT r.retired AND NOT t.retired,false),'recorded_at',t.recorded_at,'reason',t.reason);
END $$;
REVOKE ALL ON FUNCTION public.infrequency_notification_configuration() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.infrequency_notification_configuration() TO authenticated;
CREATE FUNCTION public.record_infrequency_notification_configuration(_template_base uuid,_rule_base uuid,_title text,_body text,_enabled boolean,_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.notification_template_versions; r public.notification_delivery_rules;
BEGIN
 PERFORM public.notif_grant('manter-comunicacao-institucional',NULL);
 IF length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'notif:reason-required'; END IF;
 IF coalesce(_title,'') ~ '\{\{' OR coalesce(_body,'') ~ '\{\{' THEN RAISE EXCEPTION 'notif:undeclared-variable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('infrequency-notification-configuration'));
 SELECT * INTO t FROM public.notification_template_versions WHERE template_key='infrequencia-responsavel' ORDER BY version DESC LIMIT 1;
 SELECT * INTO r FROM public.notification_delivery_rules WHERE event_kind='infrequencia-aviso' AND template_key='infrequencia-responsavel' ORDER BY recorded_at DESC,id LIMIT 1;
 IF t.id IS DISTINCT FROM _template_base OR r.id IS DISTINCT FROM _rule_base THEN RAISE EXCEPTION 'notif:base-superseded'; END IF;
 PERFORM public.record_notification_template('infrequencia-responsavel',t.id,btrim(_title),btrim(_body),'{}'::text[],'Você tem uma nova comunicação da escola.',true,NOT _enabled,_reason);
 PERFORM public.record_notification_rule(r.logical_id,r.id,'infrequencia-aviso','infrequencia-responsavel','responsavel-autorizado',NULL,'frequencia',NOT _enabled,_reason);
 RETURN public.infrequency_notification_configuration();
END $$;
REVOKE ALL ON FUNCTION public.record_infrequency_notification_configuration(uuid,uuid,text,text,boolean,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.record_infrequency_notification_configuration(uuid,uuid,text,text,boolean,text) TO authenticated;