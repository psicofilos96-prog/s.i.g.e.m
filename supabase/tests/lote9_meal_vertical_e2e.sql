-- LOTE 9 — cadeia vertical com teto calculado no banco, NF, amostras e inspetores (derivado do NAE.8). E2E transacional da cadeia de Alimentação Escolar no banco canônico. Termina em RAISE: nada persiste.
-- Pessoas/usuários sintéticos (prefixo NAE8) e dublê transacional de effective_scope_capabilities (padrão ac2) desfeitos pelo rollback.
-- Só writers/readers canônicos; nenhum DML direto em meal_*. Sucesso = 'nae8-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; td date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; tz text := 'America/Sao_Paulo';
  comp text; prev text; s1 text; s2 text; n int; n0 int; x numeric; r record; sha1 text; sha2 text;
  pS uuid := gen_random_uuid(); uS uuid := gen_random_uuid();   -- equipe escolar s1
  pA uuid := gen_random_uuid(); uA uuid := gen_random_uuid();   -- aprovador de inventário s1
  pN uuid := gen_random_uuid(); uN uuid := gen_random_uuid();   -- Núcleo (rede)
  pC uuid := gen_random_uuid(); uC uuid := gen_random_uuid();   -- conferência/homologação técnica (rede)
  pO uuid := gen_random_uuid(); uO uuid := gen_random_uuid();   -- equipe de outra escola
  pT uuid := gen_random_uuid(); uT uuid := gen_random_uuid();   -- órgão/ator técnico (não pessoa natural)
  pH uuid := gen_random_uuid(); uH uuid := gen_random_uuid();   -- homologação técnica (≠ autor e ≠ conferente)
  item uuid; unit uuid; unit2 uuid; cat uuid; ficha uuid; doc uuid; win uuid; ord uuid; sc1 uuid; sc2 uuid; sc3 uuid;
  rc1 uuid; rc2 uuid; rc3 uuid; pub uuid; pcap uuid; forn uuid; nf uuid; insp uuid; am uuid; ev jsonb; ln jsonb; nc uuid; cnt uuid; ex uuid; mv uuid;
BEGIN
  comp := to_char(td, 'YYYY-MM'); prev := to_char(td - interval '1 month', 'YYYY-MM');
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  SELECT count(*) INTO n0 FROM public.meal_master_records;
  IF n0 <> 0 OR (SELECT count(*) FROM public.meal_order_versions) <> 0 THEN RAISE EXCEPTION 'pre: base meal não vazia'; END IF;

  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES
    (pS,'NAE8 Escola sintética','pessoa-natural'),(pA,'NAE8 Aprovador sintético','pessoa-natural'),(pN,'NAE8 Núcleo sintético','pessoa-natural'),
    (pC,'NAE8 Conferente sintético','pessoa-natural'),(pO,'NAE8 Outra escola sintética','pessoa-natural'),(pT,'NAE8 Ator técnico sintético','orgao-institucional'),(pH,'NAE8 Homologador sintético','pessoa-natural');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uS,pS),(uA,pA),(uN,pN),(uC,pC),(uO,pO),(uT,pT),(uH,pH);
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES
    ('item-de-estoque-alimentar','nae8-arroz',1,'Arroz sintético','homologada'),
    ('unidade-de-medida-alimentar','nae8-kg',1,'kg sintético','homologada'),
    ('unidade-de-medida-alimentar','nae8-g',1,'g sintético','homologada'),
    ('refeicao-escolar','nae8-almoco',1,'Almoço sintético','homologada');

  CREATE TEMP TABLE nae8_caps(u uuid, cap text, scope text, school text) ON COMMIT DROP;
  INSERT INTO nae8_caps SELECT uS, c, 'escola', s1 FROM unnest(ARRAY['submeter-pedido-alimentar','conferir-recebimento-alimentar',
      'registrar-estoque-alimentar','ajustar-estoque-alimentar','registrar-execucao-alimentacao','registrar-nao-conformidade-alimentar']) c;
  INSERT INTO nae8_caps VALUES (uA,'aprovar-inventario-alimentar','escola',s1);
  INSERT INTO nae8_caps SELECT uO, c, 'escola', s2 FROM unnest(ARRAY['registrar-estoque-alimentar','submeter-pedido-alimentar']) c;
  INSERT INTO nae8_caps SELECT uN, c, 'rede', NULL FROM unnest(ARRAY['manter-catalogo-tecnico-alimentar','manter-planejamento-nutricional',
      'gerir-documentos-alimentacao','administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'consolidar-demanda-alimentar','registrar-programacao-de-entrega-alimentar','acompanhar-alimentacao-rede','fechar-estoque-alimentar','manter-parametros-nutricionais','manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao']) c;
  INSERT INTO nae8_caps VALUES (uC,'conferir-conteudo-tecnico-alimentar','rede',NULL),(uH,'homologar-conteudo-tecnico-alimentar','rede',NULL);
  INSERT INTO nae8_caps VALUES (uT,'registrar-estoque-alimentar','escola',s1);
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

  -- 0. anon / sem sessão / ator técnico / DML direto
  SET LOCAL ROLE anon;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(NULL,NULL,%L,%L,%L,%L::jsonb,NULL)','rascunho',s1,comp,'[]'), 'permission denied');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_network_action_summary(%L,%L)', td, comp), 'permission denied');
  RESET ROLE; SET LOCAL ROLE authenticated;
  PERFORM pg_temp.nae8_as(NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8-arroz','nae8-kg',td,tz), 'session-required');
  PERFORM pg_temp.nae8_as(uT);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8-arroz','nae8-kg',td,tz), 'natural-person-required');
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('INSERT INTO public.meal_inventory_movements(logical_id,version,event_kind,school_id,item_value_id,item_value_version,unit_value_id,unit_value_version,movement_kind,quantity,moved_on) VALUES (gen_random_uuid(),1,%L,%L,%L,1,%L,1,%L,1,%L)','registro',s1,'nae8-arroz','nae8-kg','entrada',td), 'permission denied');
  PERFORM pg_temp.nae8_fail('UPDATE public.meal_order_versions SET status = ''autorizado-total''', 'permission denied');
  PERFORM pg_temp.nae8_fail('DELETE FROM public.meal_master_records', 'permission denied');
  _ok := _ok || 'anon,sem-sessao,ator-tecnico,dml;';
  RESET ROLE; -- writers seguem autorizando por auth.uid()+capability; leituras de verificação usam o canal da prova

  -- 1. base mestra: autor ≠ conferente/homologador; catálogo sem homologação é recusado no pedido
  PERFORM pg_temp.nae8_as(uN);
  item := public.record_meal_master('item-alimentar', NULL, NULL, 'registro', jsonb_build_object('nome','Arroz sintético NAE8','item_estoque_value_id','nae8-arroz'), NULL, td - 30, NULL, NULL);
  unit := public.record_meal_master('unidade-de-medida', NULL, NULL, 'registro', jsonb_build_object('nome','Quilograma sintético','simbolo','kg','unidade_estoque_value_id','nae8-kg'), NULL, td - 30, NULL, NULL);
  unit2 := public.record_meal_master('unidade-de-medida', NULL, NULL, 'registro', jsonb_build_object('nome','Grama sintético','simbolo','g','unidade_estoque_value_id','nae8-g'), NULL, td - 30, NULL, NULL);
  cat := public.record_meal_master('categoria-de-refeicao', NULL, NULL, 'registro', jsonb_build_object('rotulo','Categoria sintética'), NULL, td - 30, NULL, NULL);
  ficha := public.record_meal_master('receita-ficha-tecnica', NULL, NULL, 'registro', jsonb_build_object('nome','Ficha sintética','ingredientes', jsonb_build_array(jsonb_build_object('item_ref', item, 'quantidade', 0.05))), NULL, td - 30, NULL, NULL);
  doc := public.record_meal_master('documento-tecnico', NULL, NULL, 'registro', jsonb_build_object('titulo','Evidência sintética','categoria','recebimento','natureza','evidencia','sha256', repeat('a',64)), NULL, td - 30, NULL, NULL);
  pub := public.record_meal_master('publico-de-atendimento', NULL, NULL, 'registro', jsonb_build_object('rotulo','Público sintético L9'), NULL, td - 30, NULL, NULL);
  forn := public.record_meal_master('fornecedor', NULL, NULL, 'registro', jsonb_build_object('nome','Fornecedor sintético L9'), NULL, td - 30, NULL, NULL);
  pcap := public.record_meal_master('parametro-per-capita', NULL, NULL, 'registro', jsonb_build_object('quantidade',0.1,'item_ref',item,'publico_ref',pub,'unidade_ref',unit), NULL, td - 30, NULL, NULL);
  insp := public.record_meal_master('designacao-inspetor', NULL, NULL, 'registro', jsonb_build_object('pessoa_id',pS), s1, td - 30, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_master(%L,%L,1,%L,NULL,NULL,NULL,NULL,NULL)','item-alimentar',item,'conferencia'), 'self-review-not-allowed');
  PERFORM pg_temp.nae8_as(uC);
  FOREACH mv IN ARRAY ARRAY[item, unit, unit2, cat, ficha, doc, pub, forn, pcap, insp] LOOP
    PERFORM public.record_meal_master((SELECT m.kind FROM public.meal_master_records m WHERE m.logical_id = mv LIMIT 1), mv, 1, 'conferencia', NULL, NULL, NULL, NULL, NULL);
  END LOOP;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_master(%L,%L,2,%L,NULL,NULL,NULL,NULL,NULL)','item-alimentar',item,'homologacao'), 'self-review-not-allowed');
  PERFORM pg_temp.nae8_as(uH);
  FOREACH mv IN ARRAY ARRAY[item, unit, unit2, cat, ficha, doc, pub, forn, pcap, insp] LOOP
    PERFORM public.record_meal_master((SELECT m.kind FROM public.meal_master_records m WHERE m.logical_id = mv LIMIT 1), mv, 2, 'homologacao', NULL, NULL, NULL, NULL, NULL);
  END LOOP;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_master(%L,%L,2,%L,NULL,NULL,NULL,NULL,NULL)','item-alimentar',item,'homologacao'), 'meal:stale');
  IF NOT public.meal_master_homologated(insp, 'designacao-inspetor', td) THEN RAISE EXCEPTION 'falha: inspetor não homologado'; END IF;
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_master(%L,NULL,NULL,%L,%L::jsonb,%L,%L,NULL,NULL)','designacao-inspetor','registro',jsonb_build_object('pessoa_id',pO),s1,td), 'capability');
  _ok := _ok || 'base-mestra,autor≠homologador,stale,inspetor-designado,inspetor-sem-cap;';

  -- 2. janela: regra institucional ausente recusa; abertura explícita registra
  PERFORM pg_temp.nae8_as(uN);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order_window(NULL,NULL,%L,%L,NULL,now()-interval ''1 hour'',now()+interval ''1 hour'',%L,%L,NULL,NULL)','abertura',comp,tz,'regra-homologada'), 'window-rule-not-homologated');
  win := public.record_meal_order_window(NULL, NULL, 'abertura', comp, ARRAY[s1], now() - interval '1 hour', now() + interval '1 hour', tz, 'abertura-explicita', NULL, 'Abertura sintética NAE8');

  -- 3. pedido → submissão → análise → autorização parcial (com motivo); IDOR e capability ausente
  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(NULL,NULL,%L,%L,%L,%L::jsonb,NULL)','rascunho',s1,comp,'[]'), 'capability:submeter-pedido-alimentar');
  PERFORM pg_temp.nae8_as(uS);
  ord := public.record_meal_order(NULL, NULL, 'rascunho', s1, comp, jsonb_build_array(jsonb_build_object('item_ref',item,'unidade_ref',unit,'publico_ref',pub,'quantidade',100,'publico_atendido',10,'publico_base','declaração sintética','dias_letivos',20,'dias_base','calendário sintético')), NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(NULL,NULL,%L,%L,%L,%L::jsonb,NULL)','rascunho',s1,comp,'[]'), 'order-exists-use-base');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(%L,7,%L,NULL,NULL,NULL,NULL)',ord,'submissao'), 'meal:stale');
  PERFORM public.record_meal_order(ord, 1, 'submissao', NULL, NULL, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(%L,2,%L,NULL,NULL,NULL,NULL)',ord,'analise'), 'capability:analisar-pedido-alimentar');
  PERFORM pg_temp.nae8_as(uN);
  PERFORM public.record_meal_order(ord, 2, 'analise', NULL, NULL, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(%L,3,%L,NULL,NULL,%L::jsonb,NULL)',ord,'autorizacao',jsonb_build_array(jsonb_build_object('item_ref',item,'unidade_ref',unit,'quantidade',80))), 'reason-required');
  ln := jsonb_build_array(jsonb_build_object('item_ref',item,'unidade_ref',unit,'publico_ref',pub,'quantidade',80,'publico_atendido',10,'dias_letivos',20));
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order(%L,3,%L,NULL,NULL,%L::jsonb,%L)',ord,'autorizacao',ln,'Autorização parcial'), 'ceiling-ack-required');
  PERFORM public.record_meal_order_with_ceiling(ord, 3, 'autorizacao', NULL, NULL, ln, 'Autorização parcial sintética', 'Estoque sem registro conferido manualmente');
  SELECT ceiling_evaluation INTO ev FROM public.meal_order_versions WHERE logical_id = ord ORDER BY version DESC LIMIT 1;
  IF ev->'linhas'->0->>'estado' <> 'pendente' OR (ev->'linhas'->0->>'per_capita')::numeric <> 0.1 OR NOT (ev->'linhas'->0->'faltas') ? 'estoque sem registro no livro (desconhecido, não zero)' THEN RAISE EXCEPTION 'falha: avaliação congelada %', ev; END IF;
  IF (SELECT status FROM public.meal_order_versions WHERE logical_id = ord ORDER BY version DESC LIMIT 1) <> 'autorizado-parcial' THEN RAISE EXCEPTION 'falha: autorização parcial'; END IF;
  _ok := _ok || 'janela,regra-ausente,pedido,idor,cap-ausente,autorizacao-parcial;';

  -- 4. consolidação + retry
  n := public.record_meal_demand_consolidation(comp, 0, 'Consolidação sintética');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_demand_consolidation(%L,0,NULL)',comp), 'meal:stale');
  IF n <> 1 OR (SELECT total FROM public.meal_demand_consolidation_at(comp) LIMIT 1) <> 80 THEN RAISE EXCEPTION 'falha: consolidação'; END IF;

  -- 5. programação de 3 entregas; excesso recusado
  sc1 := public.record_meal_delivery_schedule(NULL, NULL, 'programacao', ord, item, unit, NULL, NULL, NULL, 40, td, NULL);
  sc2 := public.record_meal_delivery_schedule(NULL, NULL, 'programacao', ord, item, unit, NULL, NULL, NULL, 30, td, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_delivery_schedule(NULL,NULL,%L,%L,%L,%L,NULL,NULL,NULL,11,%L,NULL)','programacao',ord,item,unit,td), 'schedule-exceeds-authorized');
  sc3 := public.record_meal_delivery_schedule(NULL, NULL, 'programacao', ord, item, unit, NULL, NULL, NULL, 10, td, NULL);
  _ok := _ok || 'consolidacao,retry,3-entregas,excesso;';

  -- 6. recebimentos integral/parcial/rejeitado; aceite idempotente; rejeitado não entra no estoque
  PERFORM pg_temp.nae8_as(uS);
  rc1 := public.record_meal_receipt(NULL, NULL, 'confirmacao', sc1, now() - interval '5 minutes', tz, 40, 40, 0, 'L1', td + 90, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['doc:'||doc], NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_fiscal_document(NULL,NULL,%L,NULL,%L,%L,%L,%L,%L,NULL,NULL)','recebido',sc2,'NF-L9',forn,td,'abc'), 'hash-required');
  nf := public.record_meal_fiscal_document(NULL, NULL, 'recebido', NULL, sc2, 'NF-L9-0001', forn, td, repeat('c',64), 'alimentacao-evidencias/sintetico-l9', NULL);
  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_fiscal_document(NULL,NULL,%L,NULL,%L,%L,%L,%L,%L,NULL,NULL)','recebido',sc2,'NF-B',forn,td,repeat('d',64)), 'capability:conferir-recebimento-alimentar');
  PERFORM pg_temp.nae8_as(uS);
  rc2 := public.record_meal_receipt(NULL, NULL, 'confirmacao', sc2, now() - interval '4 minutes', tz, 30, 20, 10, 'L2', td + 60, NULL, NULL, NULL, NULL, NULL, nf, NULL, NULL, NULL);
  rc3 := public.record_meal_receipt(NULL, NULL, 'confirmacao', sc3, now() - interval '3 minutes', tz, 10, 0, 10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_receipt(NULL,NULL,%L,%L,now(),%L,40,40,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','confirmacao',sc1,tz), 'receipt-exists-use-base');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_receipt(%L,1,%L,NULL,now(),%L,40,30,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,%L)',rc1,'retificacao',tz,'x'), 'quantities-inconsistent');
  PERFORM public.record_meal_receipt(rc1, 1, 'retificacao', NULL, now() - interval '5 minutes', tz, 40, 40, 0, 'L1', td + 90, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Retificação sem mudança de quantidade');
  SELECT count(*) INTO n FROM public.meal_inventory_movements WHERE source_receipt_version_id IN (SELECT id FROM public.meal_receipts WHERE logical_id = rc1);
  IF n <> 1 THEN RAISE EXCEPTION 'falha: aceite não idempotente (%)', n; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_inventory_movements WHERE source_receipt_version_id IN (SELECT id FROM public.meal_receipts WHERE logical_id = rc3)) THEN RAISE EXCEPTION 'falha: rejeitado entrou no estoque'; END IF;
  SELECT sum(balance) INTO x FROM public.meal_stock_lines(s1, 'infinity'::date, now()) WHERE item_value_id = 'nae8-arroz';
  IF x <> 60 THEN RAISE EXCEPTION 'falha: saldo após aceite %', x; END IF;
  _ok := _ok || 'nf-privada,nf-hash,nf-idor,entrega-parcial;';
  _ok := _ok || 'recebimentos,aceite-idempotente,rejeitado-fora;';

  -- 7. não conformidade sobre o rejeitado
  nc := public.record_meal_nonconformity(NULL, NULL, 'aberta', rc3, 'Produto avariado (sintético)', 10, ARRAY['doc:'||doc], NULL, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_nonconformity(%L,1,%L,NULL,NULL,11,NULL,NULL,NULL,%L)',nc,'providencia','x'), 'returned-exceeds-rejected');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_nonconformity(%L,1,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL)',nc,'resolvida'), 'reason-required');
  PERFORM public.record_meal_nonconformity(nc, 1, 'comunicada', NULL, NULL, NULL, ARRAY['doc:extra'], NULL, NULL, NULL);
  IF (SELECT array_length(evidence_refs,1) FROM public.meal_nonconformities WHERE logical_id = nc ORDER BY version DESC LIMIT 1) <> 2 THEN RAISE EXCEPTION 'falha: evidência não acumulada'; END IF;

  -- 8. perda/devolução; unidade incompatível; outra escola; ficha técnica não baixa
  SELECT count(*) INTO n0 FROM public.meal_inventory_movements;
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'perda', 'nae8-arroz', 'nae8-kg', 2, NULL, td, tz, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'perda sintética', NULL);
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'devolucao', 'nae8-arroz', 'nae8-kg', 1, NULL, td, tz, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'devolução sintética', NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8-arroz','nae8-g',td,tz), 'unit-incompatible');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'entrada','nae8-arroz','nae8-kg',td,tz), 'class-not-allowed');
  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8-arroz','nae8-kg',td,tz), 'capability:registrar-estoque-alimentar');
  IF (SELECT count(*) FROM public.meal_inventory_movements) <> n0 + 2 THEN RAISE EXCEPTION 'falha: ficha técnica/recusas geraram movimento'; END IF;
  _ok := _ok || 'nao-conformidade,perda,devolucao,unidade,ficha-sem-baixa;';

  -- 9. execução: planejado ≠ executado, refeições ≠ alunos, consumo observado = 1 movimento; duplicidade e correção
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,false,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td,'nae8-almoco',tz), 'deviation-required');
  ex := public.record_meal_execution(NULL, 'registro', s1, td, 'nae8-almoco', ficha, false, 'Arroz com lentilha', 'Feijão substituído por lentilha', 'Entrega parcial', NULL,
     120, 'contagem-direta', jsonb_build_array(jsonb_build_object('categoria_ref', cat, 'quantidade', 120)), 95, 'chamada sintética',
     jsonb_build_array(jsonb_build_object('line_key','l1','item','nae8-arroz','unit','nae8-kg','quantity',3)), tz, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(NULL,%L,%L,%L,%L,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,NULL,%L,NULL)','registro',s1,td,'nae8-almoco',tz), 'duplicate-use-rectification');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_execution(%L,%L,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,%L::jsonb,%L,%L)',ex,'retificacao','[{"line_key":"l2","item":"nae8-arroz","unit":"nae8-kg","quantity":1}]',tz,'x'), 'consumption-correct-in-stock-ledger');
  PERFORM public.record_meal_execution(ex, 'retificacao', NULL, NULL, NULL, ficha, false, 'Arroz com lentilha', 'Feijão substituído por lentilha', 'Entrega parcial', NULL,
     118, 'contagem-direta', NULL, 95, 'chamada sintética', NULL, tz, 'Recontagem sintética');
  SELECT count(*) INTO n FROM public.meal_execution_consumptions c JOIN public.meal_daily_executions e ON e.logical_id = c.execution_logical_id WHERE e.id = ex;
  IF n <> 1 OR (SELECT count(*) FROM public.meal_inventory_movements WHERE movement_class = 'consumo-observado') <> 1 THEN RAISE EXCEPTION 'falha: consumo observado'; END IF;
  IF (SELECT count(*) FROM public.meal_master_records WHERE logical_id = ficha) <> 3 THEN RAISE EXCEPTION 'falha: cardápio/ficha reescrito'; END IF;
  SELECT sum(balance) INTO x FROM public.meal_stock_lines(s1, 'infinity'::date, now()) WHERE item_value_id = 'nae8-arroz';
  IF x <> 54 THEN RAISE EXCEPTION 'falha: saldo após consumo %', x; END IF;
  _ok := _ok || 'execucao,planejado≠executado,refeicoes≠alunos,consumo-unico,retificacao;';

  -- 9b. teto CALCULADO (estoque agora conhecido): 0.1×10×20 = 20 − 54 ⇒ teto 0; excesso sem justificativa é recusado
  PERFORM pg_temp.nae8_as(uN);
  ln := jsonb_build_array(jsonb_build_object('item_ref',item,'unidade_ref',unit,'publico_ref',pub,'quantidade',80,'publico_atendido',10,'dias_letivos',20,'zz',1));
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_order_with_ceiling(%L,4,%L,NULL,NULL,%L::jsonb,%L,NULL)',ord,'retificacao',ln,'Retificação'), 'ceiling-exceeded');
  ln := jsonb_build_array(jsonb_build_object('item_ref',item,'unidade_ref',unit,'publico_ref',pub,'quantidade',80,'publico_atendido',10,'dias_letivos',20,'justificativa_excesso','Reposição de entrega rejeitada'));
  PERFORM public.record_meal_order_with_ceiling(ord, 4, 'retificacao', NULL, NULL, ln, 'Retificação com justificativa', NULL);
  SELECT ceiling_evaluation INTO ev FROM public.meal_order_versions WHERE logical_id = ord ORDER BY version DESC LIMIT 1;
  IF ev->'linhas'->0->>'estado' <> 'calculado' OR (ev->'linhas'->0->>'bruto')::numeric <> 20 OR (ev->'linhas'->0->>'teto')::numeric <> 0 OR (ev->'linhas'->0->>'excede')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'falha: teto calculado %', ev; END IF;
  _ok := _ok || 'teto-calculado,excesso-recusado,justificativa-congelada;';

  -- 9c. amostras/etiquetas: coleta, outra escola recusada, descarte, stale, descarte duplo
  PERFORM pg_temp.nae8_as(uS);
  am := public.record_meal_food_sample(NULL, NULL, 'coleta', s1, td, 'nae8-almoco', 'Arroz com lentilha', 72, 4, NULL, NULL);
  IF (SELECT sample_code FROM public.meal_food_samples WHERE logical_id = am) !~ '^AM-[0-9A-F]{10}$' THEN RAISE EXCEPTION 'falha: código da amostra'; END IF;
  IF (SELECT count(*) FROM public.meal_food_samples_at(s1, td, td)) <> 1 THEN RAISE EXCEPTION 'falha: leitura amostra'; END IF;
  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_food_sample(NULL,NULL,%L,%L,%L,%L,%L,NULL,NULL,NULL,NULL)','coleta',s1,td,'x','y'), 'capability');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_food_samples_at(%L,%L,%L)',s1,td,td), 'capability');
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_food_sample(%L,9,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)',am,'descarte'), 'meal:stale');
  PERFORM public.record_meal_food_sample(am, 1, 'descarte', NULL, NULL, NULL, NULL, NULL, NULL, 'Descarte após retenção', NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_food_sample(%L,2,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)',am,'descarte'), 'sample-discarded');
  _ok := _ok || 'amostra,etiqueta,amostra-idor,descarte,stale;';

  -- 10. inventário divergente: justificativa, aprovador distinto, ajuste ligado à contagem
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(NULL,NULL,%L,%L,%L,%L::jsonb,NULL)','conferida',s1,td,'[{"item_value_id":"nae8-arroz","unit_value_id":"nae8-kg","fisica":53}]'), 'divergence-requires-justification');
  cnt := public.record_meal_stock_count(NULL, NULL, 'conferida', s1, td, '[{"item_value_id":"nae8-arroz","unit_value_id":"nae8-kg","fisica":53,"justificativa":"Quebra sintética"}]'::jsonb, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_count(%L,1,%L,NULL,NULL,NULL,NULL)',cnt,'aprovada'), 'approver-must-differ');
  PERFORM pg_temp.nae8_as(uA);
  PERFORM public.record_meal_stock_count(cnt, 1, 'aprovada', NULL, NULL, NULL, NULL);
  IF (SELECT (lines->0->>'diferenca')::numeric FROM public.meal_stock_counts WHERE logical_id = cnt ORDER BY version DESC LIMIT 1) <> -1 THEN RAISE EXCEPTION 'falha: diferença congelada'; END IF;
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,(-1)::smallint,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'ajuste-inventario','nae8-arroz','nae8-kg',td,tz), 'reason-required');
  PERFORM public.record_meal_stock_movement(NULL, 'registro', s1, 'ajuste-inventario', 'nae8-arroz', 'nae8-kg', 1, -1::smallint, td, tz, NULL, NULL, NULL, NULL, NULL, cnt, NULL, NULL, 'Ajuste por contagem sintética');
  SELECT sum(balance) INTO x FROM public.meal_stock_lines(s1, 'infinity'::date, now()) WHERE item_value_id = 'nae8-arroz';
  IF x <> 53 THEN RAISE EXCEPTION 'falha: saldo após ajuste %', x; END IF;
  _ok := _ok || 'inventario,aprovador-distinto,ajuste;';

  -- 11. fechamento: competência corrente recusada; anterior reproduzível; reabertura exige motivo
  PERFORM pg_temp.nae8_as(uN);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,NULL,NULL)',s1,comp), 'competence-not-ended');
  PERFORM public.record_meal_stock_closing(s1, prev, NULL, NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_closing(%L,%L,1,NULL)',s1,prev), 'reason-required');
  PERFORM public.record_meal_stock_closing(s1, prev, 1, 'Reemissão sintética');
  SELECT min(manifest_sha256), max(manifest_sha256) INTO sha1, sha2 FROM public.meal_stock_closings WHERE school_id = s1 AND competence = prev;
  IF sha1 <> sha2 THEN RAISE EXCEPTION 'falha: fechamento não reproduzível'; END IF;
  _ok := _ok || 'fechamento,reproduzivel;';

  -- 12. Central do Núcleo: leitura não escreve; 0 ≠ BLOCKED; trilha só pessoa natural
  SELECT count(*) INTO n0 FROM public.meal_inventory_movements;
  FOR r IN SELECT * FROM public.meal_network_action_summary(td, comp) LOOP
    IF r.key = 'pedidos-autorizados' AND (r.value <> 1 OR r.state <> 'AVAILABLE') THEN RAISE EXCEPTION 'falha: autorizados %', r; END IF;
    IF r.key = 'pedidos-devolvidos' AND (r.value <> 0 OR r.state <> 'AVAILABLE') THEN RAISE EXCEPTION 'falha: zero lido %', r; END IF;
    IF r.key = 'nao-conformidades-abertas' AND r.value <> 1 THEN RAISE EXCEPTION 'falha: nc %', r; END IF;
    IF r.key IN ('adesao','prazo-nao-conformidade','escolas-sem-execucao') AND (r.value IS NOT NULL OR r.state <> 'BLOCKED') THEN RAISE EXCEPTION 'falha: bloqueio virou número %', r; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.meal_network_data_quality(td) q WHERE q.key = 'conversao-ausente' AND q.state = 'BLOCKED' AND q.value IS NULL) THEN RAISE EXCEPTION 'falha: conversão ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.meal_network_data_quality(td) q WHERE q.key = 'consumo-sem-vinculo' AND q.value = 0) THEN RAISE EXCEPTION 'falha: consumo órfão'; END IF;
  SELECT count(*) INTO n FROM public.meal_audit_trail_at(s1, now() - interval '1 hour', now() + interval '1 hour') a WHERE a.author_person_id IS NOT NULL;
  IF n < 10 OR EXISTS (SELECT 1 FROM public.meal_audit_trail_at(s1, now() - interval '1 hour', now() + interval '1 hour') a WHERE a.author_person_id IN (pT) OR a.author_person_id IS NULL) THEN RAISE EXCEPTION 'falha: trilha %', n; END IF;
  IF (SELECT count(*) FROM public.meal_inventory_movements) <> n0 THEN RAISE EXCEPTION 'falha: leitura escreveu'; END IF;
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_network_action_summary(%L,%L)',td,comp), 'capability:acompanhar-alimentacao-rede');
  _ok := _ok || 'central,zero≠blocked,trilha,leitura-sem-escrita,acl-rede;';

  -- 13. revogação: capability removida passa a recusar
  DELETE FROM nae8_caps WHERE u = uS AND cap = 'registrar-estoque-alimentar';
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_stock_movement(NULL,%L,%L,%L,%L,%L,1,NULL,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','registro',s1,'perda','nae8-arroz','nae8-kg',td,tz), 'capability:registrar-estoque-alimentar');
  _ok := _ok || 'revogacao;';

  RESET ROLE;
  RAISE EXCEPTION 'lote9-e2e-ok: %', _ok;
END $t$;
