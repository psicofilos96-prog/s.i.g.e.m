-- Defeito real: equipe escolar só via registros com school_id da própria escola; o catálogo técnico homologado da rede
-- (item, unidade, público, categoria, ficha, cardápio) tem school_id NULL e nunca aparecia, logo nenhuma escola montava pedido.
-- Agora quem tem consultar/submeter pedido em alguma escola lê o catálogo HOMOLOGADO da rede dessas espécies (nunca rascunho,
-- fornecedor, contrato ou designação de inspetor).
CREATE OR REPLACE FUNCTION public.meal_master_at(_kind text, _on date, _known_at timestamp with time zone, _include_drafts boolean)
 RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, valid_from date, valid_to date, payload jsonb, author_person_id uuid, recorded_at timestamp with time zone, functional_validation text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE sp record; k timestamptz := coalesce(_known_at, now()); maint boolean; net boolean; fx boolean; schoolcat boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO sp FROM public.meal_master_spec(_kind);
  IF sp.capability IS NULL THEN RAISE EXCEPTION 'meal:kind-unknown'; END IF;
  maint := public.meal_has_network(ARRAY[sp.capability,'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar']);
  net := maint OR public.meal_has_network(ARRAY['acompanhar-alimentacao-rede']);
  fx := public.bo_fixture_is_user(auth.uid());
  schoolcat := _kind IN ('item-alimentar','unidade-de-medida','publico-de-atendimento','categoria-de-refeicao','receita-ficha-tecnica','cardapio-planejado')
    AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
      WHERE (c.policy_id IS NOT NULL OR (c.policy_id IS NULL AND c.engagement_id IS NULL AND fx))
        AND c.capability_id IN ('consultar-alimentacao-escolar','submeter-pedido-alimentar') AND c.scope_level = 'escola');
  RETURN QUERY
  SELECT h.logical_id, h.version, h.status, h.school_id, h.valid_from, h.valid_to, h.payload, h.author_person_id, h.recorded_at,
         CASE WHEN h.kind = 'designacao-inspetor' THEN 'FUNCTIONAL_SOURCE_REQUIRED' END
  FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r
         WHERE r.kind = _kind AND r.recorded_at <= k ORDER BY r.logical_id, r.version DESC) h
  WHERE h.status <> 'retirada'
    AND (fx OR NOT EXISTS (SELECT 1 FROM public.meal_master_records z WHERE z.logical_id = h.logical_id AND public.bo_fixture_is_user(z.author_user_id)))
    AND (h.status = 'homologada' OR (coalesce(_include_drafts,false) AND maint))
    AND (_on IS NULL OR (h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on)))
    AND (net
      OR (schoolcat AND h.school_id IS NULL AND h.status = 'homologada')
      OR (h.school_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
           WHERE (c.policy_id IS NOT NULL OR (c.policy_id IS NULL AND c.engagement_id IS NULL AND fx)) AND c.capability_id = 'consultar-alimentacao-escolar' AND c.scope_level = 'escola' AND c.school_id = h.school_id)))
  ORDER BY h.valid_from, h.logical_id LIMIT 2000;
END $function$;