# Resiliência a conexão instável — NRESILIENCE.1

Situação atual: Registro de lote (2026-10-08).

## Achados e correções
- **Reenvio silencioso (corrigido):** com a configuração padrão, gravações feitas sem rede ficavam pausadas e disparavam sozinhas quando a conexão voltava, sem o usuário ver. Agora (`src/lib/connection-state.ts`, `QUERY_CLIENT_DEFAULTS`) gravações falham na hora (`networkMode: "always"`) e nunca são repetidas (`retry: 0`); leituras tentam até 2 vezes.
- **Estado offline invisível (corrigido):** `ConnectionBanner` no shell avisa "Sem conexão" e, na volta, "Conexão restabelecida. Nada foi reenviado automaticamente".
- Sem modo offline, fila ou cache de escrita: gravação só vale quando o banco aceita.

## Conferido sem mudança
- Writers SQL já recusam repetição (base esperada, `plan_id`/chave de idempotência, lock por fato lógico) — repetição manual não duplica.
- Rascunho permanece na tela em falha de rede (estado React não é limpo em erro). Matrícula guiada avisa ao sair; Diário mantém rascunho por aula na aba.

## Limites
- Recarregar a página sem rede perde rascunho não enviado das telas sem aviso de saída (turma, planejamento, Avaliação, documentos, comunicação, configurações). Persistir rascunho em navegador exige decisão (dado pessoal em disco) — DEPENDE_DECISAO.
- Teste em navegador com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.

Teste: `src/lib/connection-state.test.ts`.
