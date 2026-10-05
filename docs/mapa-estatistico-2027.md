# Mapa Estatístico 2027 — Frente T

Banco canônico: Lovable Cloud `crfqhyqkujhhlbiyhdbc`. Status: **PARTIAL — mecanismo pronto e fail-closed; aguarda regra homologada e abertura humana do ano 2027.**

## Fluxo
regra homologada (cobre a escola) → ano operacional (ledger S1) → abertura da competência → montagem automática → conferência (Secretaria) → oficialização (Direção, pessoa ≠ quem conferiu) → snapshot imutável → correção = nova versão.

## Implementado
- Migrations 0119–0121: writers por sessão (`auth.uid()` → pessoa → atuação → capacidade) para rascunho/homologação de regra, abertura, conferência, correção e oficialização; rotas `_actor`/service_role revogadas; DML direto revogado; rascunho só transita uma vez para homologada sem alterar definição/vigência/autoria; regra homologada imutável; sem DELETE.
- Regra com cobertura explícita `coveredSchoolIds`; draft, fora de vigência ou escola fora da lista ⇒ não se aplica. O dia da fotografia vem só da regra; nenhum default.
- Ano: `map_year_state_on`; só `operacional` permite oficialização. 2026 = `historico-importado` (baseline), 2027 = sem estado.
- "Matrícula do mês anterior" herdada e travada do snapshot oficial vigente do mês anterior (célula declarada pela regra); primeiro mês ⇒ ausente, nunca zero nem baseline 2026.
- Regentes apenas por `teaching_assignments_at` vigente na data; lotação não cria regência. Jornada profissional e mediadores: sem fonte.
- Tela: escola, mês e ano escolhidos explicitamente; estado do ano; dinâmico × oficial; CSV/XLSX/PDF do motor de relatórios a partir das mesmas células (oficial congelada quando houver).
- Painel de regras na visão da rede (lista, rascunho, homologar).

## Não feito (por decisão)
Nenhuma regra real homologada, nenhum Mapa 2027 aberto/oficializado, nenhum ato humano simulado.

## Provas
`src/features/statistical-map/map-2027.test.ts`; `supabase/tests/t_map_rule_guard.sql` (rollback). Limitação: o papel do sandbox recebe `permission denied` antes do gatilho em UPDATE, então o teste prova recusa, e a lógica do gatilho é provada por inspeção da 0121.
