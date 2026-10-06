import { createClient } from "@supabase/supabase-js";
const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
let t0=Date.now(); const {error}=await c.auth.signInWithPassword({email:"supervisao@sigem.itap.gov.br",password:process.env.SIGEM_SECTOR_INITIAL_PASSWORD}); console.log("login",Date.now()-t0,error?.message);
t0=Date.now(); const r=await c.rpc("current_actor"); console.log("actor",Date.now()-t0,r.error?.message);
t0=Date.now(); const s=await c.rpc("global_search",{_q:"escola",_categories:["escola"],_limit:5}); console.log("search-escola",Date.now()-t0,s.error?.message,s.data?.length);
