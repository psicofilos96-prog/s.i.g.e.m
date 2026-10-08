# N7.2.5 — Auditoria final de OP e Direção

**Situação atual:** Registro de lote (2026-10-08).

| Área | Situação | Evidência |
|---|---|---|
| Dossiê da Direção | OK — PDF A4 sai da mesma projeção da tela; fonte negada = "não disponível", nunca zero | `management-panel.ts` (`buildPanel`, `dossierPrintHtml`); PDF de teste `n725-pdfs/` |
| Fiscalização do Diário (OP) | OK — só leitura; sem grade nada é faltante; tabelas com legenda | `diary-oversight/`, `/acompanhamento-diarios` |
| SIPE (plano) e SIA (prova) | OK — um único ledger `teacher_work_review_events`; o banco decide, autor não aprova o próprio | `teacher-review/` |
| Conselho / ata | OK — ata encerrada imutável, correção por nova versão | `collegial/`, `/diario/turmas/$turmaId/avaliacao/conselho` |
| Relatórios | OK — `situacao-operacional-escola` pelo motor comum, declarado não oficial | `report-registry.ts` |
| Isolamento por escola | OK — harness com login: OP e Direção só veem a própria escola; outra escola por endereço recusada; sem autoconcessão | `institutional-harness` (99 PASS, 0 resíduos) |
| Integração com Docente | OK — OP/Direção nunca gravam nota/frequência; revisão de plano/prova pelo painel único | `school-followup/AGENTS.md`, `review-panel.tsx` |
| Celular/headless | OK — sem rolagem lateral em `/orientacao`, `/direcao`, `/gestao-escolar` | `n725-screenshots/` |

Correção técnica: sem login, `/orientacao` e `/direcao` tinham dois títulos principais (o oculto da rota + o da tela). Agora só o da tela (`laboratoryHasHeading`). Regressão: `src/features/school-management/op-direcao-n725.test.ts`.

Pendências: INTERACTIVE_BROWSER_VALIDATION_PENDING (conteúdo com login real da OP/Direção); REVISAR (`/alunos` sem título principal com login da Secretaria — já registrado, fora deste lote; data "Gerado em" do motor de relatórios em formato técnico, comum a todos os PDFs do motor).
