# B3.3 — Posição curricular individual na alocação (planejamento)

## Objetivo
Registrar, para cada alocação (enturmação), a posição curricular do estudante (etapa/segmento, ano/fase) como fato próprio, versionado e bitemporal. Isso é a base que a B4.2 vai consumir. Nada é inferido a partir da turma. Nenhum valor é semeado. Nenhuma associação a matriz é feita.

## Estado verificado
- `class_enrollment_episodes` (alocação) tem `logical_id`, `participation_logical_id`, `class_id`, `valid_from`, `supersedes_id` e `correction_reason`. Não tem nenhum campo de etapa/ano/fase.
- O término da alocação é fato separado (`class_allocation_ending_versions`).
- `cycle_participations` já guarda a natureza da participação em `nature_scheme_id`/`nature_value_id`/`nature_version` (catálogo aberto). É ali que AEE ou atividade complementar se distinguem, não na etapa.
- Catálogo aberto: `attribute_value_definitions` (scheme, value, version, status, homologation_act_ref, valid_from), lido por `homologated_attribute_values(_scheme, _on)`.
- Volume na Cloud: 0 alocações, 0 participações, 0 valores de catálogo.
- Writer `record_class_allocation` (9 argumentos, B3.2): SECURITY DEFINER, `search_path=''`, capability `manter-matricula-e-enturmacao` por escola. Reader: `class_allocations_at(school, class, validOn, knownAt)`.

## Contrato técnico proposto
Fato filho, separado da alocação: a alocação continua como está, sem coluna nova e sem mudança de assinatura.

```text
class_allocation_curricular_positions  (append-only, imutável por trigger)
  id uuid PK, position_logical_id text, version int, supersedes_id uuid
  allocation_logical_id text  -> alocação existente (mesma escola)
  school_id, class_id (snapshot de integridade)
  valid_from date, valid_until date null
  annulled bool (retificação que retira)
  originating_act_ref, change_reason, recorded_by, created_at
  unique(position_logical_id, version)

class_allocation_curricular_position_axes  (filho imutável da versão)
  position_version_id, scheme_id, value_id, value_version
  PK(position_version_id, scheme_id)
```
- Eixos abertos, como na Oferta B2.6. O motor não conhece "etapa" nem "ano": cada eixo é um par `scheme_id`/valor homologado. O papel de cada esquema (qual é etapa, qual é ano/fase) é configuração da D1, não coluna.
- Writer `record_allocation_curricular_position(...)`:
  - SECURITY DEFINER, `search_path=''`, e a mesma capability por escola da enturmação (não cria capability nova).
  - Exige a alocação head não anulada e a vigência contida na vigência da alocação. Se a alocação tiver término, `valid_until` é obrigatório e não pode passar dele.
  - Cada valor deve ser homologado em toda a vigência, verificado por segmentos (padrão B4.1.1). Com catálogo vazio, a recusa é `position:value-not-homologated`.
  - Exige base esperada (optimistic concurrency) e motivo obrigatório na retificação.
  - Não admite sobreposição de posições não anuladas para a mesma alocação. Mudança de etapa ao longo do ano se faz encerrando uma posição e constituindo outra; ambiguidade estrutural vira recusa.
  - Lock consultivo por alocação.
- Reader `allocation_curricular_positions_at(school, class, validOn, knownAt)`, SECURITY INVOKER, com a mesma RLS de leitura de roster:
  - devolve 0 linhas quando não há posição (ausência explícita);
  - devolve inconsistência quando houver mais de uma (defensivo);
  - correção posterior não altera o resultado consultado com `knownAt` anterior.
- ACL:
  - EXECUTE dos writers revogado de PUBLIC/anon;
  - tabelas sem INSERT/UPDATE/DELETE direto;
  - SELECT apenas via policy de escola;
  - sem service_role no navegador.
- TypeScript: o source `allocation-curricular-position-source.ts` mapeia o reader. A tela de enturmação mostra "Posição curricular não registrada" e só oferece edição com capability efetiva. Sem sessão, o laboratório permanece. Não há fallback para `stageId` ou para nome da turma.
- Testes:
  - SQL real na Cloud com rollback, cobrindo: sessão, ACL, catálogo vazio fail-closed, fora da vigência da alocação, sobreposição, retificação, knownAt histórico, alocação de outra escola, escrita direta recusada e zero resíduos;
  - regressões B3.1/B3.2/B4.1;
  - testes focais TypeScript, suíte, typecheck, build e diff-check.

## Fora do escopo
Correspondência posição→matriz, associação automática, cobertura por turma, cadastro de valores de catálogo, AEE como etapa e qualquer mudança em alocações existentes, policies ou migrations históricas.

## Decisões institucionais indispensáveis (antes de implementar)
1. **Onde a posição vive:** confirmar que etapa/ano/fase é fato da alocação (enturmação), e não da participação ou da inscrição no ciclo. Isso afeta quem corrige e a vigência.
2. **Competência:** confirmar que a mesma atuação que enturma (`manter-matricula-e-enturmacao`, escola) registra e corrige a posição, ou indicar outra.
3. **Mudança dentro da mesma alocação:** pode o estudante mudar de ano/fase sem trocar de alocação (posições sucessivas), ou toda mudança exige nova alocação?
4. **Obrigatoriedade:** a posição é obrigatória para alocações regulares ou apenas opcional (ausência sinalizada)? Proposta padrão: opcional, sinalizada.

## Decisões técnicas que posso tomar
- Tabela filha separada e eixos abertos, em vez de colunas fixas de etapa/ano.
- Uma posição vigente por alocação e data, recusando sobreposição.
- Reaproveitar o padrão de segmentos de homologação, locks, base esperada e readers bitemporais.
- Nomes, códigos de erro, assinatura do writer, layout da UI e testes.

## Ainda pendente para a B4.2 (não decidido aqui)
- D1: quais esquemas representam etapa, ano/fase, modalidade, natureza e jornada.
- Homologação dos valores e da correspondência posição→matriz.
- Homologação das políticas v1/v2.
