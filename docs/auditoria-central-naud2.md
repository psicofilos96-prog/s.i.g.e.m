# NAUD.2 — Central de Auditoria (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Sem migration, sem nova capacidade. Projeção dos ledgers já lidos pela RLS de quem consulta.

- Filtros: período, área, tipo, setor, escola (do evento ou do ator), quem age, ator, registro, conhecido até, busca livre; "Limpar filtros".
- Linha do tempo agrupada por dia (fuso America/Sao_Paulo), rótulos legíveis ("Documento escolar — emitido"); código desconhecido não é traduzido.
- Detalhe minimizado: ação, quem age, quando, efeito, registro, origem, motivo (já redigido). Nenhum login, e-mail, CPF, identificador de conta ou payload.
- Quem age: principal institucional × pessoa × técnica só para o Administrador Geral (inventário autorizado). Demais contas veem "Natureza da conta não visível"; setor/escola do ator ficam indisponíveis.
- Link ao fato original só para Documentos escolares, Importações e Central de Acessos (telas que aplicam as próprias permissões). Anexos da inclusão e contas nunca linkam.
- Paginação 25 por página com contador; teto de 500 por fonte declarado como INCOMPLETO.
- Exportação: só com `exportar-auditoria`, que não está atribuída a ninguém → bloqueada (ASSIGNMENT_PENDING).

Provas: `src/features/audit/audit-naud2.test.ts` (principal × pessoa, escola A/B, setor/natureza/busca, minimização, links, 3.000 eventos em 120 páginas sem perda).

Pendências: ASSIGNMENT_PENDING — quem exporta auditoria; INTERACTIVE_BROWSER_VALIDATION_PENDING — conferência com login real do Administrador e de uma escola.
