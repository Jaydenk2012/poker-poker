const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();
const STARTING_CHIPS = 1000;
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUE = Object.fromEntries(RANKS.map((r,i) => [r, i + 2]));

function code() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}
function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return shuffle(deck);
}
function shuffle(deck) {
  const d = deck.slice();
  for (let i=d.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function cardKey(c) { return `${c.rank}${c.suit}`; }
function evaluate5(cards) {
  const vals = cards.map(c => RANK_VALUE[c.rank]).sort((a,b)=>b-a);
  const counts = {};
  vals.forEach(v => counts[v]=(counts[v]||0)+1);
  const groups = Object.entries(counts).map(([v,c])=>({v:+v,c})).sort((a,b)=>b.c-a.c || b.v-a.v);
  const unique = [...new Set(vals)];
  if (unique.includes(14)) unique.push(1);
  let straightHigh = null;
  for (let i=0;i<=unique.length-5;i++) {
    const seg = unique.slice(i,i+5);
    if (seg[0]-seg[4]===4) { straightHigh=seg[0]; break; }
  }
  const flush = cards.every(c=>c.suit===cards[0].suit);
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].c===4) return [7, groups[0].v, groups[1].v];
  if (groups[0].c===3 && groups[1]?.c===2) return [6, groups[0].v, groups[1].v];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].c===3) return [3, groups[0].v, ...groups.filter(g=>g.v!==groups[0].v).map(g=>g.v)];
  const pairs = groups.filter(g=>g.c===2).map(g=>g.v);
  if (pairs.length>=2) return [2, pairs[0], pairs[1], groups.find(g=>g.c===1).v];
  if (pairs.length===1) return [1, pairs[0], ...groups.filter(g=>g.c===1).map(g=>g.v)];
  return [0, ...vals];
}
function bestHand(cards) {
  let best = null;
  for (let a=0;a<cards.length-4;a++) for (let b=a+1;b<cards.length-3;b++) for (let c=b+1;c<cards.length-2;c++)
    for (let d=c+1;d<cards.length-1;d++) for (let e=d+1;e<cards.length;e++) {
      const score=evaluate5([cards[a],cards[b],cards[c],cards[d],cards[e]]);
      if (!best || compareScore(score,best)<0) best=score;
    }
  return best;
}
function compareScore(a,b) {
  const n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){ const av=a[i]||0,bv=b[i]||0; if(av!==bv) return bv-av; }
  return 0;
}
function handName(score) {
  return ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'][score?.[0]||0];
}
function safePlayer(p, viewerId) {
  return { id:p.id, name:p.name, chips:p.chips, ready:p.ready, folded:p.folded, connected:p.connected, hand:p.id===viewerId ? (p.hand?.map(cardKey) || []) : [] };
}
function publicRoom(room, viewerId) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    community: room.community.map(cardKey),
    players: room.players.map(p => safePlayer(p, viewerId)),
    message: room.message,
    handNo: room.handNo,
    dealerIndex: room.dealerIndex
  };
}
function broadcast(room) { for (const p of room.players) io.to(p.id).emit('state', publicRoom(room, p.id)); }
function makeRoom(codeValue) {
  const room={code:codeValue, hostId:null, players:[], phase:'lobby', deck:[], community:[], handNo:0, dealerIndex:0, message:'Waiting for players.'};
  rooms.set(room.code, room); return room;
}
function dealRound(room) {
  if(room.players.length<2){room.message='Need at least 2 players.'; return;}
  room.deck=makeDeck(); room.community=[]; room.handNo+=1; room.phase='preflop';
  room.dealerIndex=(room.dealerIndex+1)%room.players.length;
  room.players.forEach(p=>{p.hand=[room.deck.pop(),room.deck.pop()];p.folded=false;p.ready=false;});
  room.message='Private cards dealt. Choose Reveal to continue.';
  broadcast(room);
}
function allReveal(room) {
  // Non-wagering showdown flow: players reveal voluntarily, host/last player can advance automatically.
  if(room.phase==='preflop') { room.community.push(room.deck.pop(),room.deck.pop(),room.deck.pop()); room.phase='flop'; room.message='Flop revealed.'; }
  else if(room.phase==='flop') { room.community.push(room.deck.pop()); room.phase='turn'; room.message='Turn revealed.'; }
  else if(room.phase==='turn') { room.community.push(room.deck.pop()); room.phase='river'; room.message='River revealed. Showdown is ready.'; }
  else if(room.phase==='river') showdown(room);
  broadcast(room);
}
function showdown(room) {
  room.phase='showdown';
  const live=room.players.filter(p=>!p.folded && p.hand?.length===2);
  const scored=live.map(p=>({p,score:bestHand([...p.hand,...room.community])}));
  if(!scored.length){room.message='Everyone folded.';return;}
  scored.sort((a,b)=>compareScore(a.score,b.score));
  const best=scored[0].score;
  const winners=scored.filter(x=>compareScore(x.score,best)===0).map(x=>x.p);
  winners.forEach(w=>w.chips+=100);
  live.filter(p=>!winners.includes(p)).forEach(p=>p.chips=Math.max(0,p.chips-25));
  room.message=`${winners.map(w=>w.name).join(' & ')} win +100 chips • ${handName(best)}`;
}

io.on('connection', socket => {
  socket.on('createRoom', ({name})=>{
    let c; do c=code(); while(rooms.has(c));
    const room=makeRoom(c); room.hostId=socket.id;
    room.players.push({id:socket.id,name:(name||'Player').slice(0,20),chips:STARTING_CHIPS,ready:false,folded:false,connected:true,hand:[]});
    socket.join(c); socket.data.room=c; socket.emit('roomCreated',{code:c}); broadcast(room);
  });
  socket.on('join', ({code:roomCode,name})=>{
    const c=(roomCode||'').trim().toUpperCase(); const room=rooms.get(c);
    if(!room) return socket.emit('errorMsg','Room not found.');
    if(room.players.length>=6) return socket.emit('errorMsg','Room is full.');
    if(room.phase!=='lobby') return socket.emit('errorMsg','That room is already in a hand.');
    room.players.push({id:socket.id,name:(name||'Player').slice(0,20),chips:STARTING_CHIPS,ready:false,folded:false,connected:true,hand:[]});
    socket.join(c); socket.data.room=c; socket.emit('joined',{code:c}); room.message=`${name||'A player'} joined the table.`; broadcast(room);
  });
  socket.on('ready', ()=>{
    const room=rooms.get(socket.data.room); if(!room) return;
    const p=room.players.find(x=>x.id===socket.id); if(!p) return; p.ready=!p.ready;
    if(room.phase==='lobby' && room.players.length>=2 && room.players.every(x=>x.ready)) dealRound(room);
    else broadcast(room);
  });
  socket.on('nextStreet', ()=>{
    const room=rooms.get(socket.data.room); if(!room) return; allReveal(room);
  });
  socket.on('fold', ()=>{
    const room=rooms.get(socket.data.room); if(!room) return; const p=room.players.find(x=>x.id===socket.id); if(!p) return;
    p.folded=true; p.ready=true; room.message=`${p.name} folded this hand.`; broadcast(room);
  });
  socket.on('newHand', ()=>{
    const room=rooms.get(socket.data.room); if(!room) return;
    if(socket.id!==room.hostId) return socket.emit('errorMsg','Only the host can start the next hand.');
    dealRound(room);
  });
  socket.on('disconnect', ()=>{
    const c=socket.data.room; if(!c) return; const room=rooms.get(c); if(!room)return;
    const idx=room.players.findIndex(p=>p.id===socket.id); if(idx>=0) room.players.splice(idx,1);
    if(room.hostId===socket.id) room.hostId=room.players[0]?.id||null;
    if(room.players.length===0) rooms.delete(c); else {room.message='A player left the room.'; broadcast(room);}
  });
});

server.listen(PORT,()=>console.log(`Neon Poker Arena listening on ${PORT}`));
