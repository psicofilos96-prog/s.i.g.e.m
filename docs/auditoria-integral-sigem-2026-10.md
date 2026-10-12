# Auditoria integral do SIGEM 2.0 — Lote corretivo 23 (2026-10-12)

Situação atual: Registro de lote. Foto do estado em 2026-10-12 20:50 UTC. Não é fonte normativa nem homologação; nenhuma aprovação, autoria ou decisão foi registrada em nome de pessoa.

## 1. Escopo e limite do que foi auditado

- **SHA analisado:** `8026fe24` (HEAD do GitHub `main` no momento da coleta; o projeto local avançou só com este registro).
- **Histórico de conversa:** o agente só tem acesso integral aos lotes corretivos 01–22 por resumo compactado e aos relatórios versionados (`sigem-relatorio-pendencias-2026-10-12.md`, `-lote18.md`, `-lote22.md`, `auditoria-pendencias-setores-lote11.md`). **Trecho não auditado:** os prompts e respostas anteriores aos lotes 01–24 originais (etapas 5–13, frentes A–BQ, N*), que só aparecem como planos arquivados em `.lovable/plan/` e nos `AGENTS.md`. Nenhum item dessas fases foi reclassificado aqui sem evidência atual em código ou banco.
- Resposta textual não foi aceita como prova: cada linha da matriz cita arquivo, teste ou contagem lida nesta rodada.

## 2. Evidências coletadas nesta rodada

| Verificação | Comando / fonte | Resultado |
|---|---|---|
| GitHub sync | API pública `commits/main` | `main` = `8026fe24` = último commit local antes deste registro |
| CI | API `actions/runs` | `8026fe24` success, `b5241a3f` success, `ecd46f3b` success, `5945ef4a` success |
| Integridade das migrations | `node scripts/check-migrations.mjs` | `migration integrity: ok` (507 drizzle + 49 supabase) |
| RLS | `pg_class` em `public` | 0 tabelas sem RLS |
| Escolas | `count(*) institutional_schools` | 55 (confere com a afirmação anterior; conferência por INEP fica no Lote 25) |
| Matrículas/enturmações | `count(*) class_enrollment_episodes` | 10.295 |
| Atuações | `count(*) institutional_engagements` | 2 (por isso quase nenhuma capacidade tem titular) |
| Acervo | `count(*) acv_spaces` | 0 |
| Emissões de relatório | `count(*) report_emissions` | 75 |
| Leitura técnica restrita | `capability_policy_rules`, `institutional_classes`, schema `drizzle` | acesso negado ao papel de auditoria — não verificável por esta via |

Testes não reexecutados nesta rodada (última execução registrada: Lote 22 — 991 arquivos, 7.334 passaram, 0 falhas; E2E 29/29 e 19/19; concorrência 2 PASS/2 BLOQUEADO). O resultado de CI verde em `8026fe24` cobre a suíte rápida e a profunda.

## 3. Achados transversais

- **Telas sem backend utilizável:** todas as consoles operacionais (Matrículas, Tecnologia, Permanência, Centro de Operações, Desenvolvimento) têm writers reais, mas o banco recusa gravação porque só existem 2 atuações e as capacidades não têm titular.
- **Serviços sem interface:** ~124 módulos de projeção sem tela (matriz L17).
- **Funcionalidades dependentes de dados inexistentes:** campanhas, quadro de vagas, regra de numeração, cursos/rubricas, espaços do Acervo, parâmetros de Matrículas, decisões de Tecnologia.
- **Duplicidade:** nenhuma tabela concorrente encontrada (testes de auditoria de Documentos, Operações e Tecnologia recusam duplicata e passam no CI).
- **Contradição de diretriz:** ato assinado exigido em 0501 × memória "nunca exigir ato" (P2-05).

## 4. Defeitos pequenos corrigidos

Nenhum defeito de baixo risco comprovado foi encontrado nesta rodada; P0-01 passou de parcial a concluído porque o CI do SHA mais recente está verde.

Matriz detalhada: `docs/matriz-unica-pendencias-sigem-2026-10.md`.
