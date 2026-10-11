#!/usr/bin/env node
// Monitor de drift Lovable ↔ GitHub (somente leitura; sem credencial; repositório público).
// Compara o HEAD local com o main do GitHub por SHA de commit E de árvore, e reporta o CI do SHA remoto.
// Saída 0 = mesmo commit (ou mesma árvore) e CI verde; 1 = drift ou CI não verde; 2 = não apurado.
import { execSync } from "node:child_process";

const REPO = process.env.SIGEM_GITHUB_REPO ?? "psicofilos96-prog/s.i.g.e.m";
const BRANCH = process.env.SIGEM_GITHUB_BRANCH ?? "main";
const api = (p) => fetch(`https://api.github.com/repos/${REPO}/${p}`, { headers: { Accept: "application/vnd.github+json" } })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`GitHub ${r.status} em ${p}`))));

try {
  const git = (c) => execSync(`git ${c}`, { encoding: "utf8" }).trim();
  const local = git("rev-parse HEAD"), localTree = git("rev-parse HEAD^{tree}");
  const dirty = git("status --porcelain").split("\n").filter(Boolean).length;
  const remote = await api(`commits/${BRANCH}`);
  const remoteTree = remote.commit.tree.sha;
  const runs = await api(`actions/runs?head_sha=${remote.sha}&per_page=5`);
  const ci = runs.workflow_runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url }));
  const sameTree = localTree === remoteTree;
  const ciGreen = ci.length > 0 && ci.every((r) => r.status === "completed" && r.conclusion === "success");
  console.log(JSON.stringify({ local, localTree, remote: remote.sha, remoteTree, sameCommit: local === remote.sha, sameTree, uncommitted: dirty, ci }, null, 2));
  process.exit(sameTree && dirty === 0 && ciGreen ? 0 : 1);
} catch (e) {
  console.error(`não apurado: ${e.message}`);
  process.exit(2);
}
