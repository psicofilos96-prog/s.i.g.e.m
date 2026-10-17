-- CPF rule shared by all enrollment writers; historical rows remain untouched.
ALTER TABLE public.sector_parameter_catalog DROP CONSTRAINT sector_parameter_catalog_value_kind_check;
ALTER TABLE public.sector_parameter_catalog ADD CONSTRAINT sector_parameter_catalog_value_kind_check CHECK (value_kind IN ('dias','escolha','percentual','data'));
ALTER TABLE public.institutional_person_identifiers DROP CONSTRAINT institutional_person_identifiers_identifier_kind_check;
ALTER TABLE public.institutional_person_identifiers ADD CONSTRAINT institutional_person_identifiers_identifier_kind_check CHECK (identifier_kind IN ('cpf-hmac','inep-pessoa','qp-mec','id-profissional','certidao-hmac'));

CREATE OR REPLACE FUNCTION public.secretariat_cpf_required_from() RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT coalesce((public.sector_parameter_value('secretaria.cpf-obrigatorio-desde') #>> '{}')::date, DATE '2017-12-01')
$$;
REVOKE ALL ON FUNCTION public.secretariat_cpf_required_from() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_cpf_required_from() TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_document_problem(_birth date, _has_cpf boolean, _has_certificate boolean) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT CASE WHEN _birth IS NULL THEN 'student:birth-required'
 WHEN _birth >= public.secretariat_cpf_required_from() AND NOT coalesce(_has_cpf,false) THEN 'student:cpf-required-by-birth'
 WHEN _birth < public.secretariat_cpf_required_from() AND NOT coalesce(_has_cpf,false) AND NOT coalesce(_has_certificate,false) THEN 'student:certificate-required' ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.secretariat_document_problem(date,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_document_problem(date,boolean,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_student_document_status(_school text, _student text)
RETURNS TABLE(birth_date date, has_cpf boolean, has_certificate boolean, cpf_required_from date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 PERFORM public.sec_actor();
 IF NOT public.has_school_capability('manter-matricula-e-enturmacao',_school) OR NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
 RETURN QUERY SELECT (SELECT v.birth_date FROM public.student_identity_versions v WHERE v.student_id=_student ORDER BY v.version DESC LIMIT 1),
 EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=_student AND i.identifier_kind='cpf-hmac'),
 EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=_student AND i.identifier_kind='certidao-hmac') OR EXISTS(SELECT 1 FROM public.enrollment_wizard_draft_events e WHERE e.kind='concluido' AND e.result->>'student_id'=_student AND nullif(btrim(e.payload#>>'{documentos,certidao}'),'') IS NOT NULL),
 public.secretariat_cpf_required_from();
END $$;
REVOKE ALL ON FUNCTION public.secretariat_student_document_status(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_student_document_status(text,text) TO authenticated;

-- Extend the existing parameter writer without replacing its authorization, concurrency or audit chain.
DO $$ DECLARE d text; old text := 'ELSIF NOT (c.allowed ? (_value #>> ''{}'')) THEN RAISE EXCEPTION ''parameter:choice-invalid''; END IF;'; BEGIN
 d := pg_get_functiondef('public.record_sector_parameter(text,jsonb,text,integer)'::regprocedure);
 IF position(old in d)=0 THEN RAISE EXCEPTION 'parameter-writer-contract-changed'; END IF;
 d := replace(d,old,'ELSIF c.value_kind = ''data'' THEN
    IF jsonb_typeof(_value) <> ''string'' OR (_value #>> ''{}'') !~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$'' THEN RAISE EXCEPTION ''parameter:date-invalid''; END IF;
    PERFORM (_value #>> ''{}'')::date;
  ELSIF NOT (c.allowed ? (_value #>> ''{}'')) THEN RAISE EXCEPTION ''parameter:choice-invalid''; END IF;');
 EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_draft_complete(_draft uuid, _expected integer, _year text, _declared_on date, _class text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; h public.enrollment_wizard_draft_events; nm text; sid text; pid uuid; p1 uuid; p2 uuid; p3 uuid;
 reused boolean := false; created boolean := false; enr text; ep text; res jsonb; c record;
 birth date; official_birth date; cert text; cert_hash text; problem text; hascpf boolean; hascert boolean; latest public.student_identity_versions;
BEGIN
 SELECT * INTO ac FROM public.sec_actor();
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
 h := public.ewd_head(_draft);
 IF h.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao',h.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
 IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
 IF h.sequence <> coalesce(_expected,-1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
 IF _declared_on IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
 IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'enrollment:year-not-open'; END IF;
 IF _class IS NOT NULL THEN
 SELECT * INTO c FROM public.institutional_classes WHERE id=_class;
 IF c.id IS NULL OR c.school_id<>h.school_id OR c.academic_year_id IS DISTINCT FROM _year THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
 END IF;
 BEGIN birth := nullif(h.payload#>>'{aluno,nascimento}','')::date; EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'student:birth-required'; END;
 cert := nullif(pg_catalog.btrim(h.payload#>>'{documentos,certidao}'),'');
 IF cert IS NOT NULL THEN
 IF length(cert)>120 OR length(regexp_replace(cert,'[^[:alnum:]]','','g'))<5 THEN RAISE EXCEPTION 'student:certificate-invalid'; END IF;
 SELECT encode(extensions.hmac(convert_to('birth-certificate:'||upper(regexp_replace(cert,'[^[:alnum:]]','','g')),'UTF8'),s.secret,'sha256'),'hex') INTO cert_hash FROM public.technical_identity_secrets s WHERE s.purpose='cpf-fingerprint';
 IF cert_hash IS NULL THEN RAISE EXCEPTION 'identity:fingerprint-unavailable'; END IF;
 END IF;
 IF h.existing_student_id IS NOT NULL THEN
 sid:=h.existing_student_id; reused:=true;
 IF NOT EXISTS(SELECT 1 FROM public.school_enrollments e WHERE e.student_id=sid AND e.school_id=h.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
 SELECT * INTO latest FROM public.student_identity_versions v WHERE v.student_id=sid ORDER BY v.version DESC LIMIT 1;
 official_birth:=latest.birth_date;
 IF official_birth IS NOT NULL AND birth IS NOT NULL AND birth<>official_birth THEN RAISE EXCEPTION 'student:birth-conflict'; END IF;
 birth:=coalesce(official_birth,birth);
 SELECT sp.person_id INTO pid FROM public.institutional_student_persons sp WHERE sp.student_id=sid;
 IF pid IS NULL THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 ELSE
 nm:=pg_catalog.btrim(coalesce(h.payload#>>'{aluno,nome}',''));
 IF nm='' OR length(nm)>255 THEN RAISE EXCEPTION 'student:name-required'; END IF;
 IF NOT public.has_school_capability('cadastrar-estudante-na-escola',h.school_id) THEN RAISE EXCEPTION 'student:capability-missing'; END IF;
 END IF;
 hascpf:=h.cpf_hmac IS NOT NULL OR EXISTS(SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id=pid AND i.identifier_kind='cpf-hmac');
 hascert:=cert IS NOT NULL OR EXISTS(SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id=pid AND i.identifier_kind='certidao-hmac') OR EXISTS(SELECT 1 FROM public.enrollment_wizard_draft_events e WHERE e.kind='concluido' AND e.result->>'student_id'=sid AND nullif(btrim(e.payload#>>'{documentos,certidao}'),'') IS NOT NULL);
 problem:=public.secretariat_document_problem(birth,hascpf,hascert);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem; END IF;
 -- Locks and exact identities use the existing canonical person registry, including certificate fingerprint.
 IF h.cpf_hmac IS NOT NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:'||h.cpf_hmac));
 SELECT i.person_id INTO p1 FROM public.institutional_person_identifiers i WHERE i.identifier_kind='cpf-hmac' AND i.value=h.cpf_hmac;
 END IF;
 IF h.inep IS NOT NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:'||h.inep));
 SELECT i.person_id INTO p2 FROM public.institutional_person_identifiers i WHERE i.identifier_kind='inep-pessoa' AND i.value=h.inep;
 END IF;
 IF cert_hash IS NOT NULL THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:'||cert_hash));
 SELECT i.person_id INTO p3 FROM public.institutional_person_identifiers i WHERE i.identifier_kind='certidao-hmac' AND i.value=cert_hash;
 END IF;
 IF (p1 IS NOT NULL AND p2 IS NOT NULL AND p1<>p2) OR (p1 IS NOT NULL AND p3 IS NOT NULL AND p1<>p3) OR (p2 IS NOT NULL AND p3 IS NOT NULL AND p2<>p3) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 IF h.existing_student_id IS NULL THEN
 pid:=coalesce(p1,p2,p3);
 IF pid IS NOT NULL AND EXISTS(SELECT 1 FROM public.institutional_student_persons sp WHERE sp.person_id=pid) THEN RAISE EXCEPTION 'identity:already-registered-use-search'; END IF;
 -- A name+birth candidate must be resolved, never silently merged or duplicated.
 IF EXISTS(SELECT 1 FROM public.student_identity_versions v WHERE v.birth_date=birth AND lower(btrim(v.civil_name))=lower(nm) AND NOT EXISTS(SELECT 1 FROM public.student_identity_versions n WHERE n.student_id=v.student_id AND n.version>v.version)) THEN RAISE EXCEPTION 'identity:already-registered-use-search'; END IF;
 IF pid IS NULL THEN INSERT INTO public.institutional_persons(display_name,actor_nature) VALUES(nm,'pessoa-natural') RETURNING id INTO pid; ELSE reused:=true; END IF;
 sid:='est-'||pg_catalog.gen_random_uuid(); created:=true;
 INSERT INTO public.institutional_students(id,display_name) VALUES(sid,nm);
 INSERT INTO public.institutional_student_persons(student_id,person_id) VALUES(sid,pid);
 IF ac.kind='human' THEN
 INSERT INTO public.student_registration_events(student_id,person_id,school_id,purpose,person_reused,author_user_id,author_person_id) VALUES(sid,pid,h.school_id,'matricula-na-escola',reused,auth.uid(),ac.person_id);
 END IF;
 ELSE
 IF (p1 IS NOT NULL AND p1<>pid) OR (p2 IS NOT NULL AND p2<>pid) OR (p3 IS NOT NULL AND p3<>pid) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 END IF;
 IF h.cpf_hmac IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id=pid AND i.identifier_kind='cpf-hmac' AND i.value<>h.cpf_hmac) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 INSERT INTO public.institutional_person_identifiers(person_id,identifier_kind,value) VALUES(pid,'cpf-hmac',h.cpf_hmac) ON CONFLICT DO NOTHING;
 END IF;
 IF h.inep IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id=pid AND i.identifier_kind='inep-pessoa' AND i.value<>h.inep) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 INSERT INTO public.institutional_person_identifiers(person_id,identifier_kind,value) VALUES(pid,'inep-pessoa',h.inep) ON CONFLICT DO NOTHING;
 END IF;
 IF cert_hash IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id=pid AND i.identifier_kind='certidao-hmac' AND i.value<>cert_hash) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
 INSERT INTO public.institutional_person_identifiers(person_id,identifier_kind,value) VALUES(pid,'certidao-hmac',cert_hash) ON CONFLICT DO NOTHING;
 END IF;
 -- Persist newly supplied birth in the existing append-only identity chain before opening the enrollment.
 IF created OR official_birth IS NULL THEN
 PERFORM pg_advisory_xact_lock(hashtext('student-identity:'||sid));
 SELECT * INTO latest FROM public.student_identity_versions v WHERE v.student_id=sid ORDER BY v.version DESC LIMIT 1;
 INSERT INTO public.student_identity_versions(student_id,version,supersedes_id,birth_date,civil_name,social_name,sex_value_id,sex_value_version,correction_reason,originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id,recorded_by_principal_id)
 VALUES(sid,coalesce(latest.version,0)+1,latest.id,birth,coalesce(latest.civil_name,nm,h.payload#>>'{aluno,nome}'),coalesce(latest.social_name,h.payload#>>'{aluno,nomeSocial}'),latest.sex_value_id,latest.sex_value_version,CASE WHEN latest.id IS NOT NULL THEN 'Complementação do nascimento na matrícula' END,'draft:'||_draft::text,auth.uid(),CASE WHEN ac.kind='human' THEN ac.person_id END,NULL,CASE WHEN ac.kind<>'human' THEN ac.principal_id END);
 END IF;
 enr:=public.s_enroll_core(sid,h.school_id,_year,_declared_on,NULL);
 IF _class IS NOT NULL THEN ep:=public.sec_allocate_core(enr,_class,_declared_on,NULL); END IF;
 res:=jsonb_build_object('student_id',sid,'enrollment_id',enr,'episode_id',ep,'class_id',_class,'year_id',_year,'declared_on',_declared_on,'student_created',created,'person_reused',reused);
 INSERT INTO public.enrollment_wizard_draft_events(draft_id,sequence,school_id,kind,step,payload,cpf_hmac,cpf_hint,inep,existing_student_id,result,author_user_id,author_actor_kind,author_person_id,author_principal_id)
 VALUES(_draft,h.sequence+1,h.school_id,'concluido',8,h.payload,h.cpf_hmac,h.cpf_hint,h.inep,sid,res,auth.uid(),ac.kind,ac.person_id,ac.principal_id);
 RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.secretariat_enrollment_document_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE b date; hc boolean; ht boolean; err text;
BEGIN
 -- Only a new enrollment is gated; a corrective version cannot erase historical enrollment rights.
 IF NEW.supersedes_id IS NOT NULL THEN RETURN NEW; END IF;
 SELECT v.birth_date INTO b FROM public.student_identity_versions v WHERE v.student_id=NEW.student_id ORDER BY v.version DESC LIMIT 1;
 SELECT EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=NEW.student_id AND i.identifier_kind='cpf-hmac'),
 EXISTS(SELECT 1 FROM public.institutional_student_persons sp JOIN public.institutional_person_identifiers i ON i.person_id=sp.person_id WHERE sp.student_id=NEW.student_id AND i.identifier_kind='certidao-hmac') OR EXISTS(SELECT 1 FROM public.enrollment_wizard_draft_events e WHERE e.kind='concluido' AND e.result->>'student_id'=NEW.student_id AND nullif(btrim(e.payload#>>'{documentos,certidao}'),'') IS NOT NULL) INTO hc,ht;
 err:=public.secretariat_document_problem(b,hc,ht);
 IF err IS NOT NULL THEN RAISE EXCEPTION '%',err; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_enrollment_document_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enrollment_document_rule BEFORE INSERT ON public.school_enrollments FOR EACH ROW EXECUTE FUNCTION public.secretariat_enrollment_document_guard();