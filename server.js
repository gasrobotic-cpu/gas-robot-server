const express = require("express");
const app = express();

app.use(express.json());

// ==========================
// DATA STORAGE
// ==========================
let robotData = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };

// ==========================
// DATA API
// ==========================
app.post("/data", (req, res) => {
  robotData = req.body;
  res.send("OK");
});

app.get("/data", (req, res) => {
  res.json(robotData);
});

// ==========================
// CONTROL API
// ==========================
app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});

app.get("/control", (req, res) => {
  res.send(lastCommand);
});

// ==========================
// GPS API
// ==========================
app.post("/gps", (req, res) => {
  gpsData = req.body;
  res.send("OK");
});

app.get("/gps", (req, res) => {
  res.json(gpsData);
});

// ==========================
// DASHBOARD
// ==========================
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Gas Robot</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body {
  background:#0f172a;
  color:white;
  text-align:center;
  font-family:Arial;
}

button {
  padding:14px;
  margin:6px;
  font-size:16px;
  border-radius:10px;
  border:none;
  cursor:pointer;
}

.grid {
  display:grid;
  grid-template-columns:repeat(3,90px);
  gap:10px;
  justify-content:center;
}

.card {
  background:#1e293b;
  padding:12px;
  margin:6px;
  border-radius:12px;
  display:inline-block;
  width:90px;
  font-size:14px;
  box-shadow:0 0 10px rgba(0,0,0,0.4);
}

.danger {
  background:red !important;
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity:0.4; }
}
</style>
</head>

<body>

<h1>🤖 GAS ROBOT</h1>

<h3>Mode</h3>
<button onclick="send('WEB')">WEB</button>
<button onclick="send('RC')">RC</button>

<h3>Speed</h3>
<button onclick="send('SLOW')">SLOW</button>
<button onclick="send('MED')">MED</button>
<button onclick="send('FAST')">FAST</button>

<h3>Movement (Hold)</h3>
<div class="grid">
<div></div>
<button onmousedown="startMove('FWD')" onmouseup="stopMove()" ontouchstart="startMove('FWD')" ontouchend="stopMove()">⬆</button>
<div></div>

<button onmousedown="startMove('LEFT')" onmouseup="stopMove()" ontouchstart="startMove('LEFT')" ontouchend="stopMove()">⬅</button>
<button onclick="send('STOP')">⏹</button>
<button onmousedown="startMove('RIGHT')" onmouseup="stopMove()" ontouchstart="startMove('RIGHT')" ontouchend="stopMove()">➡</button>

<div></div>
<button onmousedown="startMove('BACK')" onmouseup="stopMove()" ontouchstart="startMove('BACK')" ontouchend="stopMove()">⬇</button>
<div></div>
</div>

<h3>Light</h3>
<button onclick="send('LIGHT_ON')">ON</button>
<button onclick="send('LIGHT_OFF')">OFF</button>

<h3>Sensors</h3>
<div id="data">Loading...</div>

<h3>Live Graph</h3>
<canvas id="chart" width="320" height="200"></canvas>

<h3>Location</h3>
<div id="gps">Loading...</div>
<button onclick="openMap()">Open Map</button>

<h3>Camera</h3>
<img src="http://YOUR_CAMERA_IP:81/stream" width="320">

<audio id="alarm" src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"></audio>

<script>

// ================= SEND =================
function send(cmd){
  fetch('/control',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cmd:cmd})
  });
}

// ================= HOLD =================
function startMove(cmd){ send(cmd); }
function stopMove(){ send('STOP'); }

// ================= GRAPH =================
let labels = [];
let coData = [];
let nh3Data = [];

const chart = new Chart(document.getElementById('chart'), {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      { label: 'CO', data: coData },
      { label: 'NH3', data: nh3Data }
    ]
  },
  options: { animation:false }
});

// ================= DATA =================
function updateData(){
  fetch('/data')
  .then(r=>r.json())
  .then(d=>{

    let danger = false;

    if(d.CO > 50 || d.H2S > 20) danger = true;

    if(danger){
      document.getElementById("alarm").play();
    }

    document.getElementById("data").innerHTML = \`
      <div class="card \${d.CO>50?'danger':''}">CO<br><b>\${d.CO||0}</b></div>
      <div class="card \${d.NH3>50?'danger':''}">NH3<br><b>\${d.NH3||0}</b></div>
      <div class="card">NO2<br><b>\${d.NO2||0}</b></div>
      <div class="card">CH4<br><b>\${d.CH4||0}</b></div>
      <div class="card \${d.H2S>20?'danger':''}">H2S<br><b>\${d.H2S||0}</b></div>
      <div class="card">O3<br><b>\${d.O3||0}</b></div>
      <div class="card">CO2<br><b>\${d.CO2||0}</b></div>
      <div class="card">TEMP<br><b>\${d.TEMP||0}</b></div>
      <div class="card">HUM<br><b>\${d.HUM||0}</b></div>
    \`;

    let time = new Date().toLocaleTimeString();

    labels.push(time);
    coData.push(d.CO||0);
    nh3Data.push(d.NH3||0);

    if(labels.length > 10){
      labels.shift();
      coData.shift();
      nh3Data.shift();
    }

    chart.update();
  });
}

// ================= GPS =================
function updateGPS(){
  fetch('/gps')
  .then(r=>r.json())
  .then(g=>{
    document.getElementById("gps").innerHTML =
      "Lat: "+(g.lat||0)+" | Lon: "+(g.lon||0);
  });
}

function openMap(){
  fetch('/gps')
  .then(r=>r.json())
  .then(g=>{
    window.open("https://maps.google.com/?q="+g.lat+","+g.lon);
  });
}

// ================= LOOP =================
setInterval(updateData,2000);
setInterval(updateGPS,3000);

</script>

</body>
</html>
`);
});

// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
