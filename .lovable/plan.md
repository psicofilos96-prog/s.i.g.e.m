# Frente S — Ciclo operacional 2027, virada, matrícula e lotação

Escopo grande demais para uma execução única segura. Dividido em 5 fatias sequenciais; cada uma fecha com suíte, tsgo, build, migration integrity, audit SQL, Advisor (se DDL) e prova SQL com rollback. Autonomia técnica mantida entre fatias.

## Fatia S0 — Auditoria e documentação temporal
- Confirmar HEAD/checks do gate A–R; inventariar Person, StudentRole, school_enrollments, cycle_enrollment/participation/allocation, movements, professional_postings, calendário 2027.
- Corrigir docs que tratam 2026 como ano operacional; remover "Calendário 2026" como bloqueador do roadmap.
- Gerar `docs/baseline-2026-vs-operacao-2027.md`.

## Fatia S1 — Estado do ano operacional (migration 0111)
- Ledger append-only `academic_year_operational_states` (historico-importado / em-preparacao / operacional / encerrado), writer `record_academic_year_operational_state` com capability de rede, base esperada e transições permitidas por dado.
- 2026 marcado historico-importado pela camada técnica (proveniência técnica, sem autoria humana); 2027 "em preparação" só por ato humano.
- Reader `academic_year_operational_state_at`; vínculo do ano 2027 aos calendários 2027 existentes (sem copiar nem reimportar).

## Fatia S2 — Transição de alunos por escola (migration 0112)
- Candidatos = projeção dos vínculos 2026 observados (nada copiado).
- Ledger `year_transition_decisions` (renovou / transferido-saida / nao-renovou; pendente = ausência de decisão), writer com capability escolar e data declarada opcional (início desconhecido permitido).
- "Renovou" chama o writer B3 existente de matrícula/inscrição 2027, reutilizando Person/StudentRole.
- Tela "Preparar ano letivo 2027" com progresso por escola só de fatos.

## Fatia S3 — Busca ativa exata + turmas 2027 + transferência (migration 0113)
- `locate_student_exact(cpf|inep)`: SECURITY DEFINER, capability específica, igualdade normalizada sobre fingerprint, resposta mínima uniforme, rate-limit por sessão em ledger sem PII.
- Cadastro de aluno novo via `register_student` existente; conflito ⇒ fail closed.
- Criação de turmas 2027 e alocação/retirada via writers B2.5/B3 existentes; aluno ativo em outra escola ⇒ exige transferência explícita (`record_student_movement`), AEE/atividade separados.

## Fatia S4 — Servidores 2027 e baseline 2026 (migration 0114)
- `locate_professional_exact(matricula|qp-mec)` com mesmas proteções.
- Lotação 2027 via writer de postings existente; múltiplas lotações permitidas; sem regência.
- Baseline 2026: `professional_postings` aceita "observado no snapshot, início desconhecido"; operação técnica carrega só declarações explícitas de escola da fonte D já resolvida.

## Fatia S5 — Leitura por ano, testes e entrega
- Seletor de contexto (2026 base censitária / 2027 operacional) nas telas de turmas, alunos, servidores, secretaria; sem fallback 2026→2027.
- Testes S10 completos; docs `ano-operacional-2027-e-virada.md`, `busca-ativa-alunos-servidores.md`; roadmap e auditoria A–R atualizados.
- Relatório: implementado e operacional / aguardando ato humano 2027 / baseline 2026 / bloqueado. Parar antes de T.

## Premissas
- Calendários 2027 existentes são oficiais e não serão alterados.
- Nenhuma decisão de renovação/transferência/lotação 2027 é gerada pela automação.
