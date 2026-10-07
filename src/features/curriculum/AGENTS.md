## R5 na interface (`r5-source.ts`, `r5-homologation-panel.tsx`, `curricular-correspondence.tsx`)

- E1–E4 gravam só pelos 7 RPCs canônicos (0059/0060) via `r5-source.ts`; nenhum DML de tabela no navegador, porque o banco é a autoridade.
- Ação só aparece com capacidade efetiva de rede da própria operação; sem ela, estado + explicação, porque só capacidade de política homologada vale.
- Homologar/revogar envia sempre a cabeça do ledger como `expected_head`; revogar é novo evento, porque o histórico é append-only.
- Formulários só oferecem catálogos homologados, matrizes e turmas institucionais; ausência vira estado vazio explícito, porque a tela não semeia dado.
- E4 é exibida como exceção explícita, nunca fallback de E3.
- Referência documental é campo opcional (vazio ⇒ null), rotulada como fonte, nunca como autorização, porque a decisão do proprietário governa.

## D1 — importação governada (`d1-import.ts`, `d1-import-page.tsx`)

- Contrato das 22 posições e elementos vive em `docs/data/d1-contrato-canonico-cme-3-2026.json`; o motor só percorre contrato e transcrição, porque norma é dado.
- Importa só pelos writers canônicos, após prévia, validação e confirmação humana; divergência bloqueia e manda ao editor, porque reimportar não pode reescrever fato.
- Literais da fonte são texto; data usada é configuração interna do SIGEM, nunca publicação, porque a publicação não foi comprovada.

## Referências curriculares externas (`src/features/curricular-reference/`, migration 0068)
- BNCC, SAEB e futuras fontes são dado por edição (append-only, cadeia supersedes com cabeça esperada); o motor não conhece código, etapa nem componente, porque taxonomia externa muda por edição.
- Texto oficial é imutável; simplificação é camada editorial versionada à parte, porque a fonte não pode ser reescrita.
- Relações são muitos-para-muitos com natureza, confiança e proveniência obrigatórias; nunca se presume equivalência.
- Vínculo a etapa/posição/componente só por valor canônico de esquema validado no banco, nunca por texto.

## Repositório curricular Frente Y (`src/features/curricular-reference/`, migrations 0133–0134)
- Escrita só pelos writers v2 com pessoa natural e capability de rede estreita na data declarada; service_role e DML direto não gravam, porque catálogo normativo exige autoria humana.
- Texto oficial é imutável; explicação, palavras-chave, mapeamento editorial, ausência de correspondência e glossário SIGEM são camadas versionadas à parte e homologadas por pessoa distinta da autora, porque camada editorial não pode parecer fonte.
- "Sem correspondência identificada" é avaliação própria por item × fonte, nunca relação com item fictício.
- Consumidores futuros guardam `CurricularReferenceRef` (IDs de item/edição/simplificação) e leem pelos readers de `reference-source.ts`, nunca pelas tabelas, porque o significado histórico vem do ID.
- `bncc-infant-objectives.data.ts` é legado não canônico sem fonte verificável; não alimenta o repositório.
- NCURR.1: comparação entre versões é projeção pura (`matrix-version-compare.ts`) por itemKey sobre readers canônicos; carga ausente é "Ainda não configurado", nunca zero, porque diff no banco ou presunção de carga criaria norma.

## NCURR.2 — uso da matriz pelos consumidores (`matrix-integration.ts`)
- "Uso nas outras telas" é projeção pura de itens/aplicabilidade/homologação já lidos: homologação não lida ou não homologada nunca fica pronta e item sem carga deixa Horários "não calculável", porque inferir prontidão criaria norma.
