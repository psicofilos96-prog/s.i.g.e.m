# Auditoria integrada pós W.2/Z.2/AA.2/AB.2/AC.2/AD.2 (2026-10-06)

Registro de auditoria, não fonte normativa.

## Defeito corrigido
- 0163: 24 tabelas de fatos/normas governados (ano operacional, ocorrências de frequência,
  políticas do Diário, anexos de plano, avaliação/instrumentos/itens/normas, situação
  acadêmica, colegiado, fechamento de ciclo, parecer EI, instrumentos docentes) ainda
  tinham INSERT/UPDATE/DELETE herdados para anon/authenticated/service_role. RLS
  barrava os clientes, mas service_role ignora RLS. Revogação aditiva; SELECT mantido;
  writers DEFINER inalterados. Nenhum código do app gravava nessas tabelas diretamente.

## Regressões cruzadas
- CURRENT_DATE remanescente (0137/0140/0142/0153/0155/0156): só (a) recusa de data
  futura de intervenção, (b) leitura familiar "hoje", (c) capability do autor no instante
  do ato. Nenhum autoriza fato futuro/histórico. 0151 aposentou as variantes antigas.
- Writers v1 aposentados: zero usos em `src/`; deprecados sem EXECUTE para clientes,
  exceto `applicable_diary_policy` (leitura, sem consumidor W) e
  `install_sigem_reviewed` (B1.3, compatibilidade documentada).
- Migrations históricas: diff vazio; freeze OK.
- 2026 `historico-importado`; 2027 sem estado. Resíduos de teste: zero.

## Pendência registrada (decisão institucional, não corrigida)
- service_role mantém DML em tabelas operacionais fora de W–AD (integração, webhooks,
  notificações, importação, inclusão, cadastros funcionais etc.); parte é usada pelo
  servidor. Revogar exige decisão por domínio.
