# Importações — camada de interoperabilidade segura

Fluxo: arquivo → parsing → normalização → validação → matching → divergências → prévia → staging → confirmação humana → writers canônicos → eventos/relatório.

## Fronteira
| Estado | Onde vive | Significado |
|---|---|---|
| Dado recebido | `import_batch_rows.raw` | Literal do arquivo; nunca é verdade do SIGEM. |
| Dado reconciliado | `normalized`, `identity_key`, `outcome`, `reasons` | Classificação contra o SIGEM: válida, rejeitada, duplicada no arquivo, conflito, já reconciliada. |
| Fato canônico | tabelas de domínio | Só existe depois que o writer do domínio aceitou, com a capability **dele**. Evento `aplicada` guarda a referência devolvida. |

## Garantias
- Prévia não grava nada; staging não toca domínio (`stage_import_batch`).
- Lote: id, adaptador+versão, nome, SHA-256 do arquivo, SHA-256 do conteúdo guardado (calculado no banco), operador, pessoa, atuação, horário, referência documental opcional.
- Mesmo arquivo + adaptador ⇒ mesmo lote (índice único). Reprocessamento é lote novo explícito ligado ao anterior.
- Matching por chave de identidade declarada (ex.: INEP), nunca só por nome. Mais de um registro canônico ou divergência ⇒ conflito, sem resolução automática.
- Linha rejeitada guarda motivo (CHECK). Tudo append-only (triggers); sem DML direto (só `service_role`).
- Aplicação: evento `confirmacao` obrigatório; cada linha é atômica no writer; falha parcial não desfaz as anteriores e fica com motivo; reaplicar retoma só pendentes/falhas; índice único impede aplicar a mesma linha duas vezes.
- Compensação: evento com motivo, nunca reescreve história; a correção do fato é nova versão no cadastro de destino.
- Importador não tem bypass: gerir lotes exige `gerir-importacao-de-dados` (rede, **sem regra de política — fecha para todos até decisão**); gravar exige a capability do writer de destino.

## Adaptadores
- `censo-matriz-escolas`: formato curado em `docs/data/escolas-itaperuna-censo2026.json`; grava por `register_school_record_version`.
- `educacenso-matricula`, `gpe`: leiaute oficial **ausente** no repositório; interface pronta, parser recusa, nenhuma coluna inventada.

## Pendências
1. Quem recebe `gerir-importacao-de-dados` (rede).
2. Leiautes oficiais do Educacenso e do GPE como fonte.
3. Writers de domínio adicionais (aluno, matrícula) por adaptador quando houver leiaute.
