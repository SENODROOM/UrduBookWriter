import express from "express";
import { contentRouter } from "./routes/content.js";
import { exportRouter } from "./routes/export.js";

export function createApiApp() {
  const app = express();
  app.use("/api", contentRouter());
  app.use("/api", exportRouter());
  return app;
}
