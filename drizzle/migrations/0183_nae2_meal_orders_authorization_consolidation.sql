-- NAE.2 — Pedido escolar → análise → autorização → consolidação de demanda.
-- Janela = ato versionado do Núcleo (abertura/reabertura/encerramento com instantes e fuso explícitos; sem dia fixo).
-- Pedido = cadeia append-only de versões; cada transição (submissão, análise, devolução, autorização, rejeição,
-- cancelamento, retificação) é nova versão congelada. Autorização ≠ recebimento/nota/empenho/estoque.
-- Itens/unidades só homologados; item vedado por regra homologada para o público é recusado no writer;
-- teto/necessidade NÃO são calculados nem afirmados no banco (QUANTITY_LIMIT — BLOCKED_BY_HOMOLOGATED_RULE).
-- Consolidação soma só a cabeça autorizada vigente, por item+unidade+referência contratual, com discriminação por escola.

CREATE TABLE public.meal_order_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_order_windows(id),
  action text NOT NULL CHECK (action IN ('abertura','reabertura','encerramento','retificacao')),
  competence text NOT NULL CHECK (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  school_ids text[],
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL CHECK (closes_at > opens_at),
  time_zone text NOT NULL,
  basis text NOT NULL CHECK (basis IN ('regra-homologada','abertura-explicita')),
  rule_ref uuid,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.meal_order_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_order_versions(id),
  status text NOT NULL CHECK (status IN ('rascunho','submetido','em-analise','devolvido','autorizado-total','autorizado-parcial','rejeitado','cancelado','retificado')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  competence text NOT NULL,
  window_version_id uuid NOT NULL REFERENCES public.meal_order_windows(id),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE INDEX meal_order_versions_scope_idx ON public.meal_order_versions(competence, school_id, logical_id, version DESC);
CREATE TABLE public.meal_order_opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_version_id uuid NOT NULL REFERENCES public.meal_order_versions(id),
  opinion text NOT NULL,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.meal_demand_consolidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competence text NOT NULL,
  sequence integer NOT NULL,
  snapshot jsonb NOT NULL,
  order_version_ids uuid[] NOT NULL,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competence, sequence)
);
GRANT SELECT ON public.meal_order_windows, public.meal_order_versions, public.meal_order_opinions, public.meal_demand_consolidations TO service_role;
ALTER TABLE public.meal_order_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_order_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_order_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_demand_consolidations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_order_windows_append_only BEFORE UPDATE OR DELETE ON public.meal_order_windows FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_order_versions_append_only BEFORE UPDATE OR DELETE ON public.meal_order_versions FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_order_opinions_append_only BEFORE UPDATE OR DELETE ON public.meal_order_opinions FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_demand_consolidations_append_only BEFORE UPDATE OR DELETE ON public.meal_demand_consolidations FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- janela vigente da competência para a escola: última versão de cada janela lógica, não encerrada, cobrindo a escola
CREATE FUNCTION public.meal_order_window_for(_competence text, _school text) RETURNS public.meal_order_windows
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT h.* FROM (SELECT DISTINCT ON (w.logical_id) w.* FROM public.meal_order_windows w
                    WHERE w.competence = _competence ORDER BY w.logical_id, w.version DESC) h
   WHERE h.action <> 'encerramento' AND (h.school_ids IS NULL OR _school = ANY(h.school_ids))
   ORDER BY h.recorded_at DESC LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.meal_order_window_for(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_meal_order_window(_logical uuid, _expected_version integer, _action text, _competence text,
  _school_ids text[], _opens timestamptz, _closes timestamptz, _tz text, _basis text, _rule uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_order_windows; lid uuid; s text;
BEGIN
  me := public.af_natural_person();
  IF _action NOT IN ('abertura','reabertura','encerramento','retificacao') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _action <> 'abertura' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_order_windows WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_order_windows WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF _action = 'abertura' THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
    _competence := head.competence;
    IF _action = 'encerramento' THEN _school_ids := head.school_ids; _opens := head.opens_at; _closes := coalesce(_closes, head.closes_at);
      _tz := head.time_zone; _basis := head.basis; _rule := head.rule_ref; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
  END IF;
  IF _opens IS NULL OR _closes IS NULL OR _closes <= _opens THEN RAISE EXCEPTION 'meal:window-invalid'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = _tz) THEN RAISE EXCEPTION 'meal:time-zone-required'; END IF;
  IF _basis NOT IN ('regra-homologada','abertura-explicita') THEN RAISE EXCEPTION 'meal:window-basis-invalid'; END IF;
  IF _basis = 'regra-homologada' AND (_rule IS NULL OR NOT public.meal_master_homologated(_rule, 'documento-tecnico', (_opens AT TIME ZONE _tz)::date))
    THEN RAISE EXCEPTION 'meal:window-rule-not-homologated'; END IF;
  IF _school_ids IS NOT NULL THEN
    FOREACH s IN ARRAY _school_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.institutional_schools x WHERE x.id = s) THEN RAISE EXCEPTION 'meal:school-unknown'; END IF;
    END LOOP;
  END IF;
  -- autorização na data em que a janela abre (fato), no fuso declarado
  g := public.meal_network_grant_on('administrar-janela-de-pedido-alimentar', (_opens AT TIME ZONE _tz)::date);
  INSERT INTO public.meal_order_windows(logical_id, version, supersedes_id, action, competence, school_ids, opens_at, closes_at, time_zone, basis, rule_ref, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, _action, _competence, _school_ids, _opens, _closes, _tz, _basis, _rule, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_order_window(uuid, integer, text, text, text[], timestamptz, timestamptz, text, text, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_order_window(uuid, integer, text, text, text[], timestamptz, timestamptz, text, text, uuid, text) TO authenticated;

-- validação das linhas: item/unidade homologados, quantidade ≥ 0, vedação por público só por regra homologada
CREATE FUNCTION public.meal_order_lines_check(_lines jsonb, _on date) RETURNS void
LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE l jsonb; seen text[] := ARRAY[]::text[]; key text;
BEGIN
  IF jsonb_typeof(_lines) <> 'array' THEN RAISE EXCEPTION 'meal:lines-required'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF l->>'item_ref' IS NULL OR NOT public.meal_master_homologated((l->>'item_ref')::uuid, 'item-alimentar', _on) THEN RAISE EXCEPTION 'meal:item-not-homologated'; END IF;
    IF l->>'unidade_ref' IS NULL OR NOT public.meal_master_homologated((l->>'unidade_ref')::uuid, 'unidade-de-medida', _on) THEN RAISE EXCEPTION 'meal:unit-not-homologated'; END IF;
    IF l->>'apresentacao_ref' IS NOT NULL AND NOT public.meal_master_homologated((l->>'apresentacao_ref')::uuid, 'apresentacao-embalagem', _on) THEN RAISE EXCEPTION 'meal:presentation-not-homologated'; END IF;
    IF l->>'contrato_ref' IS NOT NULL AND NOT public.meal_master_homologated((l->>'contrato_ref')::uuid, 'referencia-contratual', _on) THEN RAISE EXCEPTION 'meal:contract-not-homologated'; END IF;
    IF jsonb_typeof(l->'quantidade') <> 'number' OR (l->>'quantidade')::numeric < 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
    IF l->>'zero_motivo' IS NOT NULL AND l->>'zero_motivo' NOT IN ('saldo-suficiente','nao-aplicavel','outro') THEN RAISE EXCEPTION 'meal:zero-reason-invalid'; END IF;
    key := (l->>'item_ref') || '|' || (l->>'unidade_ref') || '|' || coalesce(l->>'publico_ref','');
    IF key = ANY(seen) THEN RAISE EXCEPTION 'meal:line-duplicated'; END IF;
    seen := seen || key;
    -- vedação: existe regra homologada "vedado" para o item? então o público é obrigatório e não pode ser o vedado
    IF EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r
                 WHERE r.kind = 'regra-de-elegibilidade-item' ORDER BY r.logical_id, r.version DESC) h
               WHERE h.status = 'homologada' AND h.payload->>'efeito' = 'vedado' AND h.payload->>'item_ref' = l->>'item_ref'
                 AND h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on)) THEN
      IF l->>'publico_ref' IS NULL THEN RAISE EXCEPTION 'meal:audience-required'; END IF;
      IF EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r
                   WHERE r.kind = 'regra-de-elegibilidade-item' ORDER BY r.logical_id, r.version DESC) h
                 WHERE h.status = 'homologada' AND h.payload->>'efeito' = 'vedado' AND h.payload->>'item_ref' = l->>'item_ref'
                   AND h.payload->>'publico_ref' = l->>'publico_ref' AND h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on))
        THEN RAISE EXCEPTION 'meal:item-not-eligible-for-audience'; END IF;
    END IF;
  END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_order_lines_check(jsonb, date) FROM PUBLIC, anon, authenticated, service_role;

-- writer único do pedido
CREATE FUNCTION public.record_meal_order(_logical uuid, _expected_version integer, _action text, _school text, _competence text, _lines jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; head public.meal_order_versions; w public.meal_order_windows; lid uuid; st text; ln jsonb; d date;
BEGIN
  me := public.af_natural_person();
  IF _action NOT IN ('rascunho','submissao','analise','devolucao','autorizacao','rejeicao','cancelamento','retificacao') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _action <> 'rascunho' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'meal:competence-invalid'; END IF;
    w := public.meal_order_window_for(_competence, _school);
    IF w.id IS NULL THEN RAISE EXCEPTION 'meal:window-not-open'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('meal-order:' || _school || ':' || _competence));
    IF EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (v.logical_id) v.status FROM public.meal_order_versions v
                 WHERE v.school_id = _school AND v.competence = _competence ORDER BY v.logical_id, v.version DESC) h
               WHERE h.status NOT IN ('cancelado','rejeitado')) THEN RAISE EXCEPTION 'meal:order-exists-use-base'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_order_versions WHERE logical_id = lid FOR UPDATE;
    SELECT * INTO head FROM public.meal_order_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    _school := head.school_id; _competence := head.competence;
    IF head.status IN ('rejeitado','cancelado') THEN RAISE EXCEPTION 'meal:order-closed'; END IF;
    w := public.meal_order_window_for(_competence, _school);
    IF w.id IS NULL THEN SELECT * INTO w FROM public.meal_order_windows WHERE id = head.window_version_id; END IF;
  END IF;
  d := (now() AT TIME ZONE w.time_zone)::date;

  IF _action IN ('rascunho','submissao') THEN
    IF head.id IS NOT NULL AND head.status NOT IN ('rascunho','devolvido') THEN RAISE EXCEPTION 'meal:order-frozen'; END IF;
    g := public.meal_grant_on('submeter-pedido-alimentar', _school, d);
    ln := coalesce(_lines, head.lines);
    IF _action = 'submissao' THEN
      IF now() < w.opens_at OR now() > w.closes_at OR w.action = 'encerramento' THEN RAISE EXCEPTION 'meal:window-closed'; END IF;
      IF jsonb_array_length(ln) = 0 THEN RAISE EXCEPTION 'meal:lines-required'; END IF;
      st := 'submetido';
    ELSE st := 'rascunho'; END IF;
    PERFORM public.meal_order_lines_check(ln, d);
  ELSIF _action = 'analise' THEN
    IF head.status <> 'submetido' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    g := public.meal_network_grant_on('analisar-pedido-alimentar', d); st := 'em-analise'; ln := head.lines;
  ELSIF _action = 'devolucao' THEN
    IF head.status NOT IN ('submetido','em-analise') THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    g := public.meal_network_grant_on('analisar-pedido-alimentar', d); st := 'devolvido'; ln := head.lines;
  ELSIF _action IN ('autorizacao','retificacao') THEN
    IF _action = 'autorizacao' AND head.status NOT IN ('submetido','em-analise') THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF _action = 'retificacao' AND head.status NOT IN ('autorizado-total','autorizado-parcial','retificado') THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    g := public.meal_network_grant_on('autorizar-pedido-alimentar', d);
    ln := coalesce(_lines, head.lines);
    PERFORM public.meal_order_lines_check(ln, d);
    -- ajuste de quantidade exige justificativa; autorizado nunca excede o solicitado sem retificação justificada
    IF ln IS DISTINCT FROM head.lines AND nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    IF _action = 'retificacao' THEN
      IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
      st := 'retificado';
    ELSE
      st := CASE WHEN ln = head.lines THEN 'autorizado-total' ELSE 'autorizado-parcial' END;
    END IF;
  ELSIF _action = 'rejeicao' THEN
    IF head.status NOT IN ('submetido','em-analise') THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    g := public.meal_network_grant_on('autorizar-pedido-alimentar', d); st := 'rejeitado'; ln := head.lines;
  ELSE -- cancelamento: a escola antes da submissão; a rede antes da autorização
    IF head.status IN ('rascunho','devolvido') THEN g := public.meal_grant_on('submeter-pedido-alimentar', _school, d);
    ELSIF head.status IN ('submetido','em-analise') THEN g := public.meal_network_grant_on('autorizar-pedido-alimentar', d);
    ELSE RAISE EXCEPTION 'meal:transition-invalid'; END IF;
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    st := 'cancelado'; ln := head.lines;
  END IF;

  INSERT INTO public.meal_order_versions(logical_id, version, supersedes_id, status, school_id, competence, window_version_id, lines, reason, author_user_id, author_person_id, author_engagement)
  VALUES (lid, coalesce(head.version,0)+1, head.id, st, _school, _competence, coalesce(head.window_version_id, w.id), coalesce(ln, '[]'::jsonb), nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_order(uuid, integer, text, text, text, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_order(uuid, integer, text, text, text, jsonb, text) TO authenticated;

-- parecer técnico (Nutricionista): não muda estado nem aprova
CREATE FUNCTION public.record_meal_order_opinion(_order_version uuid, _opinion text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; r uuid;
BEGIN
  me := public.af_natural_person();
  IF NOT EXISTS (SELECT 1 FROM public.meal_order_versions v WHERE v.id = _order_version) THEN RAISE EXCEPTION 'meal:order-unknown'; END IF;
  IF nullif(btrim(_opinion),'') IS NULL THEN RAISE EXCEPTION 'meal:opinion-required'; END IF;
  g := public.meal_network_grant_on('manter-parametros-nutricionais', CURRENT_DATE);
  INSERT INTO public.meal_order_opinions(order_version_id, opinion, author_user_id, author_person_id, author_engagement)
  VALUES (_order_version, btrim(_opinion), auth.uid(), me, g) RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_order_opinion(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_order_opinion(uuid, text) TO authenticated;

-- leitura: escola vê só os próprios pedidos; rede vê com capability de análise/autorização/consolidação/acompanhamento
CREATE FUNCTION public.meal_orders_at(_competence text, _school text, _known_at timestamptz)
RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, competence text, lines jsonb, reason text,
              window_closes_at timestamptz, window_time_zone text, first_recorded_at timestamptz, recorded_at timestamptz, opinions integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now()); net boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  net := public.meal_has_network(ARRAY['analisar-pedido-alimentar','autorizar-pedido-alimentar','consolidar-demanda-alimentar','acompanhar-alimentacao-rede','manter-parametros-nutricionais']);
  IF NOT net THEN
    IF _school IS NULL THEN RAISE EXCEPTION 'meal:school-required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL
         AND c.capability_id IN ('submeter-pedido-alimentar','consultar-alimentacao-escolar') AND c.scope_level = 'escola' AND c.school_id = _school)
      THEN RAISE EXCEPTION 'capability:submeter-pedido-alimentar'; END IF;
  END IF;
  RETURN QUERY
  SELECT h.logical_id, h.version, h.status, h.school_id, h.competence, h.lines, h.reason, w.closes_at, w.time_zone,
         (SELECT min(x.recorded_at) FROM public.meal_order_versions x WHERE x.logical_id = h.logical_id), h.recorded_at,
         (SELECT count(*)::integer FROM public.meal_order_opinions o JOIN public.meal_order_versions v ON v.id = o.order_version_id WHERE v.logical_id = h.logical_id)
  FROM (SELECT DISTINCT ON (v.logical_id) v.* FROM public.meal_order_versions v
         WHERE v.recorded_at <= k AND (_competence IS NULL OR v.competence = _competence) AND (_school IS NULL OR v.school_id = _school)
         ORDER BY v.logical_id, v.version DESC) h
  JOIN public.meal_order_windows w ON w.id = h.window_version_id
  ORDER BY h.competence, h.school_id LIMIT 5000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_orders_at(text, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_orders_at(text, text, timestamptz) TO authenticated;

CREATE FUNCTION public.meal_order_history(_logical uuid)
RETURNS TABLE(version integer, status text, lines jsonb, reason text, author_person_id uuid, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text;
BEGIN
  SELECT v.school_id INTO s FROM public.meal_order_versions v WHERE v.logical_id = _logical LIMIT 1;
  IF s IS NULL THEN RETURN; END IF;
  PERFORM 1 FROM public.meal_orders_at(NULL, s, NULL) LIMIT 1;
  RETURN QUERY SELECT v.version, v.status, v.lines, v.reason, v.author_person_id, v.recorded_at
    FROM public.meal_order_versions v WHERE v.logical_id = _logical ORDER BY v.version;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_order_history(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_order_history(uuid) TO authenticated;

CREATE FUNCTION public.meal_order_windows_at(_competence text)
RETURNS TABLE(logical_id uuid, version integer, action text, competence text, school_ids text[], opens_at timestamptz, closes_at timestamptz,
              time_zone text, basis text, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT w.logical_id, w.version, w.action, w.competence, w.school_ids, w.opens_at, w.closes_at, w.time_zone, w.basis, w.reason, w.recorded_at
    FROM public.meal_order_windows w WHERE (_competence IS NULL OR w.competence = _competence)
     AND (public.meal_has_network(ARRAY['administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar','consolidar-demanda-alimentar','acompanhar-alimentacao-rede'])
          OR EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.capability_id = 'submeter-pedido-alimentar'
                     AND c.scope_level = 'escola' AND (w.school_ids IS NULL OR c.school_id = ANY(w.school_ids))))
    ORDER BY w.competence, w.logical_id, w.version;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_order_windows_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_order_windows_at(text) TO authenticated;

-- consolidação: só cabeças autorizadas vigentes; zero nunca vira demanda
CREATE FUNCTION public.meal_demand_consolidation_at(_competence text)
RETURNS TABLE(item_ref text, unidade_ref text, apresentacao_ref text, contrato_ref text, total numeric, by_school jsonb, order_version_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NOT public.meal_has_network(ARRAY['consolidar-demanda-alimentar','autorizar-pedido-alimentar','acompanhar-alimentacao-rede']) THEN RAISE EXCEPTION 'capability:consolidar-demanda-alimentar'; END IF;
  RETURN QUERY
  WITH heads AS (SELECT DISTINCT ON (v.logical_id) v.* FROM public.meal_order_versions v WHERE v.competence = _competence ORDER BY v.logical_id, v.version DESC),
  l AS (SELECT h.id, h.school_id, x FROM heads h, jsonb_array_elements(h.lines) x
         WHERE h.status IN ('autorizado-total','autorizado-parcial','retificado') AND (x->>'quantidade')::numeric > 0)
  SELECT l.x->>'item_ref', l.x->>'unidade_ref', l.x->>'apresentacao_ref', l.x->>'contrato_ref',
         sum((l.x->>'quantidade')::numeric),
         jsonb_object_agg(l.school_id, (l.x->>'quantidade')::numeric),
         array_agg(DISTINCT l.id)
    FROM l GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_demand_consolidation_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_demand_consolidation_at(text) TO authenticated;

-- mapa de consolidação congelado (revisão humana; não envia nada ao fornecedor)
CREATE FUNCTION public.record_meal_demand_consolidation(_competence text, _expected_sequence integer, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; s integer; snap jsonb; ids uuid[];
BEGIN
  me := public.af_natural_person();
  g := public.meal_network_grant_on('consolidar-demanda-alimentar', CURRENT_DATE);
  PERFORM pg_advisory_xact_lock(hashtext('meal-consolidation:' || _competence));
  SELECT coalesce(max(c.sequence),0) INTO s FROM public.meal_demand_consolidations c WHERE c.competence = _competence;
  IF s IS DISTINCT FROM coalesce(_expected_sequence,0) THEN RAISE EXCEPTION 'meal:stale'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO snap FROM public.meal_demand_consolidation_at(_competence) c;
  SELECT coalesce(array_agg(DISTINCT u), ARRAY[]::uuid[]) INTO ids FROM public.meal_demand_consolidation_at(_competence) c, unnest(c.order_version_ids) u;
  IF jsonb_array_length(snap) = 0 THEN RAISE EXCEPTION 'meal:nothing-authorized'; END IF;
  INSERT INTO public.meal_demand_consolidations(competence, sequence, snapshot, order_version_ids, reason, author_user_id, author_person_id, author_engagement)
  VALUES (_competence, s + 1, snap, ids, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN s + 1;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_demand_consolidation(text, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_demand_consolidation(text, integer, text) TO authenticated;
