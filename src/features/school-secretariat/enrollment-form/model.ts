/**
 * Ficha de Matrícula — dados de entrada do modelo de impressão (só apresentação).
 * Todo campo é opcional: ausência sai em branco, nunca como texto técnico. Caixas de seleção
 * só aparecem marcadas quando há registro (`undefined`/`null` = sem registro = caixa vazia).
 */
export type Yn = boolean | null | undefined;

export type PersonBlock = {
  name?: string | null; birth?: string | null; cpf?: string | null; address?: string | null; phone?: string | null;
  nationality?: string | null; profession?: string | null; birthCity?: string | null; birthUf?: string | null;
  idNumber?: string | null; idIssuer?: string | null; idIssuedOn?: string | null;
};

export type RenewalRow = { year?: string | null; grade?: string | null; image?: Yn; addressChange?: string | null };

export type EnrollmentFormData = {
  header: { government: string; department: string; school?: string | null; address?: string | null; phone?: string | null; email?: string | null };
  yearLabel?: string | null;
  student: PersonBlock & {
    grade?: string | null; race?: string | null; ethnicity?: string | null; sex?: "Masculino" | "Feminino" | null;
    nee?: Yn; report?: Yn; zone?: "Urbana" | "Rural" | null; district?: string | null; nis?: string | null;
    birthCertificate?: string | null; socialName?: string | null; censusId?: string | null; repeater?: Yn; formerStudent?: Yn;
  };
  father?: PersonBlock | undefined; mother?: PersonBlock | undefined; guardian?: PersonBlock | undefined;
  /** ids de DOCUMENTS marcados por conferência registrada. */
  documents?: string[];
  health?: { foodAllergy?: Yn; foodAllergyWhich?: string | null; otherAllergy?: Yn; otherAllergyWhich?: string | null; diabetes?: Yn; medicalReport?: Yn; notes?: string | null };
  imageConsent?: Yn;
  decision?: "deferido" | "indeferido" | null; decisionNotes?: string | null;
  specialEd?: { items?: string[]; other?: string | null };
  saeb?: string[];
  renewals?: RenewalRow[];
};

export type FormMode = "preenchida" | "branco";
export type FormOptions = { mode: FormMode; specialEdAnnex: boolean; renewal: boolean };

export const DOCUMENTS = [
  ["declaracao", "Declaração Escolar"], ["foto", "Foto 3x4 do Aluno"],
  ["historico", "Histórico Escolar"], ["vacina", "Cartão de Vacina"],
  ["certidao-nascimento", "Certidão de Nascimento"], ["sus", "Cartão Nacional de Saúde (SUS)"],
  ["certidao-casamento", "Certidão de Casamento"], ["residencia-aluno", "Comprovante de Residência do Aluno"],
  ["identidade-responsavel", "Identidade do Responsável Legal"], ["bolsa-familia", "Cartão do Bolsa Família"],
  ["cpf-responsavel", "CPF do Responsável Legal"], ["comprovante-responsavel", "Comprovante do Responsável Legal"],
  ["cpf-aluno", "CPF do Aluno"], ["rg-aluno", "RG do Aluno"],
] as const;

export const SPECIAL_ED = [
  ["DI", "Deficiência Intelectual (DI)"], ["SC", "Surdocegueira (SC)"],
  ["DV", "Deficiência Visual (DV)"], ["DMU", "Deficiência Múltipla (DMU)"],
  ["DF", "Deficiência Física (DF)"], ["TEA", "Transtorno do Espectro Autista (TEA)"],
  ["DA", "Deficiência Auditiva / Surdez (DA)"], ["AH", "Altas Habilidades / Superdotação (AH)"],
] as const;

export const SPECIAL_ED_LEGEND = [
  "DI – Deficiência Intelectual", "DV – Deficiência Visual", "DF – Deficiência Física", "DA – Deficiência Auditiva",
  "SC – Surdocegueira", "DMU – Deficiência Múltipla", "TEA – Transtorno do Espectro Autista", "AH – Altas Habilidades/Superdotação",
];

export const SAEB = [
  ["ledor", "Auxílio ledor"], ["labial", "Leitura labial"], ["lp2", "Prova de Língua Portuguesa como segunda língua"],
  ["transcricao", "Auxílio transcrição"], ["fonte18", "Prova ampliada (Fonte 18)"], ["libras-video", "Prova em vídeo Libras"],
  ["guia", "Guia-intérprete"], ["fonte24", "Prova superampliada (Fonte 24)"], ["braille", "Material didático e prova em Braille"],
  ["libras", "Tradutor-intérprete de Libras"], ["audio", "Material em áudio para deficiente visual"], ["nenhum", "Nenhum"],
] as const;

/** Ficha em branco: só a identidade da escola e o ano letivo escolhido. */
export function blankFormData(header: EnrollmentFormData["header"], yearLabel: string | null): EnrollmentFormData {
  return { header, yearLabel, student: {} };
}
