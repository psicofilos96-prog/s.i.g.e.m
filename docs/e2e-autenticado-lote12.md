# E2E autenticado — Lote corretivo 12 (P1-04)

Situação atual: Registro de lote (2026-10-12).

Roteiro: `scripts/lote12-authenticated-e2e.mjs` (porta `scripts/harness-gate.mjs`, camada declarada).
Camada provada: **authenticated-layer** — JWT real de contas sintéticas `@bo-fixture.invalid` contra RLS/capabilities; sem navegador (login interativo indisponível).
Resultado da execução: **29/29 PASS**, limpeza com 0 resíduos e usuários Auth apagados.

Cobertura: duas escolas (secretaria A × B), direção, servidor sem vínculo, conta sem pessoa, família (portal público anônimo), isolamento RLS de matrículas, IDOR de turma, upload no acervo sem reserva (anon/secretaria/sem vínculo), reserva negada, inscrição em campanha inexistente, vaga de documento sem pedido, chamado de Tecnologia (outra escola, sem vínculo, anônimo, própria escola conforme política), autoconcessão de papel, edição de política homologada, emissão de relatório anônima.

Não provado: caminho positivo (upload aceito, inscrição registrada, chamado aberto, matrícula concluída), porque não há campanha publicada com política aprovada nem `solicitar-tecnologia` atribuída na política vigente — o teste não fabrica aprovação. Família com conta autenticada não existe como identidade técnica do harness. Sem prova em navegador.

## Lote 16 — concorrência (`scripts/lote16-concurrency-e2e.mjs`)
12 chamadas paralelas reais com JWT sintético a `allocate_document_number` e `enr_seat_reserve_v2`. Provado: recusas paralelas não gravam nada. BLOQUEADO (não PASS): sequência única e teto de reservas sob concorrência, porque o banco não tem regra de numeração aprovada nem quadro de vagas com distribuição publicada; o teste nunca cria essas pré-condições.
