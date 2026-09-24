/**
 * ALUNOS E TRAJETÓRIA ESCOLAR — dados fictícios isolados da interface.
 *
 * Nenhum aluno real, nenhum dado pessoal real, nenhuma associação com
 * estudantes de Itaperuna. Os fixtures existem apenas para demonstrar a
 * linguagem de UX desta etapa.
 *
 * Conceitos deliberadamente distintos (não colapsados em "matrícula"):
 * - PESSOA: identidade humana canônica (não cadastrada nesta etapa);
 * - ALUNO: papel educacional da pessoa dentro do SIGEM, com identificador
 *   conceitualmente permanente;
 * - MATRÍCULA ESCOLAR: vínculo permanente do aluno com determinada escola,
 *   podendo atravessar vários períodos letivos;
 * - VÍNCULO LETIVO: contexto do aluno em determinado período letivo;
 * - PARTICIPAÇÃO: forma de participação educacional (regular, AEE,
 *   complementar...), sem enumeração definitiva;
 * - ALOCAÇÃO EM TURMA: presença da participação em uma turma durante um
 *   intervalo, preservada historicamente.
 *
 * Minimização de dados: nenhum campo de endereço, filiação, documentos, CPF,
 * contatos, saúde ou dados familiares é modelado aqui.
 */
import { demonstrationUnits } from "@/features/units/units-data";

export type StudentDataOrigin = "documentado" | "inventado" | "misto";

/** Situações contextuais demonstrativas; não são enumerações definitivas. */
export const DEMO_STUDENT_SITUATIONS = [
  "Ativo com alocação",
  "Ativo sem alocação",
  "Transferido",
  "Sem participação atual",
] as const;
export type DemoStudentSituation = (typeof DEMO_STUDENT_SITUATIONS)[number];

/** Natureza da participação: a regular não é substituída pelas complementares. */
export type ParticipationNature = "Regular" | "Complementar";

export type ClassAllocation = {
  id: string;
  /** Turma consultável quando existe fixture correspondente. */
  classId?: string;
  classLabel: string;
  /** Intervalo/contexto da alocação, preservado mesmo após mudança de turma. */
  from: string;
  until: string | null;
  situation: "Vigente" | "Encerrada";
  note: string;
};

export type StudentParticipation = {
  id: string;
  label: string;
  nature: ParticipationNature;
  situation: "Em andamento" | "Encerrada";
  note: string;
  allocations: ClassAllocation[];
};

export type AcademicLink = {
  id: string;
  periodLabel: string;
  periodNote: string;
  unitId: string;
  /** Nome da unidade conforme registrado na época; o histórico não é reescrito. */
  unitNameAtTime: string;
  offerLabel: string;
  academicOrganization: string;
  situation: string;
  situationNote: string;
  participations: StudentParticipation[];
};

export type SchoolEnrollment = {
  id: string;
  /** Número demonstrativo; não existe padrão oficial de numeração. */
  number: string;
  unitId: string;
  unitNameAtTime: string;
  openedAt: string;
  closedAt: string | null;
  situation: "Vigente" | "Encerrada";
  note: string;
  academicLinks: AcademicLink[];
};

export type TrajectoryEventKind =
  | "Ingresso"
  | "Vínculo letivo"
  | "Participação"
  | "Alocação em turma"
  | "Mudança de turma"
  | "Transferência"
  | "Retorno"
  | "Encerramento";

export type TrajectoryEvent = {
  id: string;
  kind: TrajectoryEventKind;
  title: string;
  description: string;
  /** Contexto registrado no momento do fato. */
  contextLabel: string;
  timestamp: string;
  classId?: string;
};

export type DemonstrationStudent = {
  id: string;
  /** Identificador do aluno no SIGEM: conceitualmente permanente. */
  sigemId: string;
  /** Nome da pessoa — identidade humana canônica, obviamente fictícia. */
  personName: string;
  personNote: string;
  /** Identificador externo apenas quando aplicável; nunca CPF. */
  externalId: string | null;
  externalIdNote: string;
  currentSituation: DemoStudentSituation;
  currentSituationNote: string;
  currentUnitId: string | null;
  currentOrganization: string | null;
  currentClassId: string | null;
  currentClassLabel: string | null;
  enrollments: SchoolEnrollment[];
  trajectory: TrajectoryEvent[];
  dataOrigin: StudentDataOrigin;
  updatedAt: string;
};

const HORIZONTE = "Instituição Educacional Demonstrativa Horizonte";
const AGUAS_CLARAS = "Escola Demonstrativa Águas Claras";
const PONTE = "Núcleo Educacional Demonstrativo Ponte";

const PERIOD_NOTE =
  "Período letivo é uma organização temporal própria: não se pressupõe coincidência com o ano civil, nem com período avaliativo.";

export const demonstrationStudents: DemonstrationStudent[] = [
  /* A — trajetória simples e contínua */
  {
    id: "alu-001",
    sigemId: "SIGEM-AL-000101",
    personName: "Aluna Fictícia Demonstrativa Um",
    personNote:
      "A pessoa é a identidade humana canônica; o aluno é o papel educacional dessa pessoa no SIGEM.",
    externalId: null,
    externalIdNote: "Nenhum identificador externo demonstrativo registrado.",
    currentSituation: "Ativo com alocação",
    currentSituationNote: "Situação contextual demonstrativa, sem efeito censitário.",
    currentUnitId: "demo-001",
    currentOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    currentClassId: "tur-001",
    currentClassLabel: "Turma demonstrativa 3º ano A",
    enrollments: [
      {
        id: "alu-001-me1",
        number: "ME-DEMO-1001",
        unitId: "demo-001",
        unitNameAtTime: HORIZONTE,
        openedAt: "04 fev 2026",
        closedAt: null,
        situation: "Vigente",
        note: "Matrícula escolar demonstrativa: vínculo permanente do aluno com esta escola.",
        academicLinks: [
          {
            id: "alu-001-vl1",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Em andamento",
            situationNote: "Contexto do aluno neste período letivo.",
            participations: [
              {
                id: "alu-001-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "Participação regular no vínculo letivo do período.",
                allocations: [
                  {
                    id: "alu-001-a1",
                    classId: "tur-001",
                    classLabel: "Turma demonstrativa 3º ano A",
                    from: "2026-02-09",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação vigente da participação regular.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-001-t1",
        kind: "Ingresso",
        title: "Ingresso na escola",
        description: "Matrícula escolar ME-DEMO-1001 aberta na unidade.",
        contextLabel: HORIZONTE,
        timestamp: "04 fev 2026",
      },
      {
        id: "alu-001-t2",
        kind: "Vínculo letivo",
        title: "Vínculo letivo do período 2026",
        description: "Contexto de oferta e organização acadêmica registrado para o período.",
        contextLabel: "Período letivo 2026 · Ensino Fundamental — 1º segmento",
        timestamp: "05 fev 2026",
      },
      {
        id: "alu-001-t3",
        kind: "Alocação em turma",
        title: "Alocação na turma demonstrativa 3º ano A",
        description: "Participação regular alocada em turma.",
        contextLabel: "Período letivo 2026",
        timestamp: "09 fev 2026",
        classId: "tur-001",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* B — vários vínculos letivos na mesma escola, uma única matrícula escolar */
  {
    id: "alu-002",
    sigemId: "SIGEM-AL-000102",
    personName: "Aluno Fictício Demonstrativo Dois",
    personNote:
      "Mudanças de período letivo, turma ou contexto não criam uma nova pessoa nem um novo aluno.",
    externalId: "EXT-DEMO-77002",
    externalIdNote:
      "Identificador externo demonstrativo, exibido apenas por utilidade operacional. Não é documento pessoal.",
    currentSituation: "Ativo com alocação",
    currentSituationNote: "Continuidade na mesma escola por vínculos letivos sucessivos.",
    currentUnitId: "demo-001",
    currentOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    currentClassId: "tur-001",
    currentClassLabel: "Turma demonstrativa 3º ano A",
    enrollments: [
      {
        id: "alu-002-me1",
        number: "ME-DEMO-1002",
        unitId: "demo-001",
        unitNameAtTime: HORIZONTE,
        openedAt: "06 fev 2024",
        closedAt: null,
        situation: "Vigente",
        note: "Uma única matrícula escolar atravessa três períodos letivos por meio de vínculos letivos distintos.",
        academicLinks: [
          {
            id: "alu-002-vl1",
            periodLabel: "Período letivo 2024",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Encerrada",
            situationNote: "Contexto registrado conforme o período; não é reinterpretado hoje.",
            participations: [
              {
                id: "alu-002-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Encerrada",
                note: "Participação regular do período letivo 2024.",
                allocations: [
                  {
                    id: "alu-002-a1",
                    classLabel: "Turma demonstrativa 1º ano A (2024)",
                    from: "2024-02-12",
                    until: "2024-12-18",
                    situation: "Encerrada",
                    note: "Turma fictícia sem página de consulta nesta etapa.",
                  },
                ],
              },
            ],
          },
          {
            id: "alu-002-vl2",
            periodLabel: "Período letivo 2025",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Encerrada",
            situationNote: "Novo vínculo letivo, sem criação de nova matrícula escolar permanente.",
            participations: [
              {
                id: "alu-002-p2",
                label: "Participação regular",
                nature: "Regular",
                situation: "Encerrada",
                note: "Participação regular do período letivo 2025.",
                allocations: [
                  {
                    id: "alu-002-a2",
                    classLabel: "Turma demonstrativa 2º ano A (2025)",
                    from: "2025-02-10",
                    until: "2025-12-17",
                    situation: "Encerrada",
                    note: "Turma fictícia sem página de consulta nesta etapa.",
                  },
                ],
              },
            ],
          },
          {
            id: "alu-002-vl3",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Em andamento",
            situationNote: "Vínculo letivo atual da mesma matrícula escolar.",
            participations: [
              {
                id: "alu-002-p3",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "Participação regular do período letivo 2026.",
                allocations: [
                  {
                    id: "alu-002-a3",
                    classId: "tur-001",
                    classLabel: "Turma demonstrativa 3º ano A",
                    from: "2026-02-09",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação vigente.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-002-t1",
        kind: "Ingresso",
        title: "Ingresso na escola",
        description: "Matrícula escolar ME-DEMO-1002 aberta e mantida desde então.",
        contextLabel: HORIZONTE,
        timestamp: "06 fev 2024",
      },
      {
        id: "alu-002-t2",
        kind: "Vínculo letivo",
        title: "Vínculo letivo do período 2024",
        description: "Primeiro contexto temporal desta matrícula escolar.",
        contextLabel: "Período letivo 2024",
        timestamp: "12 fev 2024",
      },
      {
        id: "alu-002-t3",
        kind: "Vínculo letivo",
        title: "Vínculo letivo do período 2025",
        description: "Continuidade na mesma escola, sem nova matrícula escolar permanente.",
        contextLabel: "Período letivo 2025",
        timestamp: "10 fev 2025",
      },
      {
        id: "alu-002-t4",
        kind: "Vínculo letivo",
        title: "Vínculo letivo do período 2026",
        description: "Terceiro período letivo da mesma matrícula escolar.",
        contextLabel: "Período letivo 2026",
        timestamp: "09 fev 2026",
        classId: "tur-001",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* C — transferência entre escolas, origem preservada */
  {
    id: "alu-003",
    sigemId: "SIGEM-AL-000103",
    personName: "Aluna Fictícia Demonstrativa Três",
    personNote: "A mesma pessoa e o mesmo aluno permanecem após a transferência.",
    externalId: null,
    externalIdNote: "Sem identificador externo demonstrativo.",
    currentSituation: "Ativo com alocação",
    currentSituationNote:
      "Vínculo atual na escola de destino; a passagem pela escola de origem permanece registrada.",
    currentUnitId: "demo-005",
    currentOrganization: "Ensino Fundamental — 2º segmento · 6º ao 9º ano",
    currentClassId: "tur-005",
    currentClassLabel: "Turma demonstrativa 7º ano B",
    enrollments: [
      {
        id: "alu-003-me1",
        number: "ME-DEMO-1003",
        unitId: "demo-003",
        unitNameAtTime: AGUAS_CLARAS,
        openedAt: "07 fev 2024",
        closedAt: "31 jul 2025",
        situation: "Encerrada",
        note: "Matrícula escolar de origem: encerrada na escola, mas preservada historicamente. Nada foi movido para a escola de destino.",
        academicLinks: [
          {
            id: "alu-003-vl1",
            periodLabel: "Período letivo 2025",
            periodNote: PERIOD_NOTE,
            unitId: "demo-003",
            unitNameAtTime: AGUAS_CLARAS,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Encerrada por transferência",
            situationNote: "Contexto registrado na escola de origem, conforme a época.",
            participations: [
              {
                id: "alu-003-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Encerrada",
                note: "Participação encerrada na escola de origem.",
                allocations: [
                  {
                    id: "alu-003-a1",
                    classId: "tur-003",
                    classLabel: "Turma demonstrativa multietapa do campo",
                    from: "2025-02-10",
                    until: "2025-07-31",
                    situation: "Encerrada",
                    note: "Alocação histórica na escola de origem.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "alu-003-me2",
        number: "ME-DEMO-1103",
        unitId: "demo-005",
        unitNameAtTime: PONTE,
        openedAt: "05 ago 2025",
        closedAt: null,
        situation: "Vigente",
        note: "Matrícula escolar no destino: novo vínculo permanente com esta escola, sem reescrever a trajetória anterior.",
        academicLinks: [
          {
            id: "alu-003-vl2",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-005",
            unitNameAtTime: PONTE,
            offerLabel: "Ensino Fundamental — 2º segmento",
            academicOrganization: "Ensino Fundamental — 2º segmento · 6º ao 9º ano",
            situation: "Em andamento",
            situationNote: "Vínculo letivo atual na escola de destino.",
            participations: [
              {
                id: "alu-003-p2",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "Participação regular na escola de destino.",
                allocations: [
                  {
                    id: "alu-003-a2",
                    classId: "tur-005",
                    classLabel: "Turma demonstrativa 7º ano B",
                    from: "2026-02-09",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação vigente.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-003-t1",
        kind: "Ingresso",
        title: "Ingresso na escola de origem",
        description: "Matrícula escolar ME-DEMO-1003 aberta na origem.",
        contextLabel: AGUAS_CLARAS,
        timestamp: "07 fev 2024",
      },
      {
        id: "alu-003-t2",
        kind: "Alocação em turma",
        title: "Alocação na turma multietapa do campo",
        description: "Participação regular na escola de origem.",
        contextLabel: `${AGUAS_CLARAS} · Período letivo 2025`,
        timestamp: "10 fev 2025",
        classId: "tur-003",
      },
      {
        id: "alu-003-t3",
        kind: "Transferência",
        title: "Trajetória encerrada na escola de origem",
        description:
          "Saída registrada na origem. O registro permanece visível na escola de origem e não é transportado para o destino.",
        contextLabel: AGUAS_CLARAS,
        timestamp: "31 jul 2025",
      },
      {
        id: "alu-003-t4",
        kind: "Ingresso",
        title: "Nova matrícula escolar no destino",
        description: "Matrícula escolar ME-DEMO-1103 aberta na escola de destino.",
        contextLabel: PONTE,
        timestamp: "05 ago 2025",
      },
      {
        id: "alu-003-t5",
        kind: "Alocação em turma",
        title: "Alocação na turma demonstrativa 7º ano B",
        description: "Participação regular no destino.",
        contextLabel: `${PONTE} · Período letivo 2026`,
        timestamp: "09 fev 2026",
        classId: "tur-005",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* D — saída e retorno à mesma escola */
  {
    id: "alu-004",
    sigemId: "SIGEM-AL-000104",
    personName: "Aluno Fictício Demonstrativo Quatro",
    personNote:
      "O retorno à mesma escola preserva a identidade escolar: nenhuma nova pessoa é criada.",
    externalId: null,
    externalIdNote: "Sem identificador externo demonstrativo.",
    currentSituation: "Ativo com alocação",
    currentSituationNote:
      "Retorno demonstrativo à mesma escola. Regras definitivas de reativação não foram decididas nesta etapa.",
    currentUnitId: "demo-003",
    currentOrganization: "EJA — 1º segmento · Fases I a V",
    currentClassId: "tur-004",
    currentClassLabel: "Turma demonstrativa EJA Fases II e III",
    enrollments: [
      {
        id: "alu-004-me1",
        number: "ME-DEMO-1004",
        unitId: "demo-003",
        unitNameAtTime: AGUAS_CLARAS,
        openedAt: "08 fev 2024",
        closedAt: "30 jun 2024",
        situation: "Encerrada",
        note: "Primeira passagem pela escola, encerrada e preservada.",
        academicLinks: [
          {
            id: "alu-004-vl1",
            periodLabel: "Período letivo 2024",
            periodNote: PERIOD_NOTE,
            unitId: "demo-003",
            unitNameAtTime: AGUAS_CLARAS,
            offerLabel: "EJA — 1º segmento",
            academicOrganization: "EJA — 1º segmento · Fases I a V",
            situation: "Encerrada",
            situationNote: "Contexto registrado na primeira passagem.",
            participations: [
              {
                id: "alu-004-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Encerrada",
                note: "Participação encerrada em 2024.",
                allocations: [
                  {
                    id: "alu-004-a1",
                    classLabel: "Turma demonstrativa EJA Fase I (2024)",
                    from: "2024-02-12",
                    until: "2024-06-30",
                    situation: "Encerrada",
                    note: "Turma fictícia sem página de consulta nesta etapa.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "alu-004-me2",
        number: "ME-DEMO-1204",
        unitId: "demo-003",
        unitNameAtTime: AGUAS_CLARAS,
        openedAt: "03 fev 2026",
        closedAt: null,
        situation: "Vigente",
        note: "Retorno à mesma escola, registrado como vínculo próprio sem apagar a passagem anterior.",
        academicLinks: [
          {
            id: "alu-004-vl2",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-003",
            unitNameAtTime: AGUAS_CLARAS,
            offerLabel: "EJA — 1º segmento",
            academicOrganization: "EJA — 1º segmento · Fases I a V",
            situation: "Em andamento",
            situationNote: "Vínculo letivo do retorno.",
            participations: [
              {
                id: "alu-004-p2",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "Participação regular após o retorno.",
                allocations: [
                  {
                    id: "alu-004-a2",
                    classId: "tur-004",
                    classLabel: "Turma demonstrativa EJA Fases II e III",
                    from: "2026-02-16",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação vigente em turma organizada por fases.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-004-t1",
        kind: "Ingresso",
        title: "Primeira passagem pela escola",
        description: "Matrícula escolar ME-DEMO-1004 aberta.",
        contextLabel: AGUAS_CLARAS,
        timestamp: "08 fev 2024",
      },
      {
        id: "alu-004-t2",
        kind: "Encerramento",
        title: "Saída da escola",
        description: "Trajetória interrompida, sem exclusão do registro anterior.",
        contextLabel: `${AGUAS_CLARAS} · Período letivo 2024`,
        timestamp: "30 jun 2024",
      },
      {
        id: "alu-004-t3",
        kind: "Retorno",
        title: "Retorno à mesma escola",
        description:
          "Mesma pessoa, mesmo aluno, mesmo identificador permanente. A passagem anterior continua visível.",
        contextLabel: AGUAS_CLARAS,
        timestamp: "03 fev 2026",
      },
      {
        id: "alu-004-t4",
        kind: "Alocação em turma",
        title: "Alocação na turma EJA Fases II e III",
        description: "Participação regular após o retorno.",
        contextLabel: "Período letivo 2026",
        timestamp: "16 fev 2026",
        classId: "tur-004",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* E — mudança de turma preservando a turma anterior */
  {
    id: "alu-005",
    sigemId: "SIGEM-AL-000105",
    personName: "Aluna Fictícia Demonstrativa Cinco",
    personNote: "Alocação em turma é um fato datado dentro da participação.",
    externalId: null,
    externalIdNote: "Sem identificador externo demonstrativo.",
    currentSituation: "Ativo com alocação",
    currentSituationNote: "Mudança de turma dentro do mesmo vínculo letivo.",
    currentUnitId: "demo-001",
    currentOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
    currentClassId: "tur-009",
    currentClassLabel: "Turma demonstrativa 3º ano B",
    enrollments: [
      {
        id: "alu-005-me1",
        number: "ME-DEMO-1005",
        unitId: "demo-001",
        unitNameAtTime: HORIZONTE,
        openedAt: "04 fev 2026",
        closedAt: null,
        situation: "Vigente",
        note: "Matrícula escolar vigente; a mudança de turma não cria nova matrícula.",
        academicLinks: [
          {
            id: "alu-005-vl1",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Ensino Fundamental — 1º segmento",
            academicOrganization: "Ensino Fundamental — 1º segmento · 1º ao 5º ano",
            situation: "Em andamento",
            situationNote: "Uma participação, duas alocações sucessivas.",
            participations: [
              {
                id: "alu-005-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "A participação permanece a mesma; apenas a alocação em turma mudou.",
                allocations: [
                  {
                    id: "alu-005-a1",
                    classId: "tur-001",
                    classLabel: "Turma demonstrativa 3º ano A",
                    from: "2026-02-09",
                    until: "2026-03-20",
                    situation: "Encerrada",
                    note: "Alocação anterior preservada: a passagem por esta turma não é apagada.",
                  },
                  {
                    id: "alu-005-a2",
                    classId: "tur-009",
                    classLabel: "Turma demonstrativa 3º ano B",
                    from: "2026-03-23",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação atual. Turma fictícia sem página de consulta nesta etapa.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-005-t1",
        kind: "Ingresso",
        title: "Ingresso na escola",
        description: "Matrícula escolar ME-DEMO-1005 aberta.",
        contextLabel: HORIZONTE,
        timestamp: "04 fev 2026",
      },
      {
        id: "alu-005-t2",
        kind: "Alocação em turma",
        title: "Alocação na turma demonstrativa 3º ano A",
        description: "Primeira alocação da participação regular.",
        contextLabel: "Período letivo 2026",
        timestamp: "09 fev 2026",
        classId: "tur-001",
      },
      {
        id: "alu-005-t3",
        kind: "Mudança de turma",
        title: "Mudança para a turma demonstrativa 3º ano B",
        description:
          "A alocação anterior foi encerrada e permanece registrada; a participação regular continua a mesma.",
        contextLabel: "Período letivo 2026",
        timestamp: "23 mar 2026",
        classId: "tur-009",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* F — participação regular + AEE coexistindo */
  {
    id: "alu-006",
    sigemId: "SIGEM-AL-000106",
    personName: "Aluno Fictício Demonstrativo Seis",
    personNote: "Participações complementares não substituem a participação regular.",
    externalId: null,
    externalIdNote: "Sem identificador externo demonstrativo.",
    currentSituation: "Ativo com alocação",
    currentSituationNote:
      "Participação regular e atendimento educacional especializado coexistem no mesmo vínculo letivo.",
    currentUnitId: "demo-001",
    currentOrganization: "Educação Infantil · Berçário, Maternal, 1º e 2º Período",
    currentClassId: "tur-002",
    currentClassLabel: "Turma demonstrativa Maternal II",
    enrollments: [
      {
        id: "alu-006-me1",
        number: "ME-DEMO-1006",
        unitId: "demo-001",
        unitNameAtTime: HORIZONTE,
        openedAt: "04 fev 2026",
        closedAt: null,
        situation: "Vigente",
        note: "Matrícula escolar vigente com mais de uma participação ativa.",
        academicLinks: [
          {
            id: "alu-006-vl1",
            periodLabel: "Período letivo 2026",
            periodNote: PERIOD_NOTE,
            unitId: "demo-001",
            unitNameAtTime: HORIZONTE,
            offerLabel: "Educação Infantil",
            academicOrganization: "Educação Infantil · Berçário, Maternal, 1º e 2º Período",
            situation: "Em andamento",
            situationNote: "Duas participações simultâneas de naturezas diferentes.",
            participations: [
              {
                id: "alu-006-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Em andamento",
                note: "Participação regular vigente.",
                allocations: [
                  {
                    id: "alu-006-a1",
                    classId: "tur-002",
                    classLabel: "Turma demonstrativa Maternal II",
                    from: "2026-02-09",
                    until: null,
                    situation: "Vigente",
                    note: "Alocação vigente da participação regular.",
                  },
                ],
              },
              {
                id: "alu-006-p2",
                label: "Atendimento educacional especializado (AEE)",
                nature: "Complementar",
                situation: "Em andamento",
                note: "Participação complementar: não substitui a participação regular e não possui alocação em turma regular nesta etapa.",
                allocations: [],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-006-t1",
        kind: "Ingresso",
        title: "Ingresso na escola",
        description: "Matrícula escolar ME-DEMO-1006 aberta.",
        contextLabel: HORIZONTE,
        timestamp: "04 fev 2026",
      },
      {
        id: "alu-006-t2",
        kind: "Alocação em turma",
        title: "Alocação na turma demonstrativa Maternal II",
        description: "Participação regular alocada em turma.",
        contextLabel: "Período letivo 2026",
        timestamp: "09 fev 2026",
        classId: "tur-002",
      },
      {
        id: "alu-006-t3",
        kind: "Participação",
        title: "Participação complementar de AEE registrada",
        description:
          "Registrada em paralelo à participação regular. Regras operacionais do AEE não fazem parte desta etapa.",
        contextLabel: "Período letivo 2026",
        timestamp: "02 mar 2026",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },

  /* G — histórico, sem participação atual */
  {
    id: "alu-007",
    sigemId: "SIGEM-AL-000107",
    personName: "Aluna Fictícia Demonstrativa Sete",
    personNote:
      "A identidade do aluno permanece consultável mesmo sem vínculo letivo em andamento.",
    externalId: null,
    externalIdNote: "Sem identificador externo demonstrativo.",
    currentSituation: "Sem participação atual",
    currentSituationNote:
      "Nenhum vínculo letivo em andamento. A trajetória registrada continua compreensível sem depender de cadastro atual.",
    currentUnitId: null,
    currentOrganization: null,
    currentClassId: null,
    currentClassLabel: null,
    enrollments: [
      {
        id: "alu-007-me1",
        number: "ME-DEMO-1007",
        unitId: "demo-005",
        unitNameAtTime: `${PONTE} (nome registrado na época)`,
        openedAt: "06 fev 2023",
        closedAt: "18 dez 2025",
        situation: "Encerrada",
        note: "Matrícula escolar encerrada. Os fatos permanecem conforme registrados, sem reinterpretação pelos cadastros atuais.",
        academicLinks: [
          {
            id: "alu-007-vl1",
            periodLabel: "Período letivo 2025",
            periodNote: PERIOD_NOTE,
            unitId: "demo-005",
            unitNameAtTime: `${PONTE} (nome registrado na época)`,
            offerLabel: "Ensino Fundamental — 2º segmento",
            academicOrganization: "Ensino Fundamental — 2º segmento · 6º ao 9º ano",
            situation: "Encerrada",
            situationNote: "Contexto histórico preservado.",
            participations: [
              {
                id: "alu-007-p1",
                label: "Participação regular",
                nature: "Regular",
                situation: "Encerrada",
                note: "Participação encerrada no período letivo 2025.",
                allocations: [
                  {
                    id: "alu-007-a1",
                    classId: "tur-006",
                    classLabel: "Turma demonstrativa 6º ano A (encerrada)",
                    from: "2025-02-10",
                    until: "2025-12-18",
                    situation: "Encerrada",
                    note: "Alocação histórica em turma encerrada.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    trajectory: [
      {
        id: "alu-007-t1",
        kind: "Ingresso",
        title: "Ingresso na escola",
        description: "Matrícula escolar ME-DEMO-1007 aberta.",
        contextLabel: `${PONTE} (nome registrado na época)`,
        timestamp: "06 fev 2023",
      },
      {
        id: "alu-007-t2",
        kind: "Alocação em turma",
        title: "Alocação na turma demonstrativa 6º ano A",
        description: "Participação regular do período letivo 2025.",
        contextLabel: "Período letivo 2025",
        timestamp: "10 fev 2025",
        classId: "tur-006",
      },
      {
        id: "alu-007-t3",
        kind: "Encerramento",
        title: "Encerramento do vínculo letivo",
        description: "Sem participação em andamento a partir deste ponto.",
        contextLabel: "Período letivo 2025",
        timestamp: "18 dez 2025",
      },
    ],
    dataOrigin: "inventado",
    updatedAt: "18 set 2026",
  },
];

export function getDemonstrationStudent(id: string) {
  return demonstrationStudents.find((item) => item.id === id);
}

export function getStudentUnitName(unitId: string | null) {
  if (!unitId) return "Sem unidade de vínculo atual";
  return demonstrationUnits.find((unit) => unit.id === unitId)?.currentName ?? "Unidade fictícia";
}

export function studentSituationTone(situation: DemoStudentSituation) {
  switch (situation) {
    case "Ativo com alocação":
      return "success" as const;
    case "Ativo sem alocação":
      return "warning" as const;
    case "Transferido":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

/** Matrícula escolar vigente, quando existir. */
export function currentEnrollment(student: DemonstrationStudent) {
  return student.enrollments.find((item) => item.situation === "Vigente") ?? null;
}

/** Vínculo letivo em andamento, quando existir. */
export function currentAcademicLink(student: DemonstrationStudent) {
  return (
    student.enrollments
      .flatMap((enrollment) => enrollment.academicLinks)
      .find((link) => link.situation === "Em andamento") ?? null
  );
}

export function allAcademicLinks(student: DemonstrationStudent) {
  return student.enrollments.flatMap((enrollment) =>
    enrollment.academicLinks.map((link) => ({ enrollment, link })),
  );
}

/** Unidades presentes nos fixtures, para filtro demonstrativo. */
export const DEMO_STUDENT_UNITS = Array.from(
  new Set(
    demonstrationStudents.flatMap((student) =>
      student.enrollments.map((enrollment) => enrollment.unitId),
    ),
  ),
).map((unitId) => ({ value: unitId, label: getStudentUnitName(unitId) }));

/** Períodos letivos presentes nos fixtures. */
export const DEMO_STUDENT_PERIODS = Array.from(
  new Set(
    demonstrationStudents.flatMap((student) =>
      student.enrollments.flatMap((enrollment) =>
        enrollment.academicLinks.map((link) => link.periodLabel),
      ),
    ),
  ),
).sort((a, b) => b.localeCompare(a, "pt-BR"));

/** Organizações acadêmicas presentes nos fixtures. */
export const DEMO_STUDENT_ORGANIZATIONS = Array.from(
  new Set(
    demonstrationStudents.flatMap((student) =>
      student.enrollments.flatMap((enrollment) =>
        enrollment.academicLinks.map((link) => link.academicOrganization),
      ),
    ),
  ),
);

/** Naturezas de participação presentes nos fixtures; não é enum definitivo. */
export const DEMO_PARTICIPATION_NATURES: ParticipationNature[] = ["Regular", "Complementar"];

/**
 * Áreas do aluno — hipóteses de UX, não contratos de backend.
 * Somente visão geral e trajetória escolar são funcionais nesta etapa.
 */
export const studentDetailAreas = [
  { id: "overview", label: "Visão geral", available: true },
  { id: "trajectory", label: "Trajetória escolar", available: true },
  { id: "enrollments", label: "Matrículas escolares", available: false },
  { id: "participations", label: "Participações", available: false },
  { id: "documents", label: "Documentos", available: false },
  { id: "history", label: "Histórico", available: false },
] as const;

/** Texto único de minimização de dados, reaproveitado nas telas. */
export const DATA_MINIMIZATION_NOTE =
  "Minimização de dados: esta consulta exibe apenas o necessário para identificação operacional. Não há endereço, filiação, documentos, CPF, contatos, dados de saúde ou informações familiares.";
