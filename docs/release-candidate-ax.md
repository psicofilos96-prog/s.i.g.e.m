# SIGEM — Release Candidate técnico (AX, 2026-10-06)

Registro técnico, não fonte normativa. Não abre 2027 nem atribui papéis.

## Estado verificado
- Rotas: 199 arquivos de página; todas as estáticas respondem 200 (uma redireciona com 307 para o perfil padrão: `/regras-avaliativas`). Todo `to="/…"` estático do código aponta para rota existente.
- Banco: migrations 0000–0178 congeladas por hash (nenhuma histórica alterada); 0 tabelas sem RLS; 0 GRANT a anon em tabela; 0 funções DEFINER sem `search_path`; só 3 DEFINER executáveis sem login, todas públicas por desenho (`public_portal_list`, `public_portal_get`, `verify_school_document`).
- Advisor: 414 achados, 3 tipos conhecidos — 96 "RLS sem política" (tabelas acessíveis só por writer/reader DEFINER, fechamento intencional), 315 DEFINER executáveis por autenticado (writers/readers que verificam capability internamente), 3 públicas acima.
- Ambiente: `supabase/config.toml` e `.env` apontam só para o Cloud canônico; ref não canônico só aparece no gate de recusa e nos testes dele.
- Gates finais (após o último ajuste): 3.647 testes / 292 arquivos; invariantes profundas 31/31; typecheck limpo; build OK; diff-check limpo; E2E sintético da ficha escolar (versão, histórico, base superada, IDOR, sem pessoa) com rollback e zero resíduos.
- Dados: 55 escolas, 9.763 alunos, 698 turmas, 1 estado de ano (2026 histórico); 2027 fechado.

## Matriz de bloqueios (fail-closed correto, não bug)
| Tipo | Item |
|---|---|
| Configuração humana | Atribuir papéis reais e políticas de capability (REAL_ROLE_ASSIGNMENT_PENDING); capabilities sem política: supervisão, comunicação escolar, autorização de responsável, integrações, exportar-auditoria; homologar calendário 2027, matrizes, correspondências e políticas de avaliação/frequência/diário; abrir 2027 por ato humano |
| Regra institucional | Elegibilidade AEE; retenção/base legal/descarte (DATA_RETENTION/LEGAL_BASIS/DISPOSAL_POLICY_PENDING); limiar CIECE para contagens pequenas; visibilidade de tabelas de configuração e contatos das unidades para qualquer logado |
| Fonte documental | Layout Educacenso; arquivo DP; GPE; cardápios; catálogo de estoque; carga contratual; BNCC/SAEB; dados territoriais; modelos oficiais de documentos (OFFICIAL_TEMPLATES_PENDING) |
| Integração externa | Provedor de envio (e-mail/SMS); anexos de comunicados; provedor de monitoramento/alertas (EXTERNAL_MONITORING_PROVIDER_PENDING) |
| Validação humana de UI | Frentes AF–AW (HUMAN_UI_VALIDATION_PENDING / HUMAN_USABILITY_VALIDATION_PENDING) |
| Limitação de plataforma | Teste real de backup/restauração (PLATFORM_BACKUP_RESTORE_VALIDATION_PENDING); sem staging de banco (migrations antes da publicação); sessão não lê histórico de migrations |

## Riscos técnicos conhecidos
- Secretaria tem dois títulos principais (h1) — ajuste interno pendente.
- Readers não medidos com conta real com capability; sem teste de escrita simultânea em carga.
- Telas ainda não usam `governError` de forma uniforme.

## Configurar 2027 de forma controlada
1. Admin Geral (`admin@`) atribui atuações reais e homologa a política de capabilities.
2. Supervisão homologa o calendário 2027 (um único aplicável).
3. Rede homologa matrizes, correspondências e políticas avaliativas/frequência/diário.
4. Ato humano abre 2027; a virada não copia nem apaga 2026.
5. Secretarias fazem matrícula/enturmação pelos writers; conferir `/diagnostico` e `/auditoria`.

## O que NÃO fazer
- Não gravar por SQL direto, service_role ou `run_sql` em tabela governada; não criar contas, pessoas ou atos fictícios.
- Não editar migration aplicada; só forward-fix aditivo.
- Não abrir 2027 nem homologar fonte automaticamente; não preencher ausência com zero.
- Não apontar scripts para banco não canônico; não guardar dump com PII no repositório.
