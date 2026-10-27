const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Browser demo-mode password derivation. This deliberately never stores plaintext,
 * but client-side storage is still demo-only and is NOT production authentication.
 */
export async function derivePassword(password, salt = randomSalt(), iterations = 120000) {
  const keyMaterial = await globalThis.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations },
    keyMaterial,
    256,
  );
  return { passwordHash: bytesToHex(bits), passwordSalt: salt, passwordIterations: iterations, passwordAlgorithm: 'PBKDF2-SHA256' };
}

export async function verifyDemoPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const result = await derivePassword(password, user.passwordSalt, user.passwordIterations || 120000);
  if (result.passwordHash.length !== user.passwordHash.length) return false;
  let difference = 0;
  for (let i = 0; i < result.passwordHash.length; i += 1) {
    difference |= result.passwordHash.charCodeAt(i) ^ user.passwordHash.charCodeAt(i);
  }
  return difference === 0;
}

export function randomToken() {
  return bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(24)));
}
