const express = require("express");
const app = express();

app.use(express.json());

let robotData = {};
let lastCommand = "";

// ===== استقبال بيانات من ESP32 =====
app.post("/data", (req, res) => {
  robotData = req.body;
  res.send("OK");
});

// ===== إرجاع البيانات للصفحة =====
app.get("/data", (req, res) => {
  res.json(robotData);
});

// ===== استقبال أوامر من الصفحة =====
app.post("/control", (req, res) => {
  lastCommand = req.body.cmd;
  res.send("OK");
});

// ===== ESP32 يسحب آخر أمر =====
app.get("/control", (req, res) => {
  res.send(lastCommand);
});

// ===== صفحة التحكم =====
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Gas Robot</title>
    <style>
      body { font-family: Arial; text-align:center; background:#111; color:white; }
      button { padding:15px; margin:10px; font-size:18px; }
      .grid { display:grid; grid-template-columns:repeat(3,100px); gap:10px; justify-content:center; }
    </style>
  </head>
  <body>

    <h1>🤖 Gas Robot Control</h1>

    <h3>التحكم بالحركة</h3>
    <div class="grid">
      <div></div>
      <button onclick="sendCmd('FWD')">⬆</button>
      <div></div>

      <button onclick="sendCmd('LEFT')">⬅</button>
      <button onclick="sendCmd('STOP')">⏹</button>
      <button onclick="sendCmd('RIGHT')">➡</button>

      <div></div>
      <button onclick="sendCmd('BACK')">⬇</button>
      <div></div>
    </div>

    <h3>الإضاءة</h3>
    <button onclick="sendCmd('LIGHT_ON')">تشغيل</button>
    <button onclick="sendCmd('LIGHT_OFF')">إيقاف</button>

    <h3>البيانات</h3>
    <div id="data">Loading...</div>

    <script>
      function sendCmd(cmd) {
        fetch('/control', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({cmd: cmd})
        });
      }

      function loadData(){
        fetch('/data')
        .then(r=>r.json())
        .then(d=>{
          document.getElementById("data").innerHTML =
            "CO: "+d.CO+" | NH3: "+d.NH3+" | TEMP: "+d.TEMP;
        });
      }

      setInterval(loadData, 2000);
    </script>

  </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started"));
