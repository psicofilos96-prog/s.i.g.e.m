# SIGEM — Memória de continuidade técnica (2026-10-03)

Registro de continuidade **dentro do repositório**. Não é promessa de memória externa: quem retomar deve reler este arquivo, os `AGENTS.md` e as fontes duráveis abaixo.

## Sequência auditada
1. Sincronização reconciliada em `7129c0c` (B4.5 recuperada/mesclada; Cloud com 0021/0022).
2. B4.5.1: cache estrito por conta/pessoa e mapper fail-closed — `51d05b2`.
3. B4.5.2: TIME até microssegundos e `block_minutes` conforme o SQL — `d885459`.
4. B4.6.1: estrutura do calendário (0023), readers públicos fechados (`access-denied`) — `a7a8e70`. Auditoria técnica aceita; não é homologação institucional.
5. B4.6.2a (esta entrega; base auditada `a7a8e70`): source tipada + fronteira de sessão nas três rotas do calendário + casos SQL `year-inactive`/`organization-inactive`.
   - O commit é criado automaticamente; o hash não fica registrado aqui.

6. B4.6.2a recebida/auditada em `aab9aba`.
7. B4.6.2a.1: `isKnownAt`/`instantMicros` validam data e hora por componente (sem normalizar 2026-02-30), aceitam T/espaço, frações até 6 dígitos, offset Z/±hh/±hhmm/±hh:mm e 24:00:00 só com zeros, e comparam em microssegundos UTC (BigInt).
   - Residual técnico: o parser B4.5 (`person-schedule-source.ts`) também usa `Date.parse` para instantes. Fica para correção dirigida; não há leitura indevida comprovada.
8. B4.6.2b.0: auditoria de consumidores (`docs/b4-6-2b-auditoria-consumidores-calendario.md`), só diagnóstico. Achados:
   - A1: os fechamentos com sessão dizem "não homologado" sem terem lido o calendário;
   - A2: períodos B2.4 rotulados como demonstrativos;
   - A3: o encerramento do ciclo usa observações do calendário do laboratório com sessão;
   - A4: durante a verificação de sessão, a configuração do laboratório é usada;
   - A5: localStorage é lido com sessão;
   - A6: ciclos sem origem.
   - Próximo patch: Patch 1 (fechamentos de frequência e período com origem explícita e motivo "calendário institucional indisponível").

## Testes reais e gates desta entrega
- Cloud: `supabase/tests/b4_6_1_calendar_structure.sql` → `b46-tests-ok` (rollback). As 9 tabelas de calendário ficaram vazias depois. Policies v1/v2 = 108/117 draft.
- Código: testes novos e afetados, suíte completa isolada, typecheck, build e diff-check com exit code real (ver relatório da entrega). SQL B4.4/B4.5 não foi repetido (não alterado).

## Escopo concluído em B4.6.2a
- `calendar_at`/`calendar_day_at` tipados, só `access-denied`, qualquer outra forma é erro visível.
- `/calendario-escolar`, `/$id` e `/$id/documento`:
  - sessão incerta ⇒ nada monta;
  - sem sessão ⇒ laboratório;
  - com sessão ⇒ consulta institucional somente leitura, sem demo, `?perfil`, impressão ou ações.
- Cache por userId + modo + ID + validOn + knownAt.

## Próximos passos (nenhum iniciado)
- **B4.6.2b**: migrar os consumidores do laboratório (Diário, frequência, avaliação, fechamento; lista em `docs/b4-6-2a-calendario-source-rotas.md`).
- **B4.6.1b**: aplicabilidade/D5.
- **Decisões institucionais abertas:**
  - D4 — leitura de rascunho;
  - competência de consulta do conteúdo homologado;
  - R5 — homologação;
  - D6 — publicação.
- **B4.7**: apresentação/impressão institucional. **B4.8 / B4.9 / B4.10**: integrações.

## Fontes duráveis e regras de retomada
- `docs/sigem-memoria-fontes-historicas.md` e `docs/sigem-memoria-setorial-e-auditoria.md`: contexto histórico e setorial, não estado atual.
- O repositório é a única fonte do estado; o modelo abandonado não é importado (regras, dados ou código).
- Não forçar permissões, capabilities, policies nem normas: sem decisão institucional explícita, a escrita e a consulta continuam fechadas.

## B4.6.2b.1 (base auditada 7e4edd9)
Patches 3 e 4 + parser B4.5 entregues (ver `docs/b4-6-2b-auditoria-consumidores-calendario.md`). Pendentes: Patches 1, 2, 5, Patch 4b (chamadores diretos), A6. Sem SQL; capabilities/consulta/D4/D5/R5/D6 intactas. Não iniciar B4.7.

## B4.6.2b.1.1 (base auditada d892692)
Um snapshot de autoridade no encerramento; provas com contexto resolvido; Patch 4b fechado (todos os chamadores auditados). Pendentes: Patches 1/2/5, A6.

## B4.6.2b.1.2 — aceitação de respostas do encerramento (sobre 2bf80e1)
- Base 2bf80e1 conferida (origem/snapshot no corpo, atores neutros, source normativa com pending/userId, testes deferred).
- Bug corrigido: `useCloudCycleClosing.refresh` hidratava o store global incondicionalmente; resposta tardia de A podia substituir snapshots de B.
- Correção (só TS/leitura): contexto = userId + classId + enabled (userId vem do snapshot da fronteira); ref de contexto ativo + geração; cleanup invalida pendentes; refresh de contexto velho/desmontado não consulta nem invalida o novo; erro em qualquer consulta não hidrata (nem [] nem parcial); policies só visíveis para o contexto carregado sem erro. clone→RPC→refresh e autorização backend inalterados.
- Prova: `cycle-closing-cloud-acceptance.test.tsx` (hook real + store real; IDs de snapshot asseridos).
- Fora de escopo (auditoria B4.10): demais syncs globais (useCloudClosingSync, useCloudStanding, useCloudCollegial e outros) não foram revistos; não se alega aplicação protegida como um todo.
- Pendentes: Patches 1/2/5, A6.

## B4.6.2b.2 — consumidores: data acadêmica, fronteira de ciclos (A6), projeção (sobre c567ab8)
- Data: `src/features/academic/academic-reference-date.ts`. Data informada (URL `data`) prevalece; inválida ⇒ indisponível sem consulta (fonte normativa bloqueada, fatos de período desabilitados). Com sessão e sem data: "hoje operacional" capturado uma vez por montagem — só referência de consulta, nunca norma/prazo. Laboratório mantém `DIARY_REFERENCE_DATE`. Aplicado em encerramento (antes sem `academicDate`), consolidação, situação acadêmica e projeção; `diaryContext` recebe a mesma data.
- Ciclos (A6): `resolveCyclesForOrigin`. Laboratório = legado. Institucional = indisponível por extenso (`INSTITUTIONAL_CYCLES_UNAVAILABLE`): sem fallback "Consolidação Anual"/todos-os-períodos, sem calendário local, sem afirmar que não há ciclos, sem `cycles[0]`. Consequência honesta: com sessão, encerramento/consolidação/situação/projeção ficam indisponíveis até existir fonte homologada de definição de ciclos (decisão de agrupamento de períodos em ciclos segue aberta; nada persistido foi criado).
- Projeção: verifica sessão, `cloudClosing.ready`/`error` antes de ler store ou afirmar ausência de política/catálogo.
- Testes: `academic-reference-date.test.ts`, `academic-projection-session.test.tsx`, `cycle-closing-session-boundary.test.tsx` (inspetor/A→B exercitados com fonte de ciclos HIPOTÉTICA só de teste; novo caso A6 e casos de data com parâmetro real da timeline).
- Limitações: projeção com data inválida ainda chama a fonte normativa com data ausente (timeline real retorna indisponível sem RPC; normas são lidas); outras telas (fechamento de período, avaliação do período, diário) não usam o hoje operacional — sem data seguem indisponíveis na timeline B2.4. `diaryContext` em outras telas continua com default de laboratório.
- Pendentes: Patches 1/2 (próximos), A6 parcial (fonte institucional de ciclos), B4.10 (syncs globais).

## B4.6.2b.3 — Patches 1/2: proveniência B2.4, calendário como dependência, política de frequência (sobre 353c34d)
- Proveniência: `OfficialTimeline.provenance` (`institucional-b2.4`, validOn, knownAt ÚNICO capturado no início e repassado a TODAS as leituras, versões do ano/organização/períodos); a estrutura avaliativa carrega `provenance`. Nenhum ato/homologação novo é declarado.
- `resolveInstrumentPeriod`: estrutura com proveniência B2.4 ⇒ `source: "institucional-b2.4"`, `official:false`, `calendarDependency:"indisponivel"`, sem consultar calendário; data civil estrita; data em >1 período (B2.4, calendário ou legado) ⇒ falha, nunca o primeiro. IDs/`periodSource` históricos preservados (sem renomear nem recalcular).
- Calendário institucional indisponível: pendência própria `calendario-institucional-indisponivel` (frequência e período) — "indisponível para consulta", nunca "não homologado". Fechamento de período não força mais `officialPeriod` com sessão.
- Previstos: `plannedUnits` sem `isSchoolDay` ⇒ `null`; tela mostra "Informação indisponível" e o fechamento oficial ganha bloqueio `unidades-previstas-indisponiveis`. Afeta também o laboratório sem calendário homologado (antes contava todos os dias).
- Fronteiras de sessão: frequência (loading ⇒ só verificação; signed-out ⇒ lab com `useNetworkCalendars`; signed-in ⇒ corpo institucional sem calendário local, remontado por conta) e período (loading ⇒ verificação; corpo recebe o mesmo snapshot). Ambas usam `useAcademicReferenceDate`; data inválida bloqueia sem consulta.
- `useAttendancePolicySource({cloud,pending,userId,date})` sobre `useInstitutionalRequest`: chave conta+data, resposta antiga/unmount ignorada, erro ≠ ausência. Callers: situação acadêmica e frequência (ambos com gate de erro).
- Projeção: data inválida desabilita encerramentos e normas (hooks mantidos).
- Escrita: protocolos inalterados (`attendance-closing-store` continua exigindo calendário oficial; backend revalida).
- Limitações: knownAt é instante do cliente (relógio pode divergir do servidor); `useCloudPeriodFacts` e diário não foram revistos para proveniência; syncs globais (B4.10) intactos; calendário institucional continua sem fonte (decisão aberta). Pendentes: fonte institucional de ciclos (A6), calendário institucional, B4.10.

## B4.6.2b.3.1 — correção dirigida (auditoria de ef509de)
- Origem do período: `period-source-presentation.ts` é a única frase de `PeriodSource`; B2.4 aparece como "Período institucional (B2.4) · calendário institucional indisponível para consulta" no instrumento e na trajetória do estudante. `official` continua só `calendario-homologado`; ausente/legado seguem demonstrativos, sem reetiquetar histórico.
- Ausência ≠ zero no motor: `ScopeAttendanceTotals`/fato de frequência/consolidação têm `plannedUnits`/`plannedWithoutExecutionUnits` `number | null`; consolidação usa `addKnown` (null propaga). Lista conhecida vazia = 0. Recibos históricos numéricos inalterados; fechamento oficial continua bloqueado sem previstos.
- `loadOfficialTimelineForClass`: data via `isCivilDate` e `knownAt` via `isKnownAt` antes de qualquer RPC; proveniência inclui `classAssociation {id, version}` (sem id/versão ⇒ indisponível, nada fabricado); identidades de organização e períodos filtradas por `created_at <= knownAt` (identidade futura não entra nem torna indisponível). `useAttendancePolicySource` só consulta com data civil válida.
- Testes: mocks exigem `created_at` (ausente não passa no filtro); cenários de identidade/organização futura, associação sem versão, data/instante inválidos sem RPC.
- Limitação mantida: `knownAt` padrão é relógio do cliente. Patches 1/2: revisados nesta correção; aguardam nova auditoria antes de serem dados como fechados.

## B4.10.0a — hardening dos espelhos de fechamento/situação/Conselho (sobre a7b3ea8)
Escopo de SEGURANÇA de aceitação de respostas; NÃO conclui B4.10 funcional. Sem SQL/RPC/autorização alterados.
- `src/lib/mirror-acceptance.ts`: `useContextGate(key)` (montagem viva + mesmo contexto + pedido mais novo; contexto velho/desmontado nem consulta nem invalida o novo) e `mirrorOwnership(store)` (ordem global de pedidos por store: resposta mais antiga que a última hidratação aceita é descartada; registra o DONO do conteúdo, sem que uma montagem invalide o pedido pendente de outra).
- `useCloudClosingSync(enabled, {userId})`, `useCloudStanding(store, classId, enabled, {userId})`, `useCloudCollegial(store, classId, enabled, {userId})`: identidade do MESMO snapshot do consumidor (sem userId ⇒ sem consulta); chave identidade+enabled(+turma); hydrate global, `lastEventIds` e `meta` só do pedido aceito; erro nunca hidrata; `ready`/`error`/capacidades por contexto (A→B oculta imediatamente).
- Escrita: `recordClosingActInCloud` exige `context` e espelho do mesmo dono (senão recusa sem RPC); `register` (situação) e `commit` (Conselho) idem; RPC aceito permanece (sem rollback fingido) e só o contexto que o iniciou, ainda vigente, rehidrata; lote do Conselho interrompe envios restantes se o contexto mudar.
- Consumidores com gate antes de ler store/capacidades/oferecer ação: `ClosingWorkspace` (recebe `userId`), encerramento do ciclo, situação acadêmica, colegiados.
- Bug real exposto pelos testes e corrigido: o gate devolvia objeto novo a cada render, refazendo a leitura a cada resposta.
- UX: selo "Período institucional · calendário institucional indisponível para consulta" sem código técnico; referência `institucional-b2.4` só no detalhe "Referência técnica da origem" da trajetória.
- Provas (`mirror-hardening.test.tsx`, hooks+stores reais, linhas não vazias): A→B (B aceito, A tardio não sobrescreve `fech-B`/capacidades), unmount, erro parcial sem hidratar, duas leituras (nova vence), operação iniciada em A com troca para B (RPC aceito não rehidrata B; reenvio com contexto velho sem RPC), turma1→turma2 (situação e Conselho), meta de A não serve a B, `ClosingWorkspace` pendente não lê o store.
- Limitações/pendências: os espelhos continuam singletons globais (um contexto por vez, separação mais ampla não prometida); ownership é por processo do navegador; testes de página completos de situação/colegiado não adicionados (gates verificados por tipo e pelo workspace). PRÓXIMA FATIA (não tocada): `diary-cloud`/`hydrateInstitutionalRoster`/Teaching — sync montado só no `DiaryHeader`, respostas antigas aceitas e retorno ao laboratório durante loading.

## B4.10.0a.1 — correção de duas lacunas da auditoria de 2c64ce6
Sem SQL/RPC/normas/capacidades/deploy.
- (1) Fechamento: `hydrateClosingsFromCloud` agora é STAGED — eventos, versões e `effective_capabilities` são lidos juntos e nada (store, `lastEventIds`, capacidades, dono) é aplicado antes de TODOS terem sucesso e gate/ordem valerem; `error` em qualquer resposta ou Promise rejeitada mantém store/base anterior, caps vazias e erro visível (try/catch no refresh: sem rejeição não capturada nem loading eterno). Releitura pós-RPC (`rehydrateClosingsAfterAct`) lê só fechamentos — contrato: ato de fechamento não altera atuação nem política de capacidades — e preserva as capacidades da revisão aceita do MESMO dono; outro dono ⇒ nada aplicado.
- (2) Base/meta da revisão aceita: `mirrorOwnership` passou a guardar a carga (meta do Conselho; `lastEventIds`+caps do fechamento) JUNTO do dono/revisão (`accept(owner, seq, payload)`, `payload()`, `useMirrorRevision`). Snapshot rejeitado não expõe meta/caps próprios; toda montagem do mesmo dono lê a base da revisão realmente hidratada no ato do commit; montagem com erro próprio recusa commit sem RPC. Situação: `register` exige leitura própria sem erro + dono; rejeição de Promise vira erro visível.
- Capacidades do fechamento só aparecem quando o dono é o contexto do consumidor E a leitura dele terminou sem erro (store passar a B ⇒ A sem caps e sem envio).
- Provas (`mirror-hardening-staged.test.tsx`, 10 testes, hooks+stores reais): store preexistente não vazio + eventos/versões completos ANTES + caps error DEPOIS ⇒ store/base/dono iguais; caps error ANTES; rejeição de Promise (caps e eventos); primeira leitura com caps error; duas montagens mesmo contexto com respostas invertidas (ambas caps/base do aceito mais novo); mudança de dono esconde caps e bloqueia envio; pós-RPC preserva caps e avança base; Conselho com duas montagens mesmo user/turma/store invertidas ⇒ commit da montagem rejeitada envia `_expected_last_event_id = ev-novo` (nunca ev-velho); montagem com erro próprio ⇒ sem RPC; situação com Promise rejeitada ⇒ erro, store intacto, sem RPC.
- Limitações mantidas: espelhos são singletons globais compartilhados (um dono por vez, sem particionamento); ownership por processo do navegador; testes de página completos de situação/colegiado ainda não adicionados. NÃO declarado: todos os espelhos protegidos — pendentes já auditados para as próximas fatias: race de `getSession` inicial em `useSessionUser` e `user_person_links` próprio sem `eq user_id`; hidratação tardia do Diário (`diary-cloud`/roster/teaching); filtro de atuação própria/domingo no adaptador.

## Encerramento solicitado pelo usuário
- Trabalho encerrado a pedido do usuário, sem iniciar outra execução Lovable. Última implementação sincronizada: `c619882eb03e58ac66310f9e66412852fbb6eae5` (B4.10.0a.1).
- Verificação independente final do Codex: `mirror-hardening.test.tsx`, `mirror-hardening-staged.test.tsx` e `cycle-closing-session-boundary.test.tsx`: **3 arquivos / 34 testes passaram**, exit 0. `git diff --check` limpo e árvore limpa antes deste registro documental.
- Gates finais reportados pelo Lovable para essa implementação: **169 arquivos / 2.644 testes**, typecheck, build e diff-check, todos exit 0. A suíte completa dessa revisão não foi repetida localmente pelo Codex; a execução completa local anterior foi 161 arquivos / 2.585 testes, exit 0.
- Próxima retomada: corrigir a origem da sessão (`getSession` atrasado e vínculo da própria conta), depois os carregadores do Diário/estudantes/atuações e o adaptador de domingo. São pendências comprovadas, não entregas. Permanecem abertas as decisões institucionais sobre calendários, definição de ciclos e permissões; não homologar políticas nem inventar normas para contornar os bloqueios.

## B4.10.0b — origem da sessão (base 75cf389)

Sem SQL/RPC/políticas/capabilities/normas/deploy. Commit: o hash final é atribuído ao encerrar o turno (registrar na auditoria).

- `useSessionUser` agora lê uma origem única por processo (`useSyncExternalStore`): qualquer evento de `onAuthStateChange` prevalece sobre o `getSession()` inicial atrasado (descartado); erro/rejeição do bootstrap ⇒ `loading` + `error` (nunca signed-out, nunca laboratório); cleanup com o último ouvinte cancela respostas tardias e a próxima montagem recomeça incerta.
- `sessionRevision` (monótona): nova a cada nova sessão (troca de conta ou logout→login da mesma conta); refresh do mesmo usuário não muda. Só entra em chaves (`["session-authority", user.id, revision]`, chaves dos espelhos de fechamento/situação/Conselho/fechamento de ciclo, fonte normativa e política de frequência); `userId` continua puro em filtros de banco. `sessionContextKey` é auxiliar só de cache.
- `useSessionAuthority`: vínculo por `.eq("user_id", user.id)`; >1 linha ⇒ erro "vínculo institucional ambíguo"; erro de link/pessoa/capacidades lança; `isError` (inclusive refetch) ⇒ `loading`+`error`, sem expor capabilities anteriores; ausência de vínculo lida com sucesso continua signed-in sem capacidades.
- Provas: `src/features/authority/session-origin.test.tsx` (9 testes, hooks reais + QueryClient real).
- Gates: 2653 testes (contagem de arquivos não capturada naquela execução), tsgo 0, build 0, diff --check 0.
- Limitações: stores globais seguem singletons (um contexto por vez); revisão é por processo do navegador; outras abas não compartilham revisão. Consumidores que só usam `useSessionUser` (ex.: `ClassRouteGate`, `ciece`) recebem fail-closed em erro, mas não usam a revisão.
- Próximas fatias (não iniciadas): hidratação tardia do Diário (diary-cloud/roster/teaching, sync só no DiaryHeader, retorno ao laboratório durante loading); filtro de atuação própria; domingo no adaptador.

## B4.10.0b.1 — correção pontual da auditoria de 41c0bc9

- `INITIAL_SESSION` é ignorado pela origem da sessão: o SDK (`_emitInitialSession`) o emite com `null` também quando `_useSession` falha, então ele não confirma signed-out nem marca evento visto. A confirmação inicial vem só de `getSession()` bem-sucedido; erro/rejeição permanece `loading`+`error`. `SIGNED_IN`/`SIGNED_OUT` reais continuam vencendo bootstrap atrasado.
- `academic-projection-pages.tsx` passa `sessionRevision` a `useCloudCycleClosing` (nova sessão da mesma conta = novo contexto).
- Provas: 5 testes novos em `session-origin.test.tsx` (INITIAL_SESSION null + erro, + rejeição, + sucesso null, + SIGNED_IN real com bootstrap tardio, SIGNED_OUT real vs bootstrap com sessão; hooks reais + QueryClient real) e 1 em `academic-projection-session.test.tsx` (revisão 1→2 da mesma conta chega ao encerramento).
- Gates: 170 arquivos / 2659 testes, tsgo 0, build 0, diff --check 0.
- Limitação: se o SDK emitir sessão válida só por `INITIAL_SESSION` e `getSession` falhar depois, a tela fica fail-closed (loading+erro) em vez de signed-in. Próxima fatia (não iniciada): Diário.

## B4.10.0c — isolamento dos carregamentos do Diário por sessão

Sem SQL, migrations, RPC, políticas, capacidades, normas ou deploy. Diário funcional NÃO declarado concluído.

- `src/features/diary/diary-session.tsx` (novo): controlador único por aba + `DiarySessionBoundary` montado na rota `/diario` (antes de todo consumidor, inclusive a Pauta/entry field). Sessão incerta/erro de bootstrap ⇒ filhos não renderizam, modo `pendente` (sem fixtures, sem consultas); laboratório só com sessão confirmadamente ausente; conta ⇒ contexto `userId#sessionRevision` (chave, nunca filtro de banco).
- Lote staged: `readInstitutionalRoster` + `readInstitutionalTeaching(userId)` + `readDiaryFromCloud` (inclui `effective_capabilities.error`) são leituras puras que lançam em qualquer erro; aplicação só se a geração (`diary-session-state.ts`) ainda for a corrente. A→B, logout, nova sessão da mesma conta e desmontagem da última fronteira descartam respostas pendentes e esquecem meta/bases/capacidades. Montagens simultâneas compartilham um carregamento.
- Modo `cloud` só após aceitação; getters de estudantes/turmas/atuações/grade devolvem vazio em `pendente`; grade não é lida sem espelho aceito.
- Escritas (`*InCloud`) exigem `diaryWriteContext()` (espelho pronto) — sem ele, recusa sem RPC. Releitura pós-RPC só se o contexto que iniciou ainda for corrente (newest-wins); falha de releitura ⇒ erro visível e espelho esquecido. RPC aceito não é desfeito.
- Vínculo próprio `eq(user_id)` com detecção de ambiguidade (erro); atuações `eq(person_id)` + filtro defensivo; papel = `UNREGISTERED_PEDAGOGICAL_ROLE` (nunca "Responsável principal" inferido). Erros de class_at/turno/escolas/anos agora lançam (antes viravam "sem cadastro").
- Rascunhos: partições na memória da aba (`laboratorio`, `conta:<userId>`, null=incerto) em aula, chamada, experiência, versões e fechamento de frequência; laboratório guarda todo estado local, conta guarda só rascunhos. Escolha: partição por CONTA (mesma conta em nova sessão recupera seus rascunhos); nada persiste além da aba.
- Provas: `src/features/diary/diary-session.test.tsx` (13 testes, hooks reais + QueryClient + stores reais): bootstrap pendente/erro sem fixtures nem consulta; ausência confirmada ⇒ laboratório; A tardio após B; logout e desmontagem com A pendente; caps error sem hidratação parcial e sem RPC; mesma conta nova revisão; duas montagens; admin com vínculos/atuações alheias; vínculo ambíguo; pós-RPC com troca A→B; rascunhos isolados e preservados. Ajustados: b2-7 (vínculo via `eq/limit`), b3 (texto do gate).
- Gates: suíte completa 171 arquivos / 2672 testes passaram; tsgo 0; build 0; `git diff --check` 0.
- Limitações: espelhos continuam singletons globais (um contexto por vez); estado por aba; fora de `/diario` (ex.: regras avaliativas) não há fronteira — após sair do Diário o modo fica `pendente`; falha de qualquer fonte bloqueia o Diário inteiro (fail closed). Próxima fatia (não iniciada): datas históricas/knownAt do roster e atuações (hoje relógio do cliente) e domingo no adaptador da grade.

## Conferência independente Codex — 2026-10-04

- `04a713d`: diff revisado; testes locais de origem da sessão e consumidor de projeções: 2 arquivos / 21 testes passaram.
- `fea4a82`: testes locais reais da fronteira do Diário: 1 arquivo / 13 testes passaram; controlador, partições de rascunhos e releitura pós-RPC revisados; `git diff --check` sem erros. A suíte completa de 2672 testes, tipos e build são evidências reportadas pelo Lovable, não uma nova execução independente.
- Próximos pontos: data histórica/knownAt em estudantes e atuações, domingo no adaptador; auditar consumidores fora de `/diario`, onde o modo inicial ainda é laboratório e não há fronteira própria. Essa limitação impede afirmar isolamento de todos os consumidores do aplicativo.
- Nenhuma decisão institucional, política ou norma foi aprovada nesta conferência.

## B4.10.0c.1 — consumidores do Diário fora de /diario (base 5b96be6)

**Inventário** (fecho transitivo de imports das rotas não-/diario até roster, teaching, modo e stores do Diário):
- `/laboratorio/recuperacao`: ÚNICO consumidor em execução (instala regra/fechamentos/instrumento fictícios e navega ao Diário). Corrigido: `DiaryLaboratoryGate` (controlador compartilhado só com sessão confirmadamente ausente; conta ⇒ recusa sem hidratar; incerteza/erro ⇒ espera).
- `/regras-avaliativas*`: só a constante `DIARY_REFERENCE_DATE` via `academic-reference-date.ts`; sem leitura de modo/stores. Sem mudança.
- `/regras-de-situacao*`, `/ciece`, `/mapa-estatistico`: constante + funções puras (`attendanceAnalyticalFacts`, tipos); sem leitura de modo/stores. Sem mudança.
- Modo inicial passou a `pendente`; `src/test/setup.ts` estabelece laboratório explicitamente para testes de unidade.

**Provas:** `src/features/diary/diary-session-outside.test.tsx` (10): módulo novo pendente; entrada direta bootstrap/erro/conta/sem sessão; entrar/sair do Diário (laboratório e conta) com rascunho preservado; mesma conta nova revisão; duas fronteiras simultâneas.

**Limites:** fora de /diario o modo fica pendente sem fronteira; a lista do laboratório (cenários puros) continua visível para qualquer sessão; inventário é estático (imports dinâmicos novos exigem nova auditoria). Próxima fatia (não iniciada): datas históricas/knownAt e domingo.

## B4.10.0d — referência temporal explícita do Diário e domingo (base 59feef7)

**Feito:** chave do controlador `userId#revisão@data`; data da URL válida prevalece, senão hoje operacional capturado uma vez; data inválida ⇒ erro sem consulta. Um `knownAt` por lote, propagado a roster (episódios com validOn:null = histórico completo conhecido; situação na data de referência), atuações, `class_at`/`class_shift_at` e `class_schedule_at`; `applyInstitutionalTeaching(snapshot, knownAt)` não recaptura. Componentes por `curricular_component_versions` (valid_from ≤ data, created_at ≤ knownAt), ano por versões (valid_from/created_at), escola por versões com `registered_at ≤ knownAt`; atuações próprias com `created_at ≤ knownAt`, `engagement_endings` (ended_on, created_at ≤ knownAt; >1 ⇒ erro de ambiguidade), "Futura" quando valid_from > data. `diaryQueryDate`/`diaryToday` substituem o fallback para `DIARY_REFERENCE_DATE` com sessão (diaryContext, studentsForClassOn, foreignClassBlocks, jornada, parecer). Domingo: `WEEK_DAYS`/`WeekDayId` com `sun`, ISO 7 → sun, `weekdayOf` de domingo = "sun". Cabeçalho em modo pendente: "base institucional não carregada".

**Provas:** `src/features/diary/diary-reference.test.tsx` (8): data histórica ≠ relógio com um knownAt até a grade; hoje operacional; data inválida sem consultas; troca de data com resposta antiga atrasada; denominação futura/registrada depois excluída; atuação futura/encerrada/encerramento posterior ao knownAt; domingo real preservado e ausente não fabricado; laboratório legado. Ajustes: fixtures de atuação ganharam `created_at`; teste de grade aplica lote com knownAt; teste de dia da semana espera "sun".

**Fontes não bitemporais (limite declarado):** `institutional_persons.display_name`, `institutional_students` (nome/identificador), `institutional_curricular_components.label` (só usado sem versão válida), `institutional_classes` (identidade escola/ano), `institutional_school_identifiers`, `user_person_links` — nome/identidade correntes, não "conhecidos em". `curricular_components_at` não aceita knownAt e deixou de ser usado no Diário.

**Restante:** sem teste de tela do cabeçalho em modo pendente; enrollments com abertura futura ainda aparecem "Vigente" no formato legado; editor de grade mostra domingo só quando há jornada/bloco; telas fora do Diário (horários) seguem com `normalizeReferenceDate`.

## B4.10.0d.1 — correção pontual de precisão temporal

- Atuações: knownAt comparado em microssegundos (`instantMicros`); knownAt inválido falha sem consulta; registros com instante inválido excluídos.
- Lista de estudantes: matrícula considera `opened_on`; matrícula/vínculo/participação/alocação projetados na data por `temporalSituation` (fim futuro = vigente; fim exato = vigente no dia; abertura ausente declarada); várias alocações vigentes não elegem turma corrente; natureza institucional em `natureValueId` (sem cast); `dataOrigin: "institucional"` declarado no tipo.
- Provas: `src/features/diary/temporal-precision.test.ts` (7). Suíte 174 arquivos/2697 testes; tsgo/build/diff 0.
- Limites: telas demonstrativas (transferência, enturmação) só tratam "Vigente"/"Em andamento"; com dado institucional, Futura/Abertura não registrada ficam fora dessas ações (falha fechada). Natureza institucional aparece como "Natureza registrada pela instituição", sem rótulo homologado.

## Conferência independente Codex — continuação de 2026-10-04

- `59feef7`: inventário e porta do laboratório revisados; suíte completa local **172 arquivos / 2682 testes**, exit 0.
- `715c7af`: controlador temporal, argumentos dos readers, domingo e fontes revisados; 31 testes / 3 arquivos locais passaram, além da recusa de laboratório com conta executada isoladamente. A revisão encontrou truncamento de microssegundos e projeções de vigência incompletas, corrigidos na fatia seguinte.
- `e159560`: comparação por `instantMicros`, projeção temporal e ausência de alocação dominante revisadas; **38 testes / 4 arquivos locais passaram**; TypeScript local (`tsc --noEmit`) exit 0; `git diff --check` sem erros. `tsgo` não estava instalado no executor; nenhuma dependência foi instalada.
- Suíte completa mais recente (174 arquivos / 2697 testes) e build são resultados reportados pelo Lovable; a suíte completa local acima pertence a `59feef7`.
- Limites preservados: algumas identidades/nomes só têm valor corrente; o formato de participação do roster ainda adapta episódios de alocação ao contrato de exibição e não constitui cadastro completo independente de participações; horário fora do Diário ainda usa normalização legada; governança/permissões e calendário institucional continuam pendentes. Nenhuma norma, política ou homologação foi aprovada.

## B4.10.0e — contexto de sessão e consulta dos horários institucionais

- `/horarios` com conta: tela remontada por `userId#revisão`; caches b44/b45 de outro contexto removidos; sessão loading/erro sem laboratório nem consulta.
- Referência: `data` da URL válida > hoje operacional capturado uma vez; inválida/campo limpo bloqueia; seleção no campo atualiza a URL. Um knownAt por data até class_at (lista), jornada, grade, Meu horário e nomes.
- `readableClasses` com knownAt; erro/ambiguidade ⇒ falha da lista. `responsibleNames` filtra atuações por created_at ≤ knownAt (µs) e devolve erros como diagnóstico.
- Provas: `src/features/schedules/schedule-session.test.tsx` (10). Suíte 175 arquivos/2707 testes; vitest/tsgo/build/diff com exit 0 (capturados diretamente, sem pipe).
- Limites: identidade da turma (`institutional_classes`), nome da pessoa e vínculo não bitemporais; knownAt é relógio do cliente; laboratório (`normalizeReferenceDate` sob HorariosLayout) não alterado; QueryClient compartilhado por aba.

## Conferência independente Codex — B4.10.0e (2026-10-04)

- `2701473`: layout de horários, chaves de cache, contexto temporal e fontes de nomes revisados. **40 testes / 3 arquivos locais passaram** (schedule-session, person-schedule, class-schedule); `tsc --noEmit` exit 0; `git diff --check` sem erros.
- Suíte completa de 175 arquivos / 2707 testes, tipos `tsgo` e build: evidências reportadas pelo Lovable com códigos de saída diretos, não nova execução completa local.
- Ajuste textual após auditoria: falha de nomes não declara a grade válida; a mensagem informa que ela permanece exibida com seu estado preservado. Não mudou lógica nem normas.
- A normalização legada é restrita às telas demonstrativas bloqueadas pelo layout com sessão institucional; não é defeito institucional por si. Continuam pendentes a precisão histórica de identidades não versionadas, governança/permissões de escrita e o calendário institucional. Não houve aprovação de política ou norma, alteração de banco nem deploy.

## B4.10.0f — roster preservando participações independentes
- Entregue: adaptador puro `src/features/students/institutional-chain.ts`; roster usa os três readers B3 com validOn:null e knownAt único; diagnósticos viajam com a lista e são aceitos pelo controlador junto dela; consumidores (studentsForClassOn, allocationWindows, attendanceBlocker, cabeçalho) respeitam a cadeia.
- Provas: `src/features/students/institutional-chain.test.ts` (11) cobre adaptador, readers, studentsForClassOn e allocationWindows — NÃO chamava attendanceBlocker (correção B4.10.0f.1); fixtures de `temporal-precision.test.ts` passadas ao contrato real. Suíte 176/2718; tsgo/build/diff 0.
- Limites: ids institucionais de inscrição/participação/alocação passam a ser logical_id (versão em `versionId`); turma com diagnóstico bloqueia chamada inteira (fail-closed) até regularização; telas demonstrativas (transferência/enturmação) não consomem `validFrom` da participação; a sessão A→B continua provada pelos testes do controlador (B4.10.0c/d), não reexecutada neste arquivo; o Diário não é declarado funcional.

## B4.10.0f.1 — consumidores da cadeia (chamada e fechamento)
- `AttendanceClosingContext.rosterChainDiagnostics` entra pelo produtor canônico (página de fechamento, a partir do roster aceito); o motor filtra só turma do escopo × período (`scopeRosterChainIssues`) e gera pendência bloqueante `lista-de-estudantes-incompleta-na-fonte` (integridade da fonte, distinta de regra ausente). Entrega e fechamento recusados; `buildRecord` recusa também na retificação.
- Provas: `attendance-closing.test.ts` (+2: bloqueio de entrega/fechamento sem gravar fato; outra turma/fora do período não bloqueia); `roster-chain-session.test.tsx` (2, controlador real: A tardio não bloqueia B, diagnóstico aceito de B bloqueia só sua turma via attendanceBlocker real). Suíte 177/2722; tsgo/build/diff 0.
- Limites: diagnóstico sem datas bloqueia qualquer período da turma; fechamentos já gravados antes do diagnóstico não são revistos; consolidação de ciclo não recebe diagnóstico (lê fechamentos oficiais); telas fora do Diário não exibem diagnóstico.

## Conferência independente Codex — B4.10.0f/f.1 (2026-10-04)

- `414a09d`: adaptador, IDs lógicos, vigências próprias e interseções históricas revisados; **39 testes / 4 arquivos locais passaram**; TypeScript local exit 0. A auditoria encontrou prova ausente do bloqueador e falta de propagação dos diagnósticos ao fechamento; corrigidos em `8b450fe`.
- `8b450fe`: produtor do contexto, pendência de integridade e recusa de gravação/retificação revisados. **Suíte completa local: 177 arquivos / 2722 testes passaram**, exit 0; `tsc --noEmit` exit 0; `git diff --check` sem erros. Build passou segundo execução do Lovable com código de saída direto; não foi reexecutado localmente.
- A limitação anterior de participação criada por episódio foi corrigida: participação agora mantém logical_id, versão, natureza e intervalo próprios, inclusive sem alocação e com vários episódios. academicLinks é explicitamente agrupamento de apresentação.
- Limites remanescentes: diagnósticos sem intervalo confiável bloqueiam o período pertinente conservadoramente; fechamentos anteriores não são automaticamente revisados; consolidação lê fatos oficiais, não a nova fonte de diagnóstico; outras telas ainda demonstrativas não usam esta cadeia. Regras/permissões/calendário institucional continuam pendentes. Nenhuma aprovação institucional, mudança de banco ou deploy nesta conferência.

## B4.6.3a (2026-10-04)
Decisão: Supervisão Escolar constrói e aprova/publica o calendário. Motor puro `institutional-calendar-effects.ts` (8 testes). Integração institucional NÃO operacional: ver blockers em docs/b4-6-3a-calendario-motor-efeitos.md.
B4.6.3b: adaptador central + fechamento de frequência e horários mostram bloqueio real do calendário; uso positivo indisponível (D5/leitura).

### Verificação independente Codex — 2026-10-04

- HEAD Lovable `e99b23f`: Calendário, Diário e Horários passaram localmente (671 testes); `tsc --noEmit` e `git diff --check` passaram. Sem execução local de build ou suíte completa nesta entrega.
- Corrigido limite inclusivo do adaptador: 400 dias aceitos; 401 rejeitados antes de RPC. Datas duplicadas agora aparecem como fonte malformada também no resumo, sem mensagem vazia.
- Decisão expressa: Supervisão Escolar constrói e aprova/publica o calendário. Pergunta sobre consulta de calendário aprovado por todos os usuários autenticados permanece sem resposta; não presumir autorização.
- Uso institucional positivo ainda indisponível: faltam vínculo de aplicabilidade, leitores autorizados, writers e capabilities específicas efetivas. Motor puro não significa que feriados já alterem o funcionamento institucional. Integrações atuais em frequência/horários exibem bloqueios reais. Período/ciclo e demais consumidores ainda pendentes.

## B4.6.3c — calendário central no fechamento do período e no encerramento do ciclo
- Período: `ClosingContext.calendarRange` (com sessão) → pendência bloqueante `calendario-institucional-nao-resolvido` com motivo real; `calendarDependency` preservado como fallback; laboratório inalterado.
- Ciclo: motivo do `sourceAvailability` vem do adaptador sobre o intervalo dos períodos B2.4 do ciclo; sem requisito calendário na política, nada muda. A6 continua: sem fonte de ciclos ⇒ indisponível.
- knownAt = o do controlador do Diário; ausente ⇒ "instante inválido" (bloqueia). Sem calendarId inferido, sem RPC.
- Provas: period-closing.test.ts (+1), cycle-closing-session-boundary.test.tsx (+2). Limite: nenhum uso positivo; consolidação do ciclo, Diário/aula prevista, conselhos e documentos pendentes.

Verificação independente Codex: commit `e5d80e4`, 285 testes locais passaram; TypeScript e diff-check passaram. Mapa durável dos consumidores e limites em `docs/b4-6-3a-calendario-motor-efeitos.md`. Nenhum calendário institucional operacional positivo foi liberado.

## B4.6.3d — previsão do Diário e consolidação acadêmica

- Entrega Lovable `7dfe7db`: grade estrutural separada de aulas previstas; com sessão sem calendário aplicável, previsão indeterminada e total indisponível. Agenda mostra "Na grade"; registro do que ocorreu permanece possível. Consolidação distingue leitura indeterminada de não homologação e preserva contribuições dos fechamentos oficiais. Rota de consolidação institucional segue indisponível por A6.
- Codex acrescentou teste de bloco institucional presente e registro oficial correspondente preservado, preenchendo a lacuna de cobertura relatada pelo Lovable. Entrada sintética na fronteira do contexto; nenhuma escrita no banco.
- Verificação local: 100 arquivos / 1.487 testes passaram; teste focalizado atualizado passou (8 testes); TypeScript e diff-check passaram. Build e suíte completa não reexecutados.
- Mapa e pendências em `docs/b4-6-3a-calendario-motor-efeitos.md`. Uso positivo de feriados/recesso na rede continua indisponível; consulta, aplicabilidade e permissões efetivas pendentes. Não assumir autorização por "prossiga".
- B4.6.3e: chamada por data e agenda de conselhos cobertas (diagnóstico); pendentes: documentos, CIECE/mapa, vida escolar.

### Verificação independente B4.6.3e (Codex)

- Entrega Lovable `72135a3`: painéis informativos na chamada e na agenda de conselhos. Ausência de calendário/categoria não afirma zero eventos nem muda datas de sessões/atas.
- Prova adicional local com componentes reais e assinatura real de sessão: diagnóstico do contexto anterior retirado durante troca de conta; laboratório oculta os painéis institucionais.
- 42 arquivos / 520 testes locais passaram; `tsc --noEmit` e `git diff --check` passaram. Seleção local distinta da informada pelo Lovable (40/510). Sem build ou suíte completa nesta entrega.
- Restaurada menção histórica a rascunhos de chamada indevidamente removida por substituição global no registro de continuidade; avanço atual permanece em seção própria.
- Mapa em `docs/b4-6-3a-calendario-motor-efeitos.md` e `docs/b4-6-2b-auditoria-consumidores-calendario.md`. Operação positiva ainda bloqueada por leitura/aplicabilidade/categorias/writers/permissões; documentos/estatística/vida escolar pendentes.

## B4.6.3f (aditivo)
- Documentos do Diário com sessão não afirmam mais fonte demonstrativa como existente; aulas previstas citam o motivo real do calendário.
- Contrato puro `src/features/calendar/calendar-basis.ts` (base congelada, razão só com denominador determinado, datas de fato preservadas) com testes.
- CIECE, Mapa, vida escolar: sem dependência de calendário (inventário em `docs/b4-6-2b-auditoria-consumidores-calendario.md`).

### Revisão independente B4.6.3f — Codex

- Entrega Lovable `91ac147`: inventário dos consumidores restantes, correção de dependências demonstrativas em documentos com sessão e contrato puro de base temporal para futura emissão.
- Codex corrigiu a distinção fonte não verificada × inexistente, inclusive a frase de contagem da biblioteca. Bases agora preservam versões/homologação/declarações por dia, por cópias congeladas; intervalo incompleto, repetição de dias ou instante divergente não geram denominador calculável.
- Corrigida orientação que sugeria dias letivos como denominador universal de frequência. `ratioOverSchoolDays` é operação genérica por dias; a norma de frequência continua explícita e separada.
- Verificação local: 93 arquivos / 1.275 testes passaram, incluindo 8 testes focalizados da base; TypeScript e diff-check passaram. Sem reexecução da suíte completa ou build, sem escrita SQL/deploy.
- Mapa durável em `docs/b4-6-2b-auditoria-consumidores-calendario.md`. Emissão oficial e percentual de frequência do aluno fora do Diário não implementados; contratos novos não significam módulos operacionais.
- Fonte positiva segue bloqueada por consulta institucional ainda não definida, aplicabilidade D5, categorias e writers/permissões efetivas. Competência construir/aprovar/publicar permanece Supervisão Escolar. Não inferir resposta à pergunta pendente a partir de "prossiga".

### Verificação independente B4.6.4a — Codex

- Commit Lovable `ecc5c3e`: migration 0024 aplicada, writers de tipos e conteúdo transacionais; homologação recusa D5 ausente. Duas capacidades exatas de calendário somente na v2 draft (`108/119`, v1/v2 continuam draft). Não há poder efetivo concedido ou abertura de leitores.
- Codex reexecutou `supabase/tests/b4_6_4a_calendar_writers.sql` no Cloud. Resultado: `b464a-tests-ok: acl policy-draft deny day-types constitute atomic b24 succession-retification-immutable homologation-blocked-d5 reader-denied`. O `P0001` final é a reversão deliberada do teste, não falha de uma asserção.
- Consultas posteriores confirmaram zero calendários, tipos, homologações, pessoas/política/ano fictícios. Funções com `search_path` vazio; anon sem EXECUTE nos writers; helper privado também sem EXECUTE para authenticated. Tabelas permanecem com RLS e sem gravação direta para usuários.
- TypeScript e diff-check locais passaram. Sem reexecução de testes da aplicação ou build para este recorte exclusivamente SQL/tipos gerados.
- Advisor de segurança Supabase solicitado para o projeto: conector respondeu falta de permissão. Revisão independente de ACL/RLS e execução SQL feitas pelo conector Lovable; não afirmar que o advisor passou.
- Pendentes: aplicabilidade D5, competência de consulta ainda sem resposta, categorias, aprovação institucional da política e apresentação/editor institucional. Escritores disponíveis tecnicamente não significam calendário utilizável pela rede.

## B4.6.4a (aditivo) — preparação da escrita do calendário
- Migration `drizzle/migrations/0024_b4_6_4a_calendar_writers.sql` aplicada no Cloud (estrutura + writers + 2 regras draft).
- Regras: `construir-calendario-da-rede` e `homologar-calendario-da-rede` para `gestao-pedagogica-da-rede` `{network}`, SOMENTE na v2 draft. Contagens: v1 = 108 (intacta), v2 = 119 (era 117), ambas draft. Nenhum poder efetivo: `effective_scope_capabilities` só lê política homologada.
- Grava: tipo de dia (efeito true/false/NULL preservado), versão de calendário + períodos/intervalos/eventos/dias (atômico), sucessão/retificação com base esperada e motivo; versão anterior nunca reescrita. Gravar não homologa.
- Homologação: função com competência distinta; valida autorização (sem oráculo), base esperada e integridade do snapshot; depois RECUSA (`calendar-homologation:blocked-applicability-undeclared-d5`). Nada é gravado no ledger.
- Publicação formal (D6): não implementada, sem rito inventado. Leitura pública continua `access-denied`.
- Prova: `supabase/tests/b4_6_4a_calendar_writers.sql` (dados fictícios, política sintética homologada só dentro do teste, termina em RAISE ⇒ nada persiste); resultado `b464a-tests-ok`. Pós-teste: 0 calendários, 0 tipos, 0 homologações.
- Bloqueios: homologação real da v2 pela instituição; D5 aplicabilidade; competência de consulta (pergunta pendente); D6; categorias de tipo (conselho/férias/recesso).

## B4.6.4b (aditivo) — aplicabilidade explícita do calendário (estrutura D5)
- Migration `0025_b4_6_4b_calendar_applicability.sql` aplicada no Cloud; teste `supabase/tests/b4_6_4b_calendar_applicability.sql` → `b464b-tests-ok` (rollback; pós-teste 0 calendários/tipos/homologações/recortes; v1=108, v2=119 draft).
- Detalhes em `docs/b4-6-4b-calendario-aplicabilidade.md`. Calendário continua NÃO operacional.

## B4.6.4c (aditivo) — hardening da aplicabilidade
- `0026` aplicada: correção do UNKNOWN no resolver e recusa de contradição alocação×posição. Teste `b464b-tests-ok` com as novas asserções; rollback. Limitação registrada: vigência integral exigida das refs individuais não é regra institucional.

### Verificação independente B4.6.4b/c — Codex

- Entrega estrutural `8abee4b` (0025): recortes versionados com referências de escola, valor de eixo, alocação e posição curricular. Writer antigo sem EXECUTE para authenticated. Resolver privado mantém múltiplos candidatos e bloqueia seleção/composição sem norma.
- Codex repetiu o teste original com sucesso e acrescentou uma asserção de contexto todo ausente. Ela demonstrou **2 candidatos falsos**, revertendo integralmente a transação. Falha causada por UNKNOWN no predicado SQL, não por dados reais.
- Correção `27c90ed` (0026): predicado exige TRUE, e writer recusa alocação × posição contraditórias. Codex reexecutou o script atualizado: `b464b-tests-ok`, incluindo `missing-context-never-matches` e `contradiction-atomic`. Exceção final é a reversão deliberada.
- Consultas posteriores: 0 calendários/recortes/condições/homologações e 0 escolas/alunos/políticas de teste; v1/v2 continuam 108/119 draft. As três tabelas novas têm RLS e sem SELECT/INSERT direto para authenticated. TypeScript e diff-check locais passaram; sem reexecução de build/suíte da aplicação neste recorte SQL.
- Não foi dada competência de consulta; leitor público permanece negado. A seleção/composição ainda depende de norma homologada, não da simples existência dos recortes.
- Limitação material: referência individual precisa cobrir toda a vigência da versão nesta estrutura. Isso não autoriza impor frequência/alocação anual ao estudante; entrada tardia/remanejamento precisam de janelas próprias nos recortes, ainda não implementadas.

## B4.6.4d — janelas por recorte
- Migration 0027, teste `supabase/tests/b4_6_4d_calendar_applicability_windows.sql` (b464d-tests-ok, rollback, resíduo zero). Calendário continua não operacional: sem norma de seleção/composição homologada.

### Verificação independente Codex — 2026-10-04
- Código sincronizado em `dfc6c0f`; migrations 0023–0026 intactas.
- Reexecutei o script completo no Cloud: `b464d-tests-ok`; a exceção final intencional reverteu toda a transação.
- Consulta posterior confirmou zero calendários, versões, recortes, janelas, homologações e escolas/pessoas/estudantes/política sintéticos. Políticas reais: v1=108 e v2=119, ambas draft.
- Inspeção de ACL: tabela de janelas com RLS e sem SELECT/INSERT para authenticated; helpers privados; somente novo writer acessível a authenticated, com capability exata e search_path vazio. Writers anteriores continuam inacessíveis ao cliente.
- TypeScript local e diff-check passaram. Não executei suíte completa do app para esta alteração de SQL e tipos gerados.
- Limite concreto para próxima etapa: o resolver ainda não revalida referências após correções posteriores de alocação/posição. Endurecer essa validação respeitando validOn/knownAt antes de tornar a resolução operacional.
- Calendário institucional permanece bloqueado pela norma de seleção/composição inexistente, políticas draft e decisão pendente de consulta. Não houve aprovação institucional nem deployment.
