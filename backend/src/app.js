/**
 * app.js
 *
 * Purpose:
 * - Initializes and configures the Express application.
 *
 * Responsibilities:
 * - Creates the Express app instance
 * - Allows 'http://localhost:5173' (The Hawkbot frontend) to bypass CORS
 * - Registers global middleware (JSON body parsing)
 * - Mounts all application routes under the `/api` prefix
 *
 * Used by:
 * - Imported by the server entry point (e.g., server.js / index.js)
 *   where the app is started and listens on a port
 *
 * Notes:
 * - This file does NOT start the server itself
 * - Keeping app setup separate from server startup makes testing easier
 */

import express from 'express';
import routes from './routes/index.js';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.middleware.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Render health checks, mobile apps)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  })
);

app.use(express.json());
app.use("/api", routes);
app.use(errorHandler);

export default app;