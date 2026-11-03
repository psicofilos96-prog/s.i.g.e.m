# Acompanhamento institucional de unidades escolares — invariantes do domínio

- **Origem do instrumento:** seção 4 do documento de acompanhamento recebido em 03/11/2026. Os itens são: unidade escolar; diagnóstico; pontos fortes; fragilidades; plano de ação; responsáveis; prazos; acompanhamento.
- **Responsabilidades:** dois servidores designados registram visitas e evolução. Gabinete lê, filtra e acompanha a rede; a cobrança administrativa acontece fora do módulo. Não há botão de homologação, cobrança, fiscalização, sanção ou classificação de escola.
- **Sem Google Drive:** a decisão institucional é usar o SIGEM como instrumento, sem planilha paralela.
- **Fontes canônicas:** identificação e nome das escolas são lidos de `institutional_schools` e `institutional_school_record_versions`, jamais mantidos duplicados aqui.
- **Escrita:** RPCs `record_school_institutional_followup_*`, pessoa natural + capability `registrar-acompanhamento-institucional`; somente SQL cria fatos. RLS habilitada, sem DML de cliente.
- **Leitura:** RPCs `school_institutional_followup_network` e `school_institutional_followup_school`, autorizadas por `school_institutional_followup_grant` sobre consultar ou registrar. Capabilities próprias `consultar-acompanhamento-institucional` e `registrar-acompanhamento-institucional`: nenhuma é atribuída automaticamente, e nem Gabinete nem Supervisão formal herdam acesso por cargo.
- **Persistência:** visitas versionadas por `logical_id`, `version`, `supersedes_id`; ações e atualizações são append-only. Uma ação pertence à escola e pode ter muitas atualizações em muitas visitas. A reinterpretação de um registro nunca apaga o anterior.
- **Indicadores:** sem dado não é zero; sem atualização não significa ação não realizada; conclusão é **declaração da equipe**, não homologação do Gabinete. Prazo vencido só com prazo informado e ação ainda não declarada concluída. A quantidade de visitas ou pendências nunca vira ranking de qualidade.
- **Fonte do painel:** função de banco autorizada; não unir dados de escola fora do escopo no navegador. Período afeta visitas, enquanto totais de ações representam o histórico vigente; manter esses rótulos transparentes.
- **Privacidade:** evitar documentos pessoais, nomes de estudantes e laudos em campos livres. Qualquer anexo futuro deve ser privado, com escopo escolar e trilha.
- **Publicação:** migration 0613 deve ser testada em ambiente controlado antes de ir para o banco real; o SIGEM ainda não dispõe de staging de banco. CI sem erro não comprova execução SQL nem autorização com contas reais.
- **Testes:** `model.test.ts` cobre ausência, conclusão, prazos e agregados; acrescentar E2E autenticado antes da publicação oficial.
