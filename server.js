const express = require("express");
const app = express();

app.use(express.json());

let robotData = {};
let lastCommand = "";

// استقبال البيانات من ESP32
app.post("/data", (req, res) => {
    robotData = req.body;
    res.send("OK");
});

// إرسال البيانات للصفحة
app.get("/data", (req, res) => {
    res.json(robotData);
});

// استقبال أوامر التحكم
app.post("/control", (req, res) => {
    lastCommand = req.body.cmd;
    res.send("OK");
});

// ESP32 يطلب آخر أمر
app.get("/control", (req, res) => {
    res.send(lastCommand);
});

app.get("/", (req, res) => {
    res.send("Gas Robot Server Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started"));
