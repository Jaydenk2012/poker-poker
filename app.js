const socket = io();
const state = { view:'home', level:'medium', count:3, mode:null, room:null, single:null };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
function go(view){state.view=view;$$('.view').forEach(v=>v.classList.remove('active'));$('#view-'+view)?.classList.add('active'); if(view==='home'||view==='single'||view==='multi'||view==='rules') $('#game')?.classList.remove('active'); const title={home:'Play the table your way.',single:'Build your table.',multi:'Play with your crew.',rules:'Know the hand. Own the table.'}[view];if(title)$('#pageTitle').textContent=title}
$$('.nav-item').forEach(b=>b.onclick=()=>{ $$('nav .nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');go(b.dataset.view); });
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));

$('#levelSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;state.level=b.dataset.level;$$('#levelSeg button').forEach(x=>x.classList.toggle('selected',x===b));};
$('#countSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;state.count=+b.dataset.count;$$('#countSeg button').forEach(x=>x.classList.toggle('selected',x===b));};
$('#startSingle').onclick=()=>startSingle();
$('#backLobby').onclick=()=>{go(state.mode==='multi'?'multi':'home');};
$('#themeBtn').onclick=()=>document.body.classList.toggle('light');
$('#soundBtn').onclick=()=>toast('Sound cues are enabled visually in this build.');

function cardMarkup(key){if(!key)return'';const suit=key.slice(-1),rank=key.slice(0,-1);const red=suit==='♥'||suit==='♦';return `<div class="playing-card ${red?'red':''}"><b>${rank}</b><span class="suit">${suit}</span></div>`}
function cardBacks(n=2){return Array.from({length:n},()=>'<div class="card-back"></div>').join('')}
function score(n){return Number(n||0).toLocaleString();}
function resetSeat(count){for(let i=1;i<=3;i++){ $('#opp'+i+'Name').textContent=i<=count?'Computer '+i:'Seat empty';$('#opp'+i+'Score').textContent=i<=count?'1,000':'—';}}

function startSingle(){
  state.mode='single'; const names=Array.from({length:state.count},(_,i)=>({name:`Computer ${i+1}`,level:state.level,chips:1000,id:`ai${i}`}));
  const deck=buildDeck(); shuffle(deck); const human={name:'You',chips:1000,hand:[deck.pop(),deck.pop()],folded:false};
  const players=[human,...names.map(a=>({ ...a, chips:1000, hand:[deck.pop(),deck.pop()],folded:false }))];
  state.single={deck,players,community:[],street:0,result:null};
  $('#gameLabel').textContent=`SINGLE PLAYER • ${state.level.toUpperCase()} AI`;
  $('#game').classList.add('active'); $$('.view').forEach(v=>v.classList.remove('active'));
  resetSeat(state.count); renderSingle(); toast('Cards dealt. Reveal the flop.');
}
function buildDeck(){const suits=['♠','♥','♦','♣'],ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];return suits.flatMap(s=>ranks.map(r=>({rank:r,suit:s})));}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const rv=Object.fromEntries(['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map((r,i)=>[r,i+2]));
function eval5(cards){let vals=cards.map(c=>rv[c.rank]).sort((a,b)=>b-a),counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);let groups=Object.entries(counts).map(([v,c])=>({v:+v,c})).sort((a,b)=>b.c-a.c||b.v-a.v);let u=[...new Set(vals)];if(u.includes(14))u.push(1);let sh=null;for(let i=0;i<=u.length-5;i++){if(u[i]-u[i+4]===4){sh=u[i];break}}let fl=cards.every(c=>c.suit===cards[0].suit);if(fl&&sh)return[8,sh];if(groups[0].c===4)return[7,groups[0].v,groups[1].v];if(groups[0].c===3&&groups[1]?.c===2)return[6,groups[0].v,groups[1].v];if(fl)return[5,...vals];if(sh)return[4,sh];if(groups[0].c===3)return[3,groups[0].v,...groups.filter(g=>g.v!==groups[0].v).map(g=>g.v)];let pairs=groups.filter(g=>g.c===2).map(g=>g.v);if(pairs.length>=2)return[2,pairs[0],pairs[1],groups.find(g=>g.c===1).v];if(pairs.length===1)return[1,pairs[0],...groups.filter(g=>g.c===1).map(g=>g.v)];return[0,...vals]}
function best(cards){let out=null;for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){let s=eval5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!out||cmp(s,out)<0)out=s}return out}
function cmp(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return y-x}return 0}
function hname(s){return ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'][s?.[0]||0]}
function aiFold(p,game){const chance={easy:.25,medium:.16,hard:.08}[p.level]; const strength=best([...p.hand,...game.community])?.[0]||0;return game.street>0 && strength===0 && Math.random()<chance}
function renderSingle(){const g=state.single;if(!g)return;$('#humanChips').textContent=score(g.players[0].chips);$('#community').innerHTML=g.community.map(c=>cardMarkup(`${c.rank}${c.suit}`)).join('')||cardBacks(5);$('#humanCards').innerHTML=g.players[0].hand.map(c=>cardMarkup(`${c.rank}${c.suit}`)).join('');g.players.slice(1,4).forEach((p,i)=>{$('#opp'+(i+1)+'Name').textContent=p.folded?'Folded':p.name;$('#opp'+(i+1)+'Score').textContent=score(p.chips);});$('#humanHandName').textContent=g.result?g.result:'Street '+g.street+'/4';$('#potText').textContent=g.result?'SHOWDOWN':'—';$('#gameMessage').textContent=g.result||'Choose a move.';$('#showdownBtn').disabled=g.street<3;}
$('#foldBtn').onclick=()=>{if(state.mode==='single'){state.single.players[0].folded=true;state.single.result='You folded. Start a new hand from the lobby.';renderSingle();toast('Hand folded.');}else socket.emit('fold');};
$('#nextBtn').onclick=()=>{if(state.mode==='single')nextSingle();else socket.emit('nextStreet');};
$('#showdownBtn').onclick=()=>{if(state.mode==='single')showdownSingle();else socket.emit('nextStreet');};
function nextSingle(){const g=state.single;if(!g||g.result)return;if(g.street===0)g.community.push(g.deck.pop(),g.deck.pop(),g.deck.pop());else if(g.street===1)g.community.push(g.deck.pop());else if(g.street===2)g.community.push(g.deck.pop());else return;g.street++;g.players.slice(1).forEach(p=>{if(aiFold(p,g))p.folded=true});renderSingle();}
function showdownSingle(){const g=state.single;if(g.street<3){toast('Reveal the turn and river first.');return}g.players.forEach(p=>{if(!p.folded)p.score=best([...p.hand,...g.community])});const live=g.players.filter(p=>!p.folded);live.sort((a,b)=>cmp(a.score,b.score));if(!live.length){g.result='Everyone folded.';renderSingle();return}const top=live[0].score;const winners=live.filter(p=>cmp(p.score,top)===0);winners.forEach(p=>p.chips+=100);live.filter(p=>!winners.includes(p)).forEach(p=>p.chips=Math.max(0,p.chips-25));g.result=`${winners.map(w=>w.name).join(' & ')} • ${hname(top)} • +100 chips`;renderSingle();toast(g.result)}

const socketHandlers=()=>{
 socket.on('roomCreated',d=>{state.mode='multi';state.room=d.code;$('#roomCodePreview').textContent=d.code;$('#multiMsg').textContent=`Room ${d.code} created. Share the code with your friends.`;$('#readyRoom').disabled=false;$('#readyRoom').textContent='Ready for hand';toast(`Room ${d.code} created`)});
 socket.on('joined',d=>{state.mode='multi';state.room=d.code;$('#roomCodePreview').textContent=d.code;$('#readyRoom').disabled=false;toast(`Joined ${d.code}`)});
 socket.on('errorMsg',m=>toast(m));
 socket.on('state',renderMulti);
};
socketHandlers();
$('#createRoom').onclick=()=>{const name=$('#playerName').value.trim()||'Player';state.mode='multi';go('multi');socket.emit('createRoom',{name})};
$('#readyRoom').onclick=()=>socket.emit('ready');
$('#joinRoom').onclick=()=>{const name=$('#playerName').value.trim()||'Player';const c=$('#roomCode').value.trim().toUpperCase();if(!c)return toast('Enter a room code.');socket.emit('join',{code:c,name})};
function renderMulti(r){state.room=r.code;$('#roomCodePreview').textContent=r.code;$('#roomStatus').textContent=r.message||'Room ready';$('#readyRoom').disabled=false;const meLobby=r.players.find(p=>p.id===socket.id);$('#readyRoom').textContent=meLobby?.ready?'Unready':'Ready for hand';$('#gameLabel').textContent=`MULTIPLAYER • ROOM ${r.code}`;$('#playersStrip').innerHTML=r.players.map(p=>`<div class="player-chip">${p.name} · ${score(p.chips)}</div>`).join('');if(r.phase!=='lobby'){state.mode='multi';$('#game').classList.add('active');$$('.view').forEach(v=>v.classList.remove('active'));$('#community').innerHTML=r.community.map(cardMarkupKey).join('');const me=r.players.find(p=>p.id===socket.id);$('#humanChips').textContent=score(me?.chips||1000);$('#humanCards').innerHTML=(me?.hand||[]).map(cardMarkupKey).join('');$('#gameMessage').textContent=r.message;$('#humanHandName').textContent=r.phase.toUpperCase();r.players.filter(p=>p.id!==socket.id).slice(0,3).forEach((p,i)=>{$('#opp'+(i+1)+'Name').textContent=p.name;$('#opp'+(i+1)+'Score').textContent=score(p.chips)});}}
function cardMarkupKey(key){return cardMarkup(key)}

window.addEventListener('keydown',e=>{if(e.key==='Escape' && state.mode)go(state.mode==='multi'?'multi':'home')});
