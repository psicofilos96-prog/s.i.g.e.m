# Frente I — Piloto E2E (escola 2026)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


**Status: PARTIAL.**

## Escolha objetiva
`src/features/pilot/pilot-school-selection.ts` (+ testes): ordena por número de dimensões presentes (infraestrutura, turmas, matrículas, exercícios profissionais), depois volume agregado, desempate por INEP crescente. Ausência desqualifica a dimensão, nunca vira zero.

Escola escolhida: **INEP 33002053** (54 fatos de infraestrutura, 37 turmas, 692 matrículas observadas, 46 exercícios profissionais declarados). Seguintes: 33001731, 33096589.

## Cadeia validada
| Elo | Resultado |
|---|---|
| Unidade (cadastro versionado + INEP) | PASS |
| Infraestrutura (54 atributos com proveniência) | PASS |
| Ano 2026 (identidade; limites oficiais não informados) | PARTIAL |
| Turmas (37, `valid_from` não informado, known_at da fonte) | PASS |
| Alunos / matrículas observadas | PASS |
| Inscrição letiva / participação / alocação | BLOCKED (nenhuma fonte declara início efetivo) |
| Profissionais / vínculos declarados | PARTIAL (sem lotação, regência ou jornada) |
| Mapa / read models | PARTIAL (Mapa sem regra homologada) |

Nada foi inventado: nenhuma regência, jornada profissional, login, turno ou data.
