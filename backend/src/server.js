/**
 * server.js
 *
 * Purpose:
 * - Entry point of the backend application.
 *
 * Responsibilities:
 * - Imports the configured Express app
 * - Defines the port the server will run on
 * - Starts the HTTP server and begins listening for requests
 *
 * Calls:
 * - app.js (Express app configuration)
 *
 * Notes:
 * - No routes or middleware should be defined here
 * - Keeping server startup separate from app configuration
 *   helps with testing and scalability
 */

import app from "./app.js";

const PORT = 4005;

app.listen(PORT, () => {
    console.log("The server is listening on PORT: ", PORT);
});