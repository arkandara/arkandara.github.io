"use strict";
// Daily 03:30 Iraq analytics reset. Security/admin/visitor block data is never touched.
const https=require("https");
const account=process.env.CF_ACCOUNT_ID,token=process.env.CF_API_TOKEN,ns=process.env.CF_DAILY_KV_NAMESPACE_ID;
if(!account||!token||!ns)throw Error("Missing KV credentials");
const today=new Date().toISOString().slice(0,10);
const fs=require("fs");
const archive=JSON.parse(fs.readFileSync("archives/daily_current.json","utf8"));
if(!Array.isArray(archive.days))throw Error("Missing valid daily archive: cleanup stopped");
const archivedDays=new Set(archive.days.filter(d=>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date<today &&
  Number.isSafeInteger(d.totalVisits) && d.totalVisits>=0 &&
  Number.isSafeInteger(d.totalClicks) && d.totalClicks>=0 &&
  Number.isSafeInteger(d.totalTextarea) && d.totalTextarea>=0 &&
  d.clicks && typeof d.clicks==="object" && !Array.isArray(d.clicks) &&
  Object.values(d.clicks).every(n=>Number.isSafeInteger(n)&&n>=0) &&
  Object.values(d.clicks).reduce((a,b)=>a+b,0)===d.totalClicks &&
  d.deviceStats && typeof d.deviceStats==="object" &&
  d.cityStats && typeof d.cityStats==="object"
).map(d=>d.date));

const kv="/storage/kv/namespaces/"+ns;
function request(method,path,body){
 return new Promise((resolve,reject)=>{
  const payload=body===undefined?null:JSON.stringify(body);
  const req=https.request("https://api.cloudflare.com/client/v4/accounts/"+account+path,{method,headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}:{})}},res=>{
   let data="";res.on("data",c=>data+=c);res.on("end",()=>{
    if(res.statusCode<200||res.statusCode>=300)return reject(Error(method+" HTTP "+res.statusCode+" "+data.slice(0,120)));
    try{resolve(data?JSON.parse(data):null)}catch{resolve(data)}
   });
  });req.setTimeout(20000,()=>req.destroy(Error("Cloudflare timeout")));req.on("error",reject);req.end(payload);
 });
}
async function keys(prefix){
 let cursor,all=[];
 do{
  const q="?prefix="+encodeURIComponent(prefix)+"&limit=1000"+(cursor?"&cursor="+encodeURIComponent(cursor):"");
  const r=await request("GET",kv+"/keys"+q);
  if(!r?.success||!Array.isArray(r.result))throw Error("KV listing failed for "+prefix);
  all.push(...r.result.map(x=>x.name));cursor=r.result_info?.cursor||null;
 }while(cursor);
 return all;
}

async function main(){
 // No deletion of current UTC day, admin credentials, sessions, security,
 // site settings, visitor registry, blocklist or any unrelated KV namespace keys.
 const removable=new Set();
 for(const prefix of ["daily:","visits:","textarea:","snapshots:"]){
  for(const k of await keys(prefix)){
   const day=k.slice(prefix.length,prefix.length+10);
   const suffix=k.slice(prefix.length+10);
   if(archivedDays.has(day) && (prefix!=="daily:" || suffix.startsWith(":")))removable.add(k);
  }
 }
 // Remove all date-scoped keys for confirmed archived days, but never today's keys.
 // Never touch legacy STATS_DB, other namespaces, or unrelated undated keys.
 let failures=[];
 for(const key of removable){
  try{await request("DELETE",kv+"/values/"+encodeURIComponent(key))}
  catch(e){failures.push(key+": "+e.message)}
 }
 console.log("03:30 analytics reset:",today,"KV deleted:",removable.size-failures.length);
 console.log("Admin, security, visitor blocks and today's data preserved");
 if(failures.length)throw Error("Cleanup incomplete: "+failures.slice(0,10).join("; "));
}
main().catch(e=>{console.error(e);process.exitCode=1});
