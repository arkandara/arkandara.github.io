"use strict";
const https = require("https");
const fs = require("fs");
const account=process.env.CF_ACCOUNT_ID,token=process.env.CF_API_TOKEN,ns=process.env.CF_KV_NAMESPACE_ID,dbId=process.env.CF_D1_DATABASE_ID;
if(!account||!token||!ns||!dbId)throw Error("Cloudflare credentials/D1 id missing; refusing cleanup");
const now=new Date();
const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-1)).toISOString().slice(0,10);
const archive=JSON.parse(fs.readFileSync("archives/daily_current.json","utf8"));
const matches=(archive.days||[]).filter(x=>x.date===day);
if(matches.length!==1)throw Error("Exactly one committed daily archive required: "+day);
const entry=matches[0];
if(entry.source!=="d1")throw Error("D1-backed archive required before cleanup");
if(!Number.isSafeInteger(entry.totalVisits)||!Number.isSafeInteger(entry.totalTextarea)||!Number.isSafeInteger(entry.totalClicks)||!entry.clicks||Object.values(entry.clicks).reduce((s,n)=>s+n,0)!==entry.totalClicks)throw Error("Invalid archive counters");
const archiveTime=Date.parse(entry.generatedAt);
const end=Date.parse(day+"T00:00:00Z")+86400000;
if(!Number.isFinite(archiveTime)||archiveTime<end)throw Error("Archive generated before day ended");
function req(method,path,body){
 return new Promise((resolve,reject)=>{
  const payload=body===undefined?null:JSON.stringify(body);
  const r=https.request("https://api.cloudflare.com/client/v4/accounts/"+account+path,{method,headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}:{})}},res=>{
   let s="";res.on("data",c=>s+=c);res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300)return reject(Error(method+" "+path+" HTTP "+res.statusCode+" "+s.slice(0,180)));try{resolve(s?JSON.parse(s):null)}catch{resolve(s)}});
  });r.setTimeout(20000,()=>r.destroy(Error("Cloudflare timeout")));r.on("error",reject);r.end(payload);
 });
}
const kv="/storage/kv/namespaces/"+ns;
const d1="/d1/database/"+dbId+"/query";
async function sql(query,params){
 const x=await req("POST",d1,{sql:query,params});
 if(!x?.success||!x.result?.[0]?.success)throw Error("D1 query unsuccessful");
 return x.result[0].results||[];
}
async function listKeys(prefix){
 let cursor,keys=[];
 do{
  const q="?prefix="+encodeURIComponent(prefix)+"&limit=1000"+(cursor?"&cursor="+encodeURIComponent(cursor):"");
  const x=await req("GET",kv+"/keys"+q);
  if(!x?.success||!Array.isArray(x.result))throw Error("KV list unsuccessful");
  keys.push(...x.result.map(v=>v.name));
  cursor=x.result_info?.cursor||null;
 }while(cursor);
 return keys;
}
async function main(){
 const rows=await sql("SELECT kind,label,count FROM track_daily_counts WHERE day = ?",[day]);
 const actual={visit:0,textarea:0,clicks:{}};
 for(const r of rows){if(!Number.isSafeInteger(r.count)||r.count<0)throw Error("Invalid D1 counter");if(r.kind==="visit"&&r.label==="")actual.visit=r.count;else if(r.kind==="textarea"&&r.label==="")actual.textarea=r.count;else if(r.kind==="click")actual.clicks[r.label]=r.count;}
 if(actual.visit!==entry.totalVisits||actual.textarea!==entry.totalTextarea||JSON.stringify(Object.entries(actual.clicks).sort())!==JSON.stringify(Object.entries(entry.clicks).sort()))throw Error("D1 changed since archive; refusing deletion");
 const keys=[...await listKeys("daily:"+day+":"),"visits:"+day,"textarea:"+day,"snapshots:"+day];
 const unique=[...new Set(keys)];
 // Verify every existing daily counter; preserve any new or changed value.
 for(const key of unique.filter(k=>k.startsWith("daily:"))){
  const value=await req("GET",kv+"/values/"+encodeURIComponent(key));
  const expected=key==="daily:"+day+":visit"?entry.totalVisits:key==="daily:"+day+":textarea"?entry.totalTextarea:key.startsWith("daily:"+day+":click:")?entry.clicks[key.slice(("daily:"+day+":click:").length)]:undefined;
  if(expected===undefined||!Number.isSafeInteger(Number(value))||Number(value)>expected)throw Error("Unarchived KV data: "+key);
 }
 // Archived raw session/textarea text is not included in GitHub aggregates.
 // Deletion of these payloads is intentional under the analytics-only retention policy.
 for(const key of unique){
  try{await req("DELETE",kv+"/values/"+encodeURIComponent(key));}
  catch(e){if(!String(e).includes("HTTP 404"))throw e;}
 }
 await sql("DELETE FROM track_daily_counts WHERE day = ?",[day]);
 console.log("Deleted completed-day analytics only:",day,"KV keys:",unique.length,"D1 rows:",rows.length);
 console.log("Admin authentication, sessions, security, visitor blocks, and settings untouched");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
