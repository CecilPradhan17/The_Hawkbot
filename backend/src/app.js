/**
 * app.js
 *
 * Purpose:
 * - Initializes and configures the Express application.
 *
 * Responsibilities:
 * - Creates the Express app instance
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

 const app = express();

 app.use(express.json());

 app.use("/api", routes);

 export default app;