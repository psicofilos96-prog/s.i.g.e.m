# NIMPORT.2 — Infraestrutura comum de importações

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Estado: **PASS técnico**; lote **PARTIAL** (ver pendências).

## Inventário
| Domínio | Módulo | Pipeline | Regra própria mantida |
|---|---|---|---|
| Escolas, alunos, turmas, profissionais (staging) | `data-import/adapters.ts` + `import-engine.ts` | staging governado `stage_import_batch` → classificação → confirmação → writer canônico → eventos | adaptadores, campos comparados, writers |
| Censo (fonte externa) | `census-cycle` (`census_stage_source`, parser no banco) | staging no banco + `census_compare` | layout INEP recusado |
| Reconciliação censitária | `census-reconciliation/reconcile.ts` | projeção pura | classificação por dimensão |
| Avaliações institucionais | adaptador `resultado-avaliacao-institucional` do mesmo motor | staging governado | `plan_key` como idempotência |
| Profissionais Educacenso | `professionals/educacenso-professional-matching.ts` | matching puro | CPF por impressão digital injetada |
| Matriz D1 | `curriculum/d1-import.ts` | plano → writers canônicos | contrato das 22 posições |
| Pré-importação 2027 | `year-preparation/preimport-plan.ts`, `correspondence-dryrun.ts` | dry-run puro, sem gravação | candidatos e recusas |

## Duplicações encontradas e consolidadas em `data-import/import-kernel.ts`
- Hash FNV-1a copiado em `correspondence-dryrun.ts` e `reconcile.ts` → `stableHash`.
- Formato `adaptador@versão:sha256:chave` escrito à mão em dois lugares → `idempotencyKey`.
- Contagem de duplicidade na fonte → `keyCounts`; `sha256Hex` passa a morar no núcleo (reexportado pelo motor).
- Novos componentes comuns: `readFileSafely` (arquivo vazio/ilegível nunca vira lote vazio), `exceptionReport`/`exceptionReportCsv` (toda linha não aceita com motivo, CSV pt-BR com BOM), `compensationPlan` (rollback = compensação só de linhas aplicadas e não compensadas; nada apagado), `Provenance`.
- Saídas preservadas: mesmos valores de hash e chaves; `docs/ncfg3/dryrun-2027.json` sem alteração.

## Sem mudança
Nenhum contrato de negócio, writer, migration ou permissão. Cada domínio mantém validação, matching e writer.

## Testes (`import-kernel.test.ts`)
Reexecução (sha256, plano, dry-run), arquivo vazio/ilegível, relatório de exceções (duplicada, rejeitada, conflito) e CSV, rollback por compensação, e guarda contra nova cópia do hash fora do núcleo.

## Pendências
- **PENDENTE**: a tela da Central de Importações ainda não usa `readFileSafely`/`exceptionReportCsv` (cada uma mostra as exceções do seu jeito); migrar sem mudar o fluxo visual.
- **PENDENTE**: o Censo faz parser no banco; o núcleo só cobre o lado da tela.
- **PENDENTE**: o roteiro `scripts/ncfg3/dryrun.ts` não foi executado de novo porque as fontes temporárias do NCFG.3 não existem mais; a equivalência é garantida pelo teste do valor do hash.
- **INTERACTIVE_BROWSER_VALIDATION_PENDING**: importar arquivo real com login.

## NIMPORT.3 (2026-10-08) — integração visual do núcleo
- Central de Importações (`import-center-page.tsx`) agora usa `import-center-view.ts` sobre `import-kernel.ts`: leitura segura (vazio/ilegível recusados, nunca lote vazio), prévia com contagens, proveniência e chave de idempotência do lote, relatório de exceções CSV (prévia e lote guardado) e plano de compensação (`compensationPlan`: só aplicadas não compensadas).
- Censo (`census-page.tsx`): leitura segura (`readCensusSource`: vazio, ilegível, não-lista e lista vazia recusados), impressão digital do núcleo (`census-cycle-source.sha256Hex` delega ao kernel, mesmo valor) e relatório de exceções CSV das rejeições. Writer `census_stage_source` inalterado; nenhum writer de domínio alterado; nenhum dado oficial importado.
- Testes: `src/features/data-import/import-center-view.test.ts` (vazio, inválido, repetido, conflito, rollback, 20.000 linhas, Censo).
- Gap NFINAL.7 nº 2 (Central sem readFileSafely/exceptionReportCsv): FECHADO.
- Pendências: Censo não tem compensação (a fonte não aplica fatos; comparação nunca corrige — não aplicável); INTERACTIVE_BROWSER_VALIDATION_PENDING (upload real com login); DEPENDE_DADO (leiautes Educacenso/GPE/DP).
