# HOMO.REAL.1 — Homologação operacional por perfil

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Resultado: **PASS parcial — REAL_PROFILE_OPERATIONAL_HOMOLOGATION_COMPLETE não declarado.**
- Camada provada: `authenticated-layer` + navegador headless com sessão injetada de contas sintéticas efêmeras (`bo_fixture_*`, domínio `bo-fixture.invalid`), contra RLS e capacidades reais da política vigente. Login interativo da plataforma indisponível (`signed_out`).
- Scripts: `scripts/institutional-harness.mjs` (118 testes + 102 verificações), `scripts/homo-real-1.mjs` + `scripts/homo-real-1.py` (51 verificações de tela). Cleanup verificado: 0 usuário e 0 resíduo após a execução. Nenhuma senha ou token impresso.
- Screenshots: Files → `homologacao-real/` (29 telas).

## Matriz PERFIL × TAREFA × RESULTADO × EVIDÊNCIA
Legenda: P = PASS · F = falha · NV = não verificado · BLK = bloqueado (sem credencial).

| Perfil | Login/sessão | Menu esperado | Rotas permitidas / deep link | Rota negada | Isolamento A/B | Escrita real | Logout | Evidência |
|---|---|---|---|---|---|---|---|---|
| Administrador Geral (sintético) | P | P | P (5 rotas) | n/a | n/a (rede) | NV | P | homo-real-1 log; telas `administrador-geral-*` |
| CIECE (sintético `ciece-estatistica`) | P | F (menu completo) | P (/ciece, /mapa-estatistico) | P (Central de acessos recusa) | n/a | NV | P | idem |
| Secretaria — escola A e B | P / P | F (menu completo) | P | P | P (própria=sim, outra=não) | NV | P | idem |
| Direção — escola A e B | P / P | F | P | P | P | NV | P | idem |
| Orientação Pedagógica — A e B | P / P | F | P | P | P | NV | P | idem |
| Docente — 2 contextos | P / P | F | P (/diario, /diario/turmas) | P (Administração Geral recusa) | P | NV | P | idem |
| Supervisão Escolar (conta real) | BLK | — | — | — | — | — | — | senha inicial setorial indisponível no ambiente |
| Avaliação (conta real) | BLK | — | — | — | — | — | — | idem |
| Alimentação (conta real) | BLK | — | — | — | — | — | — | idem |
| Mediador | BLK | — | — | — | — | — | — | sem tipo de fixture nem conta real |
| Família/responsável | BLK | — | — | — | — | — | — | idem |
| Inclusão/NEI central | BLK | — | — | — | — | — | — | ACCOUNT_IDENTIFIER_PENDING (BQ.1) |

Provas do harness (todas P): self-grant recusado, DML direto recusado, edição de política homologada recusada, IDOR outra escola recusado, conta sem pessoa sem capacidades, revogação surte efeito na sessão aberta, dois JWTs paralelos sem capacidade recusados, autoria registrada como ator humano (pessoa natural), CIECE sem identidade nominal de estudante.

## Achados
1. **Menu não filtrado para contas pessoais:** o menu lateral mostra todas as estações a Docente, Secretaria, Direção e OP; as telas recusam corretamente ao abrir. Só contas de setor têm menu por estação (`station-navigation.ts`). Correção de interface pendente.
2. "Rota negada" foi conferida pelas telas: "Esta área exige…" e "Esta central exige…".

## Não executado (motivo)
- Ação de escrita representativa por perfil e "Admin em todos os domínios": não roteirizado nesta rodada.
- PDF/exportação, busca global com termo, troca de escola/rede/ano: não roteirizados.
- Contas setoriais reais (Supervisão, Avaliação, Alimentação, CIECE, Secretaria/Direção/OP por INEP): a senha inicial não está disponível neste ambiente; última prova delas é a BQ.1C (`bq1-sector-login-proof.mjs`).
- HUMAN_VISUAL_VALIDATION_PENDING: conferência visual humana de todas as estações.
