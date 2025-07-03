import { type Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";

export function setupRoutes(app: Express) {
  // API rotaları burada
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Diğer API rotaları...

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return createServer(app);
}
