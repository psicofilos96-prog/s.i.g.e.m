# BQ.1 — Contas institucionais/setoriais e estações (estado: PARTIAL)

Frente única BU.CAL.2.1 + BQ.1 + UX.SIGEM.1–4, base 0ba0b71c.
**CONTINUE_FROM=LOTE_1.2** (modelo de principal institucional). Nenhuma conta foi criada.

## Lote 0 — baseline (lido do banco, 2026-10-06)
- Migrations: 0000–0204 (49 arquivos), sem migration nova nesta rodada.
- Unidades: 55 (40 municipais; 15 privadas conveniadas: 12 filantrópicas, 2 comunitárias, 1 confessional); todas ativas; 55/55 com INEP de 8 dígitos. Nenhuma estadual ou particular não conveniada.
- Pessoas 10.822; vínculos conta↔pessoa 2; atuações 2; políticas 8 (6 homologadas, 2 rascunhos); designação de autoridade do calendário 1.
- Calendário 2027: 7 versões / 7 homologações (inalteradas).

## Matriz derivada (sem assumir quantidade)
| Tipo | Escopo | Regra | Elegíveis |
|---|---|---|---|
| ciece@ | rede | conta central | 1 |
| supervisao@ | rede | conta central (já existe) | 1 |
| alimentacao@ | rede (NAE) | conta central | 1 |
| avalia@ | rede | conta central | 1 |
| orientaped.{INEP}@ | própria escola | escola ativa com INEP válido | 55 |
| diresc.{INEP}@ | própria escola | idem | 55 |
| sec.{INEP}@ | própria escola | idem | 55 |

Total elegível: 169 (4 centrais + 165 escolares). Exceções: nenhuma (0 escolas sem INEP).

## Bloqueio técnico concreto (por que o Lote 1 não foi executado)
`effective_capabilities` resolve autoridade só por `institutional_engagements.person_id = current_person_id()`
(mais a designação nominal do calendário). Conta setorial, por decisão do usuário, **não é pessoa**.
Criar as 169 contas sem antes evoluir o resolver obrigaria a (a) fabricar pessoas para setores — proibido —
ou (b) criar contas sem autoridade alguma, o que não entrega o lote. A evolução necessária, aditiva:

1. Tabela `institutional_sector_principals` (auth user ↔ setor ↔ escopo rede|escola ↔ school_id), append-only, sem DML para papéis do app.
2. `institutional_engagements.principal_id` nullable com CHECK (pessoa XOR principal) — exige revisar todo consumidor que faz JOIN por `person_id` (writers de autoria, ledgers `author_person_id`).
3. Segunda perna em `effective_capabilities` para `principal_id = current_principal_id()`.
4. Política v9 com regras explícitas por setor (matriz A–H da solicitação) e completude do Admin por teste.
5. Script idempotente de provisionamento (Auth admin no sandbox) + registro em `account_credential_events` sem senha.

Esses itens mudam o núcleo de autorização do sistema; precisam de uma rodada dedicada com
revisão dos writers que gravam `author_person_id`, antes dos Lotes 2–8.
