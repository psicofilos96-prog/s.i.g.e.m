# Dados funcionais do DP administrativo (migration 0076)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): corrigido — título e nota "DP externo" alinhados à decisão N12.1 (original preservado como histórico).


> **Histórico (superado pela decisão N12.1):** o texto a seguir dizia que RH/DP não era módulo do SIGEM; hoje o DP administrativo é do SIGEM e ficam fora só folha, previdência, pensão e consignações. Texto original: RH/DP não é módulo do SIGEM. Ver `docs/dp-externo-arquitetura.md`. As tabelas abaixo são histórico preservado e destino de aplicação governada da planilha oficial, não cadastro operado no SIGEM.

Rota: `/departamento-pessoal` (consulta por escola, validOn e knownAt).

## Entidades distintas
| Entidade | Fonte |
|---|---|
| Pessoa | `institutional_persons` |
| Vínculo (+ cargo, natureza) | `professional_functional_links` (14.12) — vários por pessoa, com vigência |
| Lotação administrativa | `professional_postings` (14.12) |
| Exercício / função exercida | `professional_exercises` (0076) |
| Habilitação/especialidade | `professional_qualifications` (0076) — nunca concede capability |
| Evento funcional (afastamento, retorno, cessão…) | `professional_functional_events`, natureza no catálogo `natureza-de-alteracao-funcional` |
| Processo funcional | `professional_functional_processes` (0076) |
| Atuação SIGEM (autorização) | `institutional_engagements` — só leitura aqui |
| Documento/ato-fonte | `source_ref`/`originating_act_ref` opcionais |

Tudo é append-only (`forbid_mutation`), com versão base esperada, motivo de correção e revogação como nova versão.

## Pendente
- Capabilities `manter-registro-funcional` / `consultar-registro-funcional` sem regra homologada.
- Catálogos sem valores: `funcao`, `habilitacao-profissional`, `natureza-de-processo-funcional`, `natureza-de-alteracao-funcional`, `natureza-de-vinculo-funcional`, `cargo`, `situacao-funcional`.
- `professional_postings.function_id` legado mistura função com lotação; a função exercida passa a ser registrada em `professional_exercises`.
- Documentos funcionais: o motor documental atual é centrado no estudante; tipos funcionais exigem estender o sujeito da emissão.
- Telas de `/profissionais` continuam sendo o laboratório sem login; formulários de gravação na nova página ainda não existem (gravação pelos RPCs).
- Regência/horário já usam `institutional_engagements`; não há cópia de servidor.
- Fora do escopo: folha, previdência, consignação, pagamento.
