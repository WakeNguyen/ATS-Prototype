import crypto from 'crypto';

/**
 * Derives a 32-byte Buffer key for AES-256-GCM from the APP_ENCRYPTION_SECRET env var.
 * Throws an explicit error if the secret is missing.
 */
function getKey() {
  const secret = process.env.APP_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('[ENCRYPTION ERROR] APP_ENCRYPTION_SECRET environment variable is missing.');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` (all parts Base64 encoded).
 * 
 * @param {string|null|undefined} plainText
 * @returns {string|null}
 */
export function encryptSecret(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') {
    return plainText ?? null;
  }

  const key = getKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(String(plainText), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string (`iv:authTag:ciphertext`).
 * Returns original string if not in encrypted format (e.g. legacy plain text).
 * 
 * @param {string|null|undefined} cipherText
 * @returns {string|null}
 */
export function decryptSecret(cipherText) {
  if (cipherText === null || cipherText === undefined || cipherText === '') {
    return cipherText ?? null;
  }

  const str = String(cipherText);
  const parts = str.split(':');
  if (parts.length !== 3) {
    // Return original string if not encrypted
    return str;
  }

  const [ivB64, authTagB64, encryptedB64] = parts;

  try {
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    if (iv.length !== 12 || authTag.length !== 16) {
      return str; // Not valid GCM params, fallback
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[ENCRYPTION WARNING] Failed to decrypt ciphertext:', err.message);
    return str; // Graceful fallback
  }
}

/**
 * Masks a proxy URL for safe UI display and list view.
 * Transforms `http://user:pass@host:port` to `http://***:***@host:port`.
 * 
 * @param {string|null|undefined} proxyUrl
 * @returns {string}
 */
export function maskProxyUrl(proxyUrl) {
  if (!proxyUrl || typeof proxyUrl !== 'string') return '';
  // Replaces credentials inside `protocol://user:pass@host...`
  return proxyUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
}

/**
 * Masks a sensitive text string (e.g. 2FA backup codes or passwords).
 * 
 * @param {string|null|undefined} secretText
 * @returns {string}
 */
export function maskSecret(secretText) {
  if (!secretText || typeof secretText !== 'string') return '';
  return '••••••••••••';
}
