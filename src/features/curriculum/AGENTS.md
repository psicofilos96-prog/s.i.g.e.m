## R5 na interface (`r5-source.ts`, `r5-homologation-panel.tsx`, `curricular-correspondence.tsx`)

- E1–E4 gravam só pelos 7 RPCs canônicos (0059/0060) via `r5-source.ts`; nenhum DML de tabela no navegador, porque o banco é a autoridade.
- Ação só aparece com capacidade efetiva de rede da própria operação; sem ela, estado + explicação, porque só capacidade de política homologada vale.
- Homologar/revogar envia sempre a cabeça do ledger como `expected_head`; revogar é novo evento, porque o histórico é append-only.
- Formulários só oferecem catálogos homologados, matrizes e turmas institucionais; ausência vira estado vazio explícito, porque a tela não semeia dado.
- E4 é exibida como exceção explícita, nunca fallback de E3.
- Referência documental é campo opcional (vazio ⇒ null), rotulada como fonte, nunca como autorização, porque a decisão do proprietário governa.
