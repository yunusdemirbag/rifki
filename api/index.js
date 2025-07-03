// server/index.ts
import express from "express";
import { createServer as createServer2 } from "http";

// server/routes.ts
import { createServer } from "http";
function setupRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  return createServer(app2);
}

// server/index.ts
import path from "path";
var app = express();
var server = createServer2(app);
var PORT = process.env.PORT || 3e3;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
var publicPath = process.env.NODE_ENV === "production" ? path.join(process.cwd(), "dist") : path.join(process.cwd(), "public");
app.use(express.static(publicPath));
setupRoutes(app);
app.get("*", (req, res) => {
  const indexPath = process.env.NODE_ENV === "production" ? path.resolve(publicPath, "index.html") : path.resolve(publicPath, "index.html");
  res.sendFile(indexPath);
});
if (process.env.NODE_ENV !== "production") {
  server.listen(PORT, () => {
    console.log(`\u{1F680} Server running on http://localhost:${PORT}`);
  });
}
var index_default = app;
export {
  index_default as default
};
