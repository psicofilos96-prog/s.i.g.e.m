# Docente / Diário — produto

| Requisito | Estado |
|---|---|
| A Meu Diário | Existente + correções N10 |
| B Chamada | Existente (6D.1.3) |
| C Registro da aula | Existente, versionado |
| D Notas | Existente (Pauta) |
| E EI autosave | Ligado à tela de experiência (memória da aba); recuperação após recarregar PENDENTE |
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

- N5.3.2: composição da turma lida de `class_composition_at`; subtotais pela posição individual (B3.3), total = estudantes únicos; sem posição = "Posição curricular não registrada".

## N10.2.1 (parcial)
- Agenda: `teacher-agenda.ts` (próxima aula, conflitos factuais por sobreposição) sobre blocos da grade publicada; puro + teste. PENDENTE: ligar ao Meu Diário.
- PENDENTE técnico: autosave EI nas telas reais, SIPE docente, SIA, regressão mobile 390×844/tablet, PEI/PAEE no contexto do docente (depende de N8.2.1).

## N10.2.3 — PARTIAL (2026-10-07)

| Item | Estado |
|---|---|
| 1 Autosave EI | LIGADO na tela "Registrar experiência" (habilidades/objetivos, campos, observação coletiva e individuais): `useAutosave` (debounce 800 ms, cada salvamento = nova versão do rascunho, aviso "Salvando/Rascunho salvo/Não foi possível", botão "Tentar salvar de novo", flush ao navegar e ao desmontar; só pergunta ao sair se o salvamento falhou). Testes: use-autosave.test.tsx (2) + infant-experiences (19). LIMITE: rascunho vive na memória da aba (não há tabela de rascunho no servidor); recuperação após fechar/recarregar = PENDENTE (exige tabela de rascunho por autor com RLS). Fases da escrita: não há tela no sistema → AUSENTE. |
| 2 SIPE | PENDENTE técnico: fluxo decidido (rascunho→enviado→OP aprova/ajuste→reenviado) exige migration de eventos de submissão sobre o plano (Frente Z não tem aprovação) + fila da OP + comentários + impressão. Não iniciado neste lote. |
| 3 SIA | PENDENTE técnico: instrumentos (0079) existem; faltam envio à OP, aprovação/ajuste e ligação aplicar→corrigir. |
| 4 Documentos pedagógicos no contexto docente | PENDENTE (depende de N8.2.1). |
| 5 Meu Diário | agenda/próxima aula/chamada/registro já conectados (N10.2.1); multisseriada sem revisão nova. |
| 6 Mobile 390×844/tablet | INTERACTIVE_BROWSER_VALIDATION_PENDING. |
| 7 Professor relacionado/não relacionado | INTERACTIVE_BROWSER_VALIDATION_PENDING (harness). |
