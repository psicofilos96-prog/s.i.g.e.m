# Varredura: demonstração × contexto real (2026-10-07)

Regra: com sessão, só dado do banco; demonstração apenas sem sessão (laboratório), via `ClassRouteGate` / `useSessionUser` / `sessionActor`.

## Corrigido
- `/` (início): com sessão some "Contexto demonstrativo", o texto demonstrativo e os "Registros demonstrativos A/B/C"; aparece estado vazio honesto. Indicadores já eram "—".
- `/regras-avaliativas/*`: usava regras e autores de fixture sem checar sessão. Com sessão agora mostra estado vazio; as fixtures ficam só sem sessão.
- Teste guarda: `src/routes/real-context-demo.test.ts`.

## Conferido sem mudança
- Painéis (`executive-dashboard-page.tsx`), Busca global (`global_search`, RLS) e Gerador de relatórios: só leem o banco; sem linha ⇒ "Nenhuma linha visível à sua conta".
- Orientação, Conselho, Situação acadêmica, Percurso do estudante, Projeções: demonstração só no ramo sem sessão.

## Pendente
- Tela real de regras avaliativas da rede (hoje vazia com sessão) — PENDENTE.
- Varredura linha a linha das 210 rotas foi por amostragem além dos achados acima — REVISAR.
- Conferência com login real — INTERACTIVE_BROWSER_VALIDATION_PENDING.
