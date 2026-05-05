const express = require("express");
const app = express();

app.use(express.json());

// ================= STATE =================
let robotRaw = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };
let logs = []; // آخر 20 قراءة

// ================= RECEIVE =================
app.post("/data", (req, res) => {
  robotRaw = req.body || {};

  const d = mapData(robotRaw);
  logs.unshift({
    time: new Date().toLocaleTimeString(),
    ...d
  });
  if (logs.length > 20) logs.pop();

  res.send("OK");
});

app.post("/gps", (req, res) => {
  gpsData = req.body || gpsData;
  res.send("OK");
});

// ================= FIXED MAPPING =================
function mapData(d) {
  return {
    H2S: d.H2S ?? d.G5 ?? 0,
    CO: d.CO ?? d.G1 ?? 0,
    CO2: d.CO2 ?? d.G7 ?? 0,
    NO2: d.NO2 ?? d.G3 ?? 0,
    NH3: d.NH3 ?? d.G2 ?? 0,
    CH4: d.CH4 ?? d.G4 ?? 0,
    O3: d.O3 ?? d.G6 ?? 0,
    TEMP: d.TEMP ?? d.T ?? 0,
    HUM: d.HUM ?? d.H ?? 0,
    SMOKE: d.SMOKE ?? d.G7 ?? 0
  };
}

// ================= SEND =================
app.get("/data", (req, res) => res.json(mapData(robotRaw)));
app.get("/logs", (req, res) => res.json(logs));
app.get("/gps", (req, res) => res.json(gpsData));

app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});
app.get("/control", (req, res) => res.send(lastCommand));

// ================= DASHBOARD =================
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Industrial Robot</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<style>
*{box-sizing:border-box}
body{
  margin:0;
  background:#0b0f1a;
  color:white;
  font-family:Arial;
  display:flex;
}
.sidebar{
  width:260px;
  background:#111827;
  padding:20px;
  display:flex;
  flex-direction:column;
  gap:20px;
}
.main{
  flex:1;
  padding:20px;
}
.cards{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:15px;
}
.card{
  background:#1f2937;
  border-radius:12px;
  padding:15px;
  text-align:center;
  transition:0.3s;
}
.card span{font-size:22px; display:block;}
.danger{ background:#7f1d1d; animation:pulse 1s infinite; }
@keyframes pulse{50%{opacity:0.5;}}
.grid{
  display:grid;
  grid-template-columns:repeat(3,70px);
  gap:10px;
  justify-content:center;
}
.ctrl-btn{
  padding:12px;
  border-radius:10px;
  border:none;
  background:#1f2937;
  color:white;
  font-size:18px;
  touch-action:none;
}
.status{
  background:#1f2937;
  padding:10px;
  border-radius:10px;
  text-align:center;
  margin-top:10px;
  font-weight:bold;
}
.bottom{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:20px;
  margin-top:20px;
}
#map{height:300px;border-radius:12px;}
#logs{
  background:#1f2937;
  padding:10px;
  border-radius:12px;
  max-height:300px;
  overflow:auto;
  font-size:12px;
}
.camera{
  margin-top:15px;
  border-radius:12px;
  overflow:hidden;
}
</style>
</head>

<body oncontextmenu="return false">

<div class="sidebar">

<h3>🎮 Mode</h3>
<button onclick="send('RC')">🎮 RC</button>
<button onclick="send('WEB')">🌐 WEB</button>

<h3>⚡ Speed</h3>
<button onclick="send('SLOW')">🐢</button>
<button onclick="send('MED')">🚗</button>
<button onclick="send('FAST')">🚀</button>

<h3>🎯 Control</h3>

<div class="grid">
<div></div>
<button class="ctrl-btn" data-cmd="FWD">⬆</button>
<div></div>

<button class="ctrl-btn" data-cmd="LEFT">⬅</button>
<button class="ctrl-btn" onclick="send('STOP')">⛔</button>
<button class="ctrl-btn" data-cmd="RIGHT">➡</button>

<div></div>
<button class="ctrl-btn" data-cmd="BACK">⬇</button>
<div></div>
</div>

<h3>💡 Light</h3>
<button onclick="send('LIGHT_ON')">ON</button>
<button onclick="send('LIGHT_OFF')">OFF</button>

<div class="camera">
<h4>📷 Camera</h4>
<img src="http://YOUR_CAMERA_IP:81/stream" width="100%">
</div>

</div>

<div class="main">

<h2>📊 Industrial Gas Monitoring Dashboard</h2>

<div class="cards" id="cards"></div>

<div id="status" class="status">Status: SAFE</div>

<h3>📈 Multi-Gas Trend</h3>
<canvas id="chart"></canvas>

<div class="bottom">
  <div>
    <h3>📍 Map</h3>
    <div id="map"></div>
  </div>

  <div>
    <h3>📄 Logs</h3>
    <div id="logs"></div>
  </div>
</div>

</div>

<script>

// ===== FIXED CONTROL (NO DELAY) =====
let active=false;

function send(cmd){
  fetch('/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd})});
}

function bindHold(btn){
  let cmd = btn.dataset.cmd;

  btn.addEventListener('pointerdown',(e)=>{
    e.preventDefault();
    active=true;

    function loop(){
      if(!active) return;
      send(cmd);
      requestAnimationFrame(loop);
    }
    loop();
  });

  const stopNow = ()=>{
    active=false;
    send("STOP");
  };

  btn.addEventListener('pointerup', stopNow);
  btn.addEventListener('pointerleave', stopNow);
  btn.addEventListener('touchend', stopNow);
  btn.addEventListener('touchcancel', stopNow);
}

document.querySelectorAll('.ctrl-btn').forEach(bindHold);

// ===== GRAPH =====
let labels=[];
let dataSets={CO:[],H2S:[],NH3:[],CH4:[],NO2:[],CO2:[],O3:[]};

const chart=new Chart(document.getElementById("chart"),{
 type:'line',
 data:{labels:labels,datasets:[
   {label:'CO',data:dataSets.CO},
   {label:'H2S',data:dataSets.H2S},
   {label:'NH3',data:dataSets.NH3},
   {label:'CH4',data:dataSets.CH4},
   {label:'NO2',data:dataSets.NO2},
   {label:'CO2',data:dataSets.CO2},
   {label:'O3',data:dataSets.O3}
 ]},
 options:{animation:false}
});

// ===== MAP =====
let map = L.map('map').setView([15.3,44.2], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([15.3,44.2]).addTo(map);

// ===== UPDATE =====
function update(){

fetch('/data')
.then(r=>r.json())
.then(d=>{

let danger = d.CO>50 || d.H2S>20;
document.getElementById("status").innerHTML =
  danger ? "⚠️ DANGER" : "✅ SAFE";

document.getElementById("cards").innerHTML = \`
<div class="card \${d.H2S>20?'danger':''}">☠️<span>\${d.H2S}</span>ppm</div>
<div class="card \${d.CO>50?'danger':''}">🔥<span>\${d.CO}</span>ppm</div>
<div class="card">☁️<span>\${d.CO2}</span>ppm</div>
<div class="card">🧪<span>\${d.NO2}</span>ppm</div>
<div class="card">🤖<span>\${d.NH3}</span>ppm</div>

<div class="card">💨<span>\${d.CH4}</span>ppm</div>
<div class="card">🧬<span>\${d.O3}</span>ppm</div>
<div class="card">🌡<span>\${d.TEMP}</span>°C</div>
<div class="card">💧<span>\${d.HUM}</span>%</div>
<div class="card">🌫<span>\${d.SMOKE}</span>%</div>
\`;

let t=new Date().toLocaleTimeString();
labels.push(t);

for(let k in dataSets){ dataSets[k].push(d[k]||0); }

if(labels.length>15){
 labels.shift();
 for(let k in dataSets) dataSets[k].shift();
}

chart.update();
});

// GPS
fetch('/gps')
.then(r=>r.json())
.then(g=>{
 if(g.lat && g.lon){
  marker.setLatLng([g.lat,g.lon]);
  map.setView([g.lat,g.lon],15);
 }
});

// LOGS
fetch('/logs')
.then(r=>r.json())
.then(arr=>{
 document.getElementById("logs").innerHTML =
   arr.map(l=>l.time+" | CO:"+l.CO+" | H2S:"+l.H2S).join("<br>");
});

}

setInterval(update,2000);

</script>

</body>
</html>
`);
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
