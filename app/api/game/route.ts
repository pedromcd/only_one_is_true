import { env } from 'cloudflare:workers';
import { bank, english } from './questions';
export const dynamic='force-dynamic';
const shuffle=(a:any[])=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const fail=(m:string)=>{throw new Error(m)};
const reply=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function advance(r:any){
  if(!r.start)return;
  let cursor=r.start;
  for(let round=0;round<10;round++){
    const revealAt=Math.min(cursor+15000,r.earlyEnds?.[round]??Infinity);
    const end=revealAt+7000;
    if(Date.now()<end){r.round=round;r.phase=Date.now()<revealAt?'question':'reveal';r.deadline=r.phase==='question'?revealAt:end;return;}
    cursor=end;
  }
  r.round=9;r.phase='finished';r.deadline=0;
}
function view(r:any,token:string){advance(r);const me=r.players.find((p:any)=>p.token===token);if(!me)fail('Join the room to play.');const q=r.deck?.[r.round];const reveal=r.phase==='reveal'||r.phase==='finished';const players=r.players.map((p:any)=>({id:p.id,name:p.name,score:Object.entries(r.votes).reduce((s:number,[round,v]:any)=>s+(Number(round)<r.round||reveal ? v[p.id]===r.deck[Number(round)].correct?10:0:0),0)}));return {code:r.code,me:me.id,host:r.host,players,phase:r.phase,round:r.round,now:Date.now(),deadline:r.deadline??0,question:q?{category:english(q.category),title:english(q.title),options:q.options.map(english),...(reveal?{correct:q.correct,explanation:english(q.explanation)}:{})}:null,myVote:r.votes[r.round]?.[me.id]??null,votes:reveal?r.votes[r.round]??{}:null,answered:Object.keys(r.votes[r.round]??{}).length};}
export async function GET(req:Request){try{const u=new URL(req.url);const row:any=await env.DB!.prepare('SELECT data FROM rooms WHERE code=?').bind(u.searchParams.get('code')).first();if(!row)fail('Room not found. Check your code.');const r=JSON.parse(row.data);if(Date.now()-r.created>86400000)fail('This room has expired. Create a new one.');return reply(view(r,req.headers.get('x-player-token')||''));}catch(e:any){return reply({error:e.message},400)}}
export async function POST(req:Request){try{const b:any=await req.json();const token=req.headers.get('x-player-token');if(!token||!/^[a-f0-9-]{36}$/.test(token))fail('Invalid player ID. Reload the page.');const name=String(b.name||'').trim().slice(0,20);if(b.action==='create'){if(!name)fail('Enter your name.');for(let i=0;i<5;i++){const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');const id=crypto.randomUUID();const r={code,created:Date.now(),host:id,players:[{id,name,token}],phase:'lobby',round:0,votes:{},deck:[]};try{await env.DB!.prepare('INSERT INTO rooms(code,data,version) VALUES(?,?,0)').bind(code,JSON.stringify(r)).run();return reply(view(r,token));}catch{}}fail('Could not create a room. Please try again.');}
const code=String(b.code||'').toUpperCase();for(let attempt=0;attempt<12;attempt++){const row:any=await env.DB!.prepare('SELECT data,version FROM rooms WHERE code=?').bind(code).first();if(!row)fail('Room not found. Check your code.');const r=JSON.parse(row.data);if(Date.now()-r.created>86400000)fail('This room has expired.');advance(r);let me=r.players.find((p:any)=>p.token===token);
if(b.action==='join'){if(!me){if(r.phase!=='lobby')fail('The game has already started. Join a new room.');if(r.players.length>=8)fail('Room full: a maximum of 8 players can join.');if(!name)fail('Enter your name.');if(r.players.some((p:any)=>p.name.toLowerCase()===name.toLowerCase()))fail('That name is already taken in this room.');r.players.push({id:crypto.randomUUID(),name,token});}}
else {if(!me)fail('You are not in this room.');if(b.action==='start'||b.action==='restart'){if(me.id!==r.host)fail('Only the host can start the game.');if(b.action==='start'&&r.phase!=='lobby')fail('The game has already started.');if(b.action==='restart'&&r.phase!=='finished')fail('The game is still in progress.');if(r.players.length<2)fail('Wait for at least one more player.');r.deck=shuffle(bank).slice(0,10).map(q=>{const opts=shuffle([{text:q[2],yes:true},{text:q[3],yes:false},{text:q[4],yes:false}]);return {category:q[0],title:q[1],options:opts.map(o=>o.text),correct:opts.findIndex(o=>o.yes),explanation:q[5]}});r.votes={};r.earlyEnds={};r.start=Date.now();r.round=0;r.phase='question';}
else if(b.action==='vote'){if(r.phase!=='question'||b.round!==r.round)fail('This round has ended.');if(!Number.isInteger(b.option)||b.option<0||b.option>2)fail('Choose a valid option.');r.votes[r.round]??={};if(r.votes[r.round][me.id]!==undefined)fail('Your answer is already locked in.');r.votes[r.round][me.id]=b.option;
if(r.players.every((p:any)=>r.votes[r.round][p.id]!==undefined)){
  r.earlyEnds??={};r.earlyEnds[r.round]=Date.now();
}}
else fail('Invalid action.');}
const res=await env.DB!.prepare('UPDATE rooms SET data=?,version=version+1 WHERE code=? AND version=?').bind(JSON.stringify(r),code,row.version).run();if(res.meta.changes)return reply(view(r,token));}fail('The room is busy. Please try again.');}catch(e:any){return reply({error:e.message},400)}}
