const WebSocket = require("ws");

describe("WebSocket Auth Failure Test", () => {
  test("Reject invalid token", done => {
    const ws = new WebSocket("ws://localhost:4000");
    let closed = false;

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "auth",
        token: "invalid.token.here"
      }));
    });

    ws.on("close", () => {
      if (closed) return;
      closed = true;
      expect(ws.readyState).toBe(WebSocket.CLOSED);
      done();
    });

    ws.on("error", () => {
      // error is acceptable → server closed connection
    });
  });
});
