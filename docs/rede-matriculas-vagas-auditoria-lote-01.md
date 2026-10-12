# Organização da Rede, Matrículas e Vagas — Auditoria (Lote 01)

Situação atual: Registro de lote (2026-10-12). Matriz: `src/features/enrollments/network-enrollment-audit.ts`, conferida por `network-enrollment-audit.test.ts`.

## Fonte única (entidades canônicas)
Escola `institutional_schools` · Pessoa `institutional_persons` · Estudante `institutional_students` · Matrícula `school_enrollments` · Participação no ciclo `cycle_participations` · Enturmação `class_enrollment_episodes` · Turma `institutional_classes` · Capacidade `class_capacity_records` · Movimentação `student_movement_events` · Responsável `guardian_authorizations`.
O teste falha se qualquer migration criar tabela com nome de entidade duplicada (students, enrollments, turmas, vagas, class_allocations…).

## Resumo
| | existente | parcial | lacuna | bloqueado |
|---|---|---|---|---|
| 42 seções | 25 | 13 | 2 | 2 |
| 20 critérios | 14 | 3 | 1 | 2 |

## Lacunas e bloqueios
1. Demanda/fila de espera e reserva de vaga inexistentes; dependem do critério municipal de prioridade (não fornecido).
2. Zoneamento escola×território sem regra homologada.
3. Perfil de central de matrículas da rede sem política de capacidades.
4. Protocolo de rede para pedido de vaga ausente.
5. Homologação humana dos fluxos (seção 42, critério 20).

## Evidência
`bunx vitest run src/features/enrollments src/test/invariants` → 162 aprovados; checagem de tipos sem erros. Títulos das seções agrupados por tema: conferir a numeração com o documento original.
