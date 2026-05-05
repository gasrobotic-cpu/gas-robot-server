<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Robot Control Dashboard</title>

<!-- Leaflet + Chart.js -->
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

<style>
body{
  margin:0;
  font-family: Arial, sans-serif;
  background:#0b0f14;
  color:#fff;
}

/* HEADER */
header{
  background:#111827;
  padding:15px;
  text-align:center;
  font-size:20px;
  font-weight:bold;
  border-bottom:2px solid #1f2937;
}

/* GRID */
.container{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap:10px;
  padding:10px;
}

.card{
  background:#111827;
  padding:10px;
  border-radius:10px;
  border:1px solid #1f2937;
}

/* MAP */
#map{
  height:300px;
  border-radius:10px;
}

/* CAMERA */
.camera-box{
  height:300px;
  background:#000;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:10px;
}

/* BUTTONS */
button{
  padding:10px;
  margin:5px;
  border:none;
  border-radius:8px;
  cursor:pointer;
  font-weight:bold;
}

.btn-on{ background:#22c55e; }
.btn-off{ background:#ef4444; color:#fff; }
.btn-alarm{ background:#f59e0b; }

/* SENSOR */
.sensor{
  display:flex;
  justify-content:space-between;
  padding:5px;
  border-bottom:1px solid #1f2937;
}

/* ALERT */
.alert{
  background:#ef4444;
  padding:10px;
  border-radius:10px;
  text-align:center;
  font-weight:bold;
  display:none;
}
</style>
</head>

<body>

<header>ROBOT CONTROL DASHBOARD</header>

<div class="container">

  <!-- MAP -->
  <div class="card">
    <h3>Live Map</h3>
    <div id="map"></div>
  </div>

  <!-- CAMERA -->
  <div class="card">
    <h3>Camera</h3>
    <div class="camera-box">LIVE STREAM</div>
  </div>

  <!-- CONTROL -->
  <div class="card">
    <h3>Control</h3>

    <div class="alert" id="alertBox">⚠ GAS DETECTED</div>

    <button class="btn-on" onclick="lightOn()">Light ON</button>
    <button class="btn-off" onclick="lightOff()">Light OFF</button>
    <button class="btn-alarm" onclick="alarm()">ALARM</button>
  </div>

  <!-- SENSORS -->
  <div class="card">
    <h3>Sensors</h3>

    <div class="sensor"><span>MQ131</span><span id="mq131">0</span></div>
    <div class="sensor"><span>MQ135</span><span id="mq135">0</span></div>
    <div class="sensor"><span>MQ7</span><span id="mq7">0</span></div>
    <div class="sensor"><span>Temp</span><span id="temp">0</span></div>
    <div class="sensor"><span>Humidity</span><span id="hum">0</span></div>
  </div>

  <!-- CHART -->
  <div class="card">
    <h3>Gas Chart</h3>
    <canvas id="chart"></canvas>
  </div>

</div>

<script>

/* MAP */
var map = L.map('map').setView([15.3694, 44.1910], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z
