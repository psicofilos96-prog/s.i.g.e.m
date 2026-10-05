# Jornadas profissionais EducaCenso 2026 (Frente E)

## Estado
**Carga real BLOQUEADA POR FONTE AUSENTE e por dependências não carregadas, não por login.**
- O ambiente do agente não recebeu `Todas as jornadas.xlsx`.
- As fontes de reconciliação também não chegaram: `Todos os prof.xlsx` e `Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx`.
- A Cloud ainda não tem pessoas, vínculos nem turmas EducaCenso (Frentes C e D aguardam planilhas).

Como a fonte de jornada só referencia fatos existentes, nada pode ser carregado antes de C e D.

## Contrato (`src/features/schedules/educacenso-professional-schedule-staging.ts`)
- **Só referencia:** cada linha referencia pessoa e vínculo (fingerprints do pipeline seguro), escola INEP e turma EducaCenso já canônicas. Referência sem correspondência é evidência; nada é criado.
- **Situação de cada linha:**
  - **confirmado:** todas as referências batem.
  - **divergente:** sobreposição de horário, vínculo sem lotação na escola, ou duas fontes diferentes.
  - **incompleto:** horário ausente ou inválido.
  - **sem correspondência:** pessoa, vínculo, escola ou turma não encontrados.
  - **desatualizado:** só existirá quando houver vigência canônica posterior; não é inferido.
- **Sobreposição:** é medida pela pessoa, atravessando vínculos.
- **Carga:** comparada só quando a fonte declara e o vínculo tem carga contratual. Nenhuma faixa ou norma de carga é presumida.
- **Fontes diferentes:** `compareScheduleSources` gera evidência para revisão, sem escolher vencedora.
- **Totais por escola e situação:** para reconciliação, sem esconder divergências.
- **Evidências:** referências sempre truncadas. Nunca contêm CPF, matrícula, nome ou chave completa.

## Integração prevista (B4.3/B4.4/B4.5)
A carga confirmada entrará pelos writers e readers existentes de jornada e grade (`class_journey_*`, `class_schedule_*`, `professional_journey`), com um núcleo comum e a operação `technical_import_educacenso_2026_professional_schedules` sobre a camada 0100: source hash, fingerprint do payload, idempotência e base esperada.
- Linhas divergentes, incompletas ou sem correspondência ficam como evidência para revisão, nunca corrigidas automaticamente.
- Regência não é criada pela jornada.
