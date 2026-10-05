# B4.2.0 — Contrato técnico: correspondência posição individual → matriz curricular

Status: **contrato proposto, não implementado.** Nada aqui altera código, banco, catálogo, política ou deploy. Nenhum esquema, valor, matriz ou correspondência é cadastrado. B4.2 continua não iniciada.

> **Atualização de status (B4.2.3):** contrato **parcialmente implementado** — estrutura e readers, sem writers e sem dados. E1 homologação de versão de matriz (`0010`/`0011`); E2 perfil de correspondência (`0012`); E3 correspondência posição→matriz (`0013`); E4 associação explícita específica da turma (`0014`). Pendentes: writers (competências e R5), readers integrados B4.2.4 e UI B4.2.5. A linha acima é mantida como histórico.
>
> **Atualização de status (B4.2.4):** B4.2.1–B4.2.4 **implementados estruturalmente/read-only**. Resolução integrada (passos 3.0–3.2) em `0015`: `class_curricular_resolution_context_at`, `student_curricular_matrix_at`, `class_specific_curricular_matrix_at` (ver `docs/b4-2-4-resolucao-integrada.md`). Pendentes: writers (competências e R5), semântica de aplicabilidade, UI B4.2.5.

> **Atualização de status (B4.2.5):** B4.2.1–B4.2.5 **implementados** (estrutura + leitura). Projeção da turma `class_curricular_matrices_at` (`0016`/`0017`), fonte TS `curricular-resolution-source.ts` e painel somente leitura em Matrícula → Enturmações (ver `docs/b4-2-5-projecao-turma-ui-readonly.md`). **O editor de perfil/correspondência previsto na linha B4.2.5 da tabela abaixo NÃO foi implementado**: E2/E3/E4 não têm writers e a competência/R5 está aberta. Writers, configuração e homologação institucional continuam bloqueados.

> **Atualização de status (R5/R5.1, 2026-10-04):** writers E1–E4 implementados em `0059`; política v4 criada **draft** (213 regras/85 capabilities); hardening de sobreposição por janela efetiva em `0060`. As cinco suítes SQL R5/B4.2 passaram na Cloud com rollback e sem resíduos. A v4 draft não autoriza as sete novas operações até homologação posterior com ato institucional real.

Fontes conferidas no repositório (esquema real):

| Fato | Onde está | Leitura existente |
|---|---|---|
| Posição curricular individual (B3.3) | `allocation_curricular_positions` (versionada, `supersedes_id`, `valid_from/valid_until`, `annulled`, ato, motivo) + `allocation_curricular_position_axes` (`scheme_id`, `value_id`, `value_version`; PK por versão×esquema) — `drizzle/migrations/0008_*`, `0009_*` | `allocation_curricular_positions_at(school, class, validOn, knownAt)` (SECURITY INVOKER; ausência = posição nula; ambiguidade = `position:ambiguous-temporal-state`) |
| Oferta da turma (B2.6) | `class_offering_versions` + `class_offering_axis_values` (eixos abertos `scheme_id/value_id/value_version`) | `class_offering_at(class, validOn, knownAt)` (`offering:ambiguous-temporal-state`) |
| Catálogo | `attribute_value_definitions` (`scheme_id`, `value_id`, `version`, `status` `rascunho/homologada`, `homologation_act_ref`, `valid_from`); writer B2.6 exige `^[a-z0-9][a-z0-9-]*$`; **não há tabela de esquemas** — esquema é só identificador | `homologated_attribute_values(scheme, on)` |
| Matriz (B4.1) | `institutional_curricular_matrices`, `curricular_matrix_versions` (`constituicao/sucessao/retificacao`, vigência, ato, motivo), `curricular_matrix_items`, `curricular_matrix_applicability` (`ano-letivo`/`escola`/`atributo`) | `curricular_matrices_at`, `curricular_matrix_items_at`, `curricular_matrix_applicability_at` |
| Quadro (B4.1.2) | `curricular_matrix_layouts` (localizador/página/sha256 do ato), `..._layout_columns` (`column_key`, `parent_column_key`, `header_text`, ref opcional `ref_scheme_id/ref_value_id/ref_value_version`), grupos, linhas, células, notas | `curricular_matrix_layout_at` |
| Capacidades | `capability_policies` / `capability_policy_rules` (v1=108, v2=117, ambas draft) | — |

Lacunas reais constatadas:

1. **Matriz não tem estado de homologação.** `curricular_matrix_versions` não possui status nem registro de homologação; "matriz homologada" hoje não é verificável.
2. **Nenhum fato designa papel semântico de eixo.** Nem B2.6 nem B3.3 dizem qual `scheme_id` é "posição curricular" ou "natureza da turma".
3. **Nenhuma correspondência posição → matriz/coluna existe.** A ref de coluna B4.1.2 é evidência opcional, não regra.
4. **A semântica de múltiplas aplicabilidades (E/OU) não está homologada.**
5. Observação herdada (não corrigida aqui): os writers B4.1 já referenciam por literal os esquemas `elemento-de-matriz-curricular` e `unidade-de-carga-da-matriz`. O contrato B4.2 **não** repete esse padrão.

## 1. Princípio

A leitura B4.2 é uma **projeção derivada**, nunca um vínculo gravado turma→matriz:

```text
posição B3.3 (estudante×alocação×data)
  + perfil de correspondência homologado (papéis de eixo, portões de natureza)
  + natureza da turma (eixo designado da Oferta B2.6)
  + correspondência homologada (chave de posição → matriz + coluna)
  + versão de matriz vigente e homologada, coluna existente e referenciada
  ⇒ estado por estudante  ⇒ conjunto derivado da turma (união)
```

O motor só conhece primitivas: igualdade de tuplas `(scheme, value, version)`, contenção de vigência, contagem (0/1/≥2) e efeitos técnicos de portão. Nenhum nome de esquema ou valor existe no código; todos chegam por configuração homologada.

## 2. Entidades mínimas propostas (aditivas, append-only)

Todas seguem o padrão já usado: identidade lógica + `version` + `supersedes_id UNIQUE`, `change_kind` (`constituicao/sucessao/retificacao`), `valid_from/valid_until`, `originating_act_ref` obrigatório, `change_reason` obrigatório para versão > 1, `recorded_by`, `created_at = clock_timestamp()`, trigger `forbid_mutation`, filhos imutáveis.

### E1. Homologação de versão de matriz — `curricular_matrix_version_homologations`
- `matrix_version_id` (FK), `decision` (`homologada` | `revogada`), `homologation_act_ref`, `effective_from`, `recorded_by`, `created_at`.
- Append-only; o estado vigente é o último registro conhecido em `knownAt`. Revogação não apaga a versão.
- Não altera nenhuma tabela B4.1. Construção (Supervisão) ≠ homologação: são registros distintos.

### E2. Perfil de correspondência — `curricular_correspondence_profiles` (+ versões)
Configuração normativa que dá papel semântico aos eixos sem que o motor os conheça. Cada versão tem `status` (`rascunho`/`homologada`) e filhos:
- **E2a `..._profile_position_keys`**: lista de `scheme_id` da posição B3.3 que compõem a chave de correspondência (uma ou mais; ordem irrelevante). Só esses eixos participam do matching; outros eixos da posição são ignorados.
- **E2b `..._profile_nature_axis`**: o `scheme_id` da Oferta B2.6 designado como natureza da turma (zero ou um). Ausente ⇒ o perfil não avalia natureza e todo resultado fica `bloqueada:natureza-nao-designada`.
- **E2c `..._profile_nature_gates`**: para valores homologados desse eixo, efeito técnico fechado do motor: `matching-regular` | `associacao-explicita` | `fora-de-correspondencia`. Valor não listado ⇒ `bloqueada:natureza-sem-portao`. AEE e atividade complementar entram aqui como **dados** (normalmente `associacao-explicita` ou `fora-de-correspondencia`), nunca como literais no código.
- **E2d `applicability_rule`** (campo opcional da versão): referência a valor homologado que declare como interpretar múltiplas aplicabilidades B4.1. Enquanto nulo, aplicabilidade **não é avaliada** e o resultado não pode ser `resolvida` se a matriz tiver aplicabilidade (`bloqueada:aplicabilidade-nao-homologada`). Matriz sem linhas de aplicabilidade não é bloqueada por este item.
  - *Correção B4.2.4:* mesmo preenchida, a referência **não autoriza interpretação** enquanto não houver semântica institucional e mapeamento técnico homologados; até lá, qualquer matriz com aplicabilidade fica `bloqueada:aplicabilidade-nao-homologada`.

Os efeitos de E2c são primitivas técnicas do motor (incluir, exigir associação explícita, excluir); quais valores recebem cada efeito é norma.

### E3. Correspondência — `curricular_position_matrix_correspondences` (+ versões)
- Pertence a um perfil (logical id).
- Chave: filhos `(scheme_id, value_id, value_version)` exatamente sobre os esquemas de E2a (chave completa obrigatória).
- Alvo: `matrix_id` (lógico) + `column_key`. Opcionalmente `jornada`/outros eixos extras entram como mais esquemas na chave, se o perfil assim os declarar (ex.: Anexo I parcial/integral) — sem caso especial no motor.
- Status `rascunho/homologada`, ato, vigência.
- Sucessão de matriz (nova versão) **não** exige nova correspondência: o alvo é lógico e resolvido na data; a coluna precisa existir na versão vigente.

### E4. Associação explícita específica — `class_specific_matrix_associations` (+ versões)
- `class_id`, `matrix_id`, ato institucional específico obrigatório (fonte oficial para a oferta específica: AEE, atividade complementar ou outra natureza com portão `associacao-explicita`), vigência, motivo.
- A matriz associada deve ser matriz/documento oficial **daquela oferta específica**, registrada em B4.1 com seu próprio ato; não pode ser uma das matrizes regulares reaproveitada por aproximação, e nenhuma matriz é inventada.
- É **vínculo da turma**, não resolução curricular por estudante: não exige posição curricular regular nem coluna. Só exige coluna, posição ou outro elemento se a própria fonte específica os definir — e então a exigência vem registrada como dado da associação (ex.: `column_key` opcional, preenchido somente quando a fonte o define), nunca presumida pelo motor.
- Só produz efeito quando a natureza vigente da turma tem portão `associacao-explicita`. Em turma `matching-regular`, ela é ignorada e sinalizada (`inconsistente:associacao-explicita-em-turma-regular`).
- Nunca criada por inferência; sem registro ⇒ `nao-registrada`.

Não se cria: tabela de esquemas, enumeração de etapas/modalidades, vínculo manual turma→matriz para turmas regulares, nem cópia de posição na turma.

## 3. Leituras — ramo regular (por estudante) e ramo específico (por turma)

Os passos 1–6 são comuns e avaliados uma vez por turma/data; depois a leitura se divide em dois ramos que **não compartilham passos**.

### 3.0 Passos comuns (turma × data)

| # | Condição | Estado |
|---|---|---|
| 1 | nenhum perfil homologado vigente | `bloqueada:perfil-ausente` |
| 2 | ≥2 perfis homologados vigentes | `inconsistente:perfil-ambiguo` |
| 3 | perfil sem eixo de natureza | `bloqueada:natureza-nao-designada` |
| 4 | turma sem Oferta vigente ou sem o eixo designado | `ausente:natureza-nao-registrada` |
| 5 | valor de natureza não homologado / sem portão | `bloqueada:natureza-sem-portao` |
| 6 | portão `fora-de-correspondencia` | `nao-aplicavel:natureza` |
| → | portão `matching-regular` | ramo regular (3.1) |
| → | portão `associacao-explicita` | ramo específico (3.2) |

### 3.1 Ramo regular — `student_curricular_matrix_at(school, class, validOn, knownAt)`

SECURITY INVOKER, `search_path=''`. Para cada alocação vigente devolvida por `allocation_curricular_positions_at` com o mesmo `validOn/knownAt`, avalia em ordem e para no primeiro estado terminal:

| # | Condição | Estado |
|---|---|---|
| R1 | posição ausente | `ausente:posicao` |
| R2 | posição sem algum esquema de E2a | `ausente:posicao-incompleta` |
| R3 | correspondências homologadas vigentes para a chave: 0 / ≥2 | `ausente:correspondencia` / `inconsistente:correspondencia-multipla` |
| R4 | matriz sem versão vigente; versão não homologada (E1) | `ausente:matriz-vigente` / `bloqueada:matriz-nao-homologada` |
| R5 | coluna inexistente na versão vigente | `bloqueada:coluna-inexistente` |
| R6 | coluna sem ref, ou ref ≠ algum valor da chave de posição | `bloqueada:coluna-nao-referenciada` / `inconsistente:coluna-ref-divergente` |
| R7 | matriz com aplicabilidade e perfil sem regra homologada | `bloqueada:aplicabilidade-nao-homologada` |
| R8 | aplicabilidade avaliada e falha | `nao-aplicavel:aplicabilidade` |
| — | caso contrário | `resolvida-por-posicao` (matriz, versão, coluna, correspondência, perfil, homologação — todos com IDs de versão) |

Em turma do ramo específico, a leitura por estudante não produz resolução curricular: devolve `nao-aplicavel:ramo-especifico` com referência ao vínculo da turma (3.2).

### 3.2 Ramo específico — `class_specific_matrix_at(school, class, validOn, knownAt)`

Avaliado por turma, sem posição curricular e sem correspondência:

| # | Condição | Estado |
|---|---|---|
| S1 | associações E4 vigentes: 0 / ≥2 | `nao-registrada:associacao-especifica` / `inconsistente:associacao-multipla` |
| S2 | matriz associada sem versão vigente; versão não homologada (E1) | `ausente:matriz-vigente` / `bloqueada:matriz-nao-homologada` |
| S3 | somente se a associação registra elemento exigido pela fonte (ex.: `column_key`): elemento inexistente na versão vigente | `bloqueada:elemento-da-fonte-inexistente` |
| S4 | matriz com aplicabilidade e perfil sem regra homologada / avaliada e falha | `bloqueada:aplicabilidade-nao-homologada` / `nao-aplicavel:aplicabilidade` |
| — | caso contrário | `vinculo-especifico-vigente` (associação, ato, matriz, versão, homologação) |

Não há verificação de coluna nem de ref de coluna além do que a associação registrar a partir da fonte; ausência de coluna na fonte específica não é bloqueio.

Em todos os estados as linhas carregam as proveniências já consultadas (IDs de versão da alocação, posição, oferta, perfil, correspondência ou associação, matriz) para auditoria. Exceções de ambiguidade dos readers de origem são propagadas como `inconsistente:<origem>`, não convertidas em ausência.

## 4. Conjunto derivado da turma — `class_curricular_matrices_at(school, class, validOn, knownAt)`

- **Não é fato gravado.** Agrega 3.0–3.2 na mesma `validOn/knownAt`.
- Ramo regular: (a) união distinta das matrizes `resolvida-por-posicao` com as posições/colunas que as originaram e contagem de estudantes por matriz; (b) contagem por estado não resolvido.
- Ramo específico: o estado do vínculo da turma (3.2), identificado como `origem: vinculo-especifico`, sem contagem de resolução por estudante.
- Várias matrizes na mesma turma/data são resultado válido, nunca inconsistência por si.
- A turma do ramo regular não recebe posição, etapa ou matriz "dominante"; nada é inferido do nome/código da turma, de `stageId/offerId` legados ou do turno.
- Cobertura ("todas as posições presentes resolvidas") é indicador derivado do ramo regular; sua obrigatoriedade (R7 do quadro D1) não é aplicada como bloqueio.

## 5. Invariantes

1. Ramo regular: nenhum `resolvida-por-posicao` sem posição completa, perfil homologado, natureza com portão `matching-regular`, correspondência homologada única, versão de matriz homologada vigente, coluna existente com ref coincidente e aplicabilidade avaliável.
1b. Ramo específico: nenhum `vinculo-especifico-vigente` sem perfil homologado, natureza com portão `associacao-explicita`, associação E4 única com ato da fonte específica, versão de matriz homologada vigente, elementos exigidos pela fonte (somente se registrados) e aplicabilidade avaliável. Posição regular e coluna nunca são exigidas por presunção; o vínculo específico nunca é apresentado como resolução curricular por estudante.
2. Dado ausente nunca vira default; ausência ≠ bloqueio ≠ inconsistência ≠ não aplicável.
3. Unicidade por perfil: para um mesmo perfil, chave e data, no máximo uma correspondência homologada vigente — recusada no writer (sobreposição de vigência com mesma chave) e revalidada no reader.
4. Correspondência e perfil não podem referenciar valor não homologado em toda a vigência (verificação por segmentos, como B4.1.1/B3.3).
5. Matriz da turma = função pura das leituras por estudante; nenhum cache persistido.
6. E/OU de aplicabilidade nunca assumido pelo motor.
7. Nenhuma tabela B2.6, B3.3, B4.1 ou B4.1.2 é alterada; migrations históricas intactas.

## 6. Correção e sucessão

- **Retificação** (mesma vigência, corrige erro de registro) e **sucessão** (nova norma a partir de data) em E1–E4, exigindo base esperada (optimistic concurrency) e motivo; retificação que eliminaria predecessora já efetiva é recusada (padrão B4.1.1).
- Consulta com `knownAt` anterior à correção devolve o resultado anterior; correção não reescreve o passado.
- Nova deliberação ⇒ nova versão de matriz (Supervisão) + nova homologação E1; correspondências seguem válidas se o alvo lógico e a coluna persistirem; caso contrário o reader passa a `bloqueada:coluna-inexistente` até sucessão da correspondência.
- Correção de posição (B3.3) ou de Oferta (B2.6) reflete-se automaticamente, respeitando `knownAt`.

## 7. ACL / RLS

- Tabelas novas: `GRANT SELECT` a `authenticated`; sem INSERT/UPDATE/DELETE diretos; nada a `anon`; `service_role` só para manutenção, nunca no navegador.
- Writers `SECURITY DEFINER`, `search_path=''`, `EXECUTE` só `authenticated`, `REVOKE` de PUBLIC/anon; capability avaliada na escopo de rede.
  - Construção/rascunho de perfil e correspondência: proposta técnica `manter-matrizes-curriculares` (Supervisão Escolar, `gestao-pedagogica-da-rede`), sem conceder nada novo.
  - Homologação (E1 e status `homologada` de E2/E3): capability **pendente de decisão institucional** (R5); até lá writer de homologação fica fail-closed (`capability:not-defined`).
  - Valores de catálogo usados nos portões e chaves continuam exclusivos de `manter-catalogos-institucionais`.
  - E4: competência pendente; fail-closed até definida.
- Readers SECURITY INVOKER; leitura por estudante exige `can_read_class_roster` ou `consultar-matricula-e-movimentacao` na escola (mesma RLS B3.3); leitura de configuração (perfil, correspondência, homologação) é pública a `authenticated`, por não conter dado pessoal.

## 8. Testes relevantes (SQL Cloud com rollback + TS)

- ACL: anon sem EXECUTE; DML direto recusado; writer sem sessão/capability recusado; homologação sem capability definida recusada.
- Cada linha da tabela do item 3 com fixture transacional mínima (esquemas/valores fictícios com IDs técnicos `[a-z0-9-]`, descartados no rollback).
- Turma multietapa com duas posições → duas matrizes no conjunto da turma; mesma posição com duas correspondências → inconsistência só desse estudante.
- Ramo específico (natureza fictícia com portão `associacao-explicita`): sem E4 → `nao-registrada:associacao-especifica`; com E4 e matriz específica homologada, sem nenhuma posição B3.3 nem `column_key` → `vinculo-especifico-vigente` da turma, e a leitura por estudante devolve `nao-aplicavel:ramo-especifico` (nunca `resolvida-por-posicao`); E4 com `column_key` registrado e coluna ausente → `bloqueada:elemento-da-fonte-inexistente`; dois E4 vigentes → `inconsistente:associacao-multipla`; E4 em turma regular → `inconsistente:associacao-explicita-em-turma-regular`.
- Bitemporal: correção de correspondência/posição/oferta/homologação não altera leitura com `knownAt` anterior; revogação E1 posterior não altera passado.
- Sucessão de matriz mantém correspondência; remoção da coluna gera bloqueio.
- Aplicabilidade presente sem regra → bloqueio; ausente → não bloqueia.
- Auditoria de configurabilidade: nenhum literal de esquema/valor nos readers/writers B4.2 (estender `normative-configurability.test.ts`).
- Regressões B3.3, B4.1, B4.1.2, B3.1/B3.2; suíte, typecheck, build, diff-check; resíduos zero; v1=108 e v2=117 draft.

## 9. Dependências institucionais reais

1. Homologar valores de posição (proposta D1: 22 colunas) e designar quais esquemas compõem a chave (R1/R2).
2. Designar o eixo de natureza da turma na Oferta e homologar seus valores e portões (R4).
3. Jornada: fato da alocação ou da turma, onde o anexo distingue (R3).
4. Quem homologa matriz, perfil e correspondência (R5); quem registra associação explícita E4.
5. Semântica de múltiplas aplicabilidades (E/OU ou outra) como regra homologada.
6. Obrigatoriedades R6 (posição) e R7 (matriz por posição) — hoje só sinalizadas.
7. Construção e homologação das matrizes da Deliberação CME nº 3/2026; homologação da política v2.

## 10. Etapas implementáveis sem dados normativos

| Etapa | Conteúdo | Funciona sem norma? |
|---|---|---|
| B4.2.1 | E1 tabela + reader de estado de homologação; writer fail-closed até capability definida | Estrutura sim; homologação bloqueada |
| B4.2.2 | E2/E3 tabelas, writers (rascunho com `manter-matrizes-curriculares`), validação de chave completa e não sobreposição | Rascunho sim; homologação bloqueada |
| B4.2.3 | E4 tabela + writer fail-closed | Estrutura apenas |
| B4.2.4 | Readers 3.0–3.2 (regular por estudante; específico por turma) | Sim — devolve `bloqueada:perfil-ausente` para todos |
| B4.2.5 | Reader da turma + source TS + painel somente leitura com estados por extenso; editor de perfil/correspondência para a Supervisão | Sim, exibindo bloqueios |

Cada etapa: migration nova aditiva, testes da seção 8 aplicáveis, sem seeds, sem alterar policies ou migrations históricas.


## R5 — RESOLVIDO (2026-10-04)
A Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4. A implementação está em `0059_r5_curricular_writers_policy_v4.sql`; a v4 nasce **draft** e não autoriza as novas operações até homologação posterior com ato institucional real. E1 construção preserva a capability `manter-matrizes-curriculares` já homologada na v3. Nenhum dado curricular real foi importado; a publicação da Deliberação CME nº 3/2026 segue pendente para `valid_from`. Gate: `docs/r5-gate-operacional.md`.
