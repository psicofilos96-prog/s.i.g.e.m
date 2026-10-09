# N2026.IMPORT.1 — Escolas e infraestrutura 2026: relatório de importação

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Contém só agregados, nomes de arquivo e contagens. Nenhum dado pessoal.
- Plano de origem: `docs/n2026-importacao-base-oficial.md`.

## Resultado
Todas as linhas das fontes deste lote foram comparadas campo a campo com o banco canônico. **Nenhuma divergência.** Nenhuma escrita foi necessária: tudo já estava gravado pelas operações técnicas de 2026-10-05, que são idempotentes por (operação, SHA-256). Ledger técnico continua com 7 operações; nenhuma versão nova; nenhuma observação nova.

## Relatório por arquivo e domínio
| Arquivo | Domínio | Linhas válidas | inserted | reused | updated-version | conflict | skipped |
|---|---|---|---|---|---|---|---|
| Matriz_Escolas_Itaperuna_Censo2026.xlsx (fd2e288b) | Escola | 55 | 0 | 55 (é a fonte da carga original) | 0 | 0 | 0 |
| Consolidado_Escolas_Municipais_Conveniadas (aba Escolas) | Escola | 55 | 0 | 55 — nome, dependência, localização, telefone, e-mail e situação idênticos | 0 | 0 | 0 |
| Consolidado_Escolas_Privadas (aba Escolas, ref. 16/09/2026) | Escola | 44 | 0 | 15 conveniadas idênticas | 0 | 0 | **29 privadas não conveniadas** |
| Aspectos_Infraestrutura_municipais.xlsx (5b82d019) | Infraestrutura | 40 escolas × 54 | 0 | 2.160 | 0 | 0 | 0 |
| Aspectos_Infraestrutura_conveniadas.xlsx (db804fad) | Infraestrutura | 15 × 54 | 0 | 810 | 0 | 0 | 0 |
| Consolidado municipal (aba Infraestrutura) | Infraestrutura | 55 × 54 | 0 | 2.970 | 0 | 0 | 0 |
| Aspectos_Infraestrutura_privadas.xlsx / Consolidado privadas (aba Infraestrutura) | Infraestrutura | 44 × 54 | 0 | 810 (as 15 conveniadas) | 0 | 0 | 29 escolas privadas |
| Relatórios de Fechamento (Urbanas 27, Rurais 13, Conveniadas 15) | Reconciliação | 55 INEP | — | conjunto de INEP idêntico ao banco | — | 0 | — |

## Por que as 29 privadas foram puladas
O cadastro de escolas não tem como marcar uma escola "só de referência". Toda escola cadastrada vira unidade da rede: aparece nas estações, no escopo de acesso e no Mapa. Cadastrá-las criaria unidades operacionais municipais que não existem. Ficam registradas como `skipped: PRIVATE_REFERENCE_NOT_SUPPORTED` até haver decisão e estrutura própria (lote futuro, com migration aditiva).

## Provas
- 55 escolas, 55 INEP, 55 valores distintos (`UNIQUE (identifier_kind, value)` e `UNIQUE (school_id, identifier_kind)`); não houve duplicação para 110.
- 40 municipais e 15 conveniadas (dependência `privada` com parceria `Municipal`), coerente com as três fontes.
- Infraestrutura: 55/55 escolas com 54 aspectos cada (2.970), referência 2026-08-31. A chave única é (hash da fonte, escola, aspecto, data), então repetir a carga não duplica.
- As células vazias da fonte não foram gravadas como "não possui": não havia nenhuma (0 ausências nas fontes; falso = "Não" explícito).
- Histórico: nenhuma versão substituída, todas as escolas continuam na v1, e não houve autoria humana.
- Prova executável rodada no banco: kind errado e payload incompleto recusados, total = 55 e rollback (`TEST-OK-ROLLBACK`).
- Resíduo sintético: 0 escolas fora do padrão `inep-<INEP>`, 0 observações sem operação técnica e área de transporte vazia.

## Ressalva
Endereço e bairro seguem **não informados** (nulos) nas 55 escolas, porque nenhuma fonte deste lote os traz.
