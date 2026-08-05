import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
  max: 10,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
