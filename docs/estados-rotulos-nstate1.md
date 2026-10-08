# NSTATE.1 — estados e rótulos visuais

## Situação atual (2026-10-08)
- Classe: **Registro de lote**. Regra em `src/components/sigem/AGENTS.md`.

## O que mudou
- `src/config/state-presentation.ts`: cada domínio declara, para cada estado canônico (banco ou projeção do ledger), rótulo + fase semântica; a cor sai só da fase (`PHASE_TONE`). Domínios: calendário, turma, documento, Mapa, SIPE/SIA, avaliação (instrumento), solicitação (pedido alimentar) e serviço (tarefas). Mapa é checado em compilação contra o tipo do estado (`satisfies Record<…>`): estado novo sem rótulo não compila.
- Desconhecido → "Situação não reconhecida"; ausente → "Sem situação registrada".
- Inconsistências corrigidas: documento escolar mostrava "válido/cancelado/retificado" em minúsculas e sem cor (agora badge canônico); turma usava variantes de Badge próprias (agora mesma cor de "vigente/encerrado"); Mapa repetia "Aprovado (oficial)" como texto solto; rótulos de SIPE/SIA, Mapa e pedidos passaram a vir do registro.
- Ações do pedido alimentar derivam de `ORDER_ACTIONS_FROM`, espelho das transições de `record_meal_order` (0183), conferido por teste contra o SQL.

## Testes
`src/config/state-presentation.test.ts`: cor por fase, equivalência entre domínios, desconhecido falha fechado, transições do Mapa, SIPE/SIA e pedido.

## Pendências
- REVISAR: matrícula/enturmação não têm estado enumerado no front (vigência é projeção de datas) — nada a registrar; estoque e recebimento da alimentação ainda testam status inline.
- PENDENTE: demais mapas locais de rótulo (fechamentos, conselho, regras avaliativas) seguem próprios; migrar quando tocados.
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
