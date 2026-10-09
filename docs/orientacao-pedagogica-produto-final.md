# Orientação Pedagógica — produto final (NOP.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — PEDAGOGICAL_GUIDANCE_FULLY_OPERATIONAL.

## Estado do banco (conferido)
Atuações vigentes: só 2 (Administrador Geral e autoridade do calendário) — nenhuma OP, Direção ou professor. Grade publicada 0 (class_schedule_versions/blocks) · planos 0 · sessões de Conselho 0 · registros de acompanhamento 0. Enturmações 2026 = 10.295.

## Áreas × situação
| Área | Existente | Bloqueio |
|---|---|---|
| Home/fila, acompanhamentos, intervenções, encaminhamentos | `school-followup` (abas Revisar/Acompanhar/Decidir/Histórico), `record_school_pedagogical_record_v2` | sem atuação OP; catálogos de categoria/situação sem valores homologados |
| Agenda | prazos só se registrados | idem |
| Estudantes / ficha longitudinal | `student_trajectory_at` | sem atuação OP |
| Fiscalização do Diário | `diary-oversight` (todas as turmas com grade, sem ranking) | 0 grade publicada ⇒ nada previsto; turma sem grade não aparece como faltante (regra) |
| SIPE/SIA | planejamento Frente Z | 0 planos; revisão OP sem regra de aprovação |
| Conselho (presentes, sem quórum) | módulo colegiado | 0 sessões; Conselho sem período da sessão (pendência BQ.5) |
| Aprovação do Diário / fechamento OP + Direção | `approve_teacher_diary`, `record_period_closing_act` | regra BQ.5 sem homologação; sem atuações |
| Relatórios | pacotes OP bloqueados (REPORT.PRO.2) | sem dados |
| Busca Ativa | Frente S | só o institucionalmente definido |

## Regras preservadas
OP não corrige Diário/nota; nenhuma reclassificação automática; fechamento só OP + Direção.

## Decisões necessárias
1. Quem é a OP de cada escola (pessoa natural com identificador forte) — mesma situação da Direção (DIRECTION_PERSON_MATCH_PENDING).
2. Publicação da grade 2026/2027 e atribuição docente.
3. Homologar a regra BQ.5 pelo fluxo rascunho → homologação.
4. Testes autenticados em 2 escolas — ambiente sem login.
