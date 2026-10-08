import { operationalToday } from "@/lib/academic-date";
/**
 * Identidade Institucional — fonte central de brasões e logos do SIGEM.
 *
 * Regra arquitetural: ativos de identidade institucional são dados centralizados
 * do SIGEM. Nenhum módulo ou documento incorpora logos institucionais diretamente
 * quando elas puderem ser resolvidas por este módulo.
 *
 * Camadas: UI → serviço (este arquivo) → repositório (IdentityStorage) →
 * armazenamento atual (localStorage do navegador) → futuro backend/storage.
 */
import brasaoSeed from "@/assets/brasao-itaperuna.png.asset.json";
import logoEducacaoSeed from "@/assets/logo-educacao.png.asset.json";

export type IdentityKind =
  "municipal-coat-of-arms" | "education-department-logo" | "sector-logo" | "school-logo";
export type IdentityOwnerType = "municipality" | "education-department" | "sector" | "school";
/** ativo: pode ser resolvido; substituido: corrigido por nova versão; removido: retirado (histórico mantido). */
export type IdentityAssetStatus = "ativo" | "substituido" | "removido";

export type IdentityFile = {
  url: string;
  mimeType: "image/png" | "image/jpeg";
  originalFileName: string;
  size: number;
  width?: number;
  height?: number;
  hasTransparency?: boolean;
};

export type InstitutionalAsset = {
  id: string;
  kind: IdentityKind;
  ownerType: IdentityOwnerType;
  /** Município/Secretaria: identificador fixo; escola: unitId estável. */
  ownerId: string;
  file: IdentityFile;
  createdAt: string; // ISO data-hora
  createdBy: string;
  validFrom?: string | undefined; // ISO data civil
  validUntil?: string | undefined;
  status: IdentityAssetStatus;
  version: number;
  altText: string;
  replacesId?: string | undefined;
  note?: string | undefined;
};

/** Perfis demonstrativos — NÃO é segurança real; depende de autenticação/RBAC futuros. */
export type IdentityActor = {
  profile: "ciece" | "setor" | "escola" | "supervisao" | "professor" | "familia";
  unitId?: string;
  /** Setor ao qual o usuário pertence (a CIECE é o setor "setor-ciece"). */
  sectorId?: string | undefined;
  name?: string;
};

export const MUNICIPALITY_ID = "itaperuna";
export const EDUCATION_DEPARTMENT_ID = "semed-itaperuna";
export const OWNER_TYPE: Record<IdentityKind, IdentityOwnerType> = {
  "municipal-coat-of-arms": "municipality",
  "education-department-logo": "education-department",
  "sector-logo": "sector",
  "school-logo": "school",
};
export const KIND_LABEL: Record<IdentityKind, string> = {
  "municipal-coat-of-arms": "Brasão do Município",
  "education-department-logo": "Logo da Secretaria Municipal de Educação",
  "sector-logo": "Logo do setor",
  "school-logo": "Logo da unidade escolar",
};

/** Limite técnico: 2 MB por arquivo (o armazenamento atual fica no navegador). */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
/** SVG não é aceito: não há sanitização segura disponível na infraestrutura atual. */
export const ACCEPTED_MIME = ["image/png", "image/jpeg"] as const;

export function canManage(actor: IdentityActor, kind: IdentityKind, ownerId: string): boolean {
  // Cada setor administra a própria logo; cada escola, a sua; brasão e Secretaria: só a CIECE.
  if (kind === "sector-logo") return !!actor.sectorId && actor.sectorId === ownerId;
  if (kind === "school-logo")
    return actor.profile === "escola" && !!actor.unitId && actor.unitId === ownerId;
  return actor.profile === "ciece";
}

// ---------- Validação de arquivo ----------
export type FileCheck =
  | { ok: true; mimeType: IdentityFile["mimeType"]; hasTransparency: boolean }
  | { ok: false; error: string };

/** Valida tipo declarado, tamanho e assinatura binária (detecta arquivo inválido/corrompido). */
export function validateLogoBytes(input: {
  bytes: Uint8Array;
  declaredType: string;
  size: number;
}): FileCheck {
  const { bytes, declaredType, size } = input;
  if (declaredType === "image/svg+xml")
    return { ok: false, error: "SVG não é aceito nesta versão por segurança. Use PNG ou JPEG." };
  if (!(ACCEPTED_MIME as readonly string[]).includes(declaredType))
    return { ok: false, error: "Formato não aceito. Envie PNG ou JPEG." };
  if (size <= 0) return { ok: false, error: "Arquivo vazio." };
  if (size > MAX_LOGO_BYTES) return { ok: false, error: "Arquivo acima do limite de 2 MB." };
  const isPng =
    bytes.length > 25 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (declaredType === "image/png" && !isPng)
    return { ok: false, error: "Imagem inválida ou corrompida (assinatura PNG ausente)." };
  if (declaredType === "image/jpeg" && !isJpeg)
    return { ok: false, error: "Imagem inválida ou corrompida (assinatura JPEG ausente)." };
  // PNG: tipo de cor 4/6 (com alfa) ou chunk tRNS indica transparência.
  let hasTransparency = false;
  if (isPng) {
    const colorType = bytes[25];
    hasTransparency = colorType === 4 || colorType === 6;
    if (!hasTransparency) {
      for (let i = 33; i < Math.min(bytes.length - 4, 4096); i++) {
        if (
          bytes[i] === 0x74 &&
          bytes[i + 1] === 0x52 &&
          bytes[i + 2] === 0x4e &&
          bytes[i + 3] === 0x53
        ) {
          hasTransparency = true;
          break;
        }
      }
    }
  }
  return { ok: true, mimeType: declaredType as IdentityFile["mimeType"], hasTransparency };
}

// ---------- Resolução temporal ----------
function todayIso() {
  return operationalToday();
}

/** Ativo vigente numa data (padrão: hoje). Não aplica regra jurídica sobre qual data documental usar. */
export function resolveIdentity(
  assets: InstitutionalAsset[],
  query: { kind: IdentityKind; ownerId?: string | undefined; date?: string | undefined },
): InstitutionalAsset | undefined {
  const ownerId = query.ownerId ?? defaultOwner(query.kind);
  const date = query.date ?? todayIso();
  return assets
    .filter(
      (a) =>
        a.kind === query.kind &&
        a.ownerId === ownerId &&
        a.status === "ativo" &&
        (!a.validFrom || a.validFrom <= date) &&
        (!a.validUntil || a.validUntil >= date),
    )
    .sort((a, b) => b.version - a.version)[0];
}

export function historyOf(assets: InstitutionalAsset[], kind: IdentityKind, ownerId?: string) {
  const owner = ownerId ?? defaultOwner(kind);
  return assets
    .filter((a) => a.kind === kind && a.ownerId === owner)
    .sort((a, b) => b.version - a.version);
}

function defaultOwner(kind: IdentityKind) {
  if (kind === "municipal-coat-of-arms") return MUNICIPALITY_ID;
  if (kind === "education-department-logo") return EDUCATION_DEPARTMENT_ID;
  throw new Error("Logo de setor/unidade exige ownerId.");
}

// ---------- Semente (arquivos oficiais já existentes; sem vigência inventada) ----------
export function createIdentitySeed(): InstitutionalAsset[] {
  return [
    {
      id: "idn-brasao-v1",
      kind: "municipal-coat-of-arms",
      ownerType: "municipality",
      ownerId: MUNICIPALITY_ID,
      file: {
        url: brasaoSeed.url,
        mimeType: "image/png",
        originalFileName: brasaoSeed.original_filename,
        size: brasaoSeed.size,
      },
      createdAt: brasaoSeed.created_at,
      createdBy: "Carga inicial do SIGEM",
      status: "ativo",
      version: 1,
      altText: "Brasão do Município de Itaperuna",
    },
    {
      id: "idn-semed-v1",
      kind: "education-department-logo",
      ownerType: "education-department",
      ownerId: EDUCATION_DEPARTMENT_ID,
      file: {
        url: logoEducacaoSeed.url,
        mimeType: "image/png",
        originalFileName: logoEducacaoSeed.original_filename,
        size: logoEducacaoSeed.size,
      },
      createdAt: logoEducacaoSeed.created_at,
      createdBy: "Carga inicial do SIGEM",
      status: "ativo",
      version: 1,
      altText: "Logo da Secretaria Municipal de Educação de Itaperuna",
    },
  ];
}

// ---------- Repositório ----------
/** Setor da Secretaria (ex.: CIECE). Identificador estável; a logo pertence ao setor. */
export type InstitutionalSector = { id: string; acronym: string; name: string };
export const SECTOR_SEED: InstitutionalSector[] = [
  {
    id: "setor-ciece",
    acronym: "CIECE",
    name: "Central de Informações, Estatística e Censo Escolar",
  },
];
const SECTORS_KEY = "sigem.identidade-setores.v1";
export type SectorStorage = {
  load(): InstitutionalSector[] | null;
  store(s: InstitutionalSector[]): void;
};
export const browserSectorStorage: SectorStorage = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(SECTORS_KEY);
      return raw ? (JSON.parse(raw) as InstitutionalSector[]) : null;
    } catch {
      return null;
    }
  },
  store(v) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SECTORS_KEY, JSON.stringify(v));
    } catch {
      /* mantém em memória */
    }
  },
};

export type IdentityStorage = {
  load(): InstitutionalAsset[] | null;
  store(assets: InstitutionalAsset[]): void;
};
const STORAGE_KEY = "sigem.identidade-institucional.v1";
export const browserIdentityStorage: IdentityStorage = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as InstitutionalAsset[]) : null;
    } catch {
      return null;
    }
  },
  store(assets) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    } catch {
      /* cota do navegador excedida: mantém em memória */
    }
  },
};
export const memoryIdentityStorage = (): IdentityStorage => {
  let data: InstitutionalAsset[] | null = null;
  return { load: () => data, store: (a) => void (data = a) };
};

export type IdentityInput = {
  kind: IdentityKind;
  ownerId?: string | undefined;
  file: IdentityFile;
  altText?: string | undefined;
  validFrom?: string | undefined;
  validUntil?: string | undefined;
  note?: string | undefined;
};
export type Result = { ok: true; asset: InstitutionalAsset } | { ok: false; error: string };

export function createIdentityStore(
  storage: IdentityStorage = browserIdentityStorage,
  sectorStorage: SectorStorage = { load: () => null, store: () => {} },
) {
  let assets: InstitutionalAsset[] = createIdentitySeed();
  let sectors: InstitutionalSector[] = SECTOR_SEED;
  let hydrated = false;
  const listeners = new Set<() => void>();
  const emit = () => {
    storage.store(assets);
    listeners.forEach((l) => l());
  };
  const nextId = (kind: IdentityKind) =>
    `idn-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const actorName = (a: IdentityActor) =>
    a.name ??
    {
      ciece: "CIECE/Estatística",
      setor: "Setor",
      escola: "Unidade escolar",
      supervisao: "Supervisão",
      professor: "Professor",
      familia: "Família",
    }[a.profile];

  function build(
    actor: IdentityActor,
    input: IdentityInput,
    replacesId?: string,
  ): InstitutionalAsset {
    const ownerId = input.ownerId ?? defaultOwner(input.kind);
    const version = historyOf(assets, input.kind, ownerId)[0]?.version ?? 0;
    return {
      id: nextId(input.kind),
      kind: input.kind,
      ownerType: OWNER_TYPE[input.kind],
      ownerId,
      file: input.file,
      createdAt: new Date().toISOString(),
      createdBy: actorName(actor),
      validFrom: input.validFrom || undefined,
      validUntil: input.validUntil || undefined,
      status: "ativo",
      version: version + 1,
      altText: input.altText || KIND_LABEL[input.kind],
      replacesId,
      note: input.note,
    };
  }
  function check(actor: IdentityActor, kind: IdentityKind, ownerId: string): string | null {
    if (!canManage(actor, kind, ownerId))
      return "Perfil sem capacidade para administrar esta identidade.";
    return null;
  }
  function validity(input: IdentityInput): string | null {
    if (input.validFrom && input.validUntil && input.validUntil < input.validFrom)
      return "O fim da vigência não pode ser anterior ao início.";
    return null;
  }

  return {
    hydrate() {
      if (hydrated) return;
      hydrated = true;
      const saved = storage.load();
      const savedSectors = sectorStorage.load();
      if (saved) assets = saved;
      if (savedSectors) sectors = savedSectors;
      if (saved || savedSectors) listeners.forEach((l) => l());
    },
    list: () => assets,
    sectors: () => sectors,
    /** Cadastra um setor (CIECE). Sigla única. */
    addSector(
      actor: IdentityActor,
      input: { acronym: string; name: string },
    ): { ok: true; sector: InstitutionalSector } | { ok: false; error: string } {
      if (actor.profile !== "ciece")
        return { ok: false, error: "Somente a CIECE cadastra setores." };
      const acronym = input.acronym.trim();
      const name = input.name.trim();
      if (!acronym || !name) return { ok: false, error: "Informe sigla e nome do setor." };
      if (sectors.some((x) => x.acronym.toLowerCase() === acronym.toLowerCase()))
        return { ok: false, error: "Já existe um setor com essa sigla." };
      const sector = {
        id: `setor-${acronym.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
        acronym,
        name,
      };
      sectors = [...sectors, sector];
      sectorStorage.store(sectors);
      listeners.forEach((l) => l());
      return { ok: true, sector };
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    resolve: (q: { kind: IdentityKind; ownerId?: string | undefined; date?: string | undefined }) =>
      resolveIdentity(assets, q),
    history: (kind: IdentityKind, ownerId?: string) => historyOf(assets, kind, ownerId),
    /** Nova versão (brasão, nova logo da Secretaria com vigência, logo da escola). Não apaga anteriores. */
    register(actor: IdentityActor, input: IdentityInput): Result {
      const ownerId = input.ownerId ?? defaultOwner(input.kind);
      const err = check(actor, input.kind, ownerId) ?? validity(input);
      if (err) return { ok: false, error: err };
      const asset = build(actor, { ...input, ownerId });
      // Brasão e logo de escola têm um único ativo vigente: o anterior vira "substituído" (mantido no histórico).
      if (input.kind !== "education-department-logo")
        assets = assets.map((a) =>
          a.kind === input.kind && a.ownerId === ownerId && a.status === "ativo"
            ? { ...a, status: "substituido" as const }
            : a,
        );
      assets = [...assets, asset];
      emit();
      return { ok: true, asset };
    },
    /** Correção de arquivo de uma versão específica: a versão corrigida fica como "substituída". */
    replace(
      actor: IdentityActor,
      assetId: string,
      input: Omit<IdentityInput, "kind" | "ownerId">,
    ): Result {
      const old = assets.find((a) => a.id === assetId);
      if (!old) return { ok: false, error: "Ativo não encontrado." };
      const err = check(actor, old.kind, old.ownerId) ?? validity({ ...input, kind: old.kind });
      if (err) return { ok: false, error: err };
      const asset = build(
        actor,
        {
          kind: old.kind,
          ownerId: old.ownerId,
          altText: input.altText ?? old.altText,
          validFrom: input.validFrom ?? old.validFrom,
          validUntil: input.validUntil ?? old.validUntil,
          file: input.file,
          note: input.note,
        },
        old.id,
      );
      assets = [
        ...assets.map((a) => (a.id === old.id ? { ...a, status: "substituido" as const } : a)),
        asset,
      ];
      emit();
      return { ok: true, asset };
    },
    /** Retira o ativo (sem apagar do histórico). */
    remove(actor: IdentityActor, assetId: string): Result {
      const old = assets.find((a) => a.id === assetId);
      if (!old) return { ok: false, error: "Ativo não encontrado." };
      const err = check(actor, old.kind, old.ownerId);
      if (err) return { ok: false, error: err };
      const updated = { ...old, status: "removido" as const };
      assets = assets.map((a) => (a.id === old.id ? updated : a));
      emit();
      return { ok: true, asset: updated };
    },
  };
}

export type IdentityStore = ReturnType<typeof createIdentityStore>;
export const identityStore = createIdentityStore(browserIdentityStorage, browserSectorStorage);
