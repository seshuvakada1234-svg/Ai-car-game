import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import { setupMultiplayerWebSocket } from "./src/multiplayer/multiplayerServer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Same-origin high-reliability CORS-bypass proxy for streaming binary GLB models
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing url query parameter");
    }

    try {
      console.log(`[Proxy Server] Fetching: ${targetUrl}`);
      
      // Node 18+ global fetch
      const response = await fetch(targetUrl);
      if (!response.ok) {
        console.error(`[Proxy Server] Failed to download remote resource: ${response.status} ${response.statusText}`);
        return res.status(response.status).send(`Failed to download remote resource: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
      console.log(`[Proxy Server] Successfully proxied ${targetUrl} (${arrayBuffer.byteLength} bytes)`);
    } catch (err: any) {
      console.error(`[Proxy Server] Error processing proxy download for ${targetUrl}:`, err);
      res.status(500).send(`Proxy failed: ${err.message}`);
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite development middleware vs production static handling
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create standard HTTP server wrapping express app
  const server = http.createServer(app);

  // Setup multiplayer real-time sync WebSocket services
  setupMultiplayerWebSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Proxy & Multiplayer Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});

