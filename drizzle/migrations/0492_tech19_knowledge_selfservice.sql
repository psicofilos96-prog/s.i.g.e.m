-- Tecnologia L19: biblioteca técnica = documentos da Base de Conhecimento (0094), nunca cópia. Aqui só vínculos
-- artigo → categoria de chamado (L04) ou serviço do catálogo (L15), validados por pessoa ≠ quem vinculou,
-- e retorno do autosserviço (resolveu / não resolveu, opcionalmente citando o chamado aberto depois).
CREATE TABLE public.tech_kb_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_document_id text NOT NULL REFERENCES public.kb_documents(id),
  target_kind text NOT NULL CHECK (target_kind IN ('categoria-de-chamado','servico-digital')),
  target_key text NOT NULL CHECK (length(btrim(target_key)) >= 3),
  action text NOT NULL CHECK (action IN ('vincular','desvincular')),
  person_id uuid NOT NULL,
  validated_by uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_kb_link_validations (
  link_id uuid PRIMARY KEY REFERENCES public.tech_kb_links(id),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_selfservice_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_document_id text NOT NULL REFERENCES public.kb_documents(id),
  outcome text NOT NULL CHECK (outcome IN ('resolveu','nao-resolveu')),
  request_id uuid REFERENCES public.ops_requests(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome = 'nao-resolveu' OR request_id IS NULL)
);
GRANT ALL ON public.tech_kb_links, public.tech_kb_link_validations, public.tech_selfservice_feedback TO service_role;
REVOKE ALL ON public.tech_kb_links, public.tech_kb_link_validations, public.tech_selfservice_feedback FROM anon, authenticated;
GRANT SELECT (id, kb_document_id, target_kind, target_key, action, person_id, created_at) ON public.tech_kb_links TO authenticated;
GRANT SELECT ON public.tech_kb_link_validations TO authenticated;
ALTER TABLE public.tech_kb_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_kb_link_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_selfservice_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb link read" ON public.tech_kb_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb val read" ON public.tech_kb_link_validations FOR SELECT TO authenticated USING (true);
-- Retorno individual não é lido por ninguém pela API; só agregado pela função abaixo.
CREATE TRIGGER kb_link_immutable BEFORE UPDATE OR DELETE ON public.tech_kb_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER kb_val_immutable BEFORE UPDATE OR DELETE ON public.tech_kb_link_validations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER kb_fb_immutable BEFORE UPDATE OR DELETE ON public.tech_selfservice_feedback FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_kb_link(_doc text, _kind text, _target text, _action text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_kb_links WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('curar-conhecimento-tecnico') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kb_documents WHERE id = _doc) THEN RAISE EXCEPTION 'documento-inexistente'; END IF;
  IF _kind = 'servico-digital' AND NOT EXISTS (SELECT 1 FROM public.tech_digital_service_versions WHERE service_key = _target) THEN RAISE EXCEPTION 'alvo-inexistente'; END IF;
  IF _kind = 'categoria-de-chamado' AND NOT EXISTS (SELECT 1 FROM public.tech_ticket_category_versions WHERE category_key = _target) THEN RAISE EXCEPTION 'alvo-inexistente'; END IF;
  INSERT INTO public.tech_kb_links(kb_document_id, target_kind, target_key, action, person_id, idempotency_key) VALUES (_doc, _kind, btrim(_target), _action, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.validate_tech_kb_link(_link uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _l public.tech_kb_links;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('validar-conhecimento-tecnico') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _l FROM public.tech_kb_links WHERE id = _link;
  IF _l.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _l.person_id = _p THEN RAISE EXCEPTION 'autovalidacao'; END IF;
  INSERT INTO public.tech_kb_link_validations(link_id, person_id) VALUES (_link, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-validado';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_selfservice_feedback(_doc text, _outcome text, _request uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_selfservice_feedback WHERE idempotency_key = _key AND person_id = _p; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kb_documents WHERE id = _doc) THEN RAISE EXCEPTION 'documento-inexistente'; END IF;
  IF _request IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_requests WHERE id = _request AND requester_person = _p AND sector = 'tecnologia') THEN RAISE EXCEPTION 'chamado-alheio'; END IF;
  INSERT INTO public.tech_selfservice_feedback(kb_document_id, outcome, request_id, person_id, idempotency_key) VALUES (_doc, _outcome, _request, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos'; WHEN unique_violation THEN RAISE EXCEPTION 'chave-ja-usada';
END $$;

-- Agregado sem pessoa: só para curadoria.
CREATE OR REPLACE FUNCTION public.tech_selfservice_summary()
RETURNS TABLE(kb_document_id text, resolved bigint, not_resolved bigint, tickets_after bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('curar-conhecimento-tecnico') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  RETURN QUERY SELECT f.kb_document_id, count(*) FILTER (WHERE f.outcome = 'resolveu'), count(*) FILTER (WHERE f.outcome = 'nao-resolveu'), count(f.request_id)
    FROM public.tech_selfservice_feedback f GROUP BY f.kb_document_id;
END $$;
REVOKE ALL ON FUNCTION public.record_tech_kb_link(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_tech_kb_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_selfservice_feedback(text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tech_selfservice_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_kb_link(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_tech_kb_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_selfservice_feedback(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tech_selfservice_summary() TO authenticated;