import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL || '';
const useSsl = /sslmode=require/i.test(connectionString) || process.env.PGSSLMODE === 'require';

export const INSTITUTE_ID = process.env.INSTITUTE_ID || 'edutrack-main';
export const databaseConfigured = Boolean(connectionString);
export const pool = connectionString
  ? new pg.Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : null;

export async function query(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!pool) return { ok: false, reason: 'DATABASE_URL is not configured.' };
  if (!process.env.JWT_SECRET) return { ok: false, reason: 'JWT_SECRET is not configured.' };
  const result = await pool.query("SELECT current_database() AS database, NOW() AS server_time, to_regclass('public.institutes') AS institutes_table");
  if (!result.rows[0].institutes_table) return { ok: false, reason: 'Database schema is not initialized. Run npm run db:init.' };
  return { ok: true, database: result.rows[0].database, serverTime: result.rows[0].server_time };
}
