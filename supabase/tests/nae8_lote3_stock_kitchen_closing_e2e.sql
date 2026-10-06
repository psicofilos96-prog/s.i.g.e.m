-- NAE.8 Lote 3 — prova transacional de estoque operacional, Estação Cozinha e fechamento por competência.
-- Termina em RAISE: nada persiste. Pessoas/usuários sintéticos (prefixo NAE8L3) e dublê transacional de
-- effective_scope_capabilities (mesmo padrão dos Lotes 1/2). Fixtures do proprietário (só para montar o cenário):
-- duas entradas de aceite e uma programação de entrega — o writer real de aceite já foi provado no Lote 1.
-- Todo o resto passa pelos writers/readers canônicos. Sucesso = 'nae8-l3-ok: ...'.
DO $t$
DECLARE _ok text := ''; td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; tz text := 'America/Sao_Paulo';
  comp text; prev text; s1 text; s2 text; n int; n0 int; x numeric; j jsonb; r record; sha1 text; sha2 text;
  pS uuid := gen_random_uuid(); uS uuid := gen_random_uuid();   -- equipe de estoque s1
  pA uuid := gen_random_uuid(); uA uuid := gen_random_uuid();   -- aprovador de inventário s1
  pK uuid := gen_random_uuid(); uK uuid := gen_random_uuid();   -- cozinha s1
  pO uuid := gen_random_uuid(); uO uuid := gen_random_uuid();   -- cozinha de outra escola
  pN uuid := gen_random_uuid(); uN uuid := gen_random_uuid();   -- Núcleo (fechamento de rede)
  pT uuid := gen_random_uuid(); uT uuid := gen_random_uuid();   -- órgão/ator técnico
  cnt uuid; ex uuid; ex2 uuid; c_counts int; c_closings int;
BEGIN
  comp := to_char(td, 'YYYY-MM'); prev := to_char(td - interval '1 month', 'YYYY-MM');
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  IF (SELECT count(*) FROM public.meal_inventory_movements) <> 0 OR (SELECT count(*) FROM public.meal_stock_counts) <> 0 THEN RAISE EXCEPTION 'pre: estoque não vazio'; END IF;

  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES
    (pS,'NAE8L3 Estoque','pessoa-natural'),(pA,'NAE8L3 Aprovador','pessoa-natural'),(pK,'NAE8L3 Cozinha','pessoa-natural'),
    (pO,'NAE8L3 Cozinha outra','pessoa-natural'),(pN,'NAE8L3 Núcleo','pessoa-natural'),(pT,'NAE8L3 Órgão técnico','orgao-institucional');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uS,pS),(uA,pA),(uK,pK),(uO,pO),(uN,pN),(uT,pT);
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES
    ('item-de-estoque-alimentar','nae8l3-arroz',1,'Arroz sintético','homologada'),
    ('unidade-de-medida-alimentar','nae8l3-kg',1,'kg sintético','homologada'),
    ('refeicao-escolar','nae8l3-almoco',1,'Almoço sintético','homologada');
  -- fixtures do proprietário: entradas de aceite (L1 com validade; outra sem lote/validade) e entrega esperada hoje
  INSERT INTO public.meal_inventory_movements(logical_id, version, event_kind, school_id, item_value_id, item_value_version, unit_value_id, unit_value_version,
      movement_kind, quantity, moved_on, author_user_id, author_person_id, author_engagement, movement_class, direction, lot, expires_on) VALUES
    (gen_random_uuid(),1,'registro',s1,'nae8l3-arroz',1,'nae8l3-kg',1,'entrada',20,td - 1,uS,pS,gen_random_uuid(),'entrada-aceite',1,'L1',td + 5),
    (gen_random_uuid(),1,'registro',s1,'nae8l3-arroz',1,'nae8l3-kg',1,'entrada',10,td - 1,uS,pS,gen_random_uuid(),'entrada-aceite',1,NULL,NULL);
  INSERT INTO public.meal_delivery_schedules(logical_id, version, action, order_logical_id, competence, school_id, item_ref, unidade_ref, quantity, expected_on, author_user_id, author_person_id, author_engagement)
    VALUES (gen_random_uuid(),1,'programacao',gen_random_uuid(),comp,s1,gen_random_uuid(),gen_random_uuid(),15,td,uN,pN,gen_random_uuid());

  CREATE TEMP TABLE nae8_caps(u uuid, cap text, scope text, school text) ON COMMIT DROP;
  INSERT INTO nae8_caps SELECT uS, c, 'escola', s1 FROM unnest(ARRAY['registrar-estoque-alimentar','ajustar-estoque-alimentar']) c;
  INSERT INTO nae8_caps VALUES (uA,'aprovar-inventario-alimentar','escola',s1),(uK,'registrar-execucao-alimentacao','escola',s1),
    (uO,'registrar-execucao-alimentacao','escola',s2),(uN,'fechar-estoque-alimentar','rede',NULL),(uN,'acompanhar-alimentacao-rede','rede',NULL),
    (uT,'registrar-execucao-alimentacao','escola',s1),(uS,'transferir-estoque-alimentar','rede',NULL);
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

  -- 0. anon e DML direto
  SET LOCAL ROLE anon;
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s1,td), 'permission denied');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_competence_checklist_at(%L,%L)',s1,comp), 'permission denied');
  RESET ROLE; SET LOCAL ROLE authenticated;
  PERFORM pg_temp.nae8_as(NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s1,td), 'session-required');
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('INSERT INTO public.meal_stock_counts(logical_id,version,status,school_id,counted_on,lines,author_user_id,author_person_id,author_engagement) VALUES (gen_random_uuid(),1,%L,%L,%L,%L::jsonb,%L,%L,gen_random_uuid())','aprovada',s1,td,'[]',uS,pS), 'permission denied');
  PERFORM pg_temp.nae8_fail('SELECT * FROM public.meal_inventory_movements', 'permission denied');
  _ok := _ok || 'anon,sem-sessao,dml-direto;';

  -- 1. saída: perda, devolução, consumo observado (writer canônico) e saldo derivado
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'perda', 'nae8l3-arroz', 'nae8l3-kg', 2, NULL, td, tz, 'L1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Embalagem rasgada');
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'devolucao', 'nae8l3-arroz', 'nae8l3-kg', 1, NULL, td, tz, 'L1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Devolvido ao fornecedor');
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'consumo-observado', 'nae8l3-arroz', 'nae8l3-kg', 3, NULL, td, tz, 'L1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT balance INTO x FROM public.meal_stock_balance_at(s1, td, NULL) WHERE lot = 'L1';
  IF x <> 14 THEN RAISE EXCEPTION 'falha: saldo L1 % (esperado 14)', x; END IF;
  SELECT count(*) INTO n FROM public.meal_stock_ledger_at(s1, td - 1, td, NULL) WHERE lot = 'L1';
  IF n <> 4 THEN RAISE EXCEPTION 'falha: ficha L1 % movimentos', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.meal_stock_balance_at(s1, td, NULL) WHERE lot IS NULL AND expires_on IS NULL AND balance = 10) THEN RAISE EXCEPTION 'falha: lote ausente'; END IF;
  _ok := _ok || 'perda,devolucao,consumo,saldo-derivado,ficha,lote-ausente-null;';

  -- 2. transferência sem política homologada = BLOCKED (mesmo com capability de rede)
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_transfer(%L,%L,%L,%L,1,%L,%L,NULL,NULL,NULL,NULL)',s1,s2,'nae8l3-arroz','nae8l3-kg',td,tz), 'transfer-policy-pending');
  _ok := _ok || 'transferencia-bloqueada;';

  -- 3. inventário divergente → aprovação distinta → ajuste vinculado
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(NULL,NULL,%L,%L,%L,%L::jsonb,NULL)','conferida',s1,td,'[{"item_value_id":"nae8l3-arroz","unit_value_id":"nae8l3-kg","lote":"L1","fisica":13}]'), 'divergence-requires-justification');
  cnt := public.record_meal_stock_count(NULL, NULL, 'conferida', s1, td, '[{"item_value_id":"nae8l3-arroz","unit_value_id":"nae8l3-kg","lote":"L1","fisica":13,"justificativa":"Quebra sintética"}]'::jsonb, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(%L,1,%L,NULL,NULL,NULL,NULL)',cnt,'aprovada'), 'approver-must-differ');
  PERFORM pg_temp.nae8_as(uA);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(%L,9,%L,NULL,NULL,NULL,NULL)',cnt,'aprovada'), 'meal:stale');
  PERFORM public.record_meal_stock_count(cnt, 1, 'aprovada', NULL, NULL, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(%L,2,%L,NULL,NULL,NULL,NULL)',cnt,'aprovada'), 'count-final');
  SELECT (c.lines->0->>'diferenca')::numeric INTO x FROM public.meal_stock_counts_at(s1) c WHERE c.logical_id = cnt;
  IF x <> -1 THEN RAISE EXCEPTION 'falha: diferença %', x; END IF;
  PERFORM pg_temp.nae8_as(uS);
  SELECT state INTO sha1 FROM public.meal_competence_checklist_at(s1, comp) WHERE area = 'divergencias';
  IF sha1 <> 'PENDING' THEN RAISE EXCEPTION 'falha: divergência sem ajuste %', sha1; END IF;
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'ajuste-inventario', 'nae8l3-arroz', 'nae8l3-kg', 1, -1::smallint, td, tz, 'L1', NULL, NULL, NULL, NULL, cnt, NULL, NULL, 'Ajuste pela contagem aprovada');
  SELECT balance INTO x FROM public.meal_stock_balance_at(s1, td, NULL) WHERE lot = 'L1';
  IF x <> 13 THEN RAISE EXCEPTION 'falha: saldo pós-ajuste %', x; END IF;
  SELECT state INTO sha1 FROM public.meal_competence_checklist_at(s1, comp) WHERE area = 'divergencias';
  IF sha1 <> 'AVAILABLE' THEN RAISE EXCEPTION 'falha: divergência ajustada %', sha1; END IF;
  _ok := _ok || 'contagem,justificativa,aprovador-distinto,stale,final,ajuste-vinculado;';

  -- 4. Estação Cozinha: própria escola, outra escola, mínimo de dados, execução planejado≠executado e refeições≠alunos
  PERFORM pg_temp.nae8_as(uK);
  j := public.meal_kitchen_day_at(s1, td);
  IF jsonb_array_length(j->'deliveries') <> 1 OR (j->'deliveries'->0->>'receipt_status') IS NOT NULL THEN RAISE EXCEPTION 'falha: entregas do dia %', j->'deliveries'; END IF;
  IF jsonb_array_length(j->'stock') <> 2 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'stock') e WHERE e->>'lot' = 'L1' AND (e->>'expires_on')::date = td + 5)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'stock') e WHERE e->'lot' = 'null'::jsonb AND e->'expires_on' = 'null'::jsonb) THEN RAISE EXCEPTION 'falha: estoque cozinha %', j->'stock'; END IF;
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j) k) <> ARRAY['deliveries','executions','operational_records','overdue_receipts','stock'] THEN RAISE EXCEPTION 'falha: chaves cozinha'; END IF;
  IF j::text ~ '(NAE8L3 |author|person|email|student_id)' THEN RAISE EXCEPTION 'falha: cozinha expôs dado pessoal'; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s2,td), 'capability:registrar-execucao-alimentacao');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_stock_ledger_at(%L,%L,%L,NULL)',s1,td,td), 'capability:');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'consumo-observado','nae8l3-arroz','nae8l3-kg',td,tz), 'capability:registrar-estoque-alimentar');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,false,NULL,NULL,NULL,NULL,120,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td,'nae8l3-almoco',tz), 'deviation-required');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,false,NULL,%L,NULL,NULL,120,NULL,NULL,95,NULL,NULL,%L,NULL)','registro',s1,td,'nae8l3-almoco','Macarrão',tz), 'students-source-required');
  ex := public.record_meal_execution(NULL, 'registro', s1, td, 'nae8l3-almoco', NULL, false, 'Macarrão ao sugo', 'Macarrão no lugar do arroz', 'Arroz em contagem', NULL,
    120, 'inclui repetições e servidores', NULL, 95, 'chamada do dia', NULL, tz, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td,'nae8l3-almoco',tz), 'duplicate-use-rectification');
  ex2 := public.record_meal_execution(ex, 'retificacao', NULL, NULL, NULL, NULL, false, 'Macarrão ao sugo', 'Macarrão no lugar do arroz', 'Arroz em contagem', NULL,
    118, 'inclui repetições e servidores', NULL, NULL, NULL, NULL, tz, 'Recontagem');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(%L,%L,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,%L)',ex,'retificacao',tz,'x'), 'base-superseded');
  j := public.meal_kitchen_day_at(s1, td);
  IF jsonb_array_length(j->'executions') <> 1 OR (j->'executions'->0->>'meals_total')::int <> 118 OR (j->'executions'->0->>'students_present')::int <> 95
     OR (j->'executions'->0->>'followed')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'falha: execução cozinha %', j->'executions'; END IF;
  PERFORM pg_temp.nae8_as(uT);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td - 1,'nae8l3-almoco',tz), 'natural-person-required');
  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td - 1,'nae8l3-almoco',tz), 'capability:registrar-execucao-alimentacao');
  _ok := _ok || 'cozinha-propria,outra-escola,minimo-pii,sem-estoque-sem-cap,desvio,refeicoes≠alunos,duplicidade,stale-retificacao,ator-tecnico;';

  -- 5. leitura não grava
  RESET ROLE; SELECT count(*) INTO n0 FROM public.meal_inventory_movements; SELECT count(*) INTO c_counts FROM public.meal_stock_counts; SELECT count(*) INTO c_closings FROM public.meal_stock_closings;
  SET LOCAL ROLE authenticated; PERFORM pg_temp.nae8_as(uK); PERFORM public.meal_kitchen_day_at(s1, td);
  PERFORM pg_temp.nae8_as(uS); PERFORM * FROM public.meal_competence_checklist_at(s1, comp); PERFORM * FROM public.meal_stock_alerts_at(s1, td, 7);
  RESET ROLE;
  IF (SELECT count(*) FROM public.meal_inventory_movements) <> n0 OR (SELECT count(*) FROM public.meal_stock_counts) <> c_counts OR (SELECT count(*) FROM public.meal_stock_closings) <> c_closings THEN RAISE EXCEPTION 'falha: leitura escreveu'; END IF;
  _ok := _ok || 'leitura-sem-escrita;';

  -- 6. fechamento: competência atual recusada; anterior gera manifesto reproduzível; reemissão exige motivo
  SET LOCAL ROLE authenticated; PERFORM pg_temp.nae8_as(uS);
  FOR r IN SELECT * FROM public.meal_competence_checklist_at(s1, comp) LOOP
    IF r.area = 'fechamento' AND (r.state <> 'BLOCKED' OR r.code <> 'COMPETENCE_NOT_ENDED') THEN RAISE EXCEPTION 'falha: fechamento atual %', r; END IF;
    IF r.area = 'execucao' AND (r.state <> 'AVAILABLE' OR r.code <> 'SCHOOL_DAYS_CALENDAR_UNRESOLVED') THEN RAISE EXCEPTION 'falha: execução %', r; END IF;
    IF r.area = 'recebimentos' AND (r.state <> 'PENDING' OR r.amount <> 1) THEN RAISE EXCEPTION 'falha: recebimentos %', r; END IF;
    IF r.area = 'inventario' AND r.state <> 'AVAILABLE' THEN RAISE EXCEPTION 'falha: inventário %', r; END IF;
    IF r.area = 'pedidos' AND (r.state <> 'UNKNOWN' OR r.code <> 'NO_ORDER_RECORDED') THEN RAISE EXCEPTION 'falha: pedido ausente virou zero %', r; END IF;
  END LOOP;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,NULL,NULL)',s1,prev), 'capability:fechar-estoque-alimentar');
  PERFORM pg_temp.nae8_as(uN);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,NULL,NULL)',s1,comp), 'competence-not-ended');
  PERFORM public.record_meal_stock_closing(s1, prev, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,NULL,NULL)',s1,prev), 'meal:stale');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,1,NULL)',s1,prev), 'reason-required');
  PERFORM public.record_meal_stock_closing(s1, prev, 1, 'Reemissão sintética');
  PERFORM pg_temp.nae8_as(uS);
  SELECT min(manifest_sha256), max(manifest_sha256), count(*) INTO sha1, sha2, n FROM public.meal_stock_closings_at(s1) WHERE competence = prev;
  IF n <> 2 OR sha1 <> sha2 THEN RAISE EXCEPTION 'falha: manifesto não reproduzível'; END IF;
  SELECT code INTO sha1 FROM public.meal_competence_checklist_at(s1, prev) WHERE area = 'fechamento' AND state = 'AVAILABLE';
  IF sha1 <> sha2 THEN RAISE EXCEPTION 'falha: checklist não mostra manifesto'; END IF;
  _ok := _ok || 'fechamento-atual-recusado,checklist-unknown≠zero,manifesto-reproduzivel,reemissao-versionada;';

  -- 7. revogação imediata da cozinha
  DELETE FROM nae8_caps WHERE u = uK;
  PERFORM pg_temp.nae8_as(uK);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_kitchen_day_at(%L,%L)',s1,td), 'capability:registrar-execucao-alimentacao');
  _ok := _ok || 'revogacao-cozinha;';

  RESET ROLE;
  RAISE EXCEPTION 'nae8-l3-ok: %', _ok;
END $t$;
