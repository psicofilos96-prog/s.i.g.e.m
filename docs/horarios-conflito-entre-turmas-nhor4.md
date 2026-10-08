# NHOR.4 — Conflito do mesmo profissional entre turmas

**Situação atual:** Registro de lote (2026-10-08). Complementa NHOR.2/NHOR.3.

## Entregue
- `src/features/schedules/teacher-cross-class-conflicts.ts`: `readAccessibleSchedules` lê em lote, com concorrência limitada, o MESMO reader `class_schedule_at` para cada turma que a RLS já deixa listar. Nenhuma política, função ou capacidade nova. Turma negada, ausente ou com erro fica separada e declarada.
- `personsOfEngagements`: atuação → pessoa pela RLS existente de `institutional_engagements`, só atuações registradas até knownAt. Atuações diferentes da mesma pessoa em turmas diferentes são reconhecidas como o mesmo profissional.
- `crossClassTeacherConflicts` (puro): sobreposição estrita (aulas encostadas não conflitam); mesma turma fica com NHOR.3; atuação sem pessoa legível não é convertida.
- `coverageNote`: com turma negada/falha ou atuação sem pessoa, a tela e o PDF dizem "Verificação parcial" — nunca "sem conflito".
- Tela `/horarios` (sessão institucional): painel "Conflitos do mesmo profissional entre turmas" com alerta factual da turma, ficha do profissional (seleção entre quem atua na turma) e botões de PDF da turma, do profissional e da escola.
- `schedule-print.ts`: HTML A4 (NDOC.2: quebra de texto, cabeçalho repetido, escape, sem interface do app).

## Provas
- `teacher-cross-class-nhor4.test.ts` (9 testes, fixtures): mesma pessoa com atuações distintas; encostadas; pessoas distintas; mesma turma; atuação sem pessoa; lote com negada/ausente/erro; 300 turmas × 25 blocos < 1 s; PDF A4/escape/sem grade.
- PDF headless (Chromium, fixtures): turma 25 linhas = 1 página; profissional 40 linhas com textos longos sem espaço = 7 páginas; escola 750 linhas = 18 páginas; todas A4, 0 elementos com overflow horizontal.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferir com login real e grades reais.
- Limitação declarada: a verificação cobre só as turmas legíveis pela atuação do usuário; conflitos em turmas fora do seu alcance não são vistos (política de acesso inalterada).
- Ficha do profissional demonstrativa (laboratório sem sessão) não foi alterada.
