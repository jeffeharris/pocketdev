import crypto from 'crypto';

// Function to ensure we have a proper 32-byte key
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // If key is provided as hex string, convert to buffer
    if (typeof envKey === 'string' && /^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    
    // If key is provided as string but not proper hex, throw clear error
    if (typeof envKey === 'string') {
      throw new Error(
        `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
        `Current key is ${envKey.length} characters. ` +
        `Generate a proper key with: openssl rand -hex 32`
      );
    }
    
    // If it's already a buffer, validate length
    if (Buffer.isBuffer(envKey) && envKey.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly 32 bytes. Current key is ${envKey.length} bytes.`
      );
    }
    
    return envKey;
  }
  
  // Generate default key for development
  console.warn('No ENCRYPTION_KEY provided. Using default development key (NOT secure for production)');
  return crypto.scryptSync('default-dev-password', 'salt', 32);
}

// Initialize encryption key with validation
let ENCRYPTION_KEY;
try {
  ENCRYPTION_KEY = getEncryptionKey();
} catch (error) {
  console.error('Encryption key error:', error.message);
  throw error;
}

const IV_LENGTH = 16; // For AES, this is always 16
const ALGORITHM = 'aes-256-cbc';

export function encrypt(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Return iv + encrypted content as base64
  return iv.toString('base64') + ':' + encrypted.toString('base64');
}

export function decrypt(text) {
  if (!text) return null;
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'base64');
    const encryptedText = Buffer.from(textParts.join(':'), 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}