-- Teste independente: escopo declarado deve sobreviver à alteração e só sair por remoção explícita. Tudo revertido.
DO $test$
DECLARE school text := 'school-calendar-root-rollback-' || gen_random_uuid()::text;
 sv uuid := '06cd106b-32f4-4434-b990-3ae3be2cf4a4'; source text := 'calendar-root-applicability-' || gen_random_uuid()::text;
 p jsonb; a jsonb; b jsonb; c jsonb; r jsonb; n integer;
BEGIN
 INSERT INTO public.institutional_schools(id) VALUES(school);
 INSERT INTO public.institutional_school_record_versions(school_id,version_number,official_name,active,valid_from)
 VALUES(school,1,'Escola fictícia exclusiva do teste com rollback',true,'2027-01-01');
 PERFORM set_config('request.jwt.claims', json_build_object('sub',sv,'role','authenticated')::text,true);
 PERFORM set_config('role','authenticated',true);
 p := jsonb_build_object('year',2027,'title','Teste preservação de aplicabilidade','actRef','Teste rollback','reason','Teste',
 'periods','[]'::jsonb,'dayTypes','[{"code":"ROOT-LET","label":"Teste letivo","effect":true}]'::jsonb,
 'days','[{"day":"2027-02-01","code":"ROOT-LET"}]'::jsonb,'events','[]'::jsonb,
 'sourceKind','edicao-institucional','sourceEntryId',source,'digest',repeat('a',64),
 'raw',jsonb_build_object('id',source),'presentation',jsonb_build_object('editorCalendar',jsonb_build_object('id',source)),
 'applicability',jsonb_build_array(jsonb_build_object('scope_key','escola-completa','label','Escola explícita','window_from','2027-01-01','window_until','2027-12-31',
 'conditions',jsonb_build_array(jsonb_build_object('kind','escola','school_id',school)))));
 a := public.save_network_calendar(source,NULL,p);
 IF (a->>'applicabilityScopes')::int <> 1 THEN RAISE EXCEPTION 'Escopo inicial não salvo'; END IF;
 b := public.save_network_calendar(source,(a->>'versionId')::uuid,p - 'applicability');
 IF (b->>'applicabilityScopes')::int <> 1 THEN RAISE EXCEPTION 'Escopo não herdado'; END IF;
 r := public.calendar_applicability_options_at((b->>'versionId')::uuid);
 IF jsonb_array_length(r->'scopes') <> 1 OR r->'scopes'->0->>'scope_key' <> 'escola-completa'
 OR r->'scopes'->0->>'window_from' <> '2027-01-01' OR r->'scopes'->0->>'window_until' <> '2027-12-31'
 OR r->'scopes'->0->'conditions'->0->>'school_id' <> school THEN
 RAISE EXCEPTION 'Janela/condição não preservada: %', r; END IF;
 c := public.save_network_calendar(source,(b->>'versionId')::uuid,jsonb_set(p,'{applicability}','[]'));
 IF (c->>'applicabilityScopes')::int <> 0 THEN RAISE EXCEPTION 'Remoção explícita ignorada'; END IF;
 SELECT count(*) INTO n FROM public.calendar_version_context_pending WHERE version_id=(c->>'versionId')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Pendência não registrada após retirada'; END IF;
 RAISE EXCEPTION 'calendar-root-applicability-ok';
END $test$;