# Docente / Diário — produto

| Requisito | Estado |
|---|---|
| A Meu Diário | Existente + correções N10 |
| B Chamada | Existente (6D.1.3) |
| C Registro da aula | Existente, versionado |
| D Notas | Existente (Pauta) |
| E EI autosave | Pendente de verificação |
| F SIPE envio OP | DECISÃO PENDENTE: plano não tem aprovação (Frente Z) |
| G SIA | Parcial |
| H Horários | Existente (B4.4 + próxima aula na agenda) |
| I PEI/PAEE | Depende do N8 |
| K Testes autenticados | Bloqueado: sessão indisponível |

## N10.2 — PARTIAL (CONTINUE_FROM=N10.2.1)
| Item | Situação |
|---|---|
| 1 Autosave EI | Controlador genérico `src/features/autosave/autosave-controller.ts` (debounce, salvando/salvo/erro, retry crescente, flush ao sair, edição durante salvamento preservada) — testado; ainda NÃO ligado às telas de habilidades/fases da escrita/observações nem à persistência versionada |
| 2 SIPE | PENDENTE (fluxo decidido: rascunho → enviado → OP aprova/ajuste → reenviado) |
| 3 SIA | PENDENTE |
| 4 Horários | existentes (grade por turma/profissional); próxima aula/integração Meu Diário PENDENTES |
| 5 Mobile | não testado em viewport neste lote |
| 6 Documentos pedagógicos | depende de N8.2.1 |
