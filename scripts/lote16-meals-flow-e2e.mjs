// LOTE 16 — Alimentação: janela → pedido com teto → análise/autorização com ciência → programação parcial → recebimento
// parcial com rejeição → estoque (aceite único) → baixa → Mapa de compras PDF/XLSX, no navegador autenticado.
// Contas técnicas sintéticas (camada BO, 2h, 0306): cadastros técnicos por três pessoas distintas; tudo removido no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":lote16").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const nextMonth = (() => { const [y, m] = today.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; })();
const minus = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session, ctx: prep.data };
}
async function grant(u, caps, school = null) { for (const cap of caps) { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error(`grant ${cap}: ${g.error.message}`); } }
async function rpc(u, fn, args) { const r = await u.c.rpc(fn, args); if (r.error) throw new Error(`${u.tag}.${fn}: ${r.error.message}`); return r.data; }
async function master(AU, RV, HO, kind, payload) {
  const id = await rpc(AU, "record_meal_master", { _kind: kind, _logical: null, _expected_version: null, _action: "registro", _payload: payload, _school: null, _from: minus(today, 30), _to: null, _reason: null, _staging: null });
  await rpc(RV, "record_meal_master", { _kind: kind, _logical: id, _expected_version: 1, _action: "conferencia", _payload: null, _school: null, _from: null, _to: null, _reason: null, _staging: null });
  await rpc(HO, "record_meal_master", { _kind: kind, _logical: id, _expected_version: 2, _action: "homologacao", _payload: null, _school: null, _from: null, _to: null, _reason: null, _staging: null });
  return id;
}
try {
  mkdirSync("/tmp/fs16", { recursive: true });
  const AU = await mk("autor", "gestao-pedagogica-da-rede"), RV = await mk("conferente", "gestao-pedagogica-da-rede"), HO = await mk("homologador", "gestao-pedagogica-da-rede");
  const NU = await mk("nucleo", "gestao-pedagogica-da-rede"), ES = await mk("escola-a", "secretaria-escolar"), OB = await mk("escola-b", "secretaria-escolar");
  const schoolA = ES.ctx.school, schoolB = ES.ctx.other_school;
  check(!!schoolA && !!schoolB && schoolA !== schoolB, "escolas A e B distintas para o teste");
  await grant(AU, ["manter-catalogo-tecnico-alimentar", "manter-parametros-nutricionais", "manter-planejamento-nutricional", "manter-referencias-contratuais-alimentacao"]);
  await grant(RV, ["conferir-conteudo-tecnico-alimentar"]); await grant(HO, ["homologar-conteudo-tecnico-alimentar"]);
  await grant(NU, ["administrar-janela-de-pedido-alimentar", "analisar-pedido-alimentar", "autorizar-pedido-alimentar", "consolidar-demanda-alimentar",
    "registrar-programacao-de-entrega-alimentar", "acompanhar-alimentacao-rede", "exportar-relatorios-alimentacao", "manter-catalogo-tecnico-alimentar", "manter-referencias-contratuais-alimentacao"]);
  await grant(ES, ["consultar-alimentacao-escolar", "submeter-pedido-alimentar", "conferir-recebimento-alimentar", "registrar-estoque-alimentar", "ajustar-estoque-alimentar"], schoolA);
  await grant(OB, ["consultar-alimentacao-escolar", "submeter-pedido-alimentar", "registrar-estoque-alimentar"], schoolB);
  // catálogo sintético marcado com a operação + base técnica homologada por três pessoas distintas
  const av = async (scheme, suf, label) => { const r = await admin.rpc("bo_fixture_attribute_value", { _operation_id: op, _scheme: scheme, _suffix: suf, _label: label }); if (r.error) throw new Error(r.error.message); return r.data; };
  const vItem = await av("item-de-estoque-alimentar", "arroz", "Arroz"), vUnit = await av("unidade-de-medida-alimentar", "kg", "kg");
  const item = await master(AU, RV, HO, "item-alimentar", { nome: `Arroz sintético ${op}`, item_estoque_value_id: vItem });
  const unit = await master(AU, RV, HO, "unidade-de-medida", { nome: "Quilograma sintético", simbolo: "kg", unidade_estoque_value_id: vUnit });
  const pub = await master(AU, RV, HO, "publico-de-atendimento", { rotulo: `Público sintético ${op}` });
  const forn = await master(AU, RV, HO, "fornecedor", { nome: `Fornecedor sintético ${op}` });
  const ctr = await master(AU, RV, HO, "referencia-contratual", { natureza: "contrato", numero: `CT-${op}`, fornecedor_ref: forn, empenho: "NE-SINTETICA" });
  await master(AU, RV, HO, "parametro-per-capita", { quantidade: 0.1, item_ref: item, publico_ref: pub, unidade_ref: unit });
  check(true, "base técnica sintética homologada (autor ≠ conferente ≠ homologador)");
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fs16/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, op, schoolA, contract: `CT-${op}`, sessions: { nu: NU.session, es: ES.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote16-meals-flow-e2e.py"], { encoding: "utf8", timeout: 520000 });
  rmSync("/tmp/fs16/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  // servidor: o que a tela fez ficou no banco, uma única entrada por aceite; escola B isolada
  const comp = (await rpc(NU, "meal_orders_at", { _competence: null, _school: schoolA, _known_at: null }).catch(() => null));
  const mv = await admin.from("meal_inventory_movements").select("movement_class, quantity, source_receipt_version_id").eq("school_id", schoolA).eq("item_value_id", vItem);
  const ins = (mv.data ?? []).filter((m) => m.source_receipt_version_id).reduce((a, m) => a + Number(m.quantity), 0);
  const outs = (mv.data ?? []).filter((m) => !m.source_receipt_version_id).reduce((a, m) => a + Number(m.quantity), 0);
  check(ins === 30 && outs === 5, "livro: entrada 30 (só aceitos; 10 rejeitados fora) e baixa 5 ⇒ saldo 25", `${ins}/${outs}`);
  const ent = await admin.from("meal_inventory_movements").select("id", { count: "exact", head: true }).eq("school_id", schoolA).eq("item_value_id", vItem).not("source_receipt_version_id", "is", null);
  check(ent.count === 1, "aceite gerou exatamente UMA entrada de estoque", String(ent.count));
  const bOrders = await OB.c.rpc("meal_orders_at", { _competence: null, _school: schoolA, _known_at: null });
  check(!!bOrders.error || (bOrders.data ?? []).length === 0, "conta da escola B não lê pedidos da escola A", bOrders.error?.message ?? String((bOrders.data ?? []).length));
  const bWrite = await OB.c.rpc("record_meal_order", { _logical: null, _expected_version: null, _action: "rascunho", _school: schoolA, _competence: nextMonth, _lines: [], _reason: null });
  check(!!bWrite.error && /capability:/.test(bWrite.error.message), "escola B não grava pedido em nome da escola A", bWrite.error?.message ?? "");
  const bStock = await OB.c.rpc("record_meal_stock_movement", { _base_id: null, _kind: "registro", _school: schoolA, _class: "perda", _item: vItem, _unit: vUnit, _quantity: 1, _direction: null, _on: today, _tz: "America/Sao_Paulo", _lot: null, _expires: null, _contract: null, _schedule: null, _source_doc: null, _count: null, _literal: null, _note: null, _reason: "x" });
  check(!!bStock.error && /capability:/.test(bStock.error.message), "escola B não baixa estoque da escola A", bStock.error?.message ?? "");
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  const an = await anon.rpc("meal_orders_at", { _competence: null, _school: schoolA, _known_at: null });
  check(!!an.error, "sem sessão: leitura de pedidos recusada", an.error?.message ?? "");
  void comp; void ctr;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  if (cl.error) fails++;
  for (const id of users) await admin.auth.admin.deleteUser(id);
  for (const t of ["meal_order_versions", "meal_inventory_movements", "meal_receipts", "meal_delivery_schedules", "meal_master_records", "meal_order_windows"]) {
    const left = await admin.from(t).select("id", { count: "exact", head: true }).in("author_user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
    check((left.count ?? 1) === 0, `sem resíduo em ${t}`, String(left.count));
  }
  const av = await admin.from("attribute_value_definitions").select("value_id", { count: "exact", head: true }).like("value_id", `${op}-%`);
  check((av.count ?? 1) === 0, "sem resíduo de catálogo sintético", String(av.count));
  console.log(`RESUMO falhas=${fails}`);
}
