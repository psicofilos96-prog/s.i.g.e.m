# Frente U — Matriz curricular, organização pedagógica 2027 e designação das turmas

Status: **PASS técnico — READY_FOR_HUMAN_CURRICULAR_OPERATION**. Nenhum ato humano simulado; 2027 não aberto; nenhuma turma criada ou renomeada.

## Decisões R4/R6/R7/R8 (proprietário, 2026-10-05)
Ver `docs/b4-2-classificacao-proposta-d1.md` §8. Gate puro: `src/features/classes/pedagogical-readiness.ts` (pendências `natureza-nao-definida`, `sem-posicao`, `sem-matriz`, `matriz-ambigua`, `inconsistencia-temporal`, `jornada-nao-definida`).

## Posição ≠ turma
Posição curricular individual (B3.3) pertence ao estudante na alocação. Categoria de designação (U.5) pertence à turma, só nomeia e não tem efeito curricular. Nome/código nunca alimenta posição, etapa, modalidade, matriz ou regência.

## Fluxo posição → matriz
Alocação → posição B3.3 → perfil E2 + correspondência E3 homologados (dado versionado) → matriz B4.1 vigente/homologada. E4 é exceção explícita da turma, nunca fallback. Readers existentes (`class_curricular_resolution_context_at`, `student_curricular_matrix_at`) já expõem `ausente:correspondencia`, `inconsistente:correspondencia-ambigua`, `nao-aplicavel:natureza`; a U não criou segunda arquitetura.

## 22 posições
Contrato `docs/data/d1-contrato-canonico-cme-3-2026.json` e fonte `deliberacao-cme-3-2026-matrizes-source.json` preservados (SHA registrado); literais (`X`, `--`, `*`, `1*`, números, `35h`) seguem texto; advertência do Anexo IV preservada; data do ato não é data de publicação. Importação só pelo importador governado D1 sob sessão humana.

## Jornada da EI (U.4)
Dimensão da turma; integral = ampliação curricular; turno ≠ jornada. Sem valores aprovados: pendência `jornada-nao-definida`, que não bloqueia o resto da U.

## Política de designação de turmas (migration 0126)
- `class_designation_category_versions`: categoria da turma (ex.: `ef-5-ano`), append-only, gravada só por `record_class_designation_category` (sessão → pessoa → `manter-cadastro-de-turmas` na escola → ano em preparação/operacional).
- `class_designation_policy_versions` + `class_designation_policy_homologations`: critério fechado `ordinal-por-categoria` (`prefixes`, `first_ordinal`, `ordinal_width`), validado no banco; expressão/SQL/código recusados; rascunho e homologação por pessoas distintas (`manter-catalogos-institucionais`, rede).
- `class_designation_reservations`: designação oficial; `UNIQUE(escola, ano, categoria, ordinal)` + lock consultivo; ordinal = maior já reservado + 1 (nunca reutiliza encerrado, nunca compacta); sem turno no código.
- `assign_class_designation` só consome política HOMOLOGADA vigente (0 ⇒ `designation:no-homologated-policy`; >1 ⇒ `designation:ambiguous-policies`); categoria fora da política ⇒ `designation:rule-not-defined`; ano histórico ⇒ recusa. anon/service_role sem EXECUTE; nenhum DML direto.
- 2026 nunca é renomeado retroativamente.

## Prévia para o Gabinete
`/turmas/designacao-previa`: simulação pura da proposta EF (100…900, rascunho do proprietário, **não** aprovada pelo Gabinete); não grava. Categoria não registrada ⇒ "não determinável"; EI/EJA/AEE/complementar/multietapa ⇒ "regra ainda não definida"; posições divergentes da categoria ⇒ conferência, sem correção automática. Hoje todas as turmas aparecem como "não determinável", porque nenhuma categoria foi registrada.

## Pendências humanas reais
Homologar valores de `natureza-da-turma` e das 22 posições no catálogo; Supervisão construir/homologar matrizes, perfil E2 e correspondências E3; Gabinete decidir a designação e, se aprovada, redigir/homologar a política; Secretaria registrar categorias e posições em 2027; valores da jornada EI.

## Fronteira
Sem grade, regência, jornada profissional, Diário completo, necessidade de professor, BNCC/SAEB (V/W/X).

## Fechamento U.1 (migrations 0127/0128)
- service_role sem INSERT/UPDATE/DELETE/TRUNCATE nas quatro tabelas de designação; só SELECT permanece. Gravação continua só pelas funções com sessão, pessoa, permissão e escopo.
- Vigência resolvida pelo início oficial (`starts_on`) da versão vigente do ano letivo da turma (`designation_year_valid_on`), nunca pelo relógio; política só de 2026 não nomeia turma de 2027.
- Ambiguidade por categoria: só políticas homologadas que cobrem a categoria da turma contam; 0 ⇒ `designation:rule-not-defined`; >1 chaves ⇒ `designation:ambiguous-policies`; versões sucessivas da mesma chave não geram ambiguidade; políticas de categorias distintas coexistem.
- Cadeia no banco (gatilho): raiz = v1, sucessor da mesma chave, versão +1, sem bifurcação nem segunda raiz; legado incoerente ⇒ `designation:policy-chain-inconsistent`. 0128 corrigiu a conjunção da verificação de cadeia de 0127.
- Prova: `supabase/tests/u_class_designation_policy_u1.sql` (termina em `u1-designation-tests-ok`, sem resíduo).
