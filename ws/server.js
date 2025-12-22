const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { subClient } = require("../shared/redisClient");
const { walletEventChannel, jwtSecret } = require("../shared/config");

const PORT = process.env.WS_PORT || 4000;
const wss = new WebSocket.Server({ port: PORT });

module.exports = wss;

// userId -> Set of sockets
const userSockets = new Map();

function addSocket(userId, ws) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(ws);
}

function removeSocket(userId, ws) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

// ================= CONNECTION =================
wss.on("connection", (ws) => {
  let authenticated = false;

  ws.once("message", (msg) => {
    try {
      const { type, token } = JSON.parse(msg);

      if (type !== "auth" || !token) {
        return ws.close(1008); // policy violation
      }

      const payload = jwt.verify(token, jwtSecret);
      ws.userId = payload.id;
      authenticated = true;

      addSocket(ws.userId, ws);

      ws.send(JSON.stringify({ type: "auth", ok: true }));
    } catch (err) {
      ws.close(1008);
    }
  });

  ws.on("close", () => {
    if (authenticated && ws.userId) {
      removeSocket(ws.userId, ws);
    }
  });
});

// ================= REDIS =================
// ❗ Disable Redis in test env (IMPORTANT for ws.test.js)
if (process.env.NODE_ENV !== "test") {
  subClient.subscribe(walletEventChannel);

  subClient.on("message", (channel, msg) => {
    if (channel !== walletEventChannel) return;

    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    const sockets = userSockets.get(data.userId);
    if (!sockets) return;

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "wallet_event", data }));
      }
    }
  });
}

console.log(`WebSocket server running on port ${PORT}`);
