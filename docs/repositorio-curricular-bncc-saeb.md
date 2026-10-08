# Frente P — Repositório curricular BNCC + SAEB

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


**Status: arquitetura PASS; conteúdo real BLOCKED_BY_SOURCE.**

`src/features/curricular-reference/` + migration 0068: edição append-only com cabeça esperada, itens com código e texto oficial imutável, simplificação como camada editorial versionada à parte, relações muitos-para-muitos com natureza/confiança/proveniência (relação oficial ≠ mapeamento editorial), vínculo a etapa/componente só por valor canônico validado.

Estado real: 0 edições, 0 itens. Nenhum texto BNCC/SAEB foi inventado nem copiado sem fonte oficial no projeto. Interface mostra estado vazio explícito.
