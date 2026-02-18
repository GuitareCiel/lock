import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://lock:lock@localhost:5432/lock',
});

export const db = drizzle(pool, { schema });
export { pool };
