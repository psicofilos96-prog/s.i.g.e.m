-- NAE.8 Lote 4 — prova transacional da Central/relatórios/drill-down (readers 0192). Termina em RAISE: nada persiste.
-- Fatos sintéticos (prefixo NAE8L4) inseridos pelo proprietário só para montar o cenário de LEITURA; os writers
-- canônicos que geram esses fatos já foram provados nos Lotes 1 e 3. Dublê transacional de effective_scope_capabilities
-- (mesmo padrão dos Lotes 1–3). Sucesso = 'nae8-l4-ok: ...'.
DO $t$
DECLARE _ok text := ''; td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; comp text; f0 date; s1 text; s2 text;
  pN uuid := gen_random_uuid(); uN uuid := gen_random_uuid();   -- Núcleo (acompanhar rede, só leitura)
  pC uuid := gen_random_uuid(); uC uuid := gen_random_uuid();   -- consulta escolar s1
  win uuid := gen_random_uuid(); o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); id1 uuid; id2 uuid;
  sch uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  ev uuid := gen_random_uuid(); ev2 uuid := gen_random_uuid(); eid uuid; cl uuid;
  r record; n bigint; v numeric; tot bigint; pages bigint; before_ text; after_ text; j jsonb;
BEGIN
  comp := to_char(td, 'YYYY-MM'); f0 := date_trunc('month', td)::date;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  IF (SELECT count(*) FROM public.meal_order_versions) + (SELECT count(*) FROM public.meal_inventory_movements) + (SELECT count(*) FROM public.meal_receipts) <> 0
    THEN RAISE EXCEPTION 'pre: domínio não vazio'; END IF;

  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES (pN,'NAE8L4 Núcleo','pessoa-natural'),(pC,'NAE8L4 Consulta','pessoa-natural');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uN,pN),(uC,pC);

  -- pedidos: o1 rascunho→submetido(10)→autorizado-parcial(6); o2 só rascunho; s2 com um pedido próprio
  INSERT INTO public.meal_order_windows(logical_id, version, action, competence, opens_at, closes_at, time_zone, basis, author_user_id, author_person_id, author_engagement)
    VALUES (win,1,'abertura',comp,now()-interval '1 day',now()+interval '1 day','America/Sao_Paulo','abertura-explicita',uN,pN,gen_random_uuid()) RETURNING id INTO win;
  INSERT INTO public.meal_order_versions(logical_id,version,status,school_id,competence,window_version_id,lines,author_user_id,author_person_id,author_engagement)
    VALUES (o1,1,'rascunho',s1,comp,win,'[]',uC,pC,gen_random_uuid()) RETURNING id INTO id1;
  INSERT INTO public.meal_order_versions(logical_id,version,supersedes_id,status,school_id,competence,window_version_id,lines,author_user_id,author_person_id,author_engagement)
    VALUES (o1,2,id1,'submetido',s1,comp,win,'[{"item_ref":"i","quantidade":10}]',uC,pC,gen_random_uuid()) RETURNING id INTO id2;
  INSERT INTO public.meal_order_versions(logical_id,version,supersedes_id,status,school_id,competence,window_version_id,lines,reason,author_user_id,author_person_id,author_engagement)
    VALUES (o1,3,id2,'autorizado-parcial',s1,comp,win,'[{"item_ref":"i","quantidade":6}]','Teto sintético',uN,pN,gen_random_uuid());
  INSERT INTO public.meal_order_versions(logical_id,version,status,school_id,competence,window_version_id,lines,author_user_id,author_person_id,author_engagement) VALUES
    (o2,1,'rascunho',s1,comp,win,'[]',uC,pC,gen_random_uuid()), (gen_random_uuid(),1,'submetido',s2,comp,win,'[]',uC,pC,gen_random_uuid());

  -- entregas: integral, parcial, rejeitada, pendente
  INSERT INTO public.meal_delivery_schedules(logical_id,version,action,order_logical_id,competence,school_id,item_ref,unidade_ref,quantity,expected_on,author_user_id,author_person_id,author_engagement)
    SELECT sch[i],1,'programacao',o1,comp,s1,gen_random_uuid(),gen_random_uuid(),q,f0,uN,pN,gen_random_uuid()
    FROM (VALUES (1,10),(2,10),(3,5),(4,5)) x(i,q);
  INSERT INTO public.meal_receipts(logical_id,version,status,schedule_logical_id,school_id,received_at,time_zone,delivered_qty,accepted_qty,rejected_qty,lot,expires_on,author_user_id,author_person_id,author_engagement) VALUES
    (gen_random_uuid(),1,'confirmado',sch[1],s1,now(),'America/Sao_Paulo',10,10,0,'L1',td+30,uC,pC,gen_random_uuid()),
    (gen_random_uuid(),1,'confirmado',sch[2],s1,now(),'America/Sao_Paulo',10,4,6,NULL,NULL,uC,pC,gen_random_uuid()),
    (gen_random_uuid(),1,'confirmado',sch[3],s1,now(),'America/Sao_Paulo',5,0,5,NULL,NULL,uC,pC,gen_random_uuid());
  -- estoque: só aceites viram entrada (rejeitada não tem movimento); saídas separadas por classe
  INSERT INTO public.meal_inventory_movements(logical_id,version,event_kind,school_id,item_value_id,item_value_version,unit_value_id,unit_value_version,movement_kind,quantity,moved_on,movement_class,direction,lot,expires_on,author_user_id,author_person_id,author_engagement)
    SELECT gen_random_uuid(),1,'registro',s1,'nae8l4-arroz',1,'nae8l4-kg',1,k,q,f0,c,d,l,e,uC,pC,gen_random_uuid()
    FROM (VALUES ('entrada','entrada-aceite',1,10,'L1',td+30),('entrada','entrada-aceite',1,4,NULL,NULL),('saida','perda',-1,1,'L1',NULL),
                 ('saida','devolucao',-1,1,'L1',NULL),('saida','consumo-observado',-1,2,'L1',NULL),('ajuste','ajuste-inventario',-1,1,NULL,NULL)) x(k,c,d,q,l,e);
  INSERT INTO public.meal_stock_counts(logical_id,version,status,school_id,counted_on,lines,author_user_id,author_person_id,author_engagement)
    VALUES (gen_random_uuid(),1,'aprovada',s1,f0,'[{"item_value_id":"nae8l4-arroz","fisica":8,"diferenca":-1}]',uN,pN,gen_random_uuid());
  -- execução: planejado ≠ executado; refeições ≠ alunos; segunda sem contagem (ausência ≠ zero)
  INSERT INTO public.meal_daily_executions(logical_id,version,event_kind,school_id,executed_on,meal_slot_value_id,followed,deviation,deviation_reason,meals_total,count_basis,students_present,students_present_source,author_user_id,author_person_id,author_engagement) VALUES
    (gen_random_uuid(),1,'registro',s1,f0,'nae8l4-almoco',false,'Troca de preparação','Falta de item',80,'contagem-de-pratos',95,'diario',uC,pC,gen_random_uuid()),
    (gen_random_uuid(),1,'registro',s1,f0,'nae8l4-lanche',true,NULL,NULL,NULL,NULL,NULL,NULL,uC,pC,gen_random_uuid());
  -- não conformidades e evidências (uma ativa, uma revogada — histórico preservado)
  INSERT INTO public.meal_nonconformities(logical_id,version,status,school_id,schedule_logical_id,motive,returned_qty,evidence_refs,author_user_id,author_person_id,author_engagement) VALUES
    (gen_random_uuid(),1,'aberta',s1,sch[3],'Produto avariado',5,ARRAY[ev],uC,pC,gen_random_uuid()),
    (gen_random_uuid(),1,'encerrada',s1,sch[2],'Quantidade menor',NULL,'{}',uC,pC,gen_random_uuid());
  INSERT INTO public.meal_evidence_attachments(logical_id,version,event_kind,target_kind,target_logical_id,school_id,storage_path,sha256,media_type,size_bytes,label,author_user_id,author_person_id,author_engagement) VALUES
    (ev,1,'anexacao','nao-conformidade',sch[3],s1,'nae8l4/'||ev||'.png',repeat('a',64),'image/png',10,'Foto',uC,pC,gen_random_uuid());
  INSERT INTO public.meal_evidence_attachments(logical_id,version,event_kind,target_kind,target_logical_id,school_id,storage_path,sha256,media_type,size_bytes,label,author_user_id,author_person_id,author_engagement) VALUES
    (ev2,1,'anexacao','recebimento',sch[2],s1,'nae8l4/'||ev2||'.png',repeat('b',64),'image/png',10,'Foto 2',uC,pC,gen_random_uuid()) RETURNING id INTO eid;
  INSERT INTO public.meal_evidence_attachments(logical_id,version,supersedes_id,event_kind,target_kind,target_logical_id,school_id,reason,author_user_id,author_person_id,author_engagement) VALUES
    (ev2,2,eid,'revogacao','recebimento',sch[2],s1,'Arquivo errado',uC,pC,gen_random_uuid());
  -- fechamento + reemissão
  INSERT INTO public.meal_stock_closings(school_id,competence,version,closing_on,known_at,movement_ids,balances,manifest_sha256,author_user_id,author_person_id,author_engagement)
    VALUES (s1,comp,1,td,now(),'{}','[]',repeat('c',64),uN,pN,gen_random_uuid()) RETURNING id INTO cl;
  INSERT INTO public.meal_stock_closings(school_id,competence,version,supersedes_id,closing_on,known_at,movement_ids,balances,manifest_sha256,reason,author_user_id,author_person_id,author_engagement)
    VALUES (s1,comp,2,cl,td,now(),'{}','[]',repeat('c',64),'Reemissão sintética',uN,pN,gen_random_uuid());

  CREATE TEMP TABLE nae8_caps(u uuid, cap text, scope text, school text) ON COMMIT DROP;
  INSERT INTO nae8_caps VALUES (uN,'acompanhar-alimentacao-rede','rede',NULL),(uC,'consultar-alimentacao-escolar','escola',s1);
  GRANT SELECT ON nae8_caps TO authenticated;
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_nae8_original;
  CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c.cap, md5(c.u::text || c.scope)::uuid, '00000000-0000-0000-0000-0000000000e8'::uuid, 1, c.scope, c.school
      FROM pg_temp.nae8_caps c WHERE c.u = auth.uid() $b$;
  GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated;
  CREATE FUNCTION pg_temp.nae8_as(_u uuid) RETURNS void LANGUAGE sql AS $b$
    SELECT set_config('request.jwt.claims', CASE WHEN _u IS NULL THEN '' ELSE jsonb_build_object('sub', _u, 'role','authenticated')::text END, true) $b$;
  CREATE FUNCTION pg_temp.nae8_fail(_sql text, _pat text) RETURNS void LANGUAGE plpgsql AS $b$
    BEGIN EXECUTE _sql; RAISE EXCEPTION 'nae8-should-fail[%]: %', _pat, left(_sql, 120);
    EXCEPTION WHEN others THEN IF SQLERRM LIKE 'nae8-should-fail%' OR SQLERRM NOT LIKE '%' || _pat || '%' THEN
      RAISE EXCEPTION 'nae8-unexpected[%]: %', _pat, SQLERRM; END IF; END $b$;
  CREATE FUNCTION pg_temp.nae8_sum(_ds text, _key text, _school text, _f date, _t date) RETURNS numeric LANGUAGE sql AS $b$
    SELECT value FROM public.meal_reporting_summary(_school, _f, _t) WHERE dataset = _ds AND key = _key $b$;
  CREATE FUNCTION pg_temp.nae8_tot(_ds text, _school text, _f date, _t date, _flt jsonb) RETURNS bigint LANGUAGE sql AS $b$
    SELECT coalesce(max(total), 0) FROM public.meal_reporting_rows(_ds, _school, _f, _t, _flt, 500, 0) $b$;
  before_ := (SELECT string_agg(c::text, ',') FROM (SELECT count(*) c FROM public.meal_order_versions UNION ALL SELECT count(*) FROM public.meal_inventory_movements
               UNION ALL SELECT count(*) FROM public.meal_receipts UNION ALL SELECT count(*) FROM public.meal_evidence_attachments UNION ALL SELECT count(*) FROM public.meal_stock_closings) q);

  -- 0. anon / sem sessão / internos
  SET LOCAL ROLE anon;
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(NULL,%L,%L)',f0,td), 'permission denied');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_rows(%L,NULL,%L,%L,NULL,10,0)','pedidos',f0,td), 'permission denied');
  RESET ROLE; SET LOCAL ROLE authenticated;
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_facts(%L,NULL,%L,%L)','pedidos',f0,td), 'permission denied');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_reporting_scope(NULL,%L,%L)',f0,td), 'permission denied');
  PERFORM pg_temp.nae8_as(NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(NULL,%L,%L)',f0,td), 'session-required');
  _ok := _ok || 'anon,sem-sessao,internos-fechados;';

  -- 1. escopo: escola só a própria; rede só com capability de rede
  PERFORM pg_temp.nae8_as(uC);
  IF pg_temp.nae8_sum('pedidos','total',s1,f0,td) <> 2 THEN RAISE EXCEPTION 'falha: escola própria'; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(%L,%L,%L)',s2,f0,td), 'capability:consultar-alimentacao-escolar');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_rows(%L,%L,%L,%L,NULL,10,0)','pedidos',s2,f0,td), 'capability:consultar-alimentacao-escolar');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(NULL,%L,%L)',f0,td), 'capability:acompanhar-alimentacao-rede');
  PERFORM pg_temp.nae8_as(uN);
  IF pg_temp.nae8_sum('pedidos','total',NULL,f0,td) <> 3 OR pg_temp.nae8_sum('pedidos','total',s2,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: rede'; END IF;
  -- rede somente leitura não ganha writer
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8l4-arroz','nae8l4-kg',td,'America/Sao_Paulo'), 'capability:');
  _ok := _ok || 'escola-propria,outra-escola-idor,rede-exige-capability,rede-sem-writer;';

  -- 2. semântica
  IF pg_temp.nae8_sum('pedidos','submetidos',s1,f0,td) <> 1 OR pg_temp.nae8_sum('pedidos','autorizado-parcial',s1,f0,td) <> 1 OR pg_temp.nae8_sum('pedidos','rascunho',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: pedidos'; END IF;
  SELECT row_data INTO j FROM public.meal_reporting_rows('pedidos', s1, f0, td, '{"situacao":"autorizado-parcial"}', 10, 0);
  IF (j->'linhas_solicitadas'->0->>'quantidade')::numeric <> 10 OR (j->'linhas_autorizadas'->0->>'quantidade')::numeric <> 6 THEN RAISE EXCEPTION 'falha: solicitado×autorizado %', j; END IF;
  IF (pg_temp.nae8_sum('entregas','integral',s1,f0,td), pg_temp.nae8_sum('entregas','parcial',s1,f0,td), pg_temp.nae8_sum('entregas','rejeitada',s1,f0,td), pg_temp.nae8_sum('entregas','pendente',s1,f0,td))
     IS DISTINCT FROM (1::numeric,1::numeric,1::numeric,1::numeric) THEN RAISE EXCEPTION 'falha: entregas'; END IF;
  IF pg_temp.nae8_sum('movimentos','entrada-aceite',s1,f0,td) <> 2 THEN RAISE EXCEPTION 'falha: rejeitada entrou em estoque'; END IF;
  IF (pg_temp.nae8_sum('movimentos','perda',s1,f0,td), pg_temp.nae8_sum('movimentos','devolucao',s1,f0,td), pg_temp.nae8_sum('movimentos','consumo-observado',s1,f0,td), pg_temp.nae8_sum('movimentos','ajuste-inventario',s1,f0,td))
     IS DISTINCT FROM (1::numeric,1::numeric,1::numeric,1::numeric) THEN RAISE EXCEPTION 'falha: classes de movimento'; END IF;
  IF pg_temp.nae8_sum('movimentos','lote-informado',s1,f0,td) <> 1 OR pg_temp.nae8_sum('movimentos','lote-ausente',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: lote'; END IF;
  SELECT row_data INTO j FROM public.meal_reporting_rows('movimentos', s1, f0, td, '{"classe":"entrada-aceite","lote":"ausente"}', 10, 0);
  IF j->'lote' <> 'null'::jsonb OR j->'validade' <> 'null'::jsonb THEN RAISE EXCEPTION 'falha: lote ausente fabricado %', j; END IF;
  IF pg_temp.nae8_sum('inventarios','aprovada-divergente',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: inventário divergente'; END IF;
  IF pg_temp.nae8_sum('execucoes','desvio',s1,f0,td) <> 1 OR pg_temp.nae8_sum('execucoes','refeicoes-servidas',s1,f0,td) <> 80
     OR pg_temp.nae8_sum('execucoes','alunos-presentes',s1,f0,td) <> 95 OR pg_temp.nae8_sum('execucoes','refeicoes-nao-informadas',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: execução'; END IF;
  IF pg_temp.nae8_sum('nao-conformidades','aberta',s1,f0,td) <> 1 OR pg_temp.nae8_sum('nao-conformidades','tratada',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: nc'; END IF;
  IF pg_temp.nae8_sum('evidencias','ativa',s1,f0,td) <> 1 OR pg_temp.nae8_sum('evidencias','revogada',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: evidências'; END IF;
  IF pg_temp.nae8_sum('fechamentos','emissao',s1,f0,td) <> 1 OR pg_temp.nae8_sum('fechamentos','reemissao',s1,f0,td) <> 1 THEN RAISE EXCEPTION 'falha: fechamento'; END IF;
  _ok := _ok || 'solicitado≠autorizado,entregas-4-estados,rejeitada-fora-do-estoque,classes-separadas,lote-ausente-null,inventario-divergente,planejado≠executado,refeicoes≠alunos,nc,evidencia-historica,reemissao;';

  -- 3. ZERO verdadeiro × UNKNOWN × BLOCKED (s2 sem entregas/execuções)
  SELECT state, value INTO r FROM public.meal_reporting_summary(s2, f0, td) WHERE dataset = 'entregas' AND key = 'total';
  IF r.state <> 'AVAILABLE' OR r.value <> 0 THEN RAISE EXCEPTION 'falha: zero lido %', r; END IF;
  SELECT state, value INTO r FROM public.meal_reporting_summary(s2, f0, td) WHERE dataset = 'execucoes' AND key = 'refeicoes-servidas';
  IF r.state <> 'UNKNOWN' OR r.value IS NOT NULL THEN RAISE EXCEPTION 'falha: ausência virou zero %', r; END IF;
  IF (SELECT count(*) FROM public.meal_reporting_summary(s1, f0, td) WHERE state = 'BLOCKED' AND value IS NULL AND (reason LIKE '%BLOCKED_BY_HOMOLOGATED_RULE' OR reason LIKE '%OFFICIAL_SOURCE_PENDING')) <> 6 THEN RAISE EXCEPTION 'falha: bloqueios'; END IF;
  _ok := _ok || 'zero≠unknown≠blocked;';

  -- 4. drill-down reconcilia com cada agregado de situação/classe; paginação não altera total
  FOR r IN SELECT dataset, key, value FROM public.meal_reporting_summary(s1, f0, td) WHERE state = 'AVAILABLE' AND dataset <> 'bloqueios' LOOP
    j := CASE WHEN r.key = 'total' THEN '{}'::jsonb
              WHEN r.key = 'submetidos' THEN '{"submetido":true}'
              WHEN r.key IN ('lote-informado','lote-ausente') THEN jsonb_build_object('classe','entrada-aceite','lote',substr(r.key,6))
              WHEN r.key IN ('validade-informada','validade-ausente') THEN jsonb_build_object('classe','entrada-aceite','validade',substr(r.key,10))
              WHEN r.dataset = 'movimentos' AND r.key <> 'classe-desconhecida' OR r.key = 'refeicoes-nao-informadas' THEN jsonb_build_object('classe', r.key)
              WHEN r.key IN ('refeicoes-servidas','alunos-presentes') THEN NULL
              ELSE jsonb_build_object('situacao', r.key) END;
    CONTINUE WHEN j IS NULL;
    tot := pg_temp.nae8_tot(r.dataset, s1, f0, td, j);
    IF tot <> r.value THEN RAISE EXCEPTION 'falha: drill % % = % (agregado %)', r.dataset, r.key, tot, r.value; END IF;
  END LOOP;
  SELECT count(*), max(total) INTO pages, tot FROM (SELECT * FROM public.meal_reporting_rows('movimentos', s1, f0, td, NULL, 2, 0)
     UNION ALL SELECT * FROM public.meal_reporting_rows('movimentos', s1, f0, td, NULL, 2, 2) UNION ALL SELECT * FROM public.meal_reporting_rows('movimentos', s1, f0, td, NULL, 2, 4)) p;
  IF pages <> 6 OR tot <> 6 THEN RAISE EXCEPTION 'falha: paginação % %', pages, tot; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_rows(%L,%L,%L,%L,NULL,501,0)','pedidos',s1,f0,td), 'page-invalid');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_rows(%L,%L,%L,%L,%L,10,0)','pedidos',s1,f0,td,'{"sql":"x"}'), 'filter-unknown');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_rows(%L,%L,%L,%L,NULL,10,0)','alunos',s1,f0,td), 'dataset-unknown');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(%L,%L,%L)',s1,td,f0 - 400), 'period-invalid');
  _ok := _ok || 'drill-reconcilia,paginacao-total-estavel,limites;';

  -- 5. privacidade: nenhuma pessoa/usuário/caminho de storage/URL nas linhas
  FOR r IN SELECT d FROM unnest(ARRAY['pedidos','entregas','nao-conformidades','evidencias','documentos-fiscais','movimentos','inventarios','execucoes','publicacoes','fechamentos']) d LOOP
    IF EXISTS (SELECT 1 FROM public.meal_reporting_rows(r.d, s1, f0, td, NULL, 500, 0) x
               WHERE x.row_data::text ~* '(person|user_id|storage_path|nae8l4/|https?://|NAE8L4 )' OR x.row_data::text LIKE '%' || pC || '%' OR x.row_data::text LIKE '%' || uC || '%')
      THEN RAISE EXCEPTION 'falha: PII em %', r.d; END IF;
  END LOOP;
  _ok := _ok || 'sem-pii,sem-storage-path,sem-url;';

  -- 6. leitura não grava; revogação imediata
  RESET ROLE;
  after_ := (SELECT string_agg(c::text, ',') FROM (SELECT count(*) c FROM public.meal_order_versions UNION ALL SELECT count(*) FROM public.meal_inventory_movements
               UNION ALL SELECT count(*) FROM public.meal_receipts UNION ALL SELECT count(*) FROM public.meal_evidence_attachments UNION ALL SELECT count(*) FROM public.meal_stock_closings) q);
  IF before_ <> after_ THEN RAISE EXCEPTION 'falha: leitura gravou % → %', before_, after_; END IF;
  IF (SELECT provolatile FROM pg_proc WHERE proname = 'meal_reporting_rows') <> 's' OR (SELECT provolatile FROM pg_proc WHERE proname = 'meal_reporting_summary') <> 's' THEN RAISE EXCEPTION 'falha: volatilidade'; END IF;
  DELETE FROM nae8_caps WHERE u = uN; SET LOCAL ROLE authenticated; PERFORM pg_temp.nae8_as(uN);
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_reporting_summary(NULL,%L,%L)',f0,td), 'capability:acompanhar-alimentacao-rede');
  _ok := _ok || 'leitura-sem-escrita,stable,revogacao-imediata;';

  RESET ROLE;
  RAISE EXCEPTION 'nae8-l4-ok: %', _ok;
END $t$;
