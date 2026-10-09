import { describe, expect, it } from "vitest";
import { loadCentral, centralEntryOf } from "./calendar-central-state";
import { createInMemoryCalendarRepository, projectCalendars2027 } from "./calendar-store";
import { actorFor } from "./calendar-view-copy";
import type { Rpc } from "./calendar-central";

const cal = projectCalendars2027()[0]!;
const knownAt = "2026-10-04T12:00:00Z";
const rpcFor = (n: number): Rpc => async (fn) => {
  if (fn === "calendar_network_sources_at") return {error:null,data:{contract:"b4.6.10/1",state:"lido",audience:"construcao",knownAt,sources:[{sourceKey:cal.id,calendarId:"central"}]}};
  if (fn === "calendar_list_at") return {error:null,data:{state:"lido",versions:[{calendarId:"central",versionId:`v${n}`,version:n,validFrom:"2027-01-01",recordedAt:knownAt,actId:"ato",lastHomologation:null}]}};
  return {error:null,data:{state:"lido",snapshot:{presentation:{editorCalendar:{...cal,title:`Servidor v${n}`}}}}};
};

describe("recarregar calendários centrais sem perda de edição", () => {
  it("preserva a edição e a base original quando outro salvamento recarrega a lista", async () => {
    const repo = createInMemoryCalendarRepository([cal]);
    await loadCentral(repo,rpcFor(1));
    repo.mutate(cal.id,actorFor("supervisao"),{kind:"configurar-documento",patch:{title:"Minha edição pendente"}});
    const state = await loadCentral(repo,rpcFor(2));
    expect(repo.get(cal.id)?.title).toBe("Minha edição pendente");
    expect(repo.hasUnsavedChanges(cal.id)).toBe(true);
    expect(centralEntryOf(state,cal.id)?.latest.versionId).toBe("v1");
  });
  it("uma resposta atrasada não substitui a leitura mais recente", async () => {
    const repo = createInMemoryCalendarRepository([cal]);
    let release!:()=>void;
    const wait = new Promise<void>(r=>{release=r;});
    const older:Rpc = async (fn,args)=>{if(fn==="calendar_network_sources_at") await wait;return rpcFor(1)(fn,args);};
    const pending=loadCentral(repo,older);
    await loadCentral(repo,rpcFor(2));
    release();
    const state=await pending;
    expect(repo.get(cal.id)?.title).toBe("Servidor v2");
    expect(centralEntryOf(state,cal.id)?.latest.versionId).toBe("v2");
  });
  it("rascunho do navegador ao recarregar a página mantém a base salva no banco (não salva sem base)", async () => {
    const repo = createInMemoryCalendarRepository([cal]);
    repo.mutate(cal.id,actorFor("supervisao"),{kind:"configurar-documento",patch:{title:"Rascunho antigo do navegador"}});
    const state = await loadCentral(repo,rpcFor(2));
    expect(repo.get(cal.id)?.title).toBe("Rascunho antigo do navegador");
    expect(centralEntryOf(state,cal.id)?.latest.versionId).toBe("v2");
  });
  it("remove da consulta uma publicação que o servidor deixou de disponibilizar", async () => {
    const repo = createInMemoryCalendarRepository([{...cal,status:"homologado"}]);
    const rpc:Rpc=async()=>({error:null,data:{contract:"b4.6.10/1",state:"lido",audience:"homologados",knownAt,sources:[]}});
    await loadCentral(repo,rpc);
    expect(repo.list()).toEqual([]);
  });
});
