# B2.4 — Ano e organização de períodos letivos

Implementação concluída, homologada tecnicamente e congelada em 30/09/2026. As migrations `20260930083550_b2_4_academic_year_period_organizations.sql` e `20260930101848_b2_4_temporal_period_overlap.sql` foram aplicadas explicitamente à Lovable Cloud oficial e registradas uma vez cada no histórico, antes do merge do PR #1. A v1 permanece com 108 regras e a v2 com 114, ambas `draft`; nenhuma política foi homologada. Não houve cadastro de anos, organizações, períodos ou associações de turmas. A validação operacional com login institucional real permanece pendente para a bateria vertical.

## Fonte institucional

`institutional_academic_years` é a identidade permanente do ano. `institutional_academic_year_versions` registra nome, limites, situação, vigência e proveniência. `institutional_period_organizations` representa a organização oficial dos períodos para um ano, reutilizada semanticamente como `AssessmentPeriodStructure`. `institutional_period_organization_versions` registra nome e situação. A identidade preexistente `institutional_academic_periods` passa a pertencer obrigatoriamente a uma organização e um ano, com versões em `institutional_academic_period_versions`. Não existe enumeração de bimestre, trimestre, semestre ou modalidade. A correção gera uma nova versão e não altera a anterior.

Períodos ativos da mesma organização não podem se sobrepor. Organizações diferentes podem coexistir no mesmo ano com datas coincidentes. Cada período deve caber nos limites oficiais do ano. As funções `register_academic_year_version`, `register_period_organization_version` e `register_academic_period_version` verificam essas invariantes e exigem a capacidade `manter-anos-e-periodos-letivos` de `cadastro-institucional-da-rede` com atuação vigente de rede. A migration acrescenta uma única regra ao rascunho v2 (114), preservando v1 (108) e ambas em `draft`.

## Dependência da Turma

`institutional_class_period_organization_versions` reserva a referência histórica explícita Turma → Organização. A B2.4 não cria associação nem oferece escrita para ela: o fluxo operacional e seus atos pertencem à etapa proprietária da Turma. O adaptador `loadOfficialTimelineForClass` exige a associação vigente da turma e verifica a compatibilidade com o ano oficial. Sem ela, Pauta, Mesa e Fechamento ficam indisponíveis; não consultam todos os períodos do ano nem escolhem pela configuração avaliativa, modalidade, nome ou datas. A configuração avaliativa consome a organização indicada pela turma.

O Calendário Escolar ainda mantém estrutura local no navegador. A integração com a fonte institucional pertence à B4; ele não define a organização de períodos nesta etapa. A grade pertence à B4, e matrícula/enturmação operacionais à B3.

## Verificação e pendência operacional

Os oito cenários de `supabase/tests/b2_4_academic_period_organizations.sql` passaram na Cloud dentro de uma transação revertida, com a definição corretiva aplicada apenas durante o teste. Após a aplicação definitiva e o merge do PR #1, a reconciliação confirmou as duas migrations registradas uma vez cada, a função temporal com hash `57112723eff1fa68263575b49409fb6b`, políticas e dados institucionais inalterados. Na `main` mergeada, o build passou e a suíte completa passou com quatro workers (2.333/2.333 testes). Com paralelismo padrão, um teste assíncrono não modificado do CIECE atingiu seu prazo; o arquivo passou isolado (13/13).

A tela `/administracao` e os fluxos de autorização ainda precisam de validação com login institucional real após vigência de uma política homologada que contenha a nova capacidade. Enquanto v1 e v2 permanecerem em rascunho, não há concessão operacional dessa capacidade. Nenhum ano, organização, período ou vínculo Turma → Organização oficial foi cadastrado. A integração do Calendário permanece reservada à B4.
