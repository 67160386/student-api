// mock-fail-server.js (สคริปต์ชั่วคราว ไม่ต้องเก็บไว้ในโปรเจกต์จริง)
const http = require("http");

http
  .createServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "simulated server error" }));
  })
  .listen(4000, () => console.log("Mock failing server on port 4000"));
