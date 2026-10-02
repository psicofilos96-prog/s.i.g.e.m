# B3 — Auditoria preparatória (Matrícula, Movimentação, Enturmação)

Somente diagnóstico. Nenhum código, migration ou dado foi alterado. Ao aprovar este plano, nada é implementado: ele serve de base para a especificação da B3.

## 1. Estruturas existentes (Cloud + migrations)

| Tabela | Origem | Versionamento | Gatilhos |
|---|---|---|---|
| `school_enrollments` | 20260929020412 + 14.5 (20260929034657) | `supersedes_id` (cadeia por linha, sem logical_id/version) | `immutable_enrollments` |
| `school_enrollment_endings` | 14.5 | PK = enrollment_id (um término, sem correção) | imutável |
| `class_enrollment_episodes` | 20260929020412 + 14.5 | `supersedes_id` | `guard_episode` (sobreposição), imutável |
| `class_enrollment_episode_endings` | 20260929020412 | PK = episode_id | `guard_ending`, imutável |
| `student_movement_events` | 14.5 | `logical_id` + `version` + `supersedes_id`, lock advisory, base esperada | imutável |
| `movement_type_definitions` | 14.5 | (id, version), status rascunho/homologada | imutável |

Escritores (SECURITY DEFINER): `register_school_enrollment`, `record_school_enrollment_ending`, `register_class_enrollment_episode`, `record_class_episode_ending`, `record_student_movement`. Leitura: `can_read_class_roster`, `locate_student_for_enrollment` (B2.2).
RLS: somente políticas SELECT (por `consultar-matricula-e-movimentacao` na escola, por capacidade de turma via episódio, por roster).

## 2. Temporalidade e "última versão"
- Matrícula/episódio: só `supersedes_id`; "vigente" = linha não substituída. Sem `logical_id`, sem número de versão.
- Vigência: matrícula tem `opened_on` (anulável) + término em tabela própria; episódio tem `valid_from` + `ended_on` no término. Término não é versionável (correção impossível).
- `created_at` existe em todas → `knownAt` é derivável, mas nenhum reader o usa.
- `currentVersions()` ainda governa: `ciece/fact-loader.ts:107` (episódios), `ciece/fact-adapters.ts:260/280/312` (matrícula, movimentação), `students/institutional-roster.ts:64` (Diário), `student-life/institutional-enrollment.ts:90/115`.

## 3. Validações dos escritores
- `register_school_enrollment`: sessão, capacidade escolar, escola existe. Não valida: escola ativa na data, `cycle_id` contra ano letivo B2.4 (texto livre), sobreposição de matrícula do mesmo estudante/escola/ano, lock na criação (apenas na correção).
- `register_class_enrollment_episode`: turma da mesma escola. Não valida: ano da turma = ano da matrícula, turma ativa na data (`class_at`), `valid_from` dentro da vigência da matrícula, sobreposição entre turmas diferentes (só bloqueia a mesma turma). Grava `class_label_snapshot` = `institutional_classes.name` (legado).
- Términos: sem `ended_on >= início` comprovado na função de matrícula, sem catálogo para `bond_status_id`/`reason_label` (texto livre), `recorded_by` ausente no término de episódio.
- `record_student_movement`: o mais sólido (tipo homologado, base esperada, lock, motivo de correção, polos JSON). Não valida coerência com a matrícula/escola dos polos nem `effective_on`.

## 4. Capacidades (v1 e v2 draft, nenhuma homologada)
- `consultar-matricula-e-movimentacao`: direcao-escolar {school}, orientacao-pedagogica {school,class}, secretaria-escolar {school} (v1 e v2).
- `manter-matricula-e-enturmacao`: secretaria-escolar {school} (v1 e v2) — uma só capacidade cobre matrícula E enturmação.
- `registrar-movimentacao-escolar`: secretaria-escolar {school} (v1 e v2).
- `localizar-estudante-para-matricula`: secretaria-escolar {school} (só v2).

## 5. Reader bitemporal
Não existe para matrícula, término, movimentação nem enturmação. Falta: readers `*_at(validOn, knownAt)` análogos a `class_at`, que filtrem por `created_at <= knownAt`, resolvam a cadeia conhecida naquele instante e retornem ambiguidade em vez de escolher.

## 6. Telas
- `/matriculas`, `/matriculas/nova`, `/enturmacoes`, `/enturmacoes/nova`, `/enturmacoes/movimentar`, `/transferencias`: sem nenhuma leitura do banco — somente demonstração (protótipos 8A–8F / 13B–13D em memória).
- `/alunos`: identidade B2.2 (já institucional). Não há tela institucional de matrícula, término, enturmação ou movimentação.

## 7. Consumidores
- CIECE: `fact-loader.ts` + `fact-adapters.ts` (matrícula, episódio, movimentação via `currentVersions`). Mapa herda do CIECE.
- Diário: `institutional-roster.ts` (`rosterStudents()` via episódios + `currentVersions`).

## 8. Dados no Cloud (contagens)
Todas zero: matrículas 0, términos 0, episódios 0, términos de episódio 0, movimentações 0, tipos de movimentação 0, estudantes 0, turmas 0, escolas 0, valores de catálogo 0.

## 9. Catálogos/normas
- Tipos de movimentação: tabela própria existe, 0 tipos, 0 homologados → `record_student_movement` hoje sempre recusa.
- Situação do vínculo (`bond_status_id`) e motivo de término de enturmação: sem catálogo, texto livre.
- Nenhum valor homologado. Nenhum valor será inventado.

## 10. AEE/participação complementar
Existe apenas no domínio em memória 13C (`class-allocation-*`: natureza de participação, coexistência entre participações). Não existe tabela, writer, RLS nem capacidade no Cloud. Fora da B3 salvo decisão explícita.

## 11. Capacidade/ocupação
Existe só como `ClassCapacityRecord` temporal em memória (`class-allocation-capacity.ts`), separado da turma. `institutional_classes` não tem campo de capacidade (correto). Nada no Cloud; pertence a etapa própria (não B3 mínima).

## 12. Dívidas de segurança
- EXECUTE dos 5 escritores e de `can_read_class_roster` está concedido a PUBLIC e `anon` (o REVOKE da 14.5 não se mantém no Cloud). As funções recusam sem sessão, mas o ACL contraria o padrão.
- `authenticated` e `anon` têm INSERT/SELECT de tabela nas 6 tabelas; RLS (só SELECT) bloqueia DML, mas a grant é excessiva.
- `sandbox_exec` com INSERT nas tabelas (ambiente, não app).
- `has_school_capability` usa `current_date` — escrita retroativa avaliada pela atuação de hoje.
- Sem uso de service_role no frontend para essas tabelas.

## 13. Decisões institucionais bloqueantes
1. Catálogo de tipos de movimentação (quais existem, homologação).
2. Catálogo de situação de vínculo ao término e de motivos de término de enturmação.
3. Cardinalidade: um estudante pode ter mais de um episódio regular simultâneo em turmas diferentes? (hoje não há regra).
4. Unicidade de matrícula por estudante+escola+ano (permitida reabertura no mesmo ano?).
5. Se matrícula e enturmação seguem numa capacidade única ou se separam (v2 hoje: única).

## Síntese

**A. Reutilizável:** as 6 tabelas, cadeia append-only, `record_student_movement` (modelo de referência), capacidades v1/v2, `locate_student_for_enrollment`, RLS de leitura, domínio puro `institutional-enrollment.ts`.

**B. Hardening:** ACL EXECUTE/tabela; validação ano da turma = ano da matrícula, `cycle_id` → ano letivo B2.4, turma/escola ativas na data, `valid_from` dentro da matrícula, lock e base esperada na criação, término versionável/corrigível, `recorded_by` no término de episódio, abandono de `class_label_snapshot` como verdade.

**C. Falta:** readers bitemporais (`school_enrollment_at`, `class_enrollment_at`, `student_movement_at`); telas institucionais de matrícula/enturmação/movimentação; migração de CIECE, Mapa e Diário para esses readers; administração de tipos de movimentação.

**D. Não homologado:** itens 13.1–13.5.

**E. Proposta mínima (3 blocos):**
1. **Banco (uma migration):** ACL corrigido; hardening dos 4 escritores de matrícula/enturmação; términos corrigíveis por versão; readers bitemporais das três estruturas; writer de catálogo para tipos de movimentação e situações (reuso de `attribute_value_definitions` onde couber), sem semear valores.
2. **Fontes e consumidores:** `institutional-enrollment-source.ts` sobre os readers; CIECE, Mapa e roster do Diário migrados para os readers com `BitemporalContext`; remoção de `currentVersions` nesses três pontos.
3. **Telas institucionais:** matrícula, término, enturmação e movimentação com sessão (demo só sem sessão), gating por capacidade; testes temporais (antes/depois de correção, ausência, ambiguidade), suíte, typecheck, build.

**F. Pode implementar agora sem inventar norma?** Sim, parcialmente: blocos 1–3 podem ser entregues com catálogos vazios e falha fechada (movimentação recusada até haver tipo homologado; término exige situação de catálogo; cardinalidade entre turmas diferentes fica bloqueada ou não decidida, conforme item 13.3). Operação real depende das decisões 13.1–13.4. AEE e capacidade/ocupação ficam fora.
