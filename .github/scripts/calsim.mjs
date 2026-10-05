// The Calendaring Simulators' saved work (functions/api/calsim.js) on SQLite: a trainee saves and reads their own calendar, nobody but an admin
// writes feedback (and a later save by the trainee keeps it), admins list everyone with name and batch, a trainer's preview saves nothing.
// Run: node --no-warnings .github/scripts/calsim.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
let s=fs.readFileSync('functions/api/calsim.js','utf8').replace("import { json, requireSession } from '../_utils.js';","const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});let CUR=null;const requireSession=async()=>CUR?{ok:true,session:CUR}:{ok:false,response:json({success:false},401)};globalThis.__setSession=(x)=>{CUR=x};");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cs-'));fs.writeFileSync(path.join(tmp,'calsim.mjs'),s);
const m=await import(pathToFileURL(path.join(tmp,'calsim.mjs')).href);
const sql=new DatabaseSync(':memory:');
const mk=(q)=>{let a=[];const o={bind:(...x)=>{a=x;return o},run:async()=>sql.prepare(q).run(...a),first:async()=>sql.prepare(q).get(...a)||null,all:async()=>({results:sql.prepare(q).all(...a)})};return o};
const db={prepare:mk};
sql.exec(`CREATE TABLE users(username,first_name,last_name,batch_id,status)`);sql.prepare(`INSERT INTO users VALUES('ann','Ann','Lee','B1','Approved')`).run();
const env={TRAINING_DB:db,DB:db};
const call=async(meth,body,qs='')=>{const r=await (meth==='GET'?m.onRequestGet:m.onRequestPost)({request:new Request('https://p/api/calsim'+qs,{method:meth,body:body?JSON.stringify(body):undefined}),env});return {st:r.status,j:await r.json()}};
const fails=[];const ck=(o,t)=>{console.log((o?'PASS ':'FAIL ')+t);if(!o)fails.push(t)};
__setSession({username:'ann',userType:'Trainee',fullName:'Ann Lee',batchId:'B1'});
let r=await call('GET');ck(r.st===200&&r.j.data===null&&r.j.me.name==='Ann Lee','a trainee starts with no record and is told who they are');
r=await call('POST',{data:{v:2,drafts:{s1:[{id:'e1'}]},submissions:[{scn:'s1',at:'2026-10-05T10:00:00Z',events:[]}],reviews:{'fake|x':{score:100}}}});ck(r.st===200,'a trainee saves their calendar');
r=await call('GET');ck(r.j.data.drafts.s1.length===1&&Object.keys(r.j.data.reviews).length===0,'the trainee cannot write their own review');
__setSession({username:'boss',userType:'Admin',fullName:'Trainer Bo',batchId:'MASTER'});
r=await call('POST',{review:{user:'ann',key:'s1|2026-10-05T10:00:00Z',score:88,comment:'Good',tasks:{t1:'ok'}}});ck(r.st===200&&r.j.data.reviews['s1|2026-10-05T10:00:00Z'].score===88&&r.j.data.reviews['s1|2026-10-05T10:00:00Z'].by==='Trainer Bo','an admin saves feedback');
r=await call('GET',null,'?all=1');ck(r.j.rows.length===1&&r.j.rows[0].name==='Ann Lee'&&r.j.rows[0].batch==='B1','an admin lists everyone with name and batch');
r=await call('POST',{review:{user:'ann',key:'k',score:150}});ck(r.st===400,'a score above 100 is refused');
r=await call('POST',{data:{v:2}});ck(r.j.preview===true,'a trainer\'s preview saves nothing');
__setSession({username:'ann',userType:'Trainee',fullName:'Ann Lee',batchId:'B1'});
r=await call('POST',{data:{v:2,drafts:{s1:[]},submissions:[]}});r=await call('GET');ck(r.j.data.reviews['s1|2026-10-05T10:00:00Z'].score===88,'the trainee\'s later saves keep the trainer\'s feedback');
r=await call('POST',{review:{user:'ann',key:'k',score:50}});ck(r.st===403,'a trainee cannot review');
r=await call('GET',null,'?all=1');ck(r.j.rows===undefined,'a trainee cannot list everyone');
console.log(fails.length?'FAILED':'all passed');process.exit(fails.length?1:0);
