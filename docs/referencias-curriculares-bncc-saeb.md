# Referências curriculares (BNCC, SAEB) — camada canônica

## Auditoria das fontes (2026-10-05)
| Fonte | No projeto? |
|---|---|
| BNCC Educação Infantil (objetivos EI01–EI03, 5 campos) | Sim, transcrita em `src/features/curriculum/bncc-infant-objectives.data.ts` (fonte declarada: "Base Pedagógica Mestre BNCC SAEB SIGEM"). **Não** foi migrada para a nova camada automaticamente. |
| BNCC Ensino Fundamental 1º–9º (habilidades, todos os componentes) | **Ausente.** |
| Matrizes de referência SAEB (descritores por ano/componente, edição vigente) | **Ausente.** |
| Relação BNCC↔SAEB oficial | **Ausente.** |

Nada foi raspado da internet nem semeado por aproximação.

## Arquivos que precisam ser fornecidos
1. BNCC — documento final homologado (MEC/CNE, edição de 2018, incluindo EI e EF), em PDF oficial **e**, de preferência, a planilha/tabela oficial de habilidades (código, componente, ano/faixa, unidade temática, objeto de conhecimento, texto).
2. SAEB — matrizes de referência oficiais do INEP, na edição a usar (ex.: Matrizes SAEB/BNCC 2º, 5º e 9º anos), com descritores por componente.
3. Qualquer documento oficial que relacione habilidades BNCC a descritores SAEB, se existir; sem ele, relações só entram como decisão editorial do SIGEM, declarada como tal na proveniência.

Esses documentos são convertidos para o formato `sigem.curricular-reference-source.v1` (abaixo) e registrados pela tela `/referencias-curriculares`.

## Arquitetura (migration 0068)
- **Edição** (`curricular_reference_editions`): fonte (id aberto), órgão, edição, datas de publicação/vigência opcionais, SHA-256 do arquivo, referência documental opcional, cadeia `supersedes` (nova edição exige a cabeça atual — concorrência otimista). Mesmo arquivo nunca é registrado duas vezes.
- **Item** (`curricular_reference_items`): código oficial único por edição, tipo aberto, texto oficial imutável, código-pai, rótulos literais da fonte e localizador (página/anexo).
- **Vínculo** (`curricular_reference_item_bindings`): item ↔ valor canônico de esquema do SIGEM (ex.: `elemento-de-matriz-curricular`, `posicao-curricular-individual`), validado contra os valores existentes; nunca por texto.
- **Relação** (`curricular_reference_relations`): muitos-para-muitos, com natureza, confiança (identificadores abertos) e proveniência obrigatória; revogação é novo registro com motivo. Nenhuma equivalência é presumida.
- **Simplificação** (`curricular_reference_simplifications`): camada editorial do SIGEM, versionada, com motivo a partir da 2ª versão; o texto oficial nunca muda.
- Tudo append-only; leitura para contas com login; gravação só por 3 funções que exigem `manter-referencia-curricular` (rede) — **sem regra de política: fechada até decisão**.

## Formato do arquivo-fonte
```json
{ "schema": "sigem.curricular-reference-source.v1",
  "source": { "id": "<id>", "label": "<nome>", "authority": "<órgão>" },
  "edition": { "label": "<edição>", "published_on": "AAAA-MM-DD|null", "valid_from": "AAAA-MM-DD|null" },
  "items": [ { "code": "<código oficial>", "kind": "<tipo>", "official_text": "<texto integral>",
    "parent_code": null, "source_labels": { "<rótulo da fonte>": "<valor literal>" }, "locator": "p. 00",
    "bindings": [ { "scheme_id": "<esquema>", "value_id": "<valor>" } ] } ] }
```

## Uso
- Glossário: busca por código, palavra, descrição simplificada e fonte; mostra texto integral, simplificação, relações e vínculos.
- `ReferencePicker` (`src/features/curricular-reference/reference-picker.tsx`): seleção por busca e marcação, sem digitar código; guarda o ID do item (edição preservada). Ainda não foi ligado às telas de planejamento e avaliação, porque elas não têm onde guardar a seleção.

## Pendências
1. Fornecer os arquivos acima.
2. Quem recebe `manter-referencia-curricular`.
3. Lugar no planejamento e na avaliação para guardar os itens escolhidos (contrato de registro), e a migração dos objetivos da EI do arquivo de código para a nova camada (registro pela tela).
