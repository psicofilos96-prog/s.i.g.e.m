# Auditoria do amanhecer — consolidação após AQ–BA (2026-10-06)

HEAD `1a101516`. Nenhuma correção necessária; nada gravado.

## Gates
- Suíte: 3.655 testes / 293 arquivos, todos passando. Invariantes profundas 31/31.
- tsgo limpo; build OK; diff-check limpo; hashes de migrations congelados (invariante).
- Migrations aplicadas: 180 (0000–0178 + journal). Advisor: 414 (96 RLS sem política = fechado por desenho; 315 DEFINER p/ autenticado com capability interna; 3 públicas por desenho).
- Banco: 0 tabelas sem RLS, 0 GRANT a anon, 0 DEFINER sem search_path, 0 pessoas sintéticas.
- Ambiente: project_id canônico. 2026 `historico-importado`; 2027 não aberto. 55 escolas, 9.763 alunos, 698 turmas.
- Smoke: 11 rotas críticas 200.

## Regressões transversais
CURRENT_DATE só em migrations de supervisão (0174–0176) como data de registro, não como norma. service_role só em docs/manifesto. CPFs em `professional-identity-draft.ts` são marcadores `000.000.000-xx`, não PII. Nenhuma função legada reativada, migration histórica alterada ou fixture persistida detectada.

## Matriz de módulos
PASS: núcleo, cadastro escolar, Secretaria/Vida Escolar, ficha da unidade, relatórios, integridade, release candidate, preparação 2027, ajuda.
PARTIAL: Censo, AEE, cardápios, comunicação, gestão, supervisão, CIECE, estação administrativa, importações, simulação, privacidade, acessibilidade, desempenho, diagnóstico, matriz de acesso.

## Pendências
Ver `release-candidate-ax.md`, `matriz-de-acesso-az.md`, `guias-por-perfil-ba.md`.
