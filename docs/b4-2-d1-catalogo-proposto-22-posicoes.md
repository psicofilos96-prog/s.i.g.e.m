# B4.2 — D1: contrato canônico das 22 posições e importação governada

**Status (2026-10-05): CONTRATO FECHADO por decisão do proprietário.** Fonte de verdade do contrato: `docs/data/d1-contrato-canonico-cme-3-2026.json`. Nenhum dado foi gravado na Cloud; a gravação acontece só pela tela `/matrizes-curriculares/importacao`, com sessão autorizada e confirmação humana.

## 1. Fonte

- Deliberação CME nº 3/2026 (Itaperuna), Anexos I–V, pp. 2–6; SHA-256 `d8f46e61a655f515d758c58ccb7715d3976c5ee347efc9a0d7e7e3f385fe0b02`.
- Transcrição literal: `docs/data/deliberacao-cme-3-2026-matrizes-source.json` (`bun run audit:curriculum-source`).
- **Data do ato:** 1º/04/2026 (p. 1). Não é data de publicação nem vigência. A publicação continua **não comprovada**. A vigência usada na importação é **data configurada no SIGEM por decisão interna**, declarada como tal na proveniência gravada.
- Documentos oficiais são fonte/proveniência, não autorização para desenvolver.

## 2. Decisões fechadas

| Tema | Decisão |
|---|---|
| Esquema | `posicao-curricular-individual`, exatamente 22 valores (EI 4; EF 1º–5º 5; EF 6º–9º 4; EJA I–V 5; EJA VI–IX 4) |
| IDs | os do documento D1 (sem etapa/modalidade no ID); as chaves de coluna do JSON-fonte (`ei-*`, `ef-*`, `eja-*`) ficam só como `source_column_key` |
| Rótulos | `label` humano + `source_label` literal separado (ex.: `1-ano` = "1º ano"; fonte "1º") |
| Modalidade/segmento/etapa | nunca por string/nome da turma; vêm da configuração/correspondência E3 (R2) |
| Jornada | dimensão da TURMA, não do aluno; integral = ampliação curricular, não booleano (R3) |
| Educação Infantil | 5 campos de experiência como elementos de `elemento-de-matriz-curricular`, não "disciplina" |
| EF/EJA | 12 componentes como elementos de `elemento-de-matriz-curricular` com IDs estáveis |
| Literais | X, --, *, 1*, números e "35h" são texto; nenhuma semântica sem contrato explícito |

Reconciliação: a única divergência entre o JSON-fonte e a proposta anterior era o formato dos IDs (prefixo de etapa no JSON). Adotados os IDs do D1; rótulos de elementos mantidos **literalmente** como na fonte (ex.: "Corpo, Gestos e Movimento").

## 3. Importador governado (`src/features/curriculum/d1-import.ts`)

fonte → proposta → validação → confirmação humana → writers canônicos (`record_attribute_value_version`, `record_curricular_matrix_version` de 11 argumentos). Nada de INSERT direto nem migration de conteúdo.

- Valida SHA-256, largura das 22 colunas, posições, linhas conhecidas e literais permitidos; soma só confere inteiros puros (com X ou 1* não é verificável).
- Idempotente: valor/matriz idênticos são ignorados; rótulo divergente, quadro divergente, outra fonte (hash) ou vigência incompatível bloqueiam e apontam o editor (sucessão/retificação).
- Preserva SHA-256, anexo/página (`layout.source`), rótulos literais e referência documental opcional.
- Exige `manter-catalogos-institucionais` e `manter-matrizes-curriculares` em rede (UX; o banco confere).
- Cada chamada é atômica; a execução para na primeira falha e a reexecução retoma (não há transação única entre as 44 chamadas sem nova função no banco).

**Aviso encontrado na fonte:** Anexo IV, linha "Total" soma 2.200; a nota transcrita declara "Total geral 2.400". O importador exibe o aviso, exige ciência e transcreve sem corrigir. Conferir no PDF.

## 4. Pendentes reais

| # | Pendência |
|---|---|
| P1 | Prova da publicação da Deliberação (veículo/data) — só afeta a proveniência, não bloqueia a importação |
| P2 | R4: eixo de natureza da turma e seus valores |
| P3 | Esquema/valores da jornada da turma (R3 decidido quanto ao portador, não quanto aos valores) |
| P4 | Vínculo entre elementos `elemento-de-matriz-curricular` e componentes B2.3 usados no Diário |
| P5 | Executar a importação pela sessão autorizada; depois E1 (homologar matrizes), E2 perfil e E3 22 correspondências |
| P6 | Dívida: writers B2.3/B2.6 ainda exigem `act_ref` não vazio para homologar; o importador passa a citação da fonte, que é verdadeira; ajuste ao princípio "decisão do proprietário" fica para migration futura |
