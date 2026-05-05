<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Robot Control Dashboard</title>

<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>

body{
  margin:0;
  font-family:Segoe UI;
  background:#0b1220;
  color:white;
}

.header{
  background:#020617;
  padding:12px;
  text-align:center;
  font-size:20px;
  font-weight:bold;
}

.container{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap:10px;
  padding:10px;
}

.card{
  background:#111827;
  padding:10px;
  border-radius:12px;
}

.sensor-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:8px;
}

.sensor{
  padding:10px;
  border-radius:10px;
  text-align:center;
  font-size:14px;
}

.safe{background:#064e3b;}
.warn{background:#78350f;}
.danger{background:#7f1d1d;}

.value{font-size:18px;font-weight:bold;}

#map{
  height:250px;
  border-radius:10px;
}

#cam{
  width:100%;
  height:250px;
  border-radius:10px;
  background:black;
  object-fit:cover;
}

canvas{width:100%;}

.controls{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  text-align:center;
}

button{
  padding:15px;
  border:none;
  border-radius:10px;
  background:#1f2937;
  color:white;
  font-size:16px;
}

button:active{background:#0ea5e9;}

.status{
  text-align:center;
  font-size:18px;
  margin:10px 0;
}

</style>
</head>

<body>

<div class="header">🚀 Industrial Robot Control System</div>

<div class="container">

<!-- SENSORS -->
<div class="card">
<h3>⚠️ Sensors</h3>
<div class="sensor-grid" id="sensors"></div>
</div>

<!-- MAP + CAMERA -->
<div class="card">
<h3>📍 Location</h3>
<div id="map"></div>

<h3 style="margin-top:10px;">📷 Camera</h3>
<img id="cam" src="">
</div>

<!-- CONTROL -->
<div class="card">
<h3>🎮 Control</h3>

<div class="controls">
<button onclick="send('F')">↑</button>
<button onclick="send('LIGHT_ON')">💡 ON</button>
<button onclick="send('ALARM_ON')">🚨</button>

<button onclick="send('L')">←</button>
<button onclick="send('S')">■</button>
<button onclick="send('R')">→</button>

<button onclick="send('B')">↓</button>
<button onclick="send('LIGHT_OFF')">💡 OFF</button>
<button onclick="send('ALARM_OFF')">🔕</button>
</div>

<div class="status" id="status">Loading...</div>

<!-- ✔️ زر تفعيل الصوت (مهم للمتصفح) -->
<button onclick="enableAlarm()">🔊 Enable Alarm Sound</button>

</div>

</div>

<div class="card" style="margin:10px;">
<h3>📊 Gas Chart</h3>
<canvas id="chart"></canvas>
</div>

<!-- ✔️ صوت الإنذار -->
<audio id="alarmSound" loop>
  <source src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" type="audio/ogg">
</audio>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<script>

/* ===================== */
/* SERVER CONFIG */
/* ===================== */
const server = "https://your-domain.com";

/* camera */
document.getElementById("cam").src = server + "/camera";

/* alarm */
const alarm = document.getElementById("alarmSound");
let alarmPlaying = false;

/* enable sound */
function enableAlarm(){
  alarm.play().then(()=>{
    alarm.pause();
    alarm.currentTime = 0;
    alert("Alarm Enabled 🔊");
  });
}

/* sensor UI */
function getStatus(v){
  return v > 50 ? "danger" : v > 20 ? "warn" : "safe";
}

function sensor(name,val){
  return `
  <div class="sensor ${getStatus(val)}">
    ${name}
    <div class="value">${val}</div>
  </div>`;
}

/* MAP */
let map = L.map('map').setView([15.3694,44.1910], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

let marker = L.marker([15.3694,44.1910]).addTo(map);

/* CHART */
const chart = new Chart(document.getElementById('chart'),{
  type:'line',
  data:{
    labels:[],
    datasets:[
      {label:'H2S',data:[]},
      {label:'CO',data:[]},
      {label:'CO2',data:[]},
      {label:'CH4',data:[]}
    ]
  },
  options:{animation:false}
});

/* SEND COMMAND */
function send(cmd){
  fetch(server+"/cmd",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({cmd})
  });
}

/* MAIN LOOP */
setInterval(()=>{

fetch(server+"/data")
.then(r=>r.json())
.then(d=>{

/* sensors */
document.getElementById("sensors").innerHTML =
sensor("H2S",d.h2s)+
sensor("CO",d.co)+
sensor("CO2",d.co2)+
sensor("CH4",d.ch4)+
sensor("O3",d.o3)+
sensor("NH3",d.nh3)+
sensor("NO2",d.no2)+
sensor("SMOKE",d.smoke);

/* danger logic */
let danger =
d.h2s>20 || d.co>50 || d.ch4>50 || d.smoke>50;

/* status */
document.getElementById("status").innerHTML =
danger ? "🔴 DANGER ZONE" : "🟢 SAFE";

/* 🔊 ALARM CONTROL */
if(danger && !alarmPlaying){
  alarm.play();
  alarmPlaying = true;
}

if(!danger && alarmPlaying){
  alarm.pause();
  alarm.currentTime = 0;
  alarmPlaying = false;
}

/* chart */
chart.data.labels.push("");
chart.data.datasets[0].data.push(d.h2s);
chart.data.datasets[1].data.push(d.co);
chart.data.datasets[2].data.push(d.co2);
chart.data.datasets[3].data.push(d.ch4);

if(chart.data.labels.length>20){
  chart.data.labels.shift();
  chart.data.datasets.forEach(ds=>ds.data.shift());
}

chart.update();

/* GPS */
if(d.lat && d.lon){
  marker.setLatLng([d.lat,d.lon]);
  map.setView([d.lat,d.lon]);
}

});

},1000);

</script>

</body>
</html>
