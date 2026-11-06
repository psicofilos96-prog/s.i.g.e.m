#!/usr/bin/env node
/**
 * PR7 — pré-checagem SEM ESCRITA das contas funcionais.
 * Não ativa contas, não confirma emails, não cria senhas, não gera convites
 * e jamais concede capacidades.
 *
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SIGEM_FOLLOWUP_EXPECTED_BACKEND=<ref do projeto alvo>
 * node scripts/followup-functional-seats-preflight.mjs
 *
 * Os detalhes de autenticação só devem ser usados no servidor. O relatório
 * deliberadamente não contém IDs de usuário, tokens, chaves ou metadados brutos.
 */
import { pathToFileURL } from "node:url";

export const FOLLOWUP_SEATS = Object.freeze([
  Object.freeze({ seat: "acomp1", email: "acomp1@sigem.itap.gov.br" }),
  Object.freeze({ seat: "acomp2", email: "acomp2@sigem.itap.gov.br" }),
  Object.freeze({ seat: "gab", email: "gab@sigem.itap.gov.br" }),
]);

export function assertTargetBackend(rawUrl, projectRef) {
  if (typeof projectRef !== "string" || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("Projeto-alvo não especificado corretamente.");
  }
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error("SUPABASE_URL inválida."); }
  if (u.protocol !== "https:" || u.hostname !== `${projectRef}.supabase.co`
    || u.port || u.username || u.password || u.pathname !== "/" || u.search || u.hash
    || String(rawUrl).includes("?") || String(rawUrl).includes("#")) {
    throw new Error("Backend diferente do projeto-alvo autorizado.");
  }
  return projectRef;
}

/**
 * Apenas o estado do pré-cadastro. Não inferir que contas confirmadas estejam
 * autorizadas: a fonte real continua sendo atuação e política homologadas.
 */
export function assessFunctionalSeats(users, personLinks = [], sectorPrincipals = []) {
  const normalized = new Map();
  for (const u of users) {
    const email = typeof u.email === "string" ? u.email.toLowerCase().trim() : "";
    if (!email) continue;
    const arr = normalized.get(email) ?? [];
    arr.push(u);
    normalized.set(email, arr);
  }
  return FOLLOWUP_SEATS.map(({ seat, email }) => {
    const matches = normalized.get(email) ?? [];
    if (matches.length !== 1) {
      return { email, estado: matches.length ? "CONFLITO_DUPLICADO" : "AUSENTE",
        confirmado: false, login_anterior: false, vinculo_pessoal: false,
        principal_setorial: false, convite_anterior: false };
    }
    const u = matches[0];
    const vinculo = personLinks.some((x) => x.user_id === u.id);
    const principal = sectorPrincipals.some((x) => x.auth_user_id === u.id);
    const confirmado = Boolean(u.email_confirmed_at || u.confirmed_at);
    const login = Boolean(u.last_sign_in_at);
    const convite = Boolean(u.invited_at);
    const metadataCorreta = u.app_metadata?.sigem_account === "followup-functional-pending"
      && u.app_metadata?.followup_seat === seat;
    const limpo = !vinculo && !principal && !confirmado && !login && !convite && metadataCorreta;
    return { email, estado: limpo ? "PRE_CADASTRADO_PENDENTE" : "REVISAR_ANTES_DE_ATIVAR",
      confirmado, login_anterior: login, vinculo_pessoal: vinculo,
      principal_setorial: principal, convite_anterior: convite };
  });
}

async function readAllUsers(admin) {
  const users = [];
  for (let page = 1; page <= 1000; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !Array.isArray(data?.users)) throw new Error("Falha na leitura do Auth.");
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
  throw new Error("Listagem do Auth excedeu o limite de segurança.");
}

export async function runPreflight({ url, serviceRoleKey, expectedBackend, createClient }) {
  assertTargetBackend(url, expectedBackend);
  if (!serviceRoleKey) throw new Error("Credencial administrativa ausente (não criar uma).");
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const users = await readAllUsers(admin);
  const ids = users.filter((u) =>
    FOLLOWUP_SEATS.some((seat) => u.email?.toLowerCase() === seat.email)).map((u) => u.id);
  const getLinks = async (table, column, fields) => {
    if (!ids.length) return [];
    const { data, error } = await admin.from(table).select(fields).in(column, ids);
    if (error || !Array.isArray(data)) throw new Error("Falha ao conferir vínculos institucionais.");
    return data;
  };
  const [links, principals] = await Promise.all([
    getLinks("user_person_links", "user_id", "user_id"),
    getLinks("institutional_sector_principals", "auth_user_id", "auth_user_id"),
  ]);
  const accounts = assessFunctionalSeats(users, links, principals);
  return {
    backend_verificado: expectedBackend,
    modo: "SOMENTE_LEITURA",
    identidades: accounts,
    tres_pre_cadastros_pendentes: accounts.every((u) => u.estado === "PRE_CADASTRADO_PENDENTE"),
    acesso_operacional_liberado: false,
    aviso: "Conta Auth não concede permissão. Verificar migração 0613, caixa de email, pessoa natural e autorização administrativa antes da ativação.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const report = await runPreflight({
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      expectedBackend: process.env.SIGEM_FOLLOWUP_EXPECTED_BACKEND,
      createClient,
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.tres_pre_cadastros_pendentes) process.exitCode = 2;
  } catch (e) {
    // Não registrar URL, chave, identificadores internos ou stack que os contenha.
    console.error("Pré-checagem não pôde confirmar as contas; nenhuma alteração realizada.");
    process.exitCode = 2;
  }
}
