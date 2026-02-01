/**
 * db.js
 *
 * Purpose:
 * - Centralized database configuration and connection setup
 *   for the PostgreSQL database.
 *
 * Responsibilities:
 * - Loads environment variables (DATABASE_URL)
 * - Creates and exports a reusable PostgreSQL connection pool
 * - Handles unexpected database connection errors
 *
 * Used by:
 * - Service layers (e.g., posts.services.js, delete.services.js)
 * - Any module that needs to run SQL queries
 *
 * Notes:
 * - Uses a connection pool for better performance and scalability
 * - Database credentials are never hardcoded and are read from .env
 * - This file should only handle DB setup, not queries or business logic
 */

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({connectionString: process.env.DATABASE_URL});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
});

export default pool;