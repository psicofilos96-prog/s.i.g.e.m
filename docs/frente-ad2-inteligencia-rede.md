# Frente AD.2 — Inteligência da rede (CIECE)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


- Reader `network_indicators_at(_on, _known_at, _school, _year)` (migrations 0157, 0158, 0160): SECURITY INVOKER, STABLE, sem escrita; anon/service_role recusados.
- 0159: política de leitura de matrículas por capacidade de rede avaliada uma vez (equivalente à já concedida por `has_school_capability` em escopo de rede); corrigiu leitura de ~13 s.
- Estados: available | zero (só quando a consulta autorizada prova zero) | unknown | unavailable, sempre com motivo.
- Tela: Painéis → "Indicadores da rede (CIECE)" com recorte rede/escola, data, conhecido-até, natureza, proveniência, drill-down por escola (contagens, sem dado pessoal), painel de qualidade das fontes e exportação CSV pelo motor comum (`indicadores-da-rede`).
- Sem limiar de pequenos grupos declarado ⇒ nenhuma supressão numérica.

| Indicador | Estado (2026-10-01) | Motivo |
|---|---|---|
| Escolas ativas | AVAILABLE (55) | versão cadastral vigente |
| Infraestrutura declarada | AVAILABLE | observações vigentes na data |
| Matrículas vigentes | UNKNOWN | sem capacidade: não autorizado; com capacidade: matrículas sem início efetivo |
| Saldo de movimentação | UNAVAILABLE | movimentações não constituídas |
| Mapa oficial | UNAVAILABLE | nenhuma versão oficializada |
| Posições com matriz | UNAVAILABLE | sem posições registradas |
| Blocos ofertados | UNAVAILABLE | grade sem blocos |
| Cobertura docente | UNAVAILABLE | sem atribuições |
| Aulas registradas | UNAVAILABLE | Diário sem operação |
| Frequência | UNAVAILABLE | sem chamadas / regra não homologada |
| Avaliações aplicadas | UNAVAILABLE | sem aplicações |
| Acompanhamentos | UNKNOWN | só pelo leitor próprio com capacidade |
