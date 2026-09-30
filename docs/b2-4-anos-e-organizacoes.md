# B2.4 — Ano e organização de períodos letivos

Implementação de 30/09/2026. O banco Cloud tinha v1 com 108 regras e v2 com 113, ambas `draft`, antes desta migration. A migration foi aplicada na Cloud vinculada ao Lovable: v1 continuou com 108 regras e v2 passou a 114, ambas `draft`. Não houve cadastro de anos, organizações, períodos ou associações de turmas. A homologação operacional permanece verificação separada; este documento não declara a etapa congelada.

## Fonte institucional

`institutional_academic_years` é a identidade permanente do ano. `institutional_academic_year_versions` registra nome, limites, situação, vigência e proveniência. `institutional_period_organizations` representa a organização oficial dos períodos para um ano, reutilizada semanticamente como `AssessmentPeriodStructure`. `institutional_period_organization_versions` registra nome e situação. A identidade preexistente `institutional_academic_periods` passa a pertencer obrigatoriamente a uma organização e um ano, com versões em `institutional_academic_period_versions`. Não existe enumeração de bimestre, trimestre, semestre ou modalidade. A correção gera uma nova versão e não altera a anterior.

Períodos ativos da mesma organização não podem se sobrepor. Organizações diferentes podem coexistir no mesmo ano com datas coincidentes. Cada período deve caber nos limites oficiais do ano. As funções `register_academic_year_version`, `register_period_organization_version` e `register_academic_period_version` verificam essas invariantes e exigem a capacidade `manter-anos-e-periodos-letivos` de `cadastro-institucional-da-rede` com atuação vigente de rede. A migration acrescenta uma única regra ao rascunho v2 (114), preservando v1 (108) e ambas em `draft`.

## Dependência da Turma

`institutional_class_period_organization_versions` reserva a referência histórica explícita Turma → Organização. A B2.4 não cria associação nem oferece escrita para ela: o fluxo operacional e seus atos pertencem à etapa proprietária da Turma. O adaptador `loadOfficialTimelineForClass` exige a associação vigente da turma e verifica a compatibilidade com o ano oficial. Sem ela, Pauta, Mesa e Fechamento ficam indisponíveis; não consultam todos os períodos do ano nem escolhem pela configuração avaliativa, modalidade, nome ou datas. A configuração avaliativa consome a organização indicada pela turma.

O Calendário Escolar ainda mantém estrutura local no navegador. A integração com a fonte institucional pertence à B4; ele não define a organização de períodos nesta etapa. A grade pertence à B4, e matrícula/enturmação operacionais à B3.

## Verificação pendente

Executar o teste SQL `supabase/tests/b2_4_academic_period_organizations.sql` em banco de teste. A tela `/administracao` e os fluxos de autorização precisam de validação com login institucional real após vigência de uma política homologada que contenha a nova capacidade. Enquanto v1 e v2 permanecerem em rascunho, não há concessão operacional dessa capacidade.
