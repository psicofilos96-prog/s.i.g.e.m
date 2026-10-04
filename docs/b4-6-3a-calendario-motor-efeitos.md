# B4.6.3a — Calendário operacional: decisão de competência + motor de efeitos

Status: **motor e contrato prontos e testados; integração INSTITUCIONAL NÃO operacional.**

## Decisão do usuário (2026-10-04)
- O calendário anual personalizado deve ser fonte operacional real: feriados, férias, recesso,
  conselhos etc. repercutem em todos os consumidores pertinentes de datas.
- **Construir e aprovar/publicar o calendário da rede: Supervisão Escolar.**
- Isso NÃO aprova as políticas de capacidades v1/v2 (continuam `draft`) nem concede nada a usuários.

## Auditoria read-only (2026-10-04)
- 0 calendários, 0 versões, 0 tipos, 0 homologações; 0 regras de capacidade de calendário; todas as políticas `draft`.
- `calendar_at`/`calendar_day_at` devolvem só `access-denied`; `calendar_day_declarations` é privado.
- O esquema 0023 não tem aplicabilidade a escola/oferta (D5) nem marcação de categoria (conselho, férias, recesso) além de `school_day_effect`.

## Entregue
`src/features/calendar/institutional-calendar-effects.ts` — motor central puro:
- `resolveCalendarDay`: estados próprios (acesso negado, fonte indisponível/malformada, sem versão,
  B2.4 inválida, não homologado, revogado, aplicabilidade não declarada, não aplicável, não declarado,
  efeito não declarado, conflito, letivo, não letivo). Efeito só de `school_day_effect` (NULL ≠ false).
- `countSchoolDays`: número só com todos os dias determinados; senão `null` + pendências.
- `projectPlannedLessons`: grade recorrente × datas; não letivo ⇒ sem aula e sem ausência; domingo/sábado sem presunção.
- `councilAgenda`: só tipos configurados como conselho (por ID); informativa.
- `calendarImpact`: sinaliza datas alteradas e preserva registros existentes.
Provas: `institutional-calendar-effects.test.ts` (8).

## Blockers exatos para virar operacional
1. Capacidades `construir-calendario-da-rede` e `homologar-calendario-da-rede` (Supervisão) precisam entrar numa política e ela ser **homologada** pela instituição.
2. Writer transacional (versão + filhos + homologação) exigindo essas capacidades.
3. Decisão de leitura (quem consulta homologado; rascunho só Supervisão) e substituição de `access-denied` por leitura real.
4. D5: aplicabilidade escola/oferta/alocação no esquema.
5. Declaração de categoria por tipo (conselho, férias/recesso com escopo) — hoje só configurável por ID no consumidor.
6. Produtores: Diário (aulas previstas), frequência, fechamento e horários ainda não consomem o motor.

## B4.6.3b — integração nos consumidores (bloqueios reais; uso positivo indisponível)
- Adaptador central `institutional-calendar-days.ts`: `readCalendarDayAt` → `DayResolution` (`access-denied` ⇒ `acesso-negado`; erro ⇒ `fonte-indisponivel`; forma/positivo inesperado ⇒ `fonte-malformada`); intervalo ≤ 400 dias, UM knownAt; sem calendarId aplicável ⇒ `aplicabilidade-nao-declarada` **sem RPC** (nenhum ID inferido); hook com chave `contextKey` (userId#revisão).
- Consumidores: fechamento de frequência com sessão recebe `calendarRange` e mostra pendência bloqueante `calendario-institucional-nao-resolvido` com o motivo real (prevalece sobre o texto genérico); "Unidades previstas" explica por quê. Horários institucionais mostram o estado do calendário na data e avisam que a grade não indica aula prevista. Laboratório continua sem entrar na sessão.
- Motor endurecido: data/knownAt validados (`snapshot-invalido`), efeito fora de boolean|null e versão nula ⇒ `fonte-malformada`, datas duplicadas ⇒ contagem/previstas null, impacto compara declarações e datas removidas.
- Hoje TODOS os consumidores com sessão resolvem `aplicabilidade-nao-declarada`, porque não existe vínculo turma/escola/oferta → calendário (D5). Aplicabilidade "declarada" cobre só escola; oferta/alocação não existem.
- Leitura (quem consulta) aguarda resposta do usuário. Período de fechamento (`period-closing`) e consolidação do ciclo ainda usam só `calendarDependency`.
- Provas: `institutional-calendar-days.test.tsx` (9), `attendance-closing.test.ts` (+1), `schedule-session.test.tsx` (asserção de aviso e zero RPC de calendário).

## B4.6.3c — mapa de integração e verificação independente

Decisão e objetivo continuam: Supervisão Escolar constrói e aprova/publica; calendário anual deve produzir efeitos nos módulos pertinentes. Esta entrega ainda não habilita o uso institucional positivo.

| Consumidor | Estado verificado |
| --- | --- |
| Fechamento de frequência | Diagnóstico central do intervalo; ausência de calendário não gera zero |
| Horários por data | Diagnóstico central; grade recorrente não prova aula prevista na data |
| Fechamento de período | Resumo central no contexto; pendência de resolução substitui a mensagem genérica; período continua B2.4 |
| Encerramento de ciclo | Motivo central em `sourceAvailability`; só interfere quando a política exige essa fonte |
| Diário e aulas previstas | Resolução central: grade estrutural separada de previsão; sem calendário, agenda mostra "Na grade" e totais previstos são indisponíveis |
| Consolidação acadêmica do ciclo | Diagnóstico central no contrato; contribuições dos fechamentos preservadas. Rota institucional segue indisponível pela falta de definição de ciclos (A6) |
| Chamada por data | Painel informativo sobre a data registrada; não gera marcações nem bloqueio novo |
| Agenda de conselhos | Painel institucional integrado; sem categoria/aplicabilidade fica indisponível, sem afirmar zero eventos |
| Documentos, relatórios, estatística e histórico de frequência | Inventário detalhado e integração pendentes |

- Ciclos institucionais sem definição continuam indisponíveis, sem substituição por ciclo anual demonstrativo.
- Intervalos usam o `knownAt` do controlador do Diário; ausência do instante é inválida, sem captura de um instante divergente para preencher a lacuna.
- Sem vínculo de aplicabilidade declarado não se escolhe calendário nem se dispara RPC por ID inferido.
- Verificação local Codex no commit `e5d80e4`: 285 testes passaram (Calendário, domínio de fechamento de período e módulo de encerramento do ciclo), `tsc --noEmit` e `git diff --check` passaram. Lovable informou 334 testes em sua seleção; não confundir com a seleção local. Build e suíte completa não reexecutados nesta entrega.
- A pergunta sobre leitura do calendário aprovado por usuários autenticados permanece sem resposta. Este registro não concede acesso nem homologa políticas.

## B4.6.3d — Diário e consolidação acadêmica

- `scheduleBlocksFor` representa grade estrutural; `plannedLessonsResolution` representa previsão resolvida pelo calendário. `plannedLessonsFor` é projeção dessa resolução, não fonte normativa independente.
- Com sessão ou contexto pendente, sem aplicabilidade de calendário a previsão é indeterminada; não se conta zero nem se gera falta. A agenda identifica blocos como "Na grade", e o registro do que ocorreu permanece possível.
- Registro e experiência infantil selecionam horários estruturais sem afirmar que são aulas previstas. Laboratório confirmado mantém comportamento demonstrativo.
- Consolidação recebe `calendarRange` explícito: leitura indeterminada produz `calendario-institucional-nao-resolvido`, preservando contribuições e versões dos fechamentos oficiais. Sem fonte de definição de ciclos, a rota continua indisponível e não seleciona ciclo anual substituto.
- Prova adicional local: contexto institucional sintético com bloco presente mantém o bloco estrutural, não o apresenta como previsto e preserva o registro oficial correspondente. Não há seed ou escrita no banco nesse teste.
- Pendentes para efeitos positivos reais: aplicabilidade institucional, leitores autorizados, writers e permissões efetivas. Documentos, estatística e vida escolar ainda precisam de integração específica.

## B4.6.3e — chamada e agenda de conselhos

- `institutional-calendar-consumers.ts` compõe os estados do adaptador central e `councilAgenda`; os painéis nas telas de chamada/colegiados acompanham o estado compartilhado do Diário.
- Chamada: situação do calendário é informativa; nenhuma presença/falta ou impedimento adicional é produzido. Aula/frequência continuam fatos próprios.
- Conselho: eventos se identificam por tipos declarados, sem interpretação de nome, sigla ou símbolo. Categoria não configurada e fonte ausente são motivos de indisponibilidade; sessões, pautas e atas mantêm suas datas próprias.
- Verificação adicional em componentes reais: na troca de contexto pronto → carregando, o diagnóstico anterior é retirado; no laboratório, painéis institucionais desaparecem. O teste usa a assinatura real de `useDiarySession`, sem simular o hook.
- Esta entrega ainda não libera consulta positiva nem gravação do calendário institucional.
