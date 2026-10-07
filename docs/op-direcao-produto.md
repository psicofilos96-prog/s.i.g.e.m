# OP e Direção — produto

| Requisito | Estado | Teste |
|---|---|---|
| A/C Home "o que depende de você" | Parcial: pendências agrupadas e ações distintas | vitest school-followup |
| B Ocorrências dossiê | Pendente | — |
| D Diário fiscalização | N7.2: projeção pura somente leitura (`src/features/diary-oversight/`): aula/chamada registrada × em elaboração × não registrada a partir da grade canônica; sem grade nada é faltante; tela e leitura real PENDENTES | diary-oversight (2) |
| E SIPE fila OP | Pendente | — |
| F SIA | Pendente | — |
| G Conselho/Reclassificação | Existente (link por turma) | — |
| H Busca Ativa | DECISÃO PENDENTE: autoridade Secretaria × OP | — |
| K Testes autenticados | Bloqueado: sessão indisponível | — |

## N7.2 — PARTIAL (CONTINUE_FROM=N7.2.1)
Entregue só o núcleo da fiscalização do Diário. Dossiê da Direção, SIPE, SIA, Conselho, relatórios e testes autenticados pendentes. Busca Ativa segue com autoridade configurável (decisão pendente).

## N7.2.1 (parcial)
- Fiscalização do Diário: filtros puros (turma, professor, período) + rótulos sobre a projeção existente, com teste. PENDENTE: ligar à grade (`class_schedule_at`) e aos registros reais na tela da OP.
- PENDENTE técnico: Dossiê da Direção, SIPE ponta a ponta, SIA, Conselho/ata, relatórios.
- Busca ativa: transição final DEPENDE_DECISAO. Browser: INTERACTIVE_BROWSER_VALIDATION_PENDING.
