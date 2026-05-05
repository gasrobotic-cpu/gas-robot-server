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
  padding:15px;
  margin:6px;
  font-size:18px;
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
  padding:10px;
  margin:5px;
  border-radius:10px;
  display:inline-block;
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

<h3>Camera</h3>
<img src="http://YOUR_CAMERA_IP:81/stream" width="320">

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
function startMove(cmd){
  send(cmd);
}

function stopMove(){
  send('STOP');
}

// ================= GRAPH =================
let labels = [];
let coData = [];
let nh3Data = [];

const ctx = document.getElementById('chart');

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      { label: 'CO', data: coData, borderWidth: 2 },
      { label: 'NH3', data: nh3Data, borderWidth: 2 }
    ]
  },
  options: {
    responsive: true,
    animation: false
  }
});

// ================= DATA =================
function updateData(){
  fetch('/data')
  .then(r=>r.json())
  .then(d=>{

    document.getElementById("data").innerHTML =
      "CO: "+(d.CO||0)+" | NH3: "+(d.NH3||0)+" | TEMP: "+(d.TEMP||0);

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

setInterval(updateData,2000);
setInterval(updateGPS,3000);

</script>

</body>
</html>
`);
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
