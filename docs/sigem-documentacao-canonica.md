# SIGEM — documentação canônica atual (2026-10-06)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Canônico**. Ponto de entrada técnico.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Este é o ponto de entrada técnico vigente. Documentos de frentes e etapas anteriores (`frente-*`, `b*-*`, `auditoria-*`, memórias de fontes) são **registro histórico**. Quando contradizem este texto, prevalece este texto e as `AGENTS.md`.

## Arquitetura
- TanStack Start com Lovable Cloud. O banco é a autoridade: as escritas passam só por writers canônicos SECURITY DEFINER com `search_path=''`; as leituras usam readers e RLS.
- Autorização = capability efetiva (atuação vigente × política homologada). Cargo é só rótulo, e EXECUTE de função não é autorização.
- Norma é dado versionado e homologado, nunca código.

## Ambiente e migrations
- Banco canônico único (ver `ambiente-canonico-sigem.md`).
- Migrations são forward-only, com hash congelado (`invariants:freeze-migrations`). Correção é migration nova.
- Release passa pelo CI: veja `engenharia-de-release.md`.

## Pessoa, vínculo, presença, atribuição e conta
- **Pessoa:** pessoa natural registrada uma vez na rede.
- **Vínculo funcional:** relação de trabalho mantida pelo DP administrativo do SIGEM (decisão N12.1); folha, previdência, pensão e consignações ficam fora.
- **Presença/lotação educacional:** onde a pessoa atua educacionalmente (atuação com escopo e vigência).
- **Atribuição/regência:** componente de uma turma designado a uma atuação, com vigência.
- **Conta:** login. Não é pessoa nem autorização. Conta de órgão e conta técnica não praticam ato humano.

## Fontes e importação
- Pipeline: arquivo → hash → staging imutável → classificação → diff → confirmação → writer canônico → eventos (`frente-bg-importacoes-governadas.md`).
- DP administrativo (vínculos, lotações, atos, férias/licenças, designações, PAD) é do SIGEM; só folha/previdência/pensão/consignações são externas (decisão N12.1, superou a Frente BC). RH não é perfil operacional: o setor é o DP administrativo.
- GPE é `EXTERNAL_INTEGRATION_UNDEFINED`: não há arquivo aguardado.
- Educacenso: `EDUCACENSO_LAYOUT_BLOCKED_BY_OFFICIAL_SOURCE`.
- Execução técnica estreita: as funções `technical_import_*` serviram às cargas 2026 documentadas. Não são caminho operacional.

## Tempo e ausência
- 2026 é histórico-importado. 2027 só opera após abertura humana (`REAL_2027_CONFIGURATION_PENDING`).
- `asOf/validOn` = o que valia na data. `knownAt` = o que o sistema sabia até então.
- Ausência nunca é zero: UNKNOWN, UNAVAILABLE e BLOCKED são estados distintos.

## Códigos de bloqueio
A lista única está em `src/features/help/block-codes.ts`, testada. Cada código informa o que falta e quem resolve.

## Runbooks
- Integridade e recuperação: `runbook-integridade-e-recuperacao.md`.
- Observabilidade: `observabilidade-e-incidentes.md`.
- Desempenho: `performance-baseline-au.md`.
- Verificação: `rotina-de-verificacao.md` (`npm run verify`).

## Mapa
Classe e vigência de cada documento: `mapa-documentacao-vigente.md`.
