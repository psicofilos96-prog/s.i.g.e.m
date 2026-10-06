# Frente V.1 — Fechamento da oferta/grade/regência 2027

## Mudanças (0143–0144, aditivas)
- **Cobertura integral da janela** (0143): grade e atribuição verificam a matriz em **todos os dias** da janela (`offer_matrix_applicable_throughout`); blocos da grade precisam caber na jornada em todos os dias (`offer_schedule_journey_gap`). Janela aberta vai até o fim do ano letivo da turma. Antes, só início/fim/inícios de versão eram verificados e lacunas intermediárias passavam.
- **Defeito real corrigido** (0144): `guard_class_time_root` (0129) lia `NEW.schedule_id` ao gravar jornada; **toda gravação de jornada falhava**. Revelado só pelo E2E positivo.
- **Advisor (V.1.2)**: `offer_capability_on` sem EXECUTE para authenticated (só chamado por DEFINER); readers da oferta sem EXECUTE para service_role. Demais achados = writers SECURITY DEFINER intencionais (sessão + capability + lock), aceitos.

## Limite conservador declarado
Vínculo, lotação, atuação e titular ainda exigem **um único registro** cobrindo a janela inteira: recusa lacunas e também coberturas por registros encadeados. Ampliar exige decisão.

## Prova E2E (`supabase/tests/v1_offer_e2e.sql`, rollback)
Resultado `v1-offer-e2e-ok`: anon/service_role negados; professor sem capability negado; jornada → grade → atribuição → substituição gravadas pela Direção sintética; recusas de bloco fora da jornada, item inexistente, lacuna intermediária da matriz (grade e atribuição), fronteira adjacente aceita, lotação parcial, vínculo de outra pessoa, duplicidade, cabeça desatualizada, substituto = titular, motivo vazio, lacuna intermediária da jornada; readers mostram titular + substituto só dentro da janela; saldo "não calculável"; prontidão bloqueada em preparação com motivos explícitos. Dublê único: resolvedor curricular U (provado nas suítes próprias). Contagens antes/depois idênticas; dublê desfeito.

## Pendente
- V1.6 smoke visual de `/turmas/oferta/$id` com login real (sem sessão a rota só pede login).
- Prontidão completa exige matriz U homologada e organização de períodos reais.

## Advisor (V.1.2) — 6 achados das funções da V
| Função | Razão | Risco | Mitigação | Decisão |
|---|---|---|---|---|
| record_class_journey_version | writer humano DEFINER | escrita sem RLS | sessão, capability na data, ano gravável, lock, cabeça esperada; sem anon/service_role | aceito |
| record_class_schedule_version | idem | idem | idem + matriz/jornada em toda a janela | aceito |
| record_teaching_assignment_version_v2 | idem | idem | idem + vínculo/lotação/atuação na janela | aceito |
| record_teaching_substitution_version | idem | idem | idem + titular e motivo | aceito |
| school_teaching_schedule_at | lê responsáveis de outras pessoas | exposição do quadro | capability da escola, senão `access-denied` | aceito |
| can_read_offer_organization | usado nas políticas RLS | nenhum (booleano) | só authenticated | aceito |
Endurecido (0143/0145): `offer_capability_on` sem authenticated; readers e triggers da oferta e helper legado B4.4 sem service_role. Contagem total: 330 (fim da V) → 340 hoje; o aumento veio das frentes W–AC, não da V. Os 3 achados para anon (`verify_school_document`, `public_portal_*`) são públicos por desenho e anteriores à V.

## Política v7
Homologada por `decisao-do-proprietario`, sem homologador nominal, como v5/v6 (decisão vigente do proprietário). A v8 traz as mesmas 10 regras da V. O E2E prova a capability: Direção autorizada, professor recusado.

## UI
`/turmas/oferta/$id` sem sessão: só pede login, sem aviso da própria rota (há um aviso de bundle de `horarios.tsx`, de outra rota). Campos de data usam `DateInput`. Capability lida no início do ano letivo; **corrigido**: sem datas do ano a página fica "indisponível" em vez de usar o relógio civil. Busca de profissional só exata (matrícula/QP-MEC). Saldo sem carga contratual = "não calculável". Smoke com sessão real: **pendente** (nenhuma conta do app corresponde ao usuário).
