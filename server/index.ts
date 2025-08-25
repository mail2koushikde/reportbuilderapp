import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import storageRoutes from "./routes/storage";
import snowflakeRoutes from "./routes/snowflake";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // Storage routes
  app.use("/api/storage", storageRoutes);

  // Snowflake routes
  app.use("/api/snowflake", snowflakeRoutes);

  return app;
}
