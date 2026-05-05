const express = require("express");
const app = express();

app.use(express.json());

// ================= DATA =================
let robotRaw = {};
let lastCommand = "";

// ================= RECEIVE =================
app.post("/data", (req, res) => {
  robotRaw = req.body;
  res.send("OK");
});

// ================= SEND (MAPPING) =================
app.get("/data", (req, res) => {

  const d = robotRaw;

  res.json({
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
  });
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
  margin:0;
  background:#0b0f1a;
  color:white;
  font-family:Arial;
  display:flex;
}

/* SIDEBAR */
.sidebar{
  width:260px;
  background:#111827;
  padding:20px;
  display:flex;
  flex-direction:column;
  gap:20px;
}

/* MAIN */
.main{
  flex:1;
  padding:20px;
}

/* CARDS */
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
  font-size:14px;
}

.card span{
  font-size:22px;
  display:block;
}

.danger{
  background:#7f1d1d;
}

/* CONTROL GRID */
.grid{
  display:grid;
  grid-template-columns:repeat(3,60px);
  gap:10px;
  justify-content:center;
}

button{
  padding:10px;
  border:none;
  border-radius:8px;
  background:#1f2937;
  color:white;
}

/* STATUS */
.status{
  background:#7f1d1d;
  padding:10px;
  border-radius:10px;
  text-align:center;
  margin-top:10px;
}

</style>
</head>

<body>

<!-- SIDEBAR -->
<div class="sidebar">

<h3>🎮 Mode</h3>
<button onclick="send('RC')">🎮 RC</button>
<button onclick="send('WEB')">🌐 WEB</button>

<h3>⚡ Speed</h3>
<button onclick="send('SLOW')">🐢 Slow</button>
<button onclick="send('MED')">🚗 Medium</button>
<button onclick="send('FAST')">🚀 Fast</button>

<h3>🎯 Control</h3>
<div class="grid">
<div></div>
<button onmousedown="hold('FWD')" onmouseup="stop()" ontouchstart="hold('FWD')" ontouchend="stop()">⬆</button>
<div></div>

<button onmousedown="hold('LEFT')" onmouseup="stop()" ontouchstart="hold('LEFT')" ontouchend="stop()">⬅</button>
<button onclick="send('STOP')">⛔</button>
<button onmousedown="hold('RIGHT')" onmouseup="stop()" ontouchstart="hold('RIGHT')" ontouchend="stop()">➡</button>

<div></div>
<button onmousedown="hold('BACK')" onmouseup="stop()" ontouchstart="hold('BACK')" ontouchend="stop()">⬇</button>
<div></div>
</div>

<h3>💡 Light</h3>
<button onclick="send('LIGHT_ON')">ON</button>
<button onclick="send('LIGHT_OFF')">OFF</button>

</div>

<!-- MAIN -->
<div class="main">

<h2>📊 Industrial Gas Monitoring Dashboard</h2>

<div class="cards" id="cards"></div>

<div id="status" class="status">Status: SAFE</div>

<h3>📈 Multi-Gas Graph</h3>
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
let datasets={
  CO:[], H2S:[], NH3:[], CH4:[]
};

const chart=new Chart(document.getElementById("chart"),{
  type:'line',
  data:{
    labels:labels,
    datasets:[
      {label:'CO',data:datasets.CO},
      {label:'H2S',data:datasets.H2S},
      {label:'NH3',data:datasets.NH3},
      {label:'CH4',data:datasets.CH4}
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
  danger ? "⚠️ DANGER" : "✅ SAFE";

document.getElementById("cards").innerHTML = \`

<div class="card">☠️ H2S<br>\${d.H2S} ppm</div>
<div class="card">🔥 CO<br>\${d.CO} ppm</div>
<div class="card">☁️ CO2<br>\${d.CO2} ppm</div>
<div class="card">🧪 NO2<br>\${d.NO2} ppm</div>
<div class="card">🤖 NH3<br>\${d.NH3} ppm</div>

<div class="card">💨 CH4<br>\${d.CH4} ppm</div>
<div class="card">🧬 O3<br>\${d.O3} ppm</div>
<div class="card">🌡 TEMP<br>\${d.TEMP} °C</div>
<div class="card">💧 HUM<br>\${d.HUM} %</div>
<div class="card">🌫 SMOKE<br>\${d.SMOKE} %</div>

\`;

let t=new Date().toLocaleTimeString();

labels.push(t);

datasets.CO.push(d.CO);
datasets.H2S.push(d.H2S);
datasets.NH3.push(d.NH3);
datasets.CH4.push(d.CH4);

if(labels.length>10){
labels.shift();
for(let k in datasets) datasets[k].shift();
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
