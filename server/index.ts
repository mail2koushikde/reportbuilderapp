import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import storageRoutes from "./routes/storage";
import snowflakeRoutes from "./routes/snowflake";
import databaseRoutes from "./routes/database";
import { databaseService } from "./database/database-service";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize database on startup
  initializeDatabase();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // Storage routes
  app.use("/api/storage", storageRoutes);

  // Snowflake routes (legacy - now uses database service)
  app.use("/api/snowflake", snowflakeRoutes);

  // Database routes (new unified database API)
  app.use("/api/database", databaseRoutes);

  return app;
}

async function initializeDatabase() {
  try {
    await databaseService.initialize();
    console.log('Database service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database service:', error);
    // Don't crash the server, but log the error
  }
}
