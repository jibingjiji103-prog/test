import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { INSTITUTE_ID, pool, withTransaction } from './db.js';
import { hasUsers, seedState } from './store.js';
import { createSeedState } from '../src/data/seed.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!pool) throw new Error('DATABASE_URL is not set. Add it to .env before initializing the database.');
  const schema = await readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema is ready.');

  const seeded = await withTransaction(async (client) => {
    if (await hasUsers(client, INSTITUTE_ID)) return false;
    const seed = await createSeedState();
    await seedState(client, INSTITUTE_ID, seed);
    return true;
  });

  if (seeded) {
    console.log('Demo dataset seeded. All demo accounts use password: Demo@12345');
    console.log('Admin: admin@edutrack.demo | Trainer: aarav@edutrack.demo | Read-only: viewer@edutrack.demo');
  } else {
    console.log('Existing users detected; seed was skipped to protect your data.');
  }
  await pool.end();
}

main().catch(async (error) => {
  console.error('Database initialization failed:', error.message);
  if (pool) await pool.end().catch(() => {});
  process.exitCode = 1;
});
