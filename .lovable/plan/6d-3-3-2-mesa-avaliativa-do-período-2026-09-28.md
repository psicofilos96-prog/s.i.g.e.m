# 6D.3.3.2 — Mesa Avaliativa do Período

Approving this plan also approves (homologates) the 6D.3.3.1 period projection that was just delivered. The other uploaded briefs (6D.3.3.3 explanation, 6D.3.3.4 integration, 6D.3.4 period closing, 6D.3.5 recovery) go on the roadmap. Each one waits for its own plan and approval, in that order.

## What the teacher will see

A new "Avaliação do período" page for the class. It is for understanding, finding and moving on, not for typing:

1. **Compact header**: class, subject, period and teacher. Technical IDs appear only in "Detalhes normativos".
2. **Instrument strip**: one short line per instrument, giving the name, the date, what kind of entry it takes, and the counts ("27 registrados · 3 sem resultado · 2 não se aplicam"). It has one main button, "Abrir pauta", which opens the existing Pauta 2.0 for that instrument.
3. **Class progress** (desktop): a compact table of students against instruments, plus a composition column. Every cell is a fact to read, never an input field. Each cell says in words which state it is in:
   - the official value;
   - "Sem resultado";
   - "Não registrado", with the reason shown on request;
   - "Não se aplica";
   - "Valor protegido".
   Descriptive results show "Registro disponível" and a "Ver" button, so rows stay short.
4. **Composition column**: shows only what the projection returns. That is the value, "Ainda não é possível calcular" (with the reason) or "Valor protegido". A "Como foi calculado?" button opens a simple panel built from data that already exists. The full explanation is left to 6D.3.3.3.
5. **Correct a result**: "Corrigir" appears only when the projection allows it. It opens the existing correction panel, starting from the current official version. Afterwards the page recomputes itself and shows the new version.
6. **Student search**: it filters what is shown and never changes the order, the facts or the composition. Arrow keys move between students.
7. **Phone (382 px)**: a list of students with a short summary. Tapping a student opens that student's instruments, with the same actions. There is no sideways scrolling.

Nothing new is invented: no zeros, no percentages, no "risco", "crítico" or "atrasado", no rankings and no indicators.

## Out of scope

- No changes to the Pauta 2.0, the composition engine, batch entry, the correction logic, closing or the Council.
- No calculations inside the screen.
- If the projection is missing a piece of information, I write the gap down instead of having the screen guess it.

## Technical details

- Route `src/routes/diario.turmas.$turmaId.avaliacao.periodo.tsx` (`/diario/turmas/$turmaId/avaliacao/periodo`), with its own `head()`. Add a link to it from the existing assessment area.
- `src/features/assessment/assessment-period-workspace.tsx`: `AssessmentPeriodWorkspace` takes an `AssessmentPeriodProjection` and renders it. `assessment-period-presentation.ts` holds pure resolvers that turn cell, composition and action states into labels.
- `assessment-period-demo.ts` sets up the demo data: fixtures, the demo capabilities agent and the action definitions (`abrir-pauta`, `corrigir`). It reuses the existing assessment fixtures and version store. Pages and stores are reused through their existing entry points only.
- "Abrir pauta" links to the existing `/diario/turmas/$turmaId/avaliacao/pauta/$instrumentoId` route.
- "Corrigir" mounts the existing `AssessmentCorrectionPanel`. When it finishes, the version store changes and the projection is computed again, with no copy of the values kept anywhere.
- Tests:
  - the five cell states render as distinct text;
  - no input field appears on an official result;
  - "Não se aplica" rows stay visible;
  - blocked or suppressed actions and values behave correctly;
  - homonym discriminators appear;
  - search does not reorder the list;
  - the Pauta link carries the right context;
  - the page updates after a correction.
- Screenshot checks at 1280 px, 382 px and 200% zoom.
- Record the Mesa decision in `AGENTS.md`/project knowledge. Queue 6D.3.3.3, 6D.3.3.4, 6D.3.4 and 6D.3.5 in `roadmap.md`.
