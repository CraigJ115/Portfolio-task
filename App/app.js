const PAL = ['#FF3B30','#FF9500','#FFCC00','#34C759','#007AFF','#5856D6','#FF2D55','#00C7BE'];
let pick = PAL[4], myId = 'u_' + Math.random().toString(36).slice(2,9);
let myName = '', myIni = '', roomCode = '';
let room = {}, bc = null, shOpen = false, firstFix = true;
let markers = {};

// Leaflet map
const map = L.map('map', { zoomControl: false }).setView([48.85, 2.35], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);
map.on('click', hideCallout);

// Color swatches
const cr = document.getElementById('colorRow');
PAL.forEach(c => {
  const s = document.createElement('div');
  s.className = 'cswatch' + (c === pick ? ' on' : '');
  s.style.background = c;
  s.onclick = () => {
    pick = c;
    document.querySelectorAll('.cswatch').forEach(x => x.classList.remove('on'));
    s.classList.add('on');
    document.getElementById('obAv').style.background = c;
  };
  cr.appendChild(s);
});
document.getElementById('obAv').style.background = pick;
document.getElementById('obName').oninput = e => {
  document.getElementById('obAv').textContent = ini(e.target.value) || '?';
};

function ini(n) {
  if (!n.trim()) return '?';
  const p = n.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length-1][0] : n.slice(0,2)).toUpperCase();
}
function genCode() { return Math.random().toString(36).slice(2,8).toUpperCase(); }

document.getElementById('obCreate').onclick = () => go(genCode());
document.getElementById('obJoin').onclick = () => {
  const c = document.getElementById('obCode').value.trim().toUpperCase();
  if (c.length < 4) { document.getElementById('obCode').focus(); return; }
  go(c);
};
document.getElementById('obName').onkeydown = e => { if (e.key === 'Enter') go(genCode()); };
document.getElementById('obCode').onkeydown = e => { if (e.key === 'Enter') document.getElementById('obJoin').click(); };

function go(code) {
  myName = document.getElementById('obName').value.trim() || 'You';
  myIni = ini(myName); roomCode = code;
  room[myId] = { id: myId, name: myName, ini: myIni, color: pick, lat: null, lng: null, ts: null };
  document.getElementById('onboard').classList.add('out');
  const tb = document.getElementById('topbar'); tb.style.display = 'flex';
  document.getElementById('tbAv').textContent = myIni;
  document.getElementById('tbAv').style.background = pick;
  document.getElementById('tbName').textContent = myName;
  document.getElementById('tbCode').textContent = code;
  document.getElementById('shCode').textContent = code;
  syncUp(); startGPS();
  setTimeout(() => { shOpen = true; document.getElementById('sheet').classList.add('open'); }, 800);
}

function syncUp() {
  try { bc = new BroadcastChannel('nm_' + roomCode); } catch(e) {}
  if (bc) {
    bc.onmessage = ({ data: msg }) => {
      if (!msg.member) return;
      const m = msg.member;
      if (msg.type === 'update' && m.id !== myId) {
        const isNew = !room[m.id];
        room[m.id] = m;
        if (isNew) toast(m.name + ' joined');
        updateMarker(m);
        renderCrew();
      }
      if (msg.type === 'leave') { delete room[m.id]; removeMarker(m.id); renderCrew(); }
      if (msg.type === 'ping') broadMe();
      if (msg.type === 'join' && m.id !== myId) { broadMe(); toast(m.name + ' joined'); }
    };
  }
  loadStor();
  broadcast({ type: 'join', member: room[myId] });
  setInterval(broadMe, 5000);
}

function broadcast(msg) {
  if (bc) bc.postMessage(msg);
  try {
    if (msg.type === 'update') {
      const s = JSON.parse(localStorage.getItem('nm_' + roomCode) || '{}');
      s[msg.member.id] = msg.member;
      localStorage.setItem('nm_' + roomCode, JSON.stringify(s));
    }
  } catch(e) {}
}

function loadStor() {
  try {
    const s = JSON.parse(localStorage.getItem('nm_' + roomCode) || '{}');
    Object.values(s).forEach(m => {
      if (m.id !== myId && Date.now() - (m.ts || 0) < 600000) {
        room[m.id] = m;
        updateMarker(m);
      }
    });
    renderCrew();
  } catch(e) {}
}

function broadMe() { broadcast({ type: 'update', member: room[myId] }); }

function startGPS() {
  if (!navigator.geolocation) { demo(); return; }
  navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    room[myId].lat = lat; room[myId].lng = lng; room[myId].ts = Date.now();
    broadMe(); updateMarker(room[myId]); renderCrew();
    if (firstFix) { firstFix = false; flyTo(lat, lng, 14); }
  }, demo, { enableHighAccuracy: true, maximumAge: 4000 });
}

function demo() {
  const b = { lat: 51.505 + (Math.random() - .5) * .02, lng: -.09 + (Math.random() - .5) * .02 };
  room[myId].lat = b.lat; room[myId].lng = b.lng; room[myId].ts = Date.now();
  broadMe(); updateMarker(room[myId]); renderCrew();
  if (firstFix) { firstFix = false; flyTo(b.lat, b.lng, 13); }
  setInterval(() => {
    room[myId].lat += (Math.random() - .5) * .0003;
    room[myId].lng += (Math.random() - .5) * .0003;
    room[myId].ts = Date.now();
    broadMe(); updateMarker(room[myId]); renderCrew();
  }, 7000);
}

// Leaflet marker management
function makeIcon(m, isMe) {
  const size = 44;
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:${size}px;">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${m.color};border:${isMe ? 3 : 2.5}px solid #fff;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:700;font-size:${Math.round(size * .38)}px;
        font-family:Inter,sans-serif;
        box-shadow:0 3px 12px rgba(0,0,0,.35);
      ">${m.ini}</div>
      <div style="
        background:rgba(0,0,0,.72);color:#fff;
        font-size:9px;font-weight:600;font-family:Inter,sans-serif;
        padding:2px 7px;border-radius:6px;margin-top:3px;white-space:nowrap;
      ">${isMe ? 'You' : m.name}</div>
    </div>`,
    iconSize: [size, size + 22],
    iconAnchor: [size / 2, size + 22]
  });
}

function updateMarker(m) {
  if (!m.lat) return;
  const isMe = m.id === myId;
  if (markers[m.id]) {
    markers[m.id].setLatLng([m.lat, m.lng]);
    markers[m.id].setIcon(makeIcon(m, isMe));
  } else {
    const marker = L.marker([m.lat, m.lng], { icon: makeIcon(m, isMe) }).addTo(map);
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      showCallout(room[m.id] || m, e.originalEvent.clientX, e.originalEvent.clientY);
    });
    markers[m.id] = marker;
  }
}

function removeMarker(id) {
  if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; }
}

function flyTo(lat, lng, zoom) {
  map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 0.8 });
}

// Controls
document.getElementById('zIn').onclick = () => map.setZoom(map.getZoom() + 1);
document.getElementById('zOut').onclick = () => map.setZoom(map.getZoom() - 1);
document.getElementById('fabMe').onclick = () => {
  const me = room[myId];
  if (me && me.lat) flyTo(me.lat, me.lng, 15);
  else toast('Finding your location…');
};

// Bottom sheet
const tog = () => { shOpen = !shOpen; document.getElementById('sheet').classList.toggle('open', shOpen); };
document.getElementById('shToggle').onclick = tog;
document.getElementById('shTop').onclick = tog;
document.getElementById('copyBtn').onclick = () => {
  navigator.clipboard && navigator.clipboard.writeText(roomCode).catch(() => {});
  toast('Room code copied!');
};

function showCallout(m, px, py) {
  document.getElementById('clAv').textContent = m.ini;
  document.getElementById('clAv').style.background = m.color;
  document.getElementById('clName').textContent = m.id === myId ? 'You' : m.name;
  const ago = m.ts ? Math.round((Date.now() - m.ts) / 1000) : null;
  document.getElementById('clTime').textContent = ago === null ? 'no location' : ago < 5 ? 'just now' : ago < 60 ? ago + 's ago' : Math.round(ago / 60) + 'm ago';
  const co = document.getElementById('callout');
  co.style.left = (px + 12) + 'px';
  co.style.top = (py - 90) + 'px';
  co.classList.add('show');
  co.style.display = 'block';
  setTimeout(hideCallout, 3000);
}

function hideCallout() {
  const c = document.getElementById('callout');
  c.classList.remove('show');
  setTimeout(() => c.style.display = 'none', 150);
}

function haversine(a, b, c, d) {
  const R = 6371, dL = (c-a) * Math.PI/180, dG = (d-b) * Math.PI/180;
  const x = Math.sin(dL/2)**2 + Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function renderCrew() {
  const sc = document.getElementById('shCrew'), me = room[myId];
  const others = Object.values(room).filter(m => m.id !== myId);
  document.getElementById('shTitle').textContent = 'Friends (' + (others.length + 1) + ')';
  sc.innerHTML = '';
  sc.appendChild(mkCard(me, null, true));
  if (!others.length) {
    const el = document.createElement('div');
    el.className = 'no-crew';
    el.textContent = 'Share your code and your friends will show up here.';
    sc.appendChild(el);
  } else {
    others.forEach(m => {
      const d = (me && me.lat && m.lat) ? haversine(me.lat, me.lng, m.lat, m.lng) : null;
      sc.appendChild(mkCard(m, d, false));
    });
  }
}

function mkCard(m, dist, isMe) {
  const el = document.createElement('div'); el.className = 'cc';
  const online = m.ts && (Date.now() - m.ts) < 15000;
  const ds = dist === null ? '' : dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + 'km';
  el.innerHTML = `<div class="cc-av" style="background:${m.color}">${m.ini}${(online || isMe) ? '<div class="cc-dot"></div>' : ''}</div><div class="cc-name">${isMe ? 'You' : m.name}</div><div class="cc-dist">${isMe ? 'Sharing' : ds || '–'}</div>`;
  if (!isMe && m.lat) el.onclick = () => flyTo(m.lat, m.lng, 15);
  return el;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400);
}
