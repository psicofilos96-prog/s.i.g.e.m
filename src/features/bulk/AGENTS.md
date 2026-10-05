## Operações em lote (`src/features/bulk/`, sem migration)
- O motor só orquestra prévia → confirmação → execução por item; toda gravação passa pelo writer canônico declarado na operação, que revalida capability/escopo/base no banco, porque UPDATE em massa contornaria a norma.
- Escopo autorizado ausente ⇒ nenhum item pronto; item recusado, duplicado ou alterado nunca some do resultado, porque esconder recusa mascara falha.
- Prévia tem impressão digital da seleção; execução com seleção diferente é recusada, porque confirmar uma lista e gravar outra seria autoaprovação.
- Modo `parcial` exige writer por item; `tudo-ou-nada` só existe com writer atômico de lote, porque atomicidade não pode ser simulada na tela.
- Chave de idempotência = operação@versão:lote:item; relatório sai só pelo motor de relatórios; lote grande pagina e roda por `BulkJobRunner` (hoje local).
