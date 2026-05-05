const express = require("express");
const app = express();

app.use(express.json());

// ================= DATA =================
let robotRaw = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };

// ================= DATA RECEIVE =================
app.post("/data", (req, res) => {
  robotRaw = req.body;
  res.send("OK");
});

// ================= DATA SEND (MAPPING) =================
app.get("/data", (req, res) => {

  const d = robotRaw;

  const mapped = {
    H2S: d.G5 || 0,
    CO: d.G1 || 0,
    CO2: d.G7 || 0,
    NO2: d.G3 || 0,
    NH3: d.G2 || 0,
    CH4: d.G4 || 0,
    O3: d.G6 || 0,
    TEMP: d.T || 0,
    HUM: d.H || 0,
    SMOKE: d.G7 || 0
  };

  res.json(mapped);
});

// ================= CONTROL =================
app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});

app.get("/control", (req, res) => {
  res.send(lastCommand);
});

// ================= DASHBOARD =================
app.get("/", (req, res) => {
res.send(`

<!DOCTYPE html>
<html>
<head>
<title>Industrial Robot</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{
  background:#0b0f1a;
  color:white;
  font-family:Arial;
  margin:0;
  display:flex;
}

.sidebar{
  width:250px;
  background:#111827;
  padding:20px;
}

.main{
  flex:1;
  padding:20px;
}

.card{
  background:#1f2937;
  padding:15px;
  border-radius:12px;
  width:150px;
  display:inline-block;
  margin:10px;
  text-align:center;
}

.danger{
  background:#7f1d1d;
}

button{
  padding:10px;
  margin:5px;
  border:none;
  border-radius:8px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(3,60px);
  gap:10px;
}

</style>
</head>

<body>

<!-- SIDEBAR -->
<div class="sidebar">

<h3>Mode</h3>
<button onclick="send('WEB')">WEB</button>
<button onclick="send('RC')">RC</button>

<h3>Speed</h3>
<button onclick="send('SLOW')">Slow</button>
<button onclick="send('MED')">Medium</button>
<button onclick="send('FAST')">Fast</button>

<h3>Control</h3>

<div class="grid">
<div></div>
<button onmousedown="hold('FWD')" onmouseup="stop()" ontouchstart="hold('FWD')" ontouchend="stop()">↑</button>
<div></div>

<button onmousedown="hold('LEFT')" onmouseup="stop()" ontouchstart="hold('LEFT')" ontouchend="stop()">←</button>
<button onclick="send('STOP')">■</button>
<button onmousedown="hold('RIGHT')" onmouseup="stop()" ontouchstart="hold('RIGHT')" ontouchend="stop()">→</button>

<div></div>
<button onmousedown="hold('BACK')" onmouseup="stop()" ontouchstart="hold('BACK')" ontouchend="stop()">↓</button>
<div></div>
</div>

<h3>Light</h3>
<button onclick="send('LIGHT_ON')">ON</button>
<button onclick="send('LIGHT_OFF')">OFF</button>

</div>

<!-- MAIN -->
<div class="main">

<h2>Industrial Gas Monitoring</h2>

<div id="cards"></div>

<h3 id="status">Status: SAFE</h3>

<canvas id="chart"></canvas>

</div>

<script>

// ================= CONTROL =================
let interval=null;

function send(cmd){
  fetch('/control',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cmd})
  });
}

function hold(cmd){
  clearInterval(interval);
  send(cmd);
  interval=setInterval(()=>send(cmd),200);
}

function stop(){
  clearInterval(interval);
  send("STOP");
}

// ================= GRAPH =================
let labels=[];
let co=[],h2s=[];

const chart=new Chart(document.getElementById("chart"),{
  type:'line',
  data:{
    labels:labels,
    datasets:[
      {label:'CO',data:co},
      {label:'H2S',data:h2s}
    ]
  },
  options:{animation:false}
});

// ================= UPDATE =================
function update(){

fetch('/data')
.then(r=>r.json())
.then(d=>{

let danger = d.CO>50 || d.H2S>20;

document.getElementById("status").innerHTML =
  "Status: " + (danger ? "DANGER" : "SAFE");

document.getElementById("cards").innerHTML = \`
<div class="card \${d.H2S>20?'danger':''}">H2S<br>\${d.H2S} ppm</div>
<div class="card">CO<br>\${d.CO} ppm</div>
<div class="card">CO2<br>\${d.CO2} ppm</div>
<div class="card">NO2<br>\${d.NO2} ppm</div>
<div class="card">NH3<br>\${d.NH3} ppm</div>
<div class="card">CH4<br>\${d.CH4} ppm</div>
<div class="card">O3<br>\${d.O3} ppm</div>
<div class="card">TEMP<br>\${d.TEMP} °C</div>
<div class="card">HUM<br>\${d.HUM} %</div>
\`;

let t=new Date().toLocaleTimeString();

labels.push(t);
co.push(d.CO);
h2s.push(d.H2S);

if(labels.length>10){
labels.shift();
co.shift();
h2s.shift();
}

chart.update();

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
