# Publicações e verificação pública (NPUB.1)

| Superfície | Regra | Estado |
|---|---|---|
| `/publico`, `/publico/$slug` | só última versão `publicado` (`public_portal_list/get`, DEFINER); inexistente/rascunho/revogado = "indisponível" | COMPLETO_TECNICAMENTE |
| `/verificar/$codigo` | documento: status + campos públicos + impressão digital; nunca notas/saúde/endereço | COMPLETO_TECNICAMENTE |
| `/verificar/carteirinha/$codigo` | status pela cadeia `student_card_issuances`; nome, escola, turma, ano | COMPLETO_TECNICAMENTE |
| Moldura | as 4 rotas usam `PublicLayout` (sem menu interno); verificações migradas em NPUB.1 | COMPLETO_TECNICAMENTE |
| SEO | `index` só nas publicações publicadas; verificações e indisponível = `noindex` | COMPLETO_TECNICAMENTE |
| Enumeração | código de carteirinha aleatório (10 hex de `gen_random_uuid`), formato inválido = mesma resposta de inexistente | COMPLETO_TECNICAMENTE |
| Calendário público | só após publicação homologada; não há rota pública de calendário | DEPENDE_DECISAO |
| Rate limiting | plataforma sem primitiva padrão | INFRAESTRUTURA_PENDENTE |
| Mobile/a11y em navegador | INTERACTIVE_BROWSER_VALIDATION_PENDING (rotas públicas não exigem login; screenshot headless possível) |
