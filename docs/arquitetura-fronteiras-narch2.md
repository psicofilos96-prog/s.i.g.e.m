# Fronteiras de módulos — NARCH.2

**Situação atual:** Registro de lote (2026-10-08).

## Corrigido
- 17 cópias idênticas do helper de chamada ao banco (Alimentação ×10, Inclusão ×3, Desempenho ×2, Comunicação, Notificações) → `callRpc` em `src/lib/rpc-call.ts`. Mesma semântica: erro do banco vira exceção com a mensagem original; cada módulo segue mapeando a mensagem. Guardado por `src/test/invariants/narch2-boundaries.test.ts`.
- Tipo de `parseBoundary` (NVALID.1) ajustado para aceitar schemas com transformação (erro de tipos).

## Dependências entre módulos conferidas (mantidas)
- Alimentação/Inclusão/Acompanhamento → `reports` e `privacy`: motores compartilhados, uso correto.
- Inclusão → `school-followup/followup-source` (`schoolsInScope`): reaproveita reader existente.
- Portal da Família → `communication/family-communications`: comunicados publicados à família são da Comunicação.
- Alimentação → `educational-intelligence` só por tipo.

## Não feito
- ~65 leitores com `data as T` próprios: migrar para `callRpc` + `parseBoundary` ao tocar cada tela (cada um tem mapeamento de erro próprio).
