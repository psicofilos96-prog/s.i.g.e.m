# Matriz de aceite — Direção Escolar (Lote 12)

**Situação atual:** Registro de lote.

Evidência em 2026-10-11 22:08 UTC, commit local `12c6bbf6` (sincronização com GitHub é automática pela plataforma; nenhum push manual, nenhum force push). Suíte completa: 653 arquivos, 5.700 aprovados, 7 pulados, 0 falhas. Direção (lotes 03–11): 57/57. Lotes 01–02: 59 + 24. Typecheck limpo após corrigir uma falha real (tipos opcionais em `demand-center.ts` e `management-plan.ts`, só detectada pelo typecheck completo).

**Especificação de 30 seções:** não encontrada nos uploads. Os arquivos existentes (SIGEM-especificacao-mestra-para-IA §6.14, sigem-especificacao-detalhada-por-setor §6, sigem-op-direcao-pedidos-e-decisoes — arquivos enviados, fora do repositório) foram a base. A matriz abaixo é por lote, não por seção; o mapeamento às 30 seções depende do documento.

**Testes autenticados:** não executados. A chave de serviço existe neste ambiente, mas o portão `scripts/harness-gate.mjs` exige `SIGEM_TEST_HARNESS=1` (ausente) e, principalmente, os núcleos dos lotes 03–11 não estão ligados a tabela, função ou tela — um teste autenticado não teria o que provar. Contas diretor A/B, adjunto com/sem delegação, secretaria e setor central não foram criadas.

**Migrations/rollback/RLS:** nenhuma migration nos lotes de Direção; nenhuma RLS alterada.

| Lote | Núcleo | Implementado | Testado | Bloqueado | Evidência |
|---|---|---|---|---|---|
| 01 Perfis e acesso | `school-leadership/leadership-access.ts` | núcleo | 59 (cross-school, revogação, adjunto sem exclusivos, sensível) | ligação às designações reais do DP; contas de teste | teste unitário |
| 02 Painel e Minha Escola | `school-management/school-dashboard.ts` | núcleo | 24 (não registrado ≠ zero, fórmula/fonte, ficha INEP) | telas; dados reais | teste unitário |
| 03 Estudantes/turmas/vagas | `students-classes.ts` | núcleo | 4 | regra de distorção; nomes de capacidade de turno/enturmação/docente a confirmar; persistência das solicitações | teste unitário |
| 04 Frequência/busca ativa | `attendance-permanence.ts` | núcleo | 4 (vigências distintas) | limiar homologado; processo municipal de busca ativa | teste unitário |
| 05 Pessoal/horários | `staff-schedule.ts` | núcleo | 4 | capacidade do DP para cobertura (`manter-vida-funcional` não existe) | teste unitário |
| 06 Calendário/pedagogia | `calendar-pedagogy.ts` | núcleo | 4 | persistência de reposição/agenda/providência | teste unitário |
| 07 NEI/alimentação/infra/patrimônio | `operations-overview.ts` | núcleo | 4 | SLA homologado; ligação aos readers | teste unitário |
| 08 Demandas/comunicação | `demand-center.ts` | núcleo | 3 (fluxo completo com devolução) | persistência; e-mail/SMS sem provedor | teste unitário |
| 09 Plano/PPP/agenda/documentos | `management-plan.ts` | núcleo | 4 | competência de aprovação por tipo; rito do PPP | teste unitário |
| 10 Relatórios/indicadores | `leadership-reports.ts` | núcleo | 3 | regras de abandono e distorção; ligação ao report-engine | teste unitário |
| 11 Operação diária | `daily-operation.ts` | núcleo | 3 (5 tarefas em sequência) | telas | teste unitário |

**Homologação institucional humana:** nenhuma. Nada aqui foi validado por pessoa da rede.

**Próximo passo que destrava o aceite real:** migrations para demandas, solicitações, agenda, providências e documentos (ledgers append-only com writers DEFINER), depois telas, depois E2E autenticado com contas sintéticas pelo `harness-gate`.
