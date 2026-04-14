const PAL=['#FF3B30','#FF9500','#FFCC00','#34C759','#007AFF','#5856D6','#FF2D55','#00C7BE'];
let pick=PAL[4], myId='u_'+Math.random().toString(36).slice(2,9);
let myName='',myIni='',roomCode='';
let room={},bc=null,shOpen=false,firstFix=true;

// swatches
const cr=document.getElementById('colorRow');
PAL.forEach(c=>{
  const s=document.createElement('div');
  s.className='cswatch'+(c===pick?' on':'');
  s.style.background=c;
  s.onclick=()=>{ pick=c; document.querySelectorAll('.cswatch').forEach(x=>x.classList.remove('on')); s.classList.add('on'); document.getElementById('obAv').style.background=c; };
  cr.appendChild(s);
});
document.getElementById('obAv').style.background=pick;
document.getElementById('obName').oninput=e=>{ document.getElementById('obAv').textContent=ini(e.target.value)||'?'; };

function ini(n){ if(!n.trim())return'?'; const p=n.trim().split(/\s+/); return(p.length>=2?p[0][0]+p[p.length-1][0]:n.slice(0,2)).toUpperCase(); }
function genCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

document.getElementById('obCreate').onclick=()=>go(genCode());
document.getElementById('obJoin').onclick=()=>{ const c=document.getElementById('obCode').value.trim().toUpperCase(); if(c.length<4){document.getElementById('obCode').focus();return;} go(c); };
document.getElementById('obName').onkeydown=e=>{ if(e.key==='Enter')go(genCode()); };
document.getElementById('obCode').onkeydown=e=>{ if(e.key==='Enter')document.getElementById('obJoin').click(); };

function go(code){
  myName=document.getElementById('obName').value.trim()||'You';
  myIni=ini(myName); roomCode=code;
  room[myId]={id:myId,name:myName,ini:myIni,color:pick,lat:null,lng:null,ts:null};
  document.getElementById('onboard').classList.add('out');
  const tb=document.getElementById('topbar'); tb.style.display='flex';
  document.getElementById('tbAv').textContent=myIni; document.getElementById('tbAv').style.background=pick;
  document.getElementById('tbName').textContent=myName;
  document.getElementById('tbCode').textContent=code;
  document.getElementById('shCode').textContent=code;
  syncUp(); startGPS(); resize();
  setTimeout(()=>{ shOpen=true; document.getElementById('sheet').classList.add('open'); },800);
}

function syncUp(){
  try{ bc=new BroadcastChannel('nm_'+roomCode); }catch(e){}
  if(bc){ bc.onmessage=({data:msg})=>{ if(!msg.member)return; const m=msg.member; if(msg.type==='update'&&m.id!==myId){ const isNew=!room[m.id]; room[m.id]=m; if(isNew)toast(m.name+' joined'); renderCrew(); drawFriends(); } if(msg.type==='leave'){delete room[m.id];renderCrew();drawFriends();} if(msg.type==='ping')broadMe(); if(msg.type==='join'&&m.id!==myId){broadMe();toast(m.name+' joined');} }; }
  loadStor(); broadcast({type:'join',member:room[myId]}); setInterval(broadMe,5000);
}
function broadcast(msg){ if(bc)bc.postMessage(msg); try{ if(msg.type==='update'){ const s=JSON.parse(localStorage.getItem('nm_'+roomCode)||'{}'); s[msg.member.id]=msg.member; localStorage.setItem('nm_'+roomCode,JSON.stringify(s)); } }catch(e){} }
function loadStor(){ try{ const s=JSON.parse(localStorage.getItem('nm_'+roomCode)||'{}'); Object.values(s).forEach(m=>{ if(m.id!==myId&&Date.now()-(m.ts||0)<600000)room[m.id]=m; }); renderCrew(); drawFriends(); }catch(e){} }
function broadMe(){ broadcast({type:'update',member:room[myId]}); }

function startGPS(){
  if(!navigator.geolocation){demo();return;}
  navigator.geolocation.watchPosition(pos=>{ const{latitude:lat,longitude:lng}=pos.coords; room[myId].lat=lat; room[myId].lng=lng; room[myId].ts=Date.now(); broadMe(); renderCrew(); drawFriends(); if(firstFix){firstFix=false;flyTo(lat,lng,14);} },demo,{enableHighAccuracy:true,maximumAge:4000});
}
function demo(){
  const b={lat:51.505+(Math.random()-.5)*.02,lng:-.09+(Math.random()-.5)*.02};
  room[myId].lat=b.lat; room[myId].lng=b.lng; room[myId].ts=Date.now();
  broadMe(); renderCrew(); drawFriends();
  if(firstFix){firstFix=false;flyTo(b.lat,b.lng,13);}
  setInterval(()=>{ room[myId].lat+=(Math.random()-.5)*.0003; room[myId].lng+=(Math.random()-.5)*.0003; room[myId].ts=Date.now(); broadMe(); renderCrew(); drawFriends(); },7000);
}

// map
const T=256; let ms={lat:48.85,lng:2.35,zoom:5},cache={};
const wrap=document.getElementById('mapWrap');
const tc=document.getElementById('tileCanvas'),fc=document.getElementById('friendCanvas');
const tx=tc.getContext('2d'),fx=fc.getContext('2d');

function resize(){ tc.width=fc.width=wrap.clientWidth; tc.height=fc.height=wrap.clientHeight; draw(); }

function ll2t(la,ln,z){ const n=Math.pow(2,z),x=(ln+180)/360*n,y=(1-Math.log(Math.tan(la*Math.PI/180)+1/Math.cos(la*Math.PI/180))/Math.PI)/2*n; return{x,y}; }
function t2ll(tx2,ty,z){ const n=Math.pow(2,z); return{lat:Math.atan(Math.sinh(Math.PI*(1-2*ty/n)))*180/Math.PI,lng:tx2/n*360-180}; }
function ll2px(la,ln){ const c=ll2t(ms.lat,ms.lng,ms.zoom),p=ll2t(la,ln,ms.zoom); return{x:(p.x-c.x)*T+tc.width/2,y:(p.y-c.y)*T+tc.height/2}; }
function px2ll(x,y){ const c=ll2t(ms.lat,ms.lng,ms.zoom); return t2ll(c.x+(x-tc.width/2)/T,c.y+(y-tc.height/2)/T,ms.zoom); }

function loadTile(z,x2,y2){ const k=z+'/'+x2+'/'+y2; if(cache[k]!==undefined)return cache[k]; cache[k]=null; const img=new Image(); img.crossOrigin='anonymous'; img.src='https://'+['a','b','c'][Math.abs(x2+y2)%3]+'.tile.openstreetmap.org/'+z+'/'+x2+'/'+y2+'.png'; img.onload=()=>{cache[k]=img;draw();}; return null; }

function drawTiles(){
  tx.fillStyle='#e8e0d8'; tx.fillRect(0,0,tc.width,tc.height);
  const z=ms.zoom,c=ll2t(ms.lat,ms.lng,z),mx=Math.pow(2,z);
  const rx=Math.ceil(tc.width/T/2)+2,ry=Math.ceil(tc.height/T/2)+2;
  for(let ty=Math.floor(c.y)-ry;ty<=Math.floor(c.y)+ry;ty++){
    for(let tx2=Math.floor(c.x)-rx;tx2<=Math.floor(c.x)+rx;tx2++){
      const wtx=((tx2%mx)+mx)%mx,wty=Math.max(0,Math.min(mx-1,ty));
      const img=loadTile(z,wtx,wty);
      const dx=(tx2-c.x)*T+tc.width/2,dy=(ty-c.y)*T+tc.height/2;
      if(img){ tx.drawImage(img,Math.round(dx),Math.round(dy),T,T); }
      else{ tx.fillStyle='#ede8e1'; tx.fillRect(Math.round(dx),Math.round(dy),T,T); }
    }
  }
}

function drawFriends(){ fx.clearRect(0,0,fc.width,fc.height); Object.values(room).forEach(m=>{if(m.lat)drawPin(m);}); }

function drawPin(m){
  const{x,y}=ll2px(m.lat,m.lng);
  const isMe=m.id===myId, R=22;
  // Snapchat-style: circle avatar with white border + small tail
  fx.save();
  fx.shadowColor='rgba(0,0,0,.3)'; fx.shadowBlur=10; fx.shadowOffsetY=3;
  // tail
  fx.beginPath(); fx.moveTo(x-6,y+R-2); fx.lineTo(x,y+R+10); fx.lineTo(x+6,y+R-2);
  fx.fillStyle=m.color; fx.fill();
  fx.beginPath(); fx.arc(x,y,R,0,Math.PI*2);
  fx.fillStyle=m.color; fx.fill();
  fx.restore();
  // white border
  fx.beginPath(); fx.arc(x,y,R,0,Math.PI*2);
  fx.strokeStyle='#fff'; fx.lineWidth=isMe?3:2.5; fx.stroke();
  // initials
  fx.font='700 '+(R*.65)+'px Inter,sans-serif';
  fx.fillStyle='#fff'; fx.textAlign='center'; fx.textBaseline='middle';
  fx.fillText(m.ini,x,y+1);
  // name tag
  const label=isMe?'You':m.name;
  fx.font='600 10px Inter,sans-serif';
  const tw=fx.measureText(label).width+10, th=16, bx=x-tw/2, by=y+R+14;
  fx.save();
  fx.shadowColor='rgba(0,0,0,.15)'; fx.shadowBlur=4;
  fx.fillStyle='rgba(0,0,0,.7)';
  roundRect(fx,bx,by,tw,th,8); fx.fill();
  fx.restore();
  fx.fillStyle='#fff'; fx.font='600 10px Inter,sans-serif';
  fx.textAlign='center'; fx.textBaseline='middle';
  fx.fillText(label,x,by+th/2);
}

function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); }

function draw(){ drawTiles(); drawFriends(); }

let drag=false,ds,dO;
wrap.addEventListener('mousedown',e=>{drag=true;ds={x:e.clientX,y:e.clientY};dO={lat:ms.lat,lng:ms.lng};});
window.addEventListener('mousemove',e=>{ if(!drag)return; const c=ll2t(dO.lat,dO.lng,ms.zoom); const ll=t2ll(c.x-(e.clientX-ds.x)/T,c.y-(e.clientY-ds.y)/T,ms.zoom); ms.lat=Math.max(-85,Math.min(85,ll.lat));ms.lng=ll.lng;draw(); });
window.addEventListener('mouseup',()=>{drag=false;});
wrap.addEventListener('wheel',e=>{ e.preventDefault(); const nz=Math.max(2,Math.min(18,ms.zoom+(e.deltaY>0?-1:1))); if(nz===ms.zoom)return; const rect=wrap.getBoundingClientRect(); const ll=px2ll(e.clientX-rect.left,e.clientY-rect.top); const f=Math.pow(2,nz-ms.zoom); ms.lat=ll.lat-(ll.lat-ms.lat)/f; ms.lng=ll.lng-(ll.lng-ms.lng)/f; ms.zoom=nz;cache={};draw(); },{passive:false});
let tt,to2;
wrap.addEventListener('touchstart',e=>{tt=e.touches[0];to2={lat:ms.lat,lng:ms.lng};ds={x:tt.clientX,y:tt.clientY};});
wrap.addEventListener('touchmove',e=>{ e.preventDefault(); const t=e.touches[0]; const c=ll2t(to2.lat,to2.lng,ms.zoom); const ll=t2ll(c.x-(t.clientX-ds.x)/T,c.y-(t.clientY-ds.y)/T,ms.zoom); ms.lat=Math.max(-85,Math.min(85,ll.lat));ms.lng=ll.lng;draw(); },{passive:false});

wrap.addEventListener('click',e=>{ const rect=wrap.getBoundingClientRect(); const mx=e.clientX-rect.left,my=e.clientY-rect.top; let hit=null; Object.values(room).forEach(m=>{ if(!m.lat)return; const{x,y}=ll2px(m.lat,m.lng); if(Math.hypot(mx-x,my-y)<26)hit={m,ex:e.clientX,ey:e.clientY}; }); if(hit)showCallout(hit.m,hit.ex,hit.ey); else hideCallout(); });

function showCallout(m,px,py){ document.getElementById('clAv').textContent=m.ini; document.getElementById('clAv').style.background=m.color; document.getElementById('clName').textContent=m.id===myId?'You':m.name; const ago=m.ts?Math.round((Date.now()-m.ts)/1000):null; document.getElementById('clTime').textContent=ago===null?'no location':ago<5?'just now':ago<60?ago+'s ago':Math.round(ago/60)+'m ago'; const co=document.getElementById('callout'); co.style.left=(px+12)+'px'; co.style.top=(py-90)+'px'; co.classList.add('show'); co.style.display='block'; setTimeout(hideCallout,3000); }
function hideCallout(){ const c=document.getElementById('callout'); c.classList.remove('show'); setTimeout(()=>c.style.display='none',150); }

document.getElementById('zIn').onclick=()=>{ms.zoom=Math.min(18,ms.zoom+1);cache={};draw();};
document.getElementById('zOut').onclick=()=>{ms.zoom=Math.max(2,ms.zoom-1);cache={};draw();};
document.getElementById('fabMe').onclick=()=>{ const me=room[myId]; if(me&&me.lat)flyTo(me.lat,me.lng,15); else toast('Finding your location…'); };

function flyTo(la,ln,zoom){ const N=20,sl=ms.lat,slng=ms.lng,sz=ms.zoom,tz=zoom||sz; let s=0; const ease=t=>t<.5?2*t*t:-1+(4-2*t)*t; const tick=()=>{s++;const t=ease(s/N);ms.lat=sl+(la-sl)*t;ms.lng=slng+(ln-slng)*t;if(tz!==sz)ms.zoom=Math.round(sz+(tz-sz)*t);draw();if(s<N)requestAnimationFrame(tick);}; requestAnimationFrame(tick); }

function haversine(a,b,c,d){ const R=6371,dL=(c-a)*Math.PI/180,dG=(d-b)*Math.PI/180; const x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2; return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }

function renderCrew(){
  const sc=document.getElementById('shCrew'), me=room[myId];
  const others=Object.values(room).filter(m=>m.id!==myId);
  document.getElementById('shTitle').textContent='Friends ('+(others.length+1)+')';
  sc.innerHTML='';
  sc.appendChild(mkCard(me,null,true));
  if(!others.length){ const el=document.createElement('div'); el.className='no-crew'; el.textContent='Share your code with friends to see them here.'; sc.appendChild(el); }
  else { others.forEach(m=>{ const d=(me&&me.lat&&m.lat)?haversine(me.lat,me.lng,m.lat,m.lng):null; sc.appendChild(mkCard(m,d,false)); }); }
}

function mkCard(m,dist,isMe){
  const el=document.createElement('div'); el.className='cc';
  const online=m.ts&&(Date.now()-m.ts)<15000;
  const ds=dist===null?'':dist<1?Math.round(dist*1000)+'m':dist.toFixed(1)+'km';
  el.innerHTML=`<div class="cc-av" style="background:${m.color}">${m.ini}${(online||isMe)?'<div class="cc-dot"></div>':''}</div><div class="cc-name">${isMe?'You':m.name}</div><div class="cc-dist">${isMe?'Sharing':ds||'–'}</div>`;
  if(!isMe&&m.lat)el.onclick=()=>flyTo(m.lat,m.lng,15);
  return el;
}

const tog=()=>{ shOpen=!shOpen; document.getElementById('sheet').classList.toggle('open',shOpen); };
document.getElementById('shToggle').onclick=tog;
document.getElementById('shTop').onclick=tog;
document.getElementById('copyBtn').onclick=()=>{ navigator.clipboard&&navigator.clipboard.writeText(roomCode).catch(()=>{}); toast('Room code copied!'); };

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2400); }

window.addEventListener('resize',resize);
resize();