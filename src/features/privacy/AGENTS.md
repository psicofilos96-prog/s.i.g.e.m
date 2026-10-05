## Privacidade (`src/features/privacy/`)
- `DATA_INVENTORY` é o inventário único e testado; tabela nova com dado de menor ou sensível entra nele, porque o teste de GRANT a anon só cobre o que está inventariado.
- Retenção, base legal e destino ficam `null` até decisão institucional; `lifecycleAction` sem decisão completa sempre retém, porque prazo legal não pode nascer no código.
- URLs assinadas usam só `SIGNED_URL_TTL_SECONDS`, porque TTL espalhado diverge.
