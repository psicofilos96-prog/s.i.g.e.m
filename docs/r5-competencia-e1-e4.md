# R5 — Competência institucional para E1–E4

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


> Atualização 2026-10-04 (0061): v4 homologada por decisão do proprietário, sem ato externo; referências documentais tornaram-se opcionais. Ver `docs/r5-gate-operacional.md`. O texto abaixo é histórico.

**Status: RESOLVIDO em 2026-10-04.**

## Decisão institucional

A atuação `gestao-pedagogica-da-rede` (**Supervisão Escolar**) é a autoridade institucional responsável por **construir e homologar** os quatro estágios do fluxo de correspondência curricular:

- **E1** — versões de matrizes curriculares;
- **E2** — perfis de correspondência curricular;
- **E3** — correspondências posição curricular → matriz lógica + coluna;
- **E4** — associações específicas turma → matriz.

A construção de E1 reutiliza a capability existente `manter-matrizes-curriculares`. As demais operações devem usar capabilities explícitas próprias. Nenhuma competência decorre de nome de setor, e-mail, flag, bypass, service role ou wildcard.

## Administrador Geral

O `administrador-geral-do-sigem` continua transversal. Capacidades futuras somente entram por **regra explícita em nova versão da política**, preservando o contrato de completude do mestre; isso não o converte em Supervisão Escolar nem substitui a proveniência da atuação que exerceu a operação.

## Versionamento da política

A política v3 homologada é imutável. R5 deve ser materializado em uma **v4 draft** que:
1. preserve integralmente a v3;
2. acrescente explicitamente as novas capabilities para `gestao-pedagogica-da-rede`;
3. acrescente explicitamente as mesmas capabilities ao `administrador-geral-do-sigem`, conforme o contrato do mestre;
4. permaneça `draft` até homologação posterior com **ato institucional real**.

Não é permitido inventar `act_ref`, alterar v3 ou usar a v4 draft como autorização runtime.

## Fronteiras preservadas

Esta decisão não homologa catálogo, 22 posições, matrizes, perfis, correspondências ou associações. Não fixa `valid_from` da Deliberação CME nº 3/2026: o ato é de 1º de abril de 2026, mas a vigência depende da publicação, cuja prova permanece pendente.

A implementação dos writers E1–E4 deve continuar append-only, versionada, fail-closed, com optimistic concurrency, proveniência, RLS/ACL fechados e leitura `validOn`/`knownAt`.
