CREATE TABLE public.student_protection_recipient_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), measure_id uuid NOT NULL, protection_seq integer NOT NULL,
 authorization_logical_id uuid NOT NULL, seq integer NOT NULL CHECK(seq>0), action text NOT NULL CHECK(action IN ('indicar','retirar')),
 reason text NOT NULL CHECK(length(btrim(reason))>=5), recorded_by uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(measure_id,authorization_logical_id,seq), FOREIGN KEY(measure_id,protection_seq) REFERENCES public.student_protection_events(measure_id,seq)
);
GRANT ALL ON public.student_protection_recipient_events TO service_role;
REVOKE ALL ON public.student_protection_recipient_events FROM anon, authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.student_protection_recipient_events FROM service_role;
ALTER TABLE public.student_protection_recipient_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER protection_recipient_immutable BEFORE UPDATE OR DELETE ON public.student_protection_recipient_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE FUNCTION public.school_protection_recipients(_school text,_student text,_measure uuid)
RETURNS TABLE(authorization_id uuid,guardian_name text,indicated boolean,sequence integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.student_protection_events;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao',_school) THEN RAISE EXCEPTION 'protection:capability-missing'; END IF;
 SELECT x.* INTO p FROM public.student_protection_events x WHERE x.measure_id=_measure AND x.school_id=_school AND x.student_id=_student ORDER BY x.seq DESC LIMIT 1;
 IF p.id IS NULL THEN RAISE EXCEPTION 'protection:not-found'; END IF;
 RETURN QUERY SELECT a.logical_id,person.display_name,coalesce(r.action='indicar' AND r.protection_seq=p.seq,false),coalesce(r.seq,0)
 FROM public.guardian_authorizations a JOIN public.institutional_persons person ON person.id=a.guardian_person_id
 LEFT JOIN LATERAL(SELECT e.* FROM public.student_protection_recipient_events e WHERE e.measure_id=_measure AND e.authorization_logical_id=a.logical_id ORDER BY e.seq DESC LIMIT 1) r ON true
 WHERE a.student_id=_student AND a.event_kind<>'revogacao' AND a.valid_from<=current_date AND (a.valid_until IS NULL OR a.valid_until>=current_date)
 AND NOT EXISTS(SELECT 1 FROM public.guardian_authorizations n WHERE n.supersedes_id=a.id)
 AND EXISTS(SELECT 1 FROM public.user_person_links l WHERE l.person_id=a.guardian_person_id AND l.user_id=a.guardian_user_id)
 AND public.family_enrollment_school(_student,current_date)=_school
 ORDER BY person.display_name,a.logical_id;
END $$;
REVOKE ALL ON FUNCTION public.school_protection_recipients(text,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.school_protection_recipients(text,text,uuid) TO authenticated;
CREATE FUNCTION public.record_protection_recipient(_school text,_student text,_measure uuid,_authorization uuid,_action text,_reason text,_expected_seq integer,_expected_protection_seq integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.student_protection_events; cur integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao',_school) THEN RAISE EXCEPTION 'protection:capability-missing'; END IF;
 IF _action IS NULL OR _action NOT IN('indicar','retirar') THEN RAISE EXCEPTION 'protection:transition-invalid'; END IF;
 IF length(btrim(coalesce(_reason,'')))<5 THEN RAISE EXCEPTION 'protection:reason-required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('protection:'||_measure::text));
 SELECT x.* INTO p FROM public.student_protection_events x WHERE x.measure_id=_measure AND x.school_id=_school AND x.student_id=_student ORDER BY x.seq DESC LIMIT 1;
 IF p.id IS NULL THEN RAISE EXCEPTION 'protection:not-found'; END IF;
 IF p.seq IS DISTINCT FROM _expected_protection_seq THEN RAISE EXCEPTION 'protection:stale-base'; END IF;
 IF p.action='encerrar' OR p.valid_from>current_date OR (p.valid_until IS NOT NULL AND p.valid_until<current_date) THEN RAISE EXCEPTION 'protection:transition-invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.school_protection_recipients(_school,_student,_measure) c WHERE c.authorization_id=_authorization) THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
 SELECT coalesce(max(e.seq),0) INTO cur FROM public.student_protection_recipient_events e WHERE e.measure_id=_measure AND e.authorization_logical_id=_authorization;
 IF cur IS DISTINCT FROM _expected_seq THEN RAISE EXCEPTION 'protection:stale-base'; END IF;
 INSERT INTO public.student_protection_recipient_events(measure_id,protection_seq,authorization_logical_id,seq,action,reason,recorded_by)
 VALUES(_measure,p.seq,_authorization,cur+1,_action,btrim(_reason),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.record_protection_recipient(text,text,uuid,uuid,text,text,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.record_protection_recipient(text,text,uuid,uuid,text,text,integer,integer) TO authenticated;
CREATE FUNCTION public.family_protection_notice(_student text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.guardian_authorizations; visible boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
 a:=public.family_authorization(_student);
 IF a.id IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.student_protection_events p
 JOIN public.student_protection_recipient_events r ON r.measure_id=p.measure_id AND r.protection_seq=p.seq AND r.authorization_logical_id=a.logical_id
 WHERE p.student_id=_student AND p.school_id=a.school_id AND p.action<>'encerrar' AND p.valid_from<=current_date AND (p.valid_until IS NULL OR p.valid_until>=current_date)
 AND NOT EXISTS(SELECT 1 FROM public.student_protection_events n WHERE n.measure_id=p.measure_id AND n.seq>p.seq)
 AND r.action='indicar' AND NOT EXISTS(SELECT 1 FROM public.student_protection_recipient_events n WHERE n.measure_id=r.measure_id AND n.authorization_logical_id=r.authorization_logical_id AND n.seq>r.seq)) INTO visible;
 IF visible THEN INSERT INTO public.student_protection_access_log(school_id,student_id,what,accessed_by) VALUES(a.school_id,_student,'aviso-familia',auth.uid()); END IF;
 RETURN visible;
END $$;
REVOKE ALL ON FUNCTION public.family_protection_notice(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.family_protection_notice(text) TO authenticated;
COMMENT ON FUNCTION public.family_protection_notice(text) IS 'Somente aviso genérico para responsável explicitamente indicado pela escola. Sem nomes, tipo, vigência, teor ou arquivo judicial. Correção da medida exige nova indicação.';