# B4.0 — Auditoria preparatória da Organização Pedagógica (contrato da B4)

Somente diagnóstico. Nenhuma migration, alteração de banco, fixture ou tela.
Banco auditado em 2026-10-02: todas as tabelas citadas abaixo têm **0 linhas**
(componentes, objetivos, atuações, vínculos, lotações, turmas, anos letivos,
catálogos, grade). Classificação: A canônico persistido · B parcialmente
canônico · C protótipo UX · D fixture · E memória/localStorage · F segunda
verdade potencial · G consumidor · H norma não homologada.

## 1. Estado atual real da B4

Nada da B4 existe como domínio institucional completo. Há **três pontos de
banco pré-existentes** que tocam a B4 (componentes B2.3, atuações B1, slots de
grade 13x) e **cinco módulos de UX** (matriz, atuação pedagógica, horários,
calendário, objetivos) que vivem em fixture/memória/localStorage.

## 2. Inventário

| Domínio | Onde | Classe | Observação |
|---|---|---|---|
| Componente curricular | `institutional_curricular_components` + `curricular_component_versions`, `curricular_components_at`, `register_curricular_component_version` | A | Identidade + versões (nome, curto, ativo, valid_from, motivo, ato, recorded_by). Sem tipo/natureza, sem aplicabilidade. |
| Objetivos curriculares (BNCC) | tabela `curriculum_objectives` (id, code, official_text, age_group_id, experience_field_id, source_edition, created_at) | B | Sem versão, sem fonte estruturada, sem writer; `curriculum-objectives-repository.ts` é E (memória) + `bncc-infant-objectives.data.ts` (dado de fonte pública, não oficial da rede). |
| Matriz curricular | `curriculum-data.ts`, `matrix-draft.ts`, páginas | C+D | Declaradamente fixture; `dataOrigin` documentado/inventado; IDs, vigências, cargas distribuídas e unidades inventados. Componente identificado por **nome** (F). `DEMO_MATRIX_SITUATIONS`, `DEMO_MATRIX_SEGMENTS` = H. Três estruturas distintas (grade, campos de experiência, tempo ampliado) — modelo útil, não schema. Nenhum modelo de banco. |
| Oferta/Turno da turma | `class_offering_versions` + `class_offering_axis_values`, `class_shift_versions`, readers `*_at` (B2.6) | A | Eixos abertos sobre `attribute_value_definitions` (0 valores). |
| Ano letivo / organização de períodos | B2.4 (`institutional_academic_years`, `institutional_period_organizations`, `institutional_academic_periods` + versões) | A | `academic-structure.ts` (12B) é D/C com `calendarId` — F se usado com sessão. |
| Turma | B2.5 (`institutional_classes`, `class_at`, `class_period_organization_at`) | A | |
| Pessoa / vínculo / lotação / evento funcional | `institutional_persons`, `professional_functional_links`, `professional_postings`, `professional_functional_events` (append-only, logical_id/version), `functional-record.ts` | A | Função/situação/natureza são IDs de catálogo (H, vazios). |
| Atuação | `institutional_engagements` (person, kind, school/class/component/period, vigência, ato) + `institutional_engagement_scope_classes` | A (autorização) | É a mesma entidade que concede capacidade. Não versionada (encerramento por `engagement_endings`). |
| Atuação pedagógica (UX) | `pedagogical-data.ts`, `pedagogical-assignment-draft.ts`, `PEDAGOGICAL_ROLES` | C+D+H | Modelo paralelo fictício de "atuação"; F se ligado com sessão. |
| Profissionais (UX) | `professionals-data.ts`, drafts | C+D | Fictício declarado. |
| Grade da turma (banco) | `institutional_class_schedule_slots` (class, component, engagement, weekday 1–7, horário, valid_from/until, ato, created_at; trigger imutável; só SELECT) | B | Sem logical_id/versão/supersedes, sem writer, sem tipo de bloco, sem recorded_by. Consumida por `teachingClassBlocks` (Diário, G). |
| Jornada/grade/versões/mudanças (UX) | `schedules/**` (`schedules-data.ts`, `schedule-lifecycle.ts`, `schedule-integration.ts`) | C+D+H | `ScheduleBlockKind` ("Aula", "Intervalo", "Acolhimento", "Oficina"…), estados de publicação, `SCHEDULE_REFERENCE_DATE` fixo. Projeções puras (pessoa/turma/unidade, conflito por pessoa, corresponsabilidade, vigência) são reaproveitáveis como lógica. |
| Calendário | `calendar/**` | E+C (+H) | `calendar-store.ts` memória + `localStorage`; `calendar-image-assets.ts` localStorage; governança (`calendar-governance.ts`: rascunho→revisão→homologado→arquivado, auditoria) só em TS. **Nenhuma tabela de calendário no banco.** Motor (`calendar-engine.ts`), catálogo de tipos, períodos, conselhos, regras, documento/impressão = lógica pura preservável. |
| Diário | `institutional-teaching.ts` | G | Turmas/atuações/aulas do banco com sessão; sem grade ⇒ nenhuma aula prevista. |

## 3. Fontes canônicas existentes a referenciar (IDs)

`institutional_schools.id` · `institutional_academic_years.id` ·
`institutional_period_organizations.id` / `institutional_academic_periods.id` ·
`institutional_classes.id` · `class_offering_versions` (via `class_offering_at`) ·
`class_shift_versions` · `institutional_curricular_components.id` ·
`institutional_persons.id` · `professional_functional_links.logical_id` ·
`professional_postings.logical_id` · `institutional_engagements.id` ·
`attribute_value_definitions` (catálogos) · B3: `school_enrollments.logical_id`,
`cycle_participations.logical_id`, `class_enrollment_episodes.logical_id`.
Snapshot de nome só como evidência histórica em documento emitido.

## 4. Fixtures / localStorage / segunda verdade

- E: `calendar-store.ts`, `calendar-image-assets.ts`, `curriculum-objectives-repository.ts`, `matrix-draft.ts`, `schedule-draft.ts`.
- D: `curriculum-data.ts`, `schedules-data.ts`, `pedagogical-data.ts`, `professionals-data.ts`, `calendar-fixtures.ts`, `classes-data.ts`, `academic-structure.ts`.
- F (risco): componente por nome na matriz; "atuação pedagógica" paralela a `institutional_engagements`; `institutional_class_schedule_slots` (grade plana) vs futura grade versionada; `AcademicYear.calendarId`/`SchoolCalendar` vs B2.4; calendário em localStorage vs futuro calendário no banco.

## 5. Modelo conceitual recomendado

```text
Componente (B2.3) ──< versão
      │ (+ natureza/tipo: catálogo aberto, H)
Matriz (identidade) ──< versão de matriz [vigência, ato, homologação]
      ├─ aplicabilidade: ano letivo? organização de períodos? valor(es) de eixo de Oferta (H)
      └──< item da matriz: component_id | elemento não-disciplinar (campo de experiência, atividade)
               posição, agrupamento (opcional), carga + unidade (catálogo, H), parte (catálogo, H)
Turma (B2.5) ── vínculo histórico Turma → versão de Matriz (como Turma → Organização)
Jornada da turma: versão [dias, janelas, intervalos declarados] — referencia turma
Grade da turma: versão [blocos: dia, início, fim, tipo de bloco (catálogo), item da matriz?]
Atribuição pedagógica = institutional_engagements (kind de catálogo) com escopo turma+componente
   bloco ──< responsáveis (engagement_id)  ⇒ corresponsabilidade sem duplicar bloco
Horário do profissional = PROJEÇÃO (grade × atribuições), nunca persistido
Calendário da rede: identidade (ano letivo, recorte de aplicabilidade) ──< versão homologada
   conteúdo: tipos de dia (catálogo versionado), intervalos, eventos, sobrescritas, períodos→IDs B2.4, regras
   apresentação: layout/simbologia/logos/tipografia em tabela separada, versionada à parte
```

Objetivos BNCC/SAEB: dicionário próprio (identidade = código da fonte + edição),
ligado a componente/campo por relação — nunca identidade da matriz.

## 6. Temporalidade por agregado

| Agregado | Identidade | Versão/supersedes | valid_from/until | knownAt (created_at) | Ato | recorded_by | Por quê |
|---|---|---|---|---|---|---|---|
| Natureza do componente | herda B2.3 | sim | sim | sim | sim | sim | Reclassificar não reescreve passado. |
| Matriz | sim | sim | sim | **sim** | **obrigatório** | sim | Norma homologada; documentos emitidos precisam do conhecido na data. |
| Item da matriz | dentro da versão | não (imutável na versão) | não | — | — | — | Mudança = nova versão da matriz. |
| Turma → Matriz | sim | sim | sim | sim | sim | sim | Mesmo padrão de Turma → Organização. |
| Jornada da turma | sim | sim | sim | opcional | sim | sim | validOn basta para Diário; knownAt agrega pouco. |
| Grade da turma | sim | sim | sim | **sim** | sim | sim | Frequência/Diário revistos depois precisam saber qual grade valia e o que se sabia. |
| Responsável do bloco | via engagement | — | da atuação | — | — | — | Já temporal na atuação. |
| Horário do profissional | — | — | — | — | — | — | Projeção. |
| Calendário (conteúdo) | sim | sim (homologada imutável) | ano letivo | **sim** | sim | sim | Dias letivos alimentam frequência/CIECE. |
| Layout do calendário | sim | sim | não | não | não | sim | Apresentação; não normativo. |

## 7. Segurança (sem criar nem reutilizar silenciosamente)

| Domínio | Capability próxima existente | Situação |
|---|---|---|
| Natureza do componente | `manter-componentes-curriculares` | validação institucional pendente |
| Catálogos (tipo de bloco, unidade de carga, parte, natureza) | `manter-catalogos-institucionais` | validação institucional pendente |
| Matriz e homologação | `manter-componentes-curriculares` / `registrar-norma-homologada` | **sem contrato**; validação institucional pendente |
| Turma → Matriz | `manter-organizacao-da-oferta-da-turma` | validação institucional pendente |
| Jornada/grade | nenhuma | sem contrato |
| Atribuição docente | `manter-atuacoes-institucionais` | contrato B1 cobre atuação; uso pela Secretaria escolar pendente |
| Calendário | nenhuma | sem contrato (governança "Supervisão" só em TS) |
| Consulta | `consultar-registro-funcional` (profissional); demais sem capability de consulta | pendente |

## 8. Oferta educacional (não decidido)

Conceitos mapeados sem fusão: **escola** (B2.1, A); **ano letivo** (B2.4, A);
**organização de períodos** (B2.4, A); **turma** (B2.5, A); **oferta da turma**
(B2.6, eixos abertos, A, 0 valores); **turno** (B2.6, A, 0 valores); **etapa,
modalidade, segmento, ano/série, fase, curso** — só texto/fixture
(`DEMO_MATRIX_SEGMENTS`, `CalendarModality` fechada `regular|eja|eja-fase-1`
— F/H, `stageId/offerId` legados nulos com sessão); **agrupamento** — só
`CalendarPeriodGroup` (TS); **jornada** — só fixture. `educationalOfferId` da
B3 permanece bloqueado: decidir qual eixo (ou combinação de eixos) da Oferta é
a "oferta educacional" é decisão institucional (seção 9, D1).

## 9. Decisões institucionais ausentes

D1 eixo(s) da Oferta = oferta educacional (B3 e matriz). D2 a quem a matriz se
aplica (oferta? ano/série? organização?) e se uma turma pode ter mais de uma.
D3 catálogos: natureza do elemento, parte (base/diversificada/complementar),
unidade de carga, tipo de bloco, papel pedagógico, tipo de atuação docente.
D4 quem homologa matriz, grade e calendário (capabilities). D5 recorte do
calendário da rede (hoje "modalidade" fechada). D6 se grade exige publicação
formal ou vale por registro. D7 regras de carga (soma de blocos vs matriz) —
sem regra, só exibir diferença. D8 corresponsabilidade/substituição docente.

## 10. Riscos técnicos

1. `institutional_class_schedule_slots` sem versão nem writer, mas já consumida pelo Diário: nova grade precisa substituí-la por reader sem duas fontes.
2. `institutional_engagements` não versionada e sem `recorded_by`: aceitável para autorização; atribuição pedagógica não deve criar tabela paralela.
3. Calendário: migrar `NetworkCalendar` (objeto grande) sem separar conteúdo de layout gravaria aparência como norma.
4. `CalendarModality` fechada e `AcademicYear.calendarId` contradizem B2.4.
5. `curriculum_objectives` sem edição/versão estruturada.
6. Datas de referência fixas (`SCHEDULE_REFERENCE_DATE`) nos módulos UX.
7. `has_school_capability` avaliando "hoje" (dívida B3.1) afeta writers B4 escolares.

## 11. Decomposição

| Etapa | Objetivo | Entidades | Depende | Migration | Readers / Writers | Telas | Testes SQL / TS | Consumidores | Decisões | Concluída quando | Sem norma? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **B4.1** Matriz — estrutura canônica | identidade + versões de matriz e itens referenciando componente por ID | matriz, versão, item (component_id ou elemento aberto), aplicabilidade por IDs | B2.3, B2.4, B2.6 | 1 aditiva | `curricular_matrix_at(validOn, knownAt)` / `register_curricular_matrix_version` | Matrizes com sessão (laboratório sem sessão) | append-only, componente inexistente/inativo na vigência, item sem ID, knownAt, ACL / projeção pura, sessão sem demo | B4.3, Diário | catálogos ficam vazios; homologação = D4 (writer fail-closed sem capability homologada) | reader+writer testados no banco, 0 dados semeados | **Sim** (estrutura) |
| B4.2 Turma → Matriz | vínculo histórico | versão do vínculo | B4.1, B2.5 | 1 | `class_matrix_at` / `record_class_matrix_version` | detalhe da turma | escola/ano compatíveis, turma ativa, sobreposição | Diário, CIECE | D2 critério de aplicabilidade e D1 (decidido: nunca mais de uma matriz por turma×data; obrigatoriedade não decidida) — *superado: aplicação derivada por posição individual (B3.3), uma ou várias matrizes por turma; ver b4-2-planejamento* | idem | Parcial (critério fail-closed) |
| B4.3 Jornada da turma | janelas e intervalos versionados | jornada | B2.5 | 1 | `class_journey_at` / `record_class_journey_version` | Horários | intervalos válidos, vigência | B4.4 | D6 | idem | Sim |
| B4.4 Grade da turma | blocos versionados com responsáveis | versão de grade, bloco, responsável(engagement) | B4.1–B4.3, B1 | 1 (+ reader que substitui `institutional_class_schedule_slots`) | `class_schedule_at(validOn, knownAt)` / `record_class_schedule_version` | Editor de grade com sessão | sobreposição, engagement fora da turma/vigência, item fora da matriz, tipo de bloco sem catálogo ⇒ indisponível | Diário (`teachingClassBlocks`), frequência | D3, D7, D8 | Diário lê só o novo reader | Estrutura sim; tipo de bloco bloqueado |
| B4.5 Horário do profissional | projeção | — | B4.4 | 0 | `person_schedule_at` (INVOKER) | Horários por profissional | conflito por pessoa, RLS | Docente, Direção | — | sem tabela própria | Sim |
| B4.6 Calendário — conteúdo | persistir conteúdo e governança | calendário, versão, tipos de dia, intervalos, eventos, períodos→B2.4 | B2.4 | 1 | `network_calendar_at` / writers de rascunho e homologação | Calendário com sessão; localStorage só sem sessão | homologada imutável, período inexistente, ACL | Diário, frequência, CIECE | D4, D5 | `calendar-store` com sessão = espelho do banco | Estrutura sim; homologação bloqueada |
| B4.7 Calendário — apresentação | layout/simbologia/logos separados | layout versão, assets (storage) | B4.6 | 1 | reader/writer de layout | editor de layout | separação conteúdo×layout | impressão | — | impressão lê banco | Sim |
| B4.8 Atribuição docente | usar `institutional_engagements` (kind de catálogo) | engagement + escopo | B1, B4.1 | 0–1 | readers existentes | Atuação pedagógica com sessão | engagement fora da matriz | Diário | D3, D4, D8 | `pedagogical-data` só sem sessão | Bloqueada (catálogo de kind) |
| B4.9 Dicionário BNCC/SAEB | fonte + edição + objetivos | — | — | 1 | reader/importador | Matriz de habilidades | proveniência | Diário | fonte oficial | — | Parcial |
| B4.10 Integrações | Diário/frequência/CIECE/Mapa leem B4 por readers | — | B4.1–B4.6 | 0 | — | — | — | todos | — | nenhum consumidor lê fixture com sessão | — |

Consumidores: Diário/frequência (grade, calendário, atribuição); avaliação
(períodos B2.4, matriz); CIECE/Mapa (matriz, carga, dias letivos);
Secretaria/Direção/Supervisão (manutenção); Docente (horário projetado);
Orientação/Família (somente consulta futura).

## 12. Primeira subetapa implementável: **B4.1 — Matriz estrutural**

Critérios de aceite: migration aditiva; matriz com `logical_id`, versão,
`supersedes_id`, `valid_from/valid_until`, `created_at`, ato e `recorded_by`;
item referencia `institutional_curricular_components.id` (nunca nome) ou
elemento aberto com ID; aplicabilidade só por IDs canônicos (eixo de Oferta
apenas referenciado, sem escolher D1); carga só com unidade de catálogo (vazio
⇒ ausência); writer SECURITY DEFINER `search_path=''`, EXECUTE só
authenticated, fail-closed sem capability homologada; DML direto revogado;
reader bitemporal INVOKER; teste SQL em bloco com RAISE; nenhum valor semeado;
laboratório sem sessão intacto; suíte/typecheck/build verdes.

## 13. Bloqueio para começar

Nenhum bloqueio estrutural. B4.1, B4.3, B4.5, B4.6 (estrutura) e B4.7 não
exigem norma; o que exige (catálogos, homologação, cardinalidade, eixo da
Oferta) permanece fail-closed.

## 14. Residual B3.1 `allocation:open-beyond-participation`

Classificação: **A + C**. É consequência técnica do desenho atual
(`record_class_allocation` só cria alocação aberta; o fim vem por
`record_class_allocation_ending`) combinada com a regra B3.1 de que nenhum
filho pode ultrapassar o pai. O efeito é um **overconstraint**: uma alocação
inteiramente contida numa participação já delimitada é legítima e hoje não é
representável (exceto criando antes de delimitar a participação). Não é
restrição de segurança nem depende de norma. Merece **B3.2** pequena: aceitar
término opcional na criação (atômico, dentro da participação), sem cascata.


## Atualização B3.2
O residual `allocation:open-beyond-participation` foi corrigido na B3.2 (término explícito na criação da alocação). Deixa de ser lacuna técnica; as decisões institucionais D1–D8 seguem em aberto.

## Atualização B4.1 (2026-10-03)
B4.1 resolvida no plano estrutural: matriz, versões, itens por `component_id`, aplicabilidade por IDs e reader bitemporal persistidos (migration 0005). D4 decidida só quanto a quem mantém a matriz (`manter-matrizes-curriculares` → `gestao-pedagogica-da-rede`, v2 draft). D1, D2, D7, catálogos de unidade/elemento e homologação da matriz seguem abertos. B4.2+ não iniciadas. Detalhes: `docs/b4-1-matriz-curricular.md`.

## Decisão D2 — cardinalidade temporal (2026-10-03, decisão institucional do usuário)
Resposta do usuário à pergunta "uma ou várias": "Só existe uma matriz vigente, nunca mais de uma". Regra: para cada turma e cada data, **nunca mais de uma** matriz curricular vigente (versão de matriz B4.1) aplicada à turma. A decisão fixa apenas esse limite superior. **Não decidido:** se toda turma/data deve obrigatoriamente ter uma matriz; ausência de vínculo não é declarada estado válido. Ausência nunca é preenchida por default; a leitura a sinaliza como ausência.

> **Superado (2026-10-03):** a autoridade institucional esclareceu que, em turma multietapas, a etapa/ano/fase é fato individual do estudante na alocação. Uma turma pode ter **uma ou várias** matrizes oficiais na mesma data; a integridade é por cobertura das posições presentes, e a ambiguidade é avaliada por estudante × posição × data. Ver `docs/b4-2-planejamento-turma-matriz.md` (D2-cardinalidade revisada). O texto acima é preservado como registro histórico.
Continuam **não decididos**: o critério de escolha/aplicabilidade da matriz à turma (D2-critério) e o eixo de oferta (D1). Nenhum desses foi inferido dos documentos normativos nem escolhido por padrão.
> **Histórico superado (2026-10-03):** ~~Planejamento B4.2 (não iniciada): o vínculo turma→matriz deverá recusar sobreposição de vigências para a mesma turma; mais de um vínculo na mesma data ⇒ inconsistência fail-closed no reader.~~ Esta prescrição não vale mais.

Contrato atual do planejamento B4.2 (não iniciada): a aplicação da matriz é **derivada por alocação individual**, a partir da posição curricular B3.3 de cada estudante e de uma correspondência posição→matriz homologada (dado versionado, com ato e vigência), nunca de um vínculo manual turma→matriz. Uma turma pode ter **várias matrizes oficiais** vigentes na mesma data (união das matrizes resolvidas para as posições presentes); isso não é inconsistência. A ambiguidade é avaliada por **estudante × posição × data**: zero correspondências ⇒ ausência sinalizada; duas ou mais ⇒ inconsistência fail-closed. Compatibilidade/aplicabilidade fica fail-closed até a decisão de D1 e do critério de correspondência.

## Decisão D8-matriz — origem normativa e construção (2026-10-03, decisão institucional do usuário)
- As matrizes curriculares são definidas por **deliberação legislativa/normativa**; a **Supervisão Escolar** é responsável pela **construção** das matrizes no SIGEM.
- Alterações futuras ocorrem por nova deliberação, preservando versões, vigência, ato e histórico (já suportado pela B4.1: versão append-only, `valid_from/valid_until`, ato, sucessão/retificação).
- **Proveniência fornecida:** Deliberação CME nº 3/2026 de Itaperuna, art. 1º–2º e Anexos I–V (Educação Infantil; Ensino Fundamental regular 1º e 2º segmentos; EJA 1º e 2º segmentos). Referência documental apenas: o conteúdo **não** foi inserido em banco nem como fixture oficial.
- A deliberação mostra estrutura e variantes (anexos), mas **não define, por si, qual campo canônico da turma escolhe um anexo**. O critério de aplicabilidade turma→matriz (D2-critério) e o eixo de oferta (D1) continuam não decididos; nada foi inferido do texto.

### D4 reconciliada (decisão do usuário, 2026-10-03)
`gestao-pedagogica-da-rede` **é** a atuação da Supervisão Escolar. Não há conflito: a D4 já concede `manter-matrizes-curriculares` ({network}) à atuação certa, somente na v2 draft. Política inalterada (v1 108 draft; v2 117 draft; nenhuma homologada).
Competências continuam distintas: **construção** no SIGEM (Supervisão, via a capability acima); **registro da norma** (o ato/anexo é referenciado em cada versão: `originating_act_ref` + `curricular_matrix_layouts.source_locator`/página/sha256); **homologação** da versão construída contra o ato — workflow ainda inexistente, não decidido.

## Atualização — B4.3
B4.3 estrutural/read-only concluída (migrations 0018/0019, `class_journey_at`); escrita institucional bloqueada por falta de capability exata. Ver `docs/b4-3-jornada-turma.md`. B4.4 estrutural/read-only concluída (migration 0020, `class_schedule_at`; sem `record_class_schedule_version` por falta de capability exata; Diário lê só o novo reader; `institutional_class_schedule_slots` deprecated e sem consumidor). Ver `docs/b4-4-grade-turma.md`. B4.5 concluída como projeção read-only (migrations 0021 hardening do helper B4.4 e 0022 `person_schedule_at`; somente a própria pessoa; conflito potencial; sem tabela, writer ou capability). Visibilidade gerencial de terceiros permanece aberta. Ver `docs/b4-5-horario-profissional.md` (B4.5.1/B4.5.2: mapeador fail-closed e precisão TIME, só TS). B4.6.0 concluída como auditoria + contrato documental (`docs/b4-6-0-contrato-calendario-institucional.md`); subetapas propostas: B4.6.1 estrutura/readers (access-denied até D4/consulta decididas), B4.6.1b aplicabilidade D5, B4.6.2 source/UI read-only, B4.6.3 governança/escrita (bloqueada por D4/R5), B4.7 apresentação. B4.6.1 estrutural concluída (migration 0023: identidade/versões/tipos/conteúdo/períodos/homologação, append-only, RLS sem policy; `calendar_at`/`calendar_day_at` devolvem só `access-denied`; helpers privados; `b46-tests-ok`). Uso institucional indisponível; sem writer, capability ou dados. Ver `docs/b4-6-1-calendario-estrutura.md`. B4.6.2a: source tipada (`access-denied` apenas) + fronteira de sessão nas três rotas; consumidores Diário/avaliação/fechamento ainda no laboratório (B4.6.2b/B4.10). Ver `docs/b4-6-2a-calendario-source-rotas.md`. B4.6.2a.1: instantes validados por componente e comparados em microssegundos. B4.6.2b.0: auditoria de consumidores e plano em `docs/b4-6-2b-auditoria-consumidores-calendario.md` (próximo: Patch 1, fechamentos de frequência/período).

- B4.6.2b.1: Patches 3 e 4 + parser B4.5 concluídos; Patches 1, 2, 5 e 4b pendentes; A6 aberto.
- B4.6.2b.1.1: encerramento com snapshot único de autoridade; Patch 4b fechado; Patches 1, 2, 5 e A6 pendentes.
