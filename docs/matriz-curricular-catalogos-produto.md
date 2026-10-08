# Matriz curricular, catálogos e referências — produto (NCURR.1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Nada oficial criado/homologado; 2027 não configurado.

| Ferramenta | Onde | Estado |
|---|---|---|
| Catálogo etapas/anos/posições | Catálogos institucionais (`record_attribute_value_version`) | COMPLETO_TECNICAMENTE; DEPENDE_DADO (nenhum valor semeado) |
| Turnos / Oferta | `class_shift_at` / `class_offering_at` | COMPLETO_TECNICAMENTE; opções só homologadas |
| Componentes | `register_curricular_component_version` | COMPLETO_TECNICAMENTE |
| Matriz por vigência + quadro | `record_curricular_matrix_version` (base esperada) | COMPLETO_TECNICAMENTE; DEPENDE_DADO (matriz oficial) |
| Correspondências E1–E4 | `r5-source.ts` (7 RPCs, expected_head) | Writers prontos; homologação ASSIGNMENT_PENDING |
| Importação em prévia | `d1-import.ts` (prévia → confirmação humana) | COMPLETO_TECNICAMENTE |
| Histórico/versionamento | readers `_at` com validOn/knownAt | COMPLETO_TECNICAMENTE |
| Comparação entre versões | `matrix-version-compare.ts` (novo) | Lógica + 4 testes; tela pendente (NCURR.1.1) |
| Impressão | `/matrizes-curriculares/impressao/$id` | Técnico; PDF com login = INTERACTIVE_BROWSER_VALIDATION_PENDING |

Integrações: Nova Turma (composição de catálogo), atribuição docente, Diário, Horários e Avaliação leem resolução curricular por readers B4.2.4; sem matriz homologada ⇒ falha fechada, nunca demo.
Pendente: textos "demonstrativo" nos títulos das rotas do laboratório de matrizes; testes com contas temporárias, desfazer, base desatualizada (só pelo harness, não executado nesta rodada).

## Rodada 2 (2026-10-07)
- Tela de comparação entregue: "Comparar versões" no detalhe da matriz (aparece com 2+ versões). Cada versão é lida no seu próprio instante (vigência + registro) pelos readers canônicos; diferenças por item (incluído, retirado, carga, referência); carga ausente = "Ainda não configurado".
- Títulos "demonstrativo" ficam só nas telas de laboratório sem login (rótulo honesto); com login só dado institucional.
- Typecheck 0 erros; curriculum 96/96.
- Pendente: testes com contas temporárias (desfazer, base desatualizada, histórico) só pelo harness; revisão das integrações com Nova Turma, atribuição docente, Diário, Horários e Avaliação; homologação de matriz = ASSIGNMENT_PENDING; PDF com login = INTERACTIVE_BROWSER_VALIDATION_PENDING.
