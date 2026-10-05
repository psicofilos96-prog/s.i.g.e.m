# Frente U — Matriz curricular, organização pedagógica 2027 e designação das turmas

Escopo: fechar a cadeia aluno → vínculo 2027 → alocação → posição individual → correspondência homologada → matriz → organização da turma, reaproveitando B2.6/B3.3/B4.1/B4.2/E1–E4. Não abre 2027, não cria atos reais, não simula autoria humana. Não inicia V/W/X.

## U.1 — Decisões R4/R6/R7/R8 (documentais + gates)
- Docs `b4-2-classificacao-proposta-d1.md`, `b4-2-planejamento-turma-matriz.md`, `b3-3-posicao-curricular-alocacao.md`: marcar R4/R6/R7/R8 como DECIDIDO 2026-10-05, com linha de histórico preservando o texto anterior.
- R4: eixo `natureza-da-turma` da Oferta B2.6 com valores `regular`, `aee`, `atividade-complementar` como proposta de catálogo pronta para o writer canônico `record_attribute_value_version` (sem semear valores; a homologação é ato humano de `manter-catalogos-institucionais`). Reader da resolução exclui `aee`/`atividade-complementar` da correspondência regular; natureza ausente ⇒ pendência "natureza não definida".
- R6/R7/R8: um único gate puro `pedagogical-readiness.ts` consumindo os readers já existentes (`class_allocations_at`, `allocation_curricular_positions_at`, `class_curricular_resolution_context_at`):
  - alocação regular sem posição ⇒ `sem-posicao` (bloqueia);
  - posição com 0 correspondências ⇒ `sem-matriz`; >1 ⇒ `matriz-ambigua` (por posição/alocação, nunca por turma);
  - turma multietapa ⇒ união das matrizes resolvidas, válida;
  - posição só produz efeito dentro da vigência da alocação (recorte no reader, sem encerramento manual, sem apagar histórico); inconsistência temporal ⇒ `inconsistencia-temporal`.

## U.2/U.3 — 22 posições e E1–E3
- Auditar `d1-import.ts` e os 7 RPCs R5: confirmar contrato de 22 posições, literais (`X`, `--`, `*`, `1*`, números, `35h`) como texto, advertência do Anexo IV, data do ato ≠ publicação. Ajustes só se houver divergência.
- Testes contratuais: correspondência é dado (sem if/else por posição), sucessão preserva histórico, E4 nunca é fallback, knownAt/validOn preservados.

## U.4 — Jornada EI
- Pendência estruturada `jornada-nao-definida` só quando a correspondência exigir a dimensão; sem valores inventados. Não bloqueia as demais partes.

## U.5 — Política de designação de turmas
Migration aditiva (nova):
- `class_designation_policies` + versões append-only (rascunho → homologada; imutável após homologação), critério de tipo fechado: `ordinal-por-posicao` com parâmetros validados (mapa posição→prefixo, ex. `5-ano`→`5`, início `00`); tipos desconhecidos, expressões, SQL ou código recusados.
- `class_designation_versions` append-only por turma (designação, política/versão usada, autoria humana).
- Writer `propose_class_designation(_class, _position, _expected_head)`: sessão → pessoa → atuação escolar → capability `manter-cadastro-de-turmas`; `pg_advisory_xact_lock(escola, ano, posição)`; menor ordinal livre a partir de x00; não renumera turmas encerradas; turno ignorado; multietapa/EI/EJA/AEE/complementar ⇒ `designation:rule-not-defined`.
- Proposta EF registrada como rascunho de produto ("aprovada pelo proprietário; aguardando Gabinete") — sem homologar.
- ACL: EXECUTE só para authenticated; anon/service_role revogados; nenhum DML direto.
- 2026 nunca renomeado.

Preview para o Gabinete (somente leitura, `/turmas/designacao-previa`):
- por escola/ano: designação atual, posição/oferta conhecida por fonte canônica, designação proposta, conflitos/duplicidades/lacunas, "não determinável" quando não há base; resumo agregado; exportação pelo motor de relatórios existente. Nenhuma inferência por nome/código.

## U.6 — UX 2027
- Painel "Prontidão pedagógica 2027" por escola/turma em `/preparacao-ano`: natureza, designação, alocações, posição, matriz resolvida e pendências por extenso. Ausente nunca vira zero.

## U.8 — Testes e gates
- Vitest: R4, R6, R7 (1/0/2/multietapa), R8, bitemporal, nomenclatura (500/501/502; escolas e anos distintos; turno; encerramento sem renumerar; multietapa recusada; versionamento), preview sem inferência.
- SQL rollback `supabase/tests/u_designation_readiness.sql` com dados sintéticos e RAISE final; verificação de zero resíduo; ACL anon/sem pessoa/sem capability/service_role.
- Suíte completa, tsgo, build, integridade (`invariants:freeze-migrations`), audit SQL, diff-check, Advisor antes/depois.

## Documentação
- `docs/frente-u-organizacao-pedagogica-2027.md` (decisões, posição ≠ turma, fluxo posição→matriz, política de designação, preview, pendências, fronteira V/W/X); delta em roadmap/auditoria/AGENTS.

## Pendências humanas esperadas (não simuladas)
Homologar valores de `natureza-da-turma`, homologar as 22 posições no catálogo, construir/homologar matrizes e correspondências E1–E3 pela Supervisão, decisão do Gabinete sobre a designação, valores da jornada EI.
