/** B2.5.1: contrato institucional. A persistência da turma começa na B2.5.2. */

export const CLASS_REGISTRY_CAPABILITY = "manter-cadastro-de-turmas" as const;
export const CLASS_PERIOD_ORGANIZATION_CAPABILITY =
  "manter-organizacao-de-periodos-da-turma" as const;

/** Escola e ano pertencem à identidade; uma mudança exige outro classId. */
export type InstitutionalClassIdentity = Readonly<{
  classId: string;
  schoolId: string;
  academicYearId: string;
}>;

export type ClassAdministrativeStatus = "ativa" | "inativa";

export type ClassVersionProvenance = Readonly<{
  originatingActRef: string;
  changeReason: string | null;
  recordedByUserId: string;
  recordedByPersonId: string;
  recordedViaEngagementId: string;
  /** Tempo de registro, distinto da vigência institucional. */
  createdAt: string;
}>;

/** A versão cadastral nunca carrega escola ou ano para poder trocá-los. */
export type InstitutionalClassRecordVersion = ClassVersionProvenance &
  Readonly<{
    id: string;
    classId: InstitutionalClassIdentity["classId"];
    version: number;
    supersedesId: string | null;
    code: string | null;
    name: string;
    administrativeStatus: ClassAdministrativeStatus;
    /** null = início efetivo não declarado pela fonte (stand-in neutralizado em 0108). */
    validFrom: string | null;
    validUntil: string | null;
  }>;

/** Relação explícita, histórica e independente da versão cadastral. */
export type ClassPeriodOrganizationLinkVersion = ClassVersionProvenance &
  Readonly<{
    id: string;
    classId: InstitutionalClassIdentity["classId"];
    organizationId: string;
    version: number;
    supersedesId: string | null;
    validFrom: string;
    validUntil: string | null;
  }>;

/** Duas perguntas diferentes; nenhum leitor deve confundi-las. */
export type ClassTemporalQuery = Readonly<{
  validOn: string;
  knownAt?: string;
}>;
