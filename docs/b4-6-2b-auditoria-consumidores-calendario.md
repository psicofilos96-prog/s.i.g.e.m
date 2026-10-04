# B4.6.2b.0 — Auditoria dos consumidores do calendário (diagnóstico + plano)

Base auditada: `aab9aba` (B4.6.2a) + correção B4.6.2a.1. **Só diagnóstico**: nenhum consumidor foi refatorado.
Estado do Cloud no momento da auditoria (consulta real):
- `cycle_closing_policies` = 0, `attendance_calculation_policies` = 0, `assessment_norm_versions` = 0;
- `institutional_academic_period_versions` = 0;
- as 9 tabelas de calendário vazias.

Portanto nenhum caminho institucional produz hoje efeito oficial dependente de calendário. Os riscos abaixo são de **contrato e proveniência**, não leitura indevida comprovada.

Legenda de classificação:
- **L** — regra pura/lab que pode permanecer;
- **C** — consumidor institucional chamando o laboratório;
- **H** — hook inofensivo que ainda hidrata storage com sessão;
- **N** — inferência normativa ou institucional de calendário;
- **P** — uso de B2.4 que não deve ser bloqueado por falta de calendário.

## Inventário

| Local | Chamada real | Caminho com sessão | Classe |
|---|---|---|---|
| `assessment-normative-sources.ts` `normativeStateFromRows` | constrói a estrutura de períodos a partir de B2.4 (`loadOfficialTimelineForClass`); `year.calendarId = ""`, sem `calendarPeriodId` | banco | **P** — preservar. Períodos avaliativos não se subordinam ao calendário |
| `assessment-normative-sources.ts` `useClassConfigurationState` | `cloud = useSessionAuthority().status === "signed-in"` | durante `loading` ⇒ `cloud=false` ⇒ `classConfigurationState(classId)` do **laboratório** | **C** (transitório) — ver achado A4 |
| `assessment-instruments.ts` `resolveInstrumentPeriod(structure, date, calendars = calendarRepository)` | com `calendarId` usa o repositório lab; sem `calendarId` ⇒ `source:"legado-demonstrativo"`, `official:false` | estrutura B2.4 cai no ramo "legado-demonstrativo" | **N** — proveniência errada (A2). Callers: `assessment-instrument-store.ts:47`, `assessment-instrument-pages.tsx:276/358`, `period-closing-pages.tsx:140` |
| `period-closing-pages.tsx:158` | `officialPeriod: cloud ? true : resolution.official`; `calendarId` só se `structure.calendarId` | com sessão: `officialPeriod=true`, mas sem `calendarId` ⇒ pendência bloqueante `calendario-nao-homologado` (`period-closing.ts:450`) | **N** — o modo da sessão decide a origem, e a mensagem afirma estado não lido (A1) |
| `attendance-closing-pages.tsx:96/147-148/271` | `useNetworkCalendars()` + `calendarRepository.get(structure.calendarId)` + `isPublished`/`temporalQueries` | `calendarId=""` ⇒ `official=null` ⇒ `officialPeriod=false` ⇒ bloqueio `calendario-nao-homologado` (`attendance-closing.ts:527`); o hook hidrata localStorage | **N + H** (A1, A5) |
| `cycle-closing-pages.tsx:104/192` | `useNetworkCalendars()` ⇒ `calendarObservations(calendars, year.id)` entra nas observações do encerramento | **com sessão também**: o status dos calendários do laboratório vira observação `sourceKind:"calendario"` avaliada contra as políticas | **C** — maior risco comprovado (A3). A fixture lab exige `calendario/homologado`; não há política no banco hoje |
| `cycle-configuration.ts` `resolveCycles({ calendars = calendarRepository })` | com `calendarId` lê o calendário lab (períodos, `homologated`, `periodGroups`); sem ⇒ ciclo pelos períodos, `official:false` | estrutura B2.4 ⇒ `official:false`; agrupamento `por-agrupamento-do-calendario` sem grupos. Callers: `cycle-closing-pages:132`, `cycle-consolidation-pages:112`, `academic-standing-pages:168`, `academic-projection-pages:168` | **N** (A6): não fixar ciclo nem calendário dominante |
| `assessment-rule-model.ts` `applicableAssessmentRule`/resolução com `calendarRepository.get(rule.scope.calendarId)` | regra lab com escopo de calendário | regras do banco não têm `calendarId` lab; o resultado `calendar` é opcional | **L** (+ default do repositório global) |
| `assessment-rule-pages.tsx` | editor de regras: `useNetworkCalendars`, `calendars[0]` como escopo inicial, `<select>` de `calendarRepository.list()`, pesos por `calendar.periods` | tela de **laboratório** de governança de regras | **L**, mas `calendars[0]` é calendário dominante implícito: aceitável só no lab; nunca portar |
| `recovery-journey-lab.ts` | import dinâmico de `calendar-store`/`calendar-fixtures`; `installTransientLaboratoryCalendar` | só laboratório | **L** |
| `calendar-queries.ts` (`isPublished`, `officialCalendar`, `calendarIdForSchool`, `temporalQueries`, `diaryDateStatus`) | funções puras sobre `NetworkCalendar` | usadas pelos consumidores acima | **L** (regra pura; o problema é quem as alimenta com sessão) |
| `calendar-assessment-link.ts` (`periodRefsFromCalendar`, `resolvePeriodRef`, `assessmentStructureFromCalendar`) | deriva estrutura avaliativa do calendário lab | nenhum caller fora de `calendar/` e testes | **L**; nunca fonte de identidade, data ou número de períodos B2.4 |

## Achados

1. **A1 — mensagem afirma estado não lido.** Com sessão, os fechamentos de período e de frequência bloqueiam com "O período não vem de calendário escolar homologado". O calendário institucional não foi lido (o reader nega acesso), e os períodos vêm de B2.4. É preciso distinguir:
   - `calendario-indisponivel` — consulta negada ou não definida;
   - `sem-declaracao` — lido, nada declarado;
   - a exigência de calendário para fechar, que é norma ainda **não decidida** para o institucional.
2. **A2 — proveniência de período.** `resolveInstrumentPeriod` rotula períodos B2.4 como `legado-demonstrativo`. Falta uma origem explícita na estrutura: `periodOrigin: "b2.4" | "laboratorio"`, com referência à versão B2.4. Não se inventa calendário para "oficializar".
3. **A3 — encerramento do ciclo consome o laboratório com sessão.** `calendarObservations(useNetworkCalendars())` entra nas observações institucionais. Hoje não tem efeito (0 políticas no banco), mas uma política homologada futura que cite a fonte `calendario` seria satisfeita ou bloqueada por dados do navegador.
4. **A4 — janela de `loading`.** `useClassConfigurationState` devolve o estado do laboratório enquanto a sessão carrega.
   - Os consumidores do Diário dependem de `useDiaryPersistenceMode()` (global, alterado em `diary-cloud.ts`), não de uma fronteira pai de sessão. Não há gate de rota que impeça renderizar durante `loading`.
   - Na primeira renderização com sessão real, a página pode montar com fixture por alguns ciclos, e `useNetworkCalendars` hidrata localStorage.
   - É falha real de fronteira, ainda que transitória. Patch mínimo: `useClassConfigurationState` devolve `inexistente/carregando` quando `status==="loading"`, e a página exibe "Carregando" sem montar a configuração lab.
5. **A5 — hidratação com sessão.** `useNetworkCalendars()` incondicional em `attendance-closing-pages` e `cycle-closing-pages` lê localStorage com sessão. Não vaza nada para o banco, mas mistura origem.
6. **A6 — ciclos.** Com B2.4, `resolveCycles` produz um ciclo com todos os períodos e `official:false`. O agrupamento "por calendário" fica sem fonte. Não se importa regra de formação de ciclo como norma, nem se escolhe calendário ou ciclo dominante; o que falta é decidir a origem oficial do ciclo (domínio de ciclo, não calendário).

## Restrições do plano
- Sem estado global mutável que "desligue" o `calendarRepository`: ele mistura sessões, SSR e laboratório e não prova origem. Usar dependência e origem explícitas, mais fronteira de sessão.
- Políticas de frequência e de ciclo são domínios próprios: nenhuma autoridade ou homologação nova para "permitir calendário".
- Operação que exige calendário oficial continua **indisponível** enquanto a source nega acesso. Sem fixture, zero ou false; `calendar unavailable` ≠ `no declaration`.
- Calendário é dado de datas e efeitos, nunca identidade, data ou número dos períodos B2.4. Sem capability nova e sem enum de modalidade.

## Plano em patches pequenos

### Patch 1 (primeira fatia) — fechamentos de frequência e período: origem explícita + motivo honesto
- **Arquivos:**
  - `assessment/assessment-types` (ou onde vive `AssessmentPeriodStructure`): `periodOrigin?: "b2.4" | "laboratorio"`, preenchido por `normativeStateFromRows` como `"b2.4"`;
  - `diary/attendance-closing.ts` e `assessment/period-closing.ts`: o contexto recebe `calendarDependency: { kind: "laboratorio"; calendarId; official } | { kind: "institucional-indisponivel" }` em vez de `officialPeriod`/`calendarId` soltos;
  - `attendance-closing-pages.tsx` e `period-closing-pages.tsx`: com sessão montam `institucional-indisponivel` e não chamam `useNetworkCalendars`/`calendarRepository`.
- **Comportamento:** com sessão, a pendência bloqueante vira `calendario-institucional-indisponivel` com o texto da B4.6.2a. Some "não homologado"; o bloqueio é mantido porque a dispensa de calendário é decisão aberta. Sem sessão, o comportamento lab fica idêntico.
- **Testes:**
  - com sessão: nenhuma leitura de `calendarRepository`/localStorage, pendência nova presente, texto "não homologado" ausente;
  - lab: snapshot das pendências inalterado;
  - período B2.4 não marcado como demonstrativo.
- **Pode avançar sem D4/D5/consulta/R5:** sim.

### Patch 2 — `resolveInstrumentPeriod` com origem
- **Arquivos:** `assessment-instruments.ts` e callers; `source: "periodo-b2.4"` quando `periodOrigin==="b2.4"`. `official` passa a refletir a homologação B2.4 da estrutura, não o calendário. A página de instrumentos mostra a origem correta.
- **Testes:** estrutura B2.4 ⇒ `periodo-b2.4`; estrutura lab com calendário ⇒ comportamento atual; sem origem ⇒ `legado-demonstrativo` (compatibilidade).
- **Sem decisão nova:** sim. A dependência do repositório default some com sessão: o parâmetro `calendars` vira obrigatório no caminho lab.

### Patch 3 — encerramento do ciclo sem observação de calendário lab com sessão
- **Arquivos:** `cycle-closing-pages.tsx`, onde, com sessão, `calendarObservations` sai das observações e não se chama `useNetworkCalendars`. A ausência da fonte `calendario` é avaliada pelas regras existentes como fonte ausente, e a tela mostra "calendário institucional indisponível" quando a política cita essa fonte.
- **Testes:** com sessão, nenhuma observação `calendario` e nenhum hydrate; lab inalterado.
- **Sem decisão nova:** sim.

### Patch 4 — fronteira de `loading` de `useClassConfigurationState`
- `status==="loading"` ⇒ estado `carregando`, sem estado lab. Teste: durante `loading` nenhum `classConfigurationState` lab é chamado.
- **Sem decisão nova:** sim.

### Patch 5 — ciclos com origem (`resolveCycles`)
- Ciclo B2.4 rotulado pela origem, sem agrupamento inferido. `calendars` deixa de ter default global.
- Agrupamento oficial e ciclo oficial dependem de decisão do domínio de ciclo, **não** do calendário.

### Dependem de decisão institucional
- Se o fechamento institucional exige calendário homologado (norma de fechamento).
- Leitura do conteúdo do calendário: D4 (rascunho) e competência de consulta do homologado.
- Aplicabilidade a turma/escola (D5/B4.6.1b), homologação (R5) e publicação (D6).
- Agrupamento de períodos em ciclos.
- Apresentação e impressão institucionais (B4.7, fora desta etapa).

## B4.6.2b.1 — fatia entregue (Patches 3 e 4 + parser B4.5)

Ordem do plano revista: **Patch 3** (encerramento do ciclo) e **Patch 4** (estado de configuração durante a autenticação) vieram primeiro (maior risco e fronteira de sessão), junto com a correção dirigida do parser B4.5. **Patches 1, 2 e 5 permanecem pendentes** para a próxima fatia.

Correção da auditoria: consulta negada ao calendário institucional é **INDISPONÍVEL**, não prova de inexistência. Nenhuma observação fictícia ("calendário não homologado", "0 calendários") nem ID sintético é injetado.

- Encerramento (`cycle-closing-pages.tsx`): fronteira `CycleClosingPage` — sessão incerta ⇒ só "Verificando sessão…" (nenhum hook de calendário/storage, configuração ou motor); sem sessão ⇒ `LabCycleClosing` (único que chama `useNetworkCalendars`); com sessão ⇒ corpo remontado por `user.id`, origem explícita `institucional-indisponivel`, sem observações de calendário do laboratório e `resolveCycles` com `NO_LAB_CALENDARS` (default nunca alcança o laboratório).
- Inspetor: entrada genérica `sourceAvailability` (`sourceKind` aberto, `state: "indisponivel"`, `reason`). Requisito cuja política declare esse `sourceKind` fica `inconclusivo` com o motivo informado; nunca satisfeito. Requisitos sem esse `sourceKind` não mudam; nenhum requisito universal de calendário.
- Configuração (`useClassConfigurationState`): `loading` ⇒ `SESSION_PENDING_STATE` (origem `sessao-pendente`), sem `teachingClass`, sem `classConfigurationState` do laboratório e sem requisição; chave inclui `userId`. Ordem dos hooks preservada.
- Parser B4.5: `src/lib/postgres-instant.ts` (`instantMicros`, `isKnownAt`, `sameInstant`) compartilhado; calendário reexporta os mesmos exports; `sameInstant` do horário compara microssegundos; `readMySchedule`/`readPlaceNames` recusam `knownAt` inválido antes da RPC.

Residuais: A6 (ciclos sem origem; agrupamento ainda vem de `cycleDefinitionFor` — ciclos institucionais **não** estão resolvidos); chamadores diretos de `useAssessmentNormativeSource` com `cloud` booleano ainda escolhem laboratório durante `loading` (Patch 4b); Patches 1/2/5. Capabilities, consulta, D4/D5/R5/D6 intactos; sem SQL/writer/policy.

## B4.6.2b.1.1 + Patch 4b (base auditada d892692)

- Encerramento: o corpo recebe a origem explícita `ClosingOrigin` (`laboratorio` com calendários locais | `institucional` com o MESMO snapshot `signed-in` da fronteira). Não há segunda chamada de sessão no corpo; com sessão nunca há política, ator, terminologia ou perfil demonstrativos (sem ator resolvido ⇒ conta da sessão sem capacidades). Configuração e políticas em carga ⇒ "Carregando" (`useCloudCycleClosing` agora expõe `ready`/`error`); nada de "não existe política" antes da leitura.
- Provas com contexto resolvido (`cycle-closing-session-boundary.test.tsx`): turma, atuação, períodos B2.4 e configuração resolvidos, política fictícia vinda do mock Cloud, inspetor real executado. Com sessão: `sourceAvailability` "indisponivel" chega ao inspetor; a fixture de calendário não entra nas observações; `useNetworkCalendars`/`get`/`list`/`forYear`/`hydrate`/`calendarObservations` nunca são chamados. Políticas com e sem requisito de calendário. Divergência simulada (fronteira assinada, outra instância em loading) sem demo. A→B: resposta atrasada de A descartada e justificativa digitada em A ausente em B.
- Patch 4b fechado: `normativeSessionArgs(authority)` (cloud/pending/userId do mesmo snapshot) em TODOS os chamadores de `useAssessmentNormativeSource`: academic-standing-pages, assessment-entry-field-page, period-closing-pages, assessment-period-page, cycle-consolidation-pages, assessment-structure-page, cycle-closing-pages e `useClassConfigurationState`. O único chamador sem sessão é o teste puro `institutional-request-race.test.tsx` (`cloud: true` explícito, compatível). Prova em `normative-source-session.test.tsx` (loading sem lab/requisição; signed-out→loading→signed-in; A→B com Promises adiadas no mesmo hook; B2.4 sem calendarId).
- Pendentes: Patches 1, 2, 5; A6. Sem SQL/migration/policy/capability.

## B4.6.2b.2 — Patch 5 / A6 (fronteira)
- Patch 5 **resolvido como fronteira**: `resolveCyclesForOrigin` — laboratório legado; institucional indisponível por extenso (sem fallback anual, sem calendário local, sem `cycles[0]`). Os 4 chamadores (encerramento, consolidação, situação, projeção) migrados.
- A6 **parcial**: a origem oficial de ciclos continua inexistente (decisão de agrupamento aberta); nenhuma entidade criada. Com sessão, as 4 telas ficam indisponíveis até haver fonte homologada.
- Data acadêmica explícita nos 4 consumidores (informada > hoje operacional como referência de consulta; nunca a data do laboratório na sessão).
- Pendentes: Patches 1/2; fonte institucional de ciclos; B4.10.

## B4.6.2b.3 — Patches 1/2
- Patch 1 (períodos com origem): **corrigido em B4.6.2b.3.1, aguardando auditoria** — proveniência B2.4 explícita; resolvedor estrito; B2.4 ≠ legado.
- Patch 2 (fechamentos com motivo honesto): **corrigido em B4.6.2b.3.1, aguardando auditoria** para frequência e período — calendário indisponível ≠ não homologado; previstos sem dias letivos indisponíveis; política de frequência com contexto/erro.
- Pendentes: A6 (fonte de ciclos), calendário institucional (B4.6.1b/D5), B4.10.

## B4.10.0a (escopo de segurança)
- Espelhos de fechamento de período, situação e Conselho: aceitação por contexto + dono do store **corrigida**; B4.10 funcional segue aberta. Pendente: diary-cloud/roster/teaching.
- B4.10.0a.1: leitura staged do fechamento (caps na revisão aceita) e meta/base do Conselho/fechamento como carga da revisão aceita do store — **corrigido**. Pendentes (não nesta fatia): `useSessionUser`/`user_person_links`, hidratação tardia do Diário, filtro de atuação/domingo no adaptador.

## Mapa durável de cobertura (atualizado em B4.6.3e)

| Consumidor | Estado |
|---|---|
| Fechamento de frequência | coberto (diagnóstico bloqueante) |
| Horários institucionais por data | coberto (aviso) |
| Fechamento do período | coberto |
| Encerramento do ciclo | coberto (só se a política homologada exigir) |
| Consolidação do ciclo | coberto (B4.6.3d) |
| Aula prevista / grade do dia com sessão | coberto (grade ≠ aula prevista) |
| Chamada do registro ministrado | coberto (B4.6.3e: aviso informativo; não apaga, não marca, não bloqueia) |
| Agenda de conselhos (colegiados) | coberto (B4.6.3e: indisponível com motivo; categoria não configurada) |
| Documentos, CIECE/mapa estatístico, vida escolar/frequência do aluno | pendente |

O diagnóstico já funciona, mas o pedido operacional NÃO está concluído: a fonte pública só responde access-denied, D5 (aplicabilidade) e a categoria conselho/férias/recesso não existem, não há writer nem capacidades homologadas e a permissão de consulta ainda espera a resposta do usuário. Nenhum consumidor recebe dias letivos reais.

## B4.6.3f — inventário dos consumidores restantes (aditivo)

| Consumidor | Caminho real | Classificação | Tratamento |
|---|---|---|---|
| Documentos e relatórios do Diário | `/diario/documentos` → `DiaryDocumentsPage` + `assessment/document-dependencies.ts` | existente com dependência (aulas previstas) | **Risco corrigido**: com sessão o mapa afirmava "Aulas previstas … existe-demonstrativo". Agora `documentDependenciesForSession` usa o motivo real do adaptador central (mesma data/knownAt do controlador do Diário) e nenhuma fonte demonstrativa conta como existente. Laboratório intacto. |
| Emissão oficial de documento (boletim, ficha, folha final) | — | inexistente/não implementado | Contrato puro `calendar/calendar-basis.ts`: base congelada (`calendarBasisSnapshot`), razão só com denominador determinado e > 0 (`ratioOverSchoolDays`), datas de fato preservadas (`preserveFactDate`). Nenhum módulo de emissão criado. |
| CIECE (`features/ciece/`, `/ciece`) | fatos atômicos, motor 14.2 | sem dependência | Nenhum fato/indicador usa dias letivos; `calendarPeriodId` é só dimensão. Nada alterado (nenhum total vira fato). |
| Mapa Estatístico (`features/statistical-map/`) | data declarada pela regra homologada | sem dependência | Datas vêm da regra do Mapa, não do calendário. Nada alterado. |
| Vida escolar (matrícula, transferência, continuidade, dossiê) | `features/student-life/`, `students/`, `transfers/`, `enrollments/` | sem dependência | Datas de ato/transferência/nascimento não são deslocadas; nenhum cálculo de dias letivos. |
| Frequência do aluno fora do Diário (percentual) | — | inexistente | Nenhum percentual implementado. Seu denominador dependerá da regra homologada e das unidades de frequência aplicáveis; não presumir dias letivos nem usar `ratioOverSchoolDays` como fórmula universal de frequência. |
| Orientação pedagógica, projeções acadêmicas | `pedagogical-guidance/`, `academic-projections/` | laboratório / sem dependência | Sinais e projeções não calculam dias letivos; não migrados artificialmente. |
| Calendário local (`/calendario-escolar`, `calendar-store`) | laboratório | laboratório | Nunca tratado como calendário oficial (fronteira B4.6.2a). |

Fonte positiva continua ausente: nenhum consumidor recebe dias letivos reais. Para desbloquear: (1) resposta sobre quem pode consultar o calendário; (2) D5 vínculo calendário↔escola/oferta/turma; (3) categorias de tipo de dia; (4) writer + homologação pela Supervisão em política homologada.

### Revisão Codex da B4.6.3f

- O mapa de documentos com sessão classifica fontes demonstrativas como `nao-verificada`, não como inexistentes: a implementação não provou ausência das fontes institucionais de aula/chamada/alocação. A tela apresenta fontes verificadas para o documento, preservando essa distinção.
- `calendarBasisSnapshot` conserva cópias imutáveis da evidência de cada dia (versão do calendário, homologação, versões de tipos e declarações), além do total. Intervalo incompleto, dias duplicados ou `knownAt` divergente tornam a base indeterminada. Este contrato prepara a futura emissão; nenhuma emissão oficial foi implementada.
- `ratioOverSchoolDays` é uma operação genérica com denominador explicitamente em dias. Não estabelece fórmula, unidade nem norma de frequência escolar. A apuração de frequência continua usando sua regra e fatos canônicos.

## B4.6.4a (aditivo)
Writers existem, mas nenhum consumidor muda: leitura continua `access-denied`, homologação recusada até D5, política v2 draft. Fonte positiva ainda indisponível.

### Atualização B4.6.4b
- D5 deixou de ser lacuna de esquema: recortes explícitos por escola/valor de eixo/alocação/posição existem e são gravados com a versão. Continua faltando a norma homologada de seleção/composição; nenhum consumidor recebe calendário positivo.

## Estado B4.6.7 Fatia 3/3b (2026-10-04)

Ativos (decisão de `calendar_composed_days_at` por alocação canônica, um knownAt, eixo da posição B3.3 do estudante — 0036):
- Aulas previstas do Diário (feriado suprime só a previsão; registros não mudam).
- Aviso da chamada (informativo; não marca, não apaga, não bloqueia).
- Horários institucionais (aviso do dia por alocações da turma).
- Fechamento de período, fechamento de frequência, encerramento do ciclo, consolidação do ciclo (indeterminado bloqueia com motivo).
- Documentos do Diário com turma escolhida (sem turma: exige escolha).
- Folha institucional impressa (aparência do snapshot, dias/efeitos das declarações da versão).

Bloqueados:
- Agenda de conselhos: não existe capacidade homologada para declarar quais tipos de dia são conselhos; `councilRole` da fonte fica preservado no original, sem inferência por nome e sem "0".
- Tudo depende de instalação legítima e de políticas homologadas (Fatia 4); hoje não há sessão institucional real.

Testes Cloud reproduzíveis (rollback por RAISE): `supabase/tests/b4_6_7b_presentation_snapshot.sql`, `supabase/tests/b4_6_7c_student_position_axis.sql`.

## Estado atual verificado — 2026-10-04
Os calendários reais de 2027 (Regular, EJA e EJA Fase I) estão centralizados e homologados. Editor original com Salvar/Homologar/Histórico; demais contas consultam as apresentações homologadas no mesmo formato. Meu horário e grade da turma mostram a decisão do calendário por alocação/data/snapshot, mantendo a grade estrutural. Diários, previsão de aulas, conselhos e fechamentos reutilizam o contrato institucional composto; efeitos indeterminados não contam como zero nem apagam fatos de frequência. O recorte explícito é herdado por alterações e pode combinar escola com valor da posição individual. Não há escolas/turmas/alocações reais cadastradas: a publicação do documento existe, mas a aplicação individual aguarda esses fatos e os recortes explícitos. Isso substitui os antigos bloqueios de autoridade/onboarding citados nesta auditoria; não autoriza inventar dados nem associar AEE/complementar automaticamente. Verificação independente: 1.095 efeitos da fonte preservados, ciclo SQL completo e preservação de recortes com rollback, 93 testes locais, typecheck e build aprovados.
