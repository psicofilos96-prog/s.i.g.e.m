import { createClient } from "@supabase/supabase-js";
const a=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ids=(await a.from("institutional_school_identifiers").select("school_id,value").eq("identifier_kind","inep").order("value").limit(2)).data;
const [A,B]=ids;
const acc=["ciece","supervisao","alimentacao","avalia"].map(x=>[x,`${x}@sigem.itap.gov.br`,null]).concat(...[A,B].map(s=>["sec","diresc","orientaped"].map(x=>[`${x}.${s===A?"A":"B"}`,`${x}.${s.value}@sigem.itap.gov.br`,s.school_id])));
const terms=["escola","maria","silva","ano","matem","supervis"];
for (const [k,e,school] of acc){
  const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
  const {error}=await c.auth.signInWithPassword({email:e,password:process.env.SIGEM_SECTOR_INITIAL_PASSWORD}); if(error) throw error;
  const cats={}; const ents=[];
  for(const t of terms){const r=await c.rpc("global_search",{_q:t,_limit:50}); if(r.error){cats.err=r.error.message;continue;} for(const h of r.data){cats[h.category]=(cats[h.category]||0)+1; ents.push(h);} }
  // school scope check: turmas/alunos must belong to own school
  let foreignClass=0, foreignStudent=0, foreignSchool=0;
  if(school){
    const tIds=ents.filter(h=>h.category==="turma").map(h=>h.entity_id);
    if(tIds.length){const r=await a.from("institutional_classes").select("id,school_id").in("id",tIds); foreignClass=r.data.filter(x=>x.school_id!==school).length;}
    foreignSchool=ents.filter(h=>h.category==="escola"&&h.entity_id!==school).length;
    const sIds=[...new Set(ents.filter(h=>h.category==="aluno").map(h=>h.entity_id))];
    if(sIds.length){const r=await a.from("class_enrollment_episodes").select("student_id,school_id").in("student_id",sIds); const own=new Set(r.data?.filter(x=>x.school_id===school).map(x=>x.student_id)); foreignStudent=sIds.filter(s=>!own.has(s)).length; if(r.error) foreignStudent="err:"+r.error.message;}
  }
  console.log(k, JSON.stringify(cats), school?`foreign class=${foreignClass} student=${foreignStudent} school=${foreignSchool}`:"");
  await c.auth.signOut();
}
