const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

// تعطيل توقيع الخادم
app.disable("x-powered-by");

// حماية من الطلبات الكبيرة
app.use(express.json({ limit: "1kb" }));

// ================= STATE =================
let robotRaw = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };
let logs = [];

// أحدث إطار كاميرا
let latestFrame = null;

// ================= CLIENTS =================
const clients = new Set();
const controlClients = new Set();

let cameraSocket = null;

// ================= COMMANDS =================
const ALLOWED_COMMANDS = new Set([
  "FWD",
  "BACK",
  "LEFT",
  "RIGHT",
  "STOP",
  "RC",
  "WEB",
  "SLOW",
  "MED",
  "FAST",
  "LIGHT_ON",
  "LIGHT_OFF"
]);

// ================= SANITIZE =================
function sanitize(val) {
  if (typeof val === "string") {
    return val.replace(/[<>"']/g, "");
  }
  return val;
}

// ================= DATA MAP =================
function mapData(d) {
  return {
    H2S: sanitize(d.H2S) ?? sanitize(d.G5) ?? 0,
    CO: sanitize(d.CO) ?? sanitize(d.G1) ?? 0,
    CO2: sanitize(d.CO2) ?? sanitize(d.G7) ?? 0,
    NO2: sanitize(d.NO2) ?? sanitize(d.G3) ?? 0,
    NH3: sanitize(d.NH3) ?? sanitize(d.G2) ?? 0,
    CH4: sanitize(d.CH4) ?? sanitize(d.G4) ?? 0,
    O3: sanitize(d.O3) ?? sanitize(d.G6) ?? 0,
    TEMP: sanitize(d.TEMP) ?? sanitize(d.T) ?? 0,
    HUM: sanitize(d.HUM) ?? sanitize(d.H) ?? 0,
    SMOKE: sanitize(d.SMOKE) ?? sanitize(d.G8) ?? 0
  };
}

// ================= RECEIVE SENSOR DATA =================
app.post("/data", (req, res) => {

  robotRaw = req.body || {};

  const d = mapData(robotRaw);

  logs.unshift({
    time: new Date().toLocaleTimeString(),
    ...d
  });

  if (logs.length > 20) {
    logs.pop();
  }

  res.send("OK");
});

// ================= RECEIVE GPS =================
app.post("/gps", (req, res) => {

  gpsData = req.body || gpsData;

  res.send("OK");
});

// ================= SEND DATA =================
app.get("/data", (req, res) => {
  res.json(mapData(robotRaw));
});

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.get("/gps", (req, res) => {
  res.json(gpsData);
});

// ================= CONTROL =================
app.post("/control", (req, res) => {

  const cmd = req.body.cmd;

  if (!cmd || !ALLOWED_COMMANDS.has(cmd)) {
    return res.status(400).send("BAD COMMAND");
  }

  lastCommand = cmd;

  console.log("🎮 HTTP CMD:", cmd);

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

<meta name="viewport" content="width=device-width,initial-scale=1.0"/>

<title>Industrial Robot</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<link rel="stylesheet"
href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  background:#0b0f1a;
  color:white;
  font-family:Arial;
  display:flex;
  min-height:100vh;
}

/* SIDEBAR */
.sidebar{
  width:260px;
  background:#111827;
  padding:20px;
  display:flex;
  flex-direction:column;
  gap:20px;
  position:fixed;
  top:0;
  left:0;
  height:100vh;
  overflow-y:auto;
  z-index:1000;
}

/* MAIN */
.main{
  flex:1;
  padding:20px;
  margin-left:260px;
  display:flex;
  flex-direction:column;
}

/* CAMERA */
.camera-section{
  width:100%;
  margin-bottom:20px;
  text-align:center;
}

#camera-img{
  width:100%;
  max-width:640px;
  border-radius:12px;
  border:2px solid #1f2937;
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
  transition:0.3s;
}

.card span{
  font-size:22px;
  display:block;
}

.danger{
  background:#7f1d1d;
  animation:pulse 1s infinite;
}

@keyframes pulse{
  50%{
    opacity:0.5;
  }
}

/* CONTROL */
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
  user-select:none;
  -webkit-user-select:none;
  -webkit-touch-callout:none;
  cursor:pointer;
}

.ctrl-btn:active{
  background:#374151;
}

/* STATUS */
.status{
  background:#1f2937;
  padding:10px;
  border-radius:10px;
  text-align:center;
  margin-top:10px;
  font-weight:bold;
}

/* LAYOUT */
.bottom{
  display:grid;
  grid-template-columns:1fr;
  gap:20px;
  margin-top:20px;
}

#map{
  height:500px;
  border-radius:12px;
  width:100%;
  z-index:1;
}

.map-container{
  width:100%;
}

.map-container h3{
  margin-bottom:10px;
}

#logs{
  background:#1f2937;
  padding:10px;
  border-radius:12px;
  max-height:300px;
  overflow:auto;
  font-size:12px;
}

/* BUTTONS */
button{
  padding:10px;
  border-radius:8px;
  border:none;
  background:#374151;
  color:white;
  cursor:pointer;
  font-size:14px;
  transition:0.2s;
}

button:hover{
  background:#4b5563;
}

</style>

</head>

<body oncontextmenu="return false">

<!-- SIDEBAR -->
<div class="sidebar">

<h3>🎮 Mode</h3>

<button onclick="sendCmd('RC')">
🎮 RC
</button>

<button onclick="sendCmd('WEB')">
🌐 WEB
</button>

<h3>⚡ Speed</h3>

<button onclick="sendCmd('SLOW')">
🐢
</button>

<button onclick="sendCmd('MED')">
🚗
</button>

<button onclick="sendCmd('FAST')">
🚀
</button>

<h3>🎯 Control</h3>

<div class="grid">

<div></div>

<button class="ctrl-btn" data-cmd="FWD">
⬆
</button>

<div></div>

<button class="ctrl-btn" data-cmd="LEFT">
⬅
</button>

<button class="ctrl-btn" id="stop-btn" data-cmd="STOP">
⛔
</button>

<button class="ctrl-btn" data-cmd="RIGHT">
➡
</button>

<div></div>

<button class="ctrl-btn" data-cmd="BACK">
⬇
</button>

<div></div>

</div>

<h3>💡 Light</h3>

<button onclick="sendCmd('LIGHT_ON')">
ON
</button>

<button onclick="sendCmd('LIGHT_OFF')">
OFF
</button>

</div>

<!-- MAIN -->
<div class="main">

<h2>
📊 Industrial Gas Monitoring Dashboard
</h2>

<!-- CAMERA -->
<div class="camera-section">

<h4>
📷 Live Camera
</h4>

<img id="camera-img" alt="Robot Camera">

</div>

<!-- CARDS -->
<div class="cards" id="cards"></div>

<!-- STATUS -->
<div id="status" class="status">
Status: SAFE
</div>

<!-- GRAPH -->
<h3>
📈 Multi-Gas Trend
</h3>

<canvas id="chart"></canvas>

<!-- MAP + LOGS -->
<div class="bottom">

<div class="map-container">

<h3>
📍 Live Location Map
</h3>

<div id="map"></div>

</div>

<div>

<h3>
📄 Logs
</h3>

<div id="logs"></div>

</div>

</div>

</div>

<script>

// ================= CONTROL WEBSOCKET =================
let controlWs = null;

function connectControlWs() {

  const protocol =
    location.protocol === 'https:'
    ?
    'wss'
    :
    'ws';

  const wsUrl =
    protocol +
    '://' +
    location.host +
    '/control-ws';

  console.log('🎮 Connecting WS:', wsUrl);

  controlWs = new WebSocket(wsUrl);

  controlWs.onopen = () => {
    console.log('🎮 WS CONNECTED');
  };

  controlWs.onclose = () => {

    console.log('🎮 WS CLOSED');

    setTimeout(connectControlWs, 2000);
  };

  controlWs.onerror = (err) => {
    console.error(err);
  };
}

// ================= SEND COMMAND =================
function sendCmd(cmd) {

  if (
    controlWs &&
    controlWs.readyState === WebSocket.OPEN
  ) {
    controlWs.send(
      JSON.stringify({
        cmd: cmd
      })
    );
  }
  else {

    fetch('/control', {
      method:'POST',

      headers:{
        'Content-Type':'application/json'
      },

      body:JSON.stringify({
        cmd:cmd
      })
    });
  }
}

// ================= HOLD CONTROL =================
function bindHold(btn) {

  let cmd = btn.dataset.cmd;

  if (!cmd) return;

  // STOP منفصل
  if (cmd === "STOP") {

    btn.addEventListener('click', (e) => {

      e.preventDefault();

      sendCmd("STOP");
    });

    return;
  }

  let intervalId = null;

  const start = (e) => {

    e.preventDefault();

    if (intervalId) {
      clearInterval(intervalId);
    }

    sendCmd(cmd);

    intervalId =
      setInterval(() => {

        sendCmd(cmd);

      }, 150);
  };

  const stopNow = (e) => {

    e.preventDefault();

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    sendCmd("STOP");
  };

  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stopNow);
  btn.addEventListener('pointerleave', stopNow);
  btn.addEventListener('touchend', stopNow);
  btn.addEventListener('touchcancel', stopNow);
}

document
.querySelectorAll('.ctrl-btn')
.forEach(bindHold);

// ================= GRAPH =================
let labels = [];

let dataSets = {
  CO:[],
  H2S:[],
  NH3:[],
  CH4:[],
  NO2:[],
  CO2:[],
  O3:[]
};

const chart =
new Chart(
document.getElementById("chart"),
{
  type:'line',

  data:{
    labels:labels,

    datasets:[

      {
        label:'CO',
        data:dataSets.CO,
        borderColor:'#f87171'
      },

      {
        label:'H₂S',
        data:dataSets.H2S,
        borderColor:'#facc15'
      },

      {
        label:'NH₃',
        data:dataSets.NH3,
        borderColor:'#4ade80'
      },

      {
        label:'CH₄',
        data:dataSets.CH4,
        borderColor:'#60a5fa'
      },

      {
        label:'NO₂',
        data:dataSets.NO2,
        borderColor:'#c084fc'
      },

      {
        label:'CO₂',
        data:dataSets.CO2,
        borderColor:'#fb923c'
      },

      {
        label:'O₃',
        data:dataSets.O3,
        borderColor:'#2dd4bf'
      }
    ]
  },

  options:{
    animation:false
  }
});

// ================= MAP =================
let map =
L.map('map')
.setView([15.3,44.2],13);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
).addTo(map);

let marker =
L.marker([15.3,44.2])
.addTo(map);

// ================= SAFE TEXT =================
function safeText(val) {

  if (typeof val !== 'number') {
    val = parseFloat(val) || 0;
  }

  return val.toFixed(1);
}

// ================= CAMERA =================
const camImg =
document.getElementById('camera-img');

let camSocket = null;

function connectCamera() {

  const protocol =
    location.protocol === 'https:'
    ?
    'wss'
    :
    'ws';

  // ✅ FIXED
  camSocket =
    new WebSocket(
      protocol +
      '://' +
      location.host +
      '/viewer'
    );

  camSocket.binaryType = 'arraybuffer';

  camSocket.onopen = () => {
    console.log('📷 Camera Connected');
  };

  camSocket.onmessage = (event) => {

    const blob =
      new Blob(
        [event.data],
        {
          type:'image/jpeg'
        }
      );

    const url =
      URL.createObjectURL(blob);

    camImg.src = url;

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  camSocket.onclose = () => {

    console.log('📷 Camera Closed');

    setTimeout(connectCamera, 3000);
  };
}

// ================= START SOCKETS =================
connectCamera();
connectControlWs();

// ================= UPDATE =================
function update() {

  // DATA
  fetch('/data')
  .then(r => {

    if (!r.ok) {
      throw new Error('SERVER ERROR');
    }

    return r.json();
  })

  .then(d => {

    let danger =
      d.CO > 50 ||
      d.H2S > 20;

    document.getElementById("status").innerHTML =
      danger
      ?
      "⚠️ DANGER"
      :
      "✅ SAFE";

    // CARDS
    document.getElementById("cards").innerHTML =

      '<div class="card ' +
      (d.H2S>20?'danger':'') +
      '">☠️ H₂S<span>' +
      safeText(d.H2S) +
      '</span>ppm</div>' +

      '<div class="card ' +
      (d.CO>50?'danger':'') +
      '">🔥 CO<span>' +
      safeText(d.CO) +
      '</span>ppm</div>' +

      '<div class="card">☁️ CO₂<span>' +
      safeText(d.CO2) +
      '</span>ppm</div>' +

      '<div class="card">🧪 NO₂<span>' +
      safeText(d.NO2) +
      '</span>ppm</div>' +

      '<div class="card">🤖 NH₃<span>' +
      safeText(d.NH3) +
      '</span>ppm</div>' +

      '<div class="card">💨 CH₄<span>' +
      safeText(d.CH4) +
      '</span>ppm</div>' +

      '<div class="card">🧬 O₃<span>' +
      safeText(d.O3) +
      '</span>ppm</div>' +

      '<div class="card">🌡 TEMP<span>' +
      safeText(d.TEMP) +
      '</span>°C</div>' +

      '<div class="card">💧 HUM<span>' +
      safeText(d.HUM) +
      '</span>%</div>' +

      '<div class="card">🌫 SMOKE<span>' +
      safeText(d.SMOKE) +
      '</span>%</div>';

    let t =
      new Date()
      .toLocaleTimeString();

    labels.push(t);

    for(let k in dataSets) {
      dataSets[k].push(d[k] || 0);
    }

    if(labels.length > 15) {

      labels.shift();

      for(let k in dataSets) {
        dataSets[k].shift();
      }
    }

    chart.update();
  })

  .catch(err => console.error(err));

  // GPS
  fetch('/gps')
  .then(r => r.json())

  .then(g => {

    if(g.lat && g.lon) {

      marker.setLatLng([
        g.lat,
        g.lon
      ]);

      map.setView([
        g.lat,
        g.lon
      ],15);
    }
  });

  // LOGS
  fetch('/logs')
  .then(r => r.json())

  .then(arr => {

    if (!Array.isArray(arr)) return;

    document.getElementById("logs").innerHTML =

      arr.map(l =>

        '<div>' +

        l.time +

        ' | CO:' +

        safeText(l.CO) +

        ' | H₂S:' +

        safeText(l.H2S) +

        '</div>'

      ).join('');
  });
}

// ================= START UPDATE =================
update();

setInterval(update, 2000);

</script>

</body>
</html>
`);
});

// ================= HTTP SERVER =================
const server = http.createServer(app);

// ================= WEBSOCKET SERVER =================
const wss =
new WebSocket.Server({
  server
});

// ================= WEBSOCKET CONNECTIONS =================
wss.on("connection", (ws, req) => {

  const path = req.url;

  console.log("🔗 WS:", path);

  // ================= CAMERA SOURCE =================
  if (path === "/cam-stream") {

    console.log("📷 Camera Source Connected");

    cameraSocket = ws;

    ws.on("message", (data) => {

      latestFrame = data;

      for (const client of clients) {

        if (
          client.readyState ===
          WebSocket.OPEN
        ) {
          client.send(data);
        }
      }
    });

    ws.on("close", () => {

      console.log("📷 Camera Source Closed");

      cameraSocket = null;
    });

    return;
  }

  // ================= CAMERA VIEWER =================
  if (path === "/viewer") {

    console.log("🌐 Viewer Connected");

    clients.add(ws);

    if (
      latestFrame &&
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(latestFrame);
    }

    ws.on("close", () => {

      clients.delete(ws);
    });

    return;
  }

  // ================= CONTROL =================
  if (path === "/control-ws") {

    console.log("🎮 Control Connected");

    controlClients.add(ws);

    ws.on("message", (data) => {

      try {

        const msg =
          JSON.parse(data);

        const cmd =
          msg.cmd;

        if (
          cmd &&
          ALLOWED_COMMANDS.has(cmd)
        ) {

          lastCommand = cmd;

          console.log(
            "🎮 CMD:",
            cmd
          );

          for (
            const client
            of controlClients
          ) {

            if (
              client !== ws &&
              client.readyState ===
              WebSocket.OPEN
            ) {

              client.send(
                JSON.stringify({
                  cmd:cmd
                })
              );
            }
          }
        }

      } catch(e) {

        console.log(
          "❌ WS ERROR"
        );
      }
    });

    ws.on("close", () => {

      controlClients.delete(ws);

      console.log(
        "🎮 Control Closed"
      );
    });

    return;
  }

  ws.close();
});

// ================= START =================
const PORT =
process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    "✅ SERVER RUNNING:",
    PORT
  );
});
