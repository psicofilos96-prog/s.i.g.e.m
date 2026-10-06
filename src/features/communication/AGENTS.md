## Comunicação escola ↔ família (AJ — `src/features/communication/`, `/comunicacao-escolar`, migrations 0172–0173)
- Comunicado = identidade + versões append-only + atos (publicação/cancelamento) + recibos (leitura ≠ ciência); estado é projeção, porque campo de estado divergiria do histórico.
- Audiência é derivada na leitura (autorização vigente na seção `comunicados` + enturmação na data da publicação), nunca lista copiada; sem provedor externo nem anexos (EXTERNAL_DELIVERY_PROVIDER_PENDING / ATTACHMENTS_PENDING), porque envio simulado afirmaria recebimento inexistente.
- Tabelas novas revogam DML de service_role explicitamente, porque `REVOKE ALL` não remove privilégios de ACL padrão.
