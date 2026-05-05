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
// RECEIVE DATA FROM ESP32
// ==========================
app.post("/data", (req, res) => {
  robotData = req.body;
  res.send("OK");
});

// ==========================
// SEND DATA TO WEB
// ==========================
app.get("/data", (req, res) => {
  res.json(robotData);
});

// ==========================
// CONTROL COMMANDS
// ==========================
app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});

app.get("/control", (req, res) => {
  res.send(lastCommand);
});

// ==========================
// GPS
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

<style>
body {
  background:#0f172a;
  color:white;
  font-family:Arial;
  text-align:center;
}

button {
  padding:12px;
  margin:6px;
  font-size:16px;
  border-radius:8px;
  border:none;
  cursor:pointer;
}

.control { background:#1e293b; }
.light { background:#f59e0b; }
.speed { background:#2563eb; }

.grid {
  display:grid;
  grid-template-columns:repeat(3,80px);
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

<!-- MODE -->
<h3>Mode</h3>
<button onclick="send('WEB')">WEB</button>
<button onclick="send('RC')">RC</button>

<!-- SPEED -->
<h3>Speed</h3>
<button class="speed" onclick="send('SLOW')">SLOW</button>
<button class="speed" onclick="send('MED')">MED</button>
<button class="speed" onclick="send('FAST')">FAST</button>

<!-- MOVEMENT -->
<h3>Movement</h3>
<div class="grid">
<div></div>
<button onclick="send('FWD')">⬆</button>
<div></div>

<button onclick="send('LEFT')">⬅</button>
<button onclick="send('STOP')">⏹</button>
<button onclick="send('RIGHT')">➡</button>

<div></div>
<button onclick="send('BACK')">⬇</button>
<div></div>
</div>

<!-- LIGHT -->
<h3>Light</h3>
<button class="light" onclick="send('LIGHT_ON')">ON</button>
<button class="light" onclick="send('LIGHT_OFF')">OFF</button>

<!-- DATA -->
<h3>Sensors</h3>
<div id="data">Loading...</div>

<!-- GPS -->
<h3>Location</h3>
<div id="gps">Loading...</div>

<!-- CAMERA -->
<h3>Camera</h3>
<img src="http://YOUR_CAMERA_IP:81/stream" width="320">

<script>

// ==========================
// SEND COMMAND
// ==========================
function send(cmd){
  fetch('/control',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cmd:cmd})
  });
}

// ==========================
// UPDATE DATA
// ==========================
function updateData(){
  fetch('/data')
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("data").innerHTML = \`
      <div class="card">CO: \${d.CO || 0}</div>
      <div class="card">NH3: \${d.NH3 || 0}</div>
      <div class="card">NO2: \${d.NO2 || 0}</div>
      <div class="card">CH4: \${d.CH4 || 0}</div>
      <div class="card">H2S: \${d.H2S || 0}</div>
      <div class="card">O3: \${d.O3 || 0}</div>
      <div class="card">CO2: \${d.CO2 || 0}</div>
      <div class="card">TEMP: \${d.TEMP || 0}</div>
      <div class="card">HUM: \${d.HUM || 0}</div>
    \`;
  });
}

// ==========================
// UPDATE GPS
// ==========================
function updateGPS(){
  fetch('/gps')
  .then(r=>r.json())
  .then(g=>{
    document.getElementById("gps").innerHTML =
      "Lat: " + (g.lat || 0) + " | Lon: " + (g.lon || 0);
  });
}

// ==========================
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
