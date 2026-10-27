import bcrypt from 'bcryptjs';
import { createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

export function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}

export async function hashServerPassword(password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return {
    passwordHash,
    passwordSalt: null,
    passwordAlgorithm: 'bcrypt',
    passwordIterations: 12,
  };
}

function safeCompareHex(expectedHex, actualHex) {
  if (!expectedHex || !actualHex || expectedHex.length !== actualHex.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'));
  } catch {
    return false;
  }
}

export async function verifyServerPassword(password, row) {
  if (!row?.password_hash || typeof password !== 'string') return false;
  if (row.password_algorithm === 'bcrypt') return bcrypt.compare(password, row.password_hash);
  if (['PBKDF2-SHA256', 'pbkdf2-sha256'].includes(row.password_algorithm)) {
    const derived = pbkdf2Sync(password, Buffer.from(row.password_salt || '', 'hex'), Number(row.password_iterations) || 120000, 32, 'sha256').toString('hex');
    return safeCompareHex(row.password_hash, derived);
  }
  return false;
}

export function passwordFingerprint(hash) {
  return createHash('sha256').update(hash || '').digest('hex').slice(0, 12);
}
