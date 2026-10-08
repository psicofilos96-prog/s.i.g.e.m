# Trajetória do profissional — NPROF.1

Situação atual: Registro de lote (2026-10-08).

## Corrigido
- **Quadro do DP por escola** (`functional-life.ts` + `functional-life-page.tsx`): atuação encerrada por ato próprio (`engagement_endings`) continuava aparecendo como vigente. Agora o encerramento conhecido até knownAt com fim até a data retira a atuação; antes da data ela continua visível. Se os encerramentos não puderem ser lidos, a tela diz "situação da atuação não confirmada", nunca "vigente".

## Conferido sem mudança (banco)
- Candidatos a atribuição (`secretariat_teaching_candidates`): atuação, vínculo e lotação vigentes na data, encerramentos considerados.
- Atribuição docente (`teaching_staff_fit`): exige atuação, vínculo e lotação na escola durante todo o período.
- Diário (`diary_holder_scope`), horários e "Meu horário": só pela atribuição/substituição vigente na data (`teaching_assignments_at`/`teaching_substitutions_at`).
- Comunicação à turma: atribuição vigente hoje, versão não substituída.
- Busca de servidor: igualdade exata; não exibe lotação.
- `teaches_class` aceita atribuição passada, mas só serve para o professor ler as próprias atribuições (histórico próprio), não para operar — mantido.

## Fora do lote
- Nenhuma lotação oficial importada.
- Teste com contas reais em várias escolas: INTERACTIVE_BROWSER_VALIDATION_PENDING (chave técnica indisponível).

Teste: `src/features/professionals/nprof1-trajectory.test.ts`.
