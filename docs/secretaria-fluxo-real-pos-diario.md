# Secretaria Escolar — fluxo real pós-Diário (2026-10-05)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Registro de continuidade, não fonte normativa.

## Auditoria (cadeia B3 na Cloud)
| Operação | Escritor / leitor canônico | Estado |
|---|---|---|
| Matrícula e rematrícula (mesma entidade) | `constitute_cycle_enrollment` / `cycle_enrollments_at` | REAL |
| Encerramento da inscrição | `record_cycle_enrollment_ending` (situação do vínculo = catálogo homologado) | REAL |
| Participação educacional | `declare_cycle_participation` / `cycle_participations_at` | REAL |
| Alocação / desalocação | `record_class_allocation`, `record_class_allocation_ending` / `class_allocations_at` | REAL |
| Posição curricular individual | `record_allocation_curricular_position` (B3.3) | REAL |
| Capacidade | `record_class_capacity` / `class_capacity_at`; ocupação = alocações vigentes | REAL |
| Movimentação (entrada, saída, transferência…) | `record_student_movement` / `student_movements_known`; tipos só de `movement_types_at` | REAL; **taxonomia sem valores** (nenhum tipo semeado) |
| Movimentação atômica entre turmas | — | AUSENTE por norma: falta política temporal homologada do fim da origem |

Todos os escritores: SECURITY DEFINER `search_path=''`, sessão + capacidade por escola, base esperada (concorrência otimista), motivo nas retificações, append-only.

## Entregue nesta rodada
- `secretary-operations.ts` (puro): disponibilidade derivada (sem capacidade ⇒ desconhecida, nunca zero; excesso só factual), situação projetada na data, busca por estudante/turma/ano/situação, trajetória cronológica (sem data inventada).
- `recordStudentMovement` + mensagens humanas para conflito/stale/sessão/data.
- Tela oficial (`/matriculas/nova`, `/enturmacoes/*`, `/transferencias/nova` com sessão): "Conhecido até" (knownAt), busca + trajetória, vagas derivadas, lista/registro/retificação de movimentações.
- Testes: `secretary-operations.test.ts`; SQL `supabase/tests/secretaria_b3_operacional.sql` (DML direto fechado, anon sem EXECUTE, reader falha fechado, zero resíduo) — passou.

## Limites de verificação
`b3_1/b3_2/b3_3` (duplicidade, concorrência, alocação incompatível, retificação, capacidade/escopo) precisam montar política de teste com papel privilegiado; desde 0057 o ambiente de verificação não tem esse papel, então não foram reexecutados.

## Pendente (decisão do proprietário)
1. Valores do catálogo de tipos de movimentação (entrada, saída, transferência, abandono, cancelamento…).
2. Valores homologados de natureza da participação e situação do vínculo.
3. Política temporal da movimentação atômica entre turmas.
4. Definição de qual eixo representa a oferta educacional na matrícula.
