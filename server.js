const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const app = express();

// تعطيل توقيع الخادم لأمان أفضل
app.disable("x-powered-by");

app.use(express.json({ limit: "1kb" })); // حماية من الطلبات الضخمة

// ================= STATE =================
let robotRaw = {};
let lastCommand = "";
let gpsData = { lat: 0, lon: 0 };
let logs = []; // آخر 20 قراءة

// أحدث إطار صورة من الكاميرا (بيانات ثنائية)
let latestFrame = null;

// ================= أوامر مسموحة (قائمة بيضاء) =================
const ALLOWED_COMMANDS = new Set([
  "FWD", "BACK", "LEFT", "RIGHT", "STOP",
  "RC", "WEB",
  "SLOW", "MED", "FAST",
  "LIGHT_ON", "LIGHT_OFF"
]);

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
// ✅ تم فصل البدائل لضمان عدم تعارض SMOKE مع CO2
function mapData(d) {
  return {
    H2S:  sanitize(d.H2S)  ?? sanitize(d.G5) ?? 0,
    CO:   sanitize(d.CO)   ?? sanitize(d.G1) ?? 0,
    CO2:  sanitize(d.CO2)  ?? sanitize(d.G7) ?? 0,
    NO2:  sanitize(d.NO2)  ?? sanitize(d.G3) ?? 0,
    NH3:  sanitize(d.NH3)  ?? sanitize(d.G2) ?? 0,
    CH4:  sanitize(d.CH4)  ?? sanitize(d.G4) ?? 0,
    O3:   sanitize(d.O3)   ?? sanitize(d.G6) ?? 0,
    TEMP: sanitize(d.TEMP) ?? sanitize(d.T)  ?? 0,
    HUM:  sanitize(d.HUM)  ?? sanitize(d.H)  ?? 0,
    SMOKE: sanitize(d.SMOKE) ?? sanitize(d.G8) ?? 0   // ✅ مفتاح بديل مختلف
  };
}

// تنقية القيم لمنع XSS
function sanitize(val) {
  if (typeof val === "string") {
    return val.replace(/[<>"']/g, ""); // إزالة رموز HTML خطيرة
  }
  return val;
}

// ================= SEND =================
app.get("/data", (req, res) => res.json(mapData(robotRaw)));
app.get("/logs", (req, res) => res.json(logs));
app.get("/gps", (req, res) => res.json(gpsData));

app.post("/control", (req, res) => {
  const cmd = req.body.cmd;
  // ✅ تحقق من القائمة البيضاء
  if (!cmd || !ALLOWED_COMMANDS.has(cmd)) {
    return res.status(400).send("BAD COMMAND");
  }
  lastCommand = cmd;
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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>
*{box-sizing:border-box}
body{
  margin:0;
  background:#0b0f1a;
  color:white;
  font-family:Arial;
  display:flex;
  min-height:100vh;
}
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
.main{
  flex:1;
  padding:20px;
  margin-left:260px;
  display:flex;
  flex-direction:column;
}
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
  cursor:pointer;
}
.ctrl-btn:active{
  background:#374151;
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

<div class="sidebar">

<h3>🎮 Mode</h3>
<button onclick="sendCmd('RC')">🎮 RC</button>
<button onclick="sendCmd('WEB')">🌐 WEB</button>

<h3>⚡ Speed</h3>
<button onclick="sendCmd('SLOW')">🐢</button>
<button onclick="sendCmd('MED')">🚗</button>
<button onclick="sendCmd('FAST')">🚀</button>

<h3>🎯 Control</h3>

<div class="grid">
<div></div>
<button class="ctrl-btn" data-cmd="FWD">⬆</button>
<div></div>

<button class="ctrl-btn" data-cmd="LEFT">⬅</button>
<button class="ctrl-btn" id="stop-btn" data-cmd="STOP">⛔</button>
<button class="ctrl-btn" data-cmd="RIGHT">➡</button>

<div></div>
<button class="ctrl-btn" data-cmd="BACK">⬇</button>
<div></div>
</div>

<h3>💡 Light</h3>
<button onclick="sendCmd('LIGHT_ON')">ON</button>
<button onclick="sendCmd('LIGHT_OFF')">OFF</button>

</div>

<div class="main">

<h2>📊 Industrial Gas Monitoring Dashboard</h2>

<!-- 📷 الكاميرا في الأعلى -->
<div class="camera-section">
  <h4>📷 Live Camera</h4>
  <img id="camera-img" alt="كاميرا الروبوت">
</div>

<div class="cards" id="cards"></div>

<div id="status" class="status">Status: SAFE</div>

<h3>📈 Multi-Gas Trend</h3>
<canvas id="chart"></canvas>

<div class="bottom">
  <!-- 🗺️ الخريطة أولاً -->
  <div class="map-container">
    <h3>📍 Live Location Map</h3>
    <div id="map"></div>
  </div>
  
  <!-- 📄 Logs ثانياً -->
  <div>
    <h3>📄 Logs</h3>
    <div id="logs"></div>
  </div>
</div>

</div>

<script>

// ===== WEBSOCKET للتحكم السريع (مباشر) =====
let controlWs = null;

function connectControlWs() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = protocol + '://' + location.host + '/control-ws';
  console.log('🎮 Connecting to Control WebSocket:', wsUrl);
  
  controlWs = new WebSocket(wsUrl);
  
  controlWs.onopen = () => {
    console.log('🎮 Control WebSocket CONNECTED ✅');
  };
  
  controlWs.onclose = () => {
    console.log('🎮 Control WebSocket DISCONNECTED - retrying in 2s');
    setTimeout(connectControlWs, 2000);
  };
  
  controlWs.onerror = (err) => {
    console.error('🎮 Control WebSocket ERROR:', err);
  };
}

function sendCmd(cmd) {
  console.log('📤 Sending command:', cmd);
  
  if (controlWs && controlWs.readyState === WebSocket.OPEN) {
    controlWs.send(JSON.stringify({ cmd: cmd }));
    console.log('📤 Sent via WebSocket:', cmd);
  } else {
    console.log('⚠️ WebSocket not connected, trying HTTP...');
    fetch('/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd })
    }).catch(err => console.error('Command HTTP fallback failed:', err));
  }
}

// ===== أزرار الاتجاهات =====
function bindHold(btn) {
  let cmd = btn.dataset.cmd;
  if (!cmd) return;

  let intervalId = null;

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sendCmd(cmd); // أرسل أول أمر فوراً
    intervalId = setInterval(() => sendCmd(cmd), 100); // ثم كل 100 مللي ثانية
  });

  const stopNow = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    sendCmd("STOP"); // أرسل STOP عند رفع الإصبع
  };

  btn.addEventListener('pointerup', stopNow);
  btn.addEventListener('pointerleave', stopNow);
  btn.addEventListener('touchend', stopNow);
  btn.addEventListener('touchcancel', stopNow);
}

document.querySelectorAll('.ctrl-btn').forEach(bindHold);

// ✅ زر التوقف المنفصل (للنقر العادي فقط)
document.getElementById('stop-btn').addEventListener('click', (e) => {
  e.preventDefault();
  sendCmd('STOP');
});

// ===== GRAPH =====
let labels = [];
let dataSets = {CO:[], H2S:[], NH3:[], CH4:[], NO2:[], CO2:[], O3:[]};

const chart = new Chart(document.getElementById("chart"), {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {label:'CO', data:dataSets.CO, borderColor:'#f87171'},
      {label:'H₂S', data:dataSets.H2S, borderColor:'#facc15'},
      {label:'NH₃', data:dataSets.NH3, borderColor:'#4ade80'},
      {label:'CH₄', data:dataSets.CH4, borderColor:'#60a5fa'},
      {label:'NO₂', data:dataSets.NO2, borderColor:'#c084fc'},
      {label:'CO₂', data:dataSets.CO2, borderColor:'#fb923c'},
      {label:'O₃', data:dataSets.O3, borderColor:'#2dd4bf'}
    ]
  },
  options: { animation: false }
});

// ===== MAP =====
let map = L.map('map').setView([15.3, 44.2], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker = L.marker([15.3, 44.2]).addTo(map);

// ✅ دالة آمنة لعرض النصوص
function safeText(val) {
  if (typeof val !== 'number') val = parseFloat(val) || 0;
  return val.toFixed(1);
}

// ===== WEBSOCKET للكاميرا =====
const camImg = document.getElementById('camera-img');
let camSocket = null;

function connectCamera() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  camSocket = new WebSocket(protocol + '://' + location.host);
  camSocket.binaryType = 'arraybuffer';
  camSocket.onopen = () => console.log('📷 Camera WebSocket connected');
  camSocket.onmessage = (event) => {
    const blob = new Blob([event.data], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    camImg.src = url;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  camSocket.onclose = () => { console.log('📷 Camera WebSocket closed'); setTimeout(connectCamera, 3000); };
}
connectCamera();

// ✅ بدء اتصال WebSocket للتحكم
connectControlWs();

// ===== UPDATE =====
function update() {
  // ✅ جلب البيانات مع معالجة الأخطاء
  fetch('/data')
    .then(r => {
      if (!r.ok) throw new Error('Server error');
      return r.json();
    })
    .then(d => {
      let danger = d.CO > 50 || d.H2S > 20;
      document.getElementById("status").innerHTML =
        danger ? "⚠️ DANGER" : "✅ SAFE";

      // ✅ بطاقات بأسماء الغازات
      document.getElementById("cards").innerHTML =
        '<div class="card ' + (d.H2S>20?'danger':'') + '">☠️ H₂S<span>' + safeText(d.H2S) + '</span>ppm</div>' +
        '<div class="card ' + (d.CO>50?'danger':'') + '">🔥 CO<span>' + safeText(d.CO) + '</span>ppm</div>' +
        '<div class="card">☁️ CO₂<span>' + safeText(d.CO2) + '</span>ppm</div>' +
        '<div class="card">🧪 NO₂<span>' + safeText(d.NO2) + '</span>ppm</div>' +
        '<div class="card">🤖 NH₃<span>' + safeText(d.NH3) + '</span>ppm</div>' +
        '<div class="card">💨 CH₄<span>' + safeText(d.CH4) + '</span>ppm</div>' +
        '<div class="card">🧬 O₃<span>' + safeText(d.O3) + '</span>ppm</div>' +
        '<div class="card">🌡 TEMP<span>' + safeText(d.TEMP) + '</span>°C</div>' +
        '<div class="card">💧 HUM<span>' + safeText(d.HUM) + '</span>%</div>' +
        '<div class="card">🌫 SMOKE<span>' + safeText(d.SMOKE) + '</span>%</div>';

      let t = new Date().toLocaleTimeString();
      labels.push(t);
      for (let k in dataSets) {
        dataSets[k].push(d[k] || 0);
      }
      if (labels.length > 15) {
        labels.shift();
        for (let k in dataSets) dataSets[k].shift();
      }
      chart.update();
    })
    .catch(err => console.error('Data fetch error:', err));

  // GPS
  fetch('/gps')
    .then(r => r.json())
    .then(g => {
      if (g.lat && g.lon) {
        marker.setLatLng([g.lat, g.lon]);
        map.setView([g.lat, g.lon], 15);
      }
    })
    .catch(err => console.error('GPS fetch error:', err));

  // LOGS
  fetch('/logs')
    .then(r => r.json())
    .then(arr => {
      if (!Array.isArray(arr)) return;
      document.getElementById("logs").innerHTML = arr.map(l =>
        '<div>' + l.time + ' | CO:' + safeText(l.CO) + ' | H₂S:' + safeText(l.H2S) + '</div>'
      ).join('');
    })
    .catch(err => console.error('Logs fetch error:', err));
}

// ✅ تشغيل أول تحديث فوري
update();
setInterval(update, 2000);

</script>

</body>
</html>
  `);
});

// ================== WebSocket Server ==================
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();
const controlClients = new Set();
let cameraSocket = null;

wss.on("connection", (ws, req) => {
  const path = req.url;
  console.log("🔗 New WebSocket connection:", path);

  // ✅ قناة الكاميرا
  if (path === "/cam-stream") {
    console.log("📷 Camera connected via WebSocket");
    cameraSocket = ws;
    ws.on("message", (data) => {
      latestFrame = data;
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    });
    ws.on("close", () => { console.log("📷 Camera disconnected"); cameraSocket = null; });
    return;
  }

  // ✅ قناة التحكم (تم التصحيح)
  if (path === "/control-ws") {
    console.log("🎮 Control client connected (Total: " + (controlClients.size + 1) + ")");
    controlClients.add(ws);
    
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);
        const cmd = msg.cmd;
        console.log("🎮 Received command:", cmd);
        
        if (cmd && ALLOWED_COMMANDS.has(cmd)) {
          lastCommand = cmd;
          // ✅ بث الأمر لجميع عملاء التحكم الآخرين (ESP32)
          for (const client of controlClients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ cmd: cmd }));
              console.log("🎮 Relayed to client:", cmd);
            }
          }
        } else {
          console.log("🎮 Invalid command rejected:", cmd);
        }
      } catch (e) {
        console.log("🎮 Invalid message format");
      }
    });
    
    ws.on("close", () => {
      controlClients.delete(ws);
      console.log("🎮 Control client disconnected (Remaining: " + controlClients.size + ")");
    });
    return;
  }

  // اتصال متصفح عادي (كاميرا)
  console.log("🌐 Browser client connected");
  clients.add(ws);
  if (latestFrame && ws.readyState === WebSocket.OPEN) ws.send(latestFrame);
  ws.on("close", () => clients.delete(ws));
});

// ================= START =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("✅ Server running on port", PORT));
