CREATE OR REPLACE FUNCTION public.meal_master_spec(_kind text, OUT capability text, OUT required text[], OUT refs text[])
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT s.c, s.r, s.f FROM (VALUES
    ('item-alimentar','manter-catalogo-tecnico-alimentar', ARRAY['nome'], ARRAY[]::text[]),
    ('unidade-de-medida','manter-catalogo-tecnico-alimentar', ARRAY['nome','simbolo'], ARRAY[]::text[]),
    ('apresentacao-embalagem','manter-catalogo-tecnico-alimentar', ARRAY['descricao','quantidade'], ARRAY['item_ref:item-alimentar','unidade_ref:unidade-de-medida']),
    ('especificacao-tecnica','manter-catalogo-tecnico-alimentar', ARRAY['texto'], ARRAY['item_ref:item-alimentar']),
    ('fator-de-conversao','manter-parametros-nutricionais', ARRAY['fator'], ARRAY['de_unidade_ref:unidade-de-medida','para_unidade_ref:unidade-de-medida']),
    ('publico-de-atendimento','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('parametro-per-capita','manter-parametros-nutricionais', ARRAY['quantidade'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento','unidade_ref:unidade-de-medida']),
    ('regra-de-elegibilidade-item','manter-parametros-nutricionais', ARRAY['efeito'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento']),
    ('necessidade-alimentar-especial','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('receita-ficha-tecnica','manter-planejamento-nutricional', ARRAY['nome','ingredientes'], ARRAY[]::text[]),
    ('cardapio-planejado','manter-planejamento-nutricional', ARRAY['competencia','tipo','entradas'], ARRAY['publico_ref:publico-de-atendimento']),
    ('fornecedor','manter-referencias-contratuais-alimentacao', ARRAY['nome'], ARRAY[]::text[]),
    ('referencia-contratual','manter-referencias-contratuais-alimentacao', ARRAY['natureza','numero'], ARRAY['fornecedor_ref:fornecedor']),
    ('marca-aprovada','manter-referencias-contratuais-alimentacao', ARRAY['marca'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('preco-contratado','manter-referencias-contratuais-alimentacao', ARRAY['preco_unitario'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('programacao-de-entrega','manter-referencias-contratuais-alimentacao', ARRAY['frequencia'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('designacao-inspetor','designar-inspetor-alimentacao', ARRAY['pessoa_id'], ARRAY[]::text[]),
    ('treinamento-inspetor','designar-inspetor-alimentacao', ARRAY['realizado_em'], ARRAY['designacao_ref:designacao-inspetor']),
    ('documento-tecnico','gerir-documentos-alimentacao', ARRAY['titulo','categoria','natureza','sha256'], ARRAY[]::text[]),
    ('categoria-de-refeicao','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('modelo-operacional','gerir-documentos-alimentacao', ARRAY['titulo','natureza','campos'], ARRAY[]::text[]),
    ('definicao-metrica-adesao','manter-planejamento-nutricional', ARRAY['formula','numerador','denominador'], ARRAY[]::text[])
  ) AS s(k, c, r, f) WHERE s.k = _kind
$function$;