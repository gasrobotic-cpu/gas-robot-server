const express = require("express");
const app = express();

app.use(express.json());

// ==========================
let robotData = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };

// ==========================
app.post("/data", (req, res) => {
  robotData = req.body;
  res.send("OK");
});

app.get("/data", (req, res) => {
  res.json(robotData);
});

app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});

app.get("/control", (req, res) => {
  res.send(lastCommand);
});

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
  -webkit-user-select:none;
  user-select:none;
}

button {
  padding:15px;
  margin:6px;
  font-size:18px;
  border-radius:10px;
  border:none;
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
  width:95px;
}
</style>
</head>

<body oncontextmenu="return false">

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
<button onmousedown="hold('FWD')" onmouseup="stop()" ontouchstart="hold('FWD')" ontouchend="stop()">⬆</button>
<div></div>

<button onmousedown="hold('LEFT')" onmouseup="stop()" ontouchstart="hold('LEFT')" ontouchend="stop()">⬅</button>
<button onclick="send('STOP')">⏹</button>
<button onmousedown="hold('RIGHT')" onmouseup="stop()" ontouchstart="hold('RIGHT')" ontouchend="stop()">➡</button>

<div></div>
<button onmousedown="hold('BACK')" onmouseup="stop()" ontouchstart="hold('BACK')" ontouchend="stop()">⬇</button>
<div></div>
</div>

<h3>Light</h3>
<button onclick="send('LIGHT_ON')">ON</button>
<button onclick="send('LIGHT_OFF')">OFF</button>

<h3>Sensors</h3>
<div id="data"></div>

<h3>Graph</h3>
<canvas id="chart" width="320" height="200"></canvas>

<script>

// ================= CONTROL =================
let interval = null;

function send(cmd){
  fetch('/control',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cmd:cmd})
  });
}

function hold(cmd){
  clearInterval(interval);
  send(cmd);
  interval = setInterval(()=>send(cmd), 200);
}

function stop(){
  clearInterval(interval);
  send('STOP');
}

// ================= GRAPH =================
let labels=[], coData=[];

const chart = new Chart(document.getElementById('chart'),{
  type:'line',
  data:{
    labels:labels,
    datasets:[{label:'CO',data:coData}]
  },
  options:{animation:false}
});

// ================= DATA =================
function updateData(){
  fetch('/data')
  .then(r=>r.json())
  .then(d=>{

    // تحويل القيم من STM32
    let CO  = d.G1 || 0;
    let NH3 = d.G2 || 0;
    let NO2 = d.G3 || 0;
    let CH4 = d.G4 || 0;
    let H2S = d.G5 || 0;
    let O3  = d.G6 || 0;
    let CO2 = d.G7 || 0;

    let TEMP = d.T || 0;
    let HUM  = d.H || 0;

    document.getElementById("data").innerHTML = \`
      <div class="card">CO<br>\${CO} ppm</div>
      <div class="card">NH3<br>\${NH3} ppm</div>
      <div class="card">NO2<br>\${NO2} ppm</div>
      <div class="card">CH4<br>\${CH4} ppm</div>
      <div class="card">H2S<br>\${H2S} ppm</div>
      <div class="card">O3<br>\${O3} ppm</div>
      <div class="card">CO2<br>\${CO2} ppm</div>
      <div class="card">TEMP<br>\${TEMP} °C</div>
      <div class="card">HUM<br>\${HUM} %</div>
    \`;

    let time = new Date().toLocaleTimeString();

    labels.push(time);
    coData.push(CO);

    if(labels.length>10){
      labels.shift();
      coData.shift();
    }

    chart.update();
  });
}

setInterval(updateData,2000);

</script>

</body>
</html>
`);
});

// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
