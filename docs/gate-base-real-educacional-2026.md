# Frente J — Gate da base real 2026

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


**Decisão: BASE_REAL_2026_ACCEPTED_WITH_EXCLUSIONS — o gate pleno NÃO é declarado.**

| Domínio | Status | Evidência |
|---|---|---|
| Escolas / INEP | PASS | 55, fonte fd2e288b, writer canônico |
| Infraestrutura | PASS | 2.970 fatos, retry idempotente |
| Ano 2026 | PARTIAL | limites neutralizados (0108), sem datas inventadas |
| Turmas | PASS | 698, `valid_from` NULL, known_at preservado |
| Alunos / matrículas observadas | PASS | 9.763 / 9.811, `opened_on` NULL |
| Participação / alocação | BLOCKED | nenhuma fonte declara início efetivo |
| Profissionais / vínculos | PARTIAL | 551 vínculos só com regime declarado; 0 lotações |
| Jornada profissional | **FORA DA COBERTURA** | Frente E BLOCKED; não mascarada |
| Privacidade | PASS | sem PII em repo/docs/logs; matching por fingerprint |
| Segurança | PASS | executor técnico sem acesso de app roles/service_role; automation OFF recusa |
| Idempotência | PASS | 7 operações técnicas, retries sem duplicação |
| Piloto E2E | PARTIAL | ver docs/piloto-e2e-escola-2026.md |

## Remediação automática
Tentada uma vez: nenhum bloqueador restante é técnico — todos dependem de fonte (data de ingresso individual — fato distinto do calendário —, limites do calendário 2026, jornada profissional, regra do Mapa). Nada a remediar sem fabricar fatos.

## Consequência para K
Como o gate pleno não foi aceito, **K não faz mutações de produção**.
