# Publicações e verificação pública (NPUB.1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


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
