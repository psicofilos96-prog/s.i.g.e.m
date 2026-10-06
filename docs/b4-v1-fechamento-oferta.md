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
