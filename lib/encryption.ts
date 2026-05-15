import crypto from 'crypto';

// The key should be 32 bytes (64 hex characters)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '64_hex_characters_should_be_here_in_env_file';
const IV_LENGTH = 16; // For AES, this is always 16

// Encrypt data
export function encrypt(text: string): string {
  if (!text) return '';

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV and encrypted text joined by a colon
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
}

// Decrypt data
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

// Hash data with salt (for non-reversible operations like passwords)
export function hashData(data: string): string {
  const salt = process.env.HASH_SALT || 'default_salt_for_dev_only';
  return crypto.createHash('sha256').update(data + salt).digest('hex');
}

// Generate a random salt
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Mask sensitive data for logging/display
export function maskSensitiveData(data: string, visibleChars: number = 2): string {
  if (!data) return '';
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const maskedLength = data.length - visibleChars * 2;

  return start + '*'.repeat(maskedLength) + end;
}

const PREFIX = 'ENC:';

// Ensure key is exactly 32 bytes for Fonnte tokens
const getFonnteKey = () => {
    let key = ENCRYPTION_KEY;
    if (key.length < 32) {
        key = key.padEnd(32, '0');
    } else if (key.length > 32) {
        key = key.substring(0, 32);
    }
    return Buffer.from(key, 'utf8');
};

/**
 * Encrypts a plain text Fonnte token.
 */
export function encryptFonnteToken(text: string): string {
    if (!text) return text;
    if (text.startsWith(PREFIX)) return text; // Don't double encrypt

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', getFonnteKey(), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${PREFIX}${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('Error encrypting Fonnte token:', error);
        return text; 
    }
}

/**
 * Decrypts an encrypted Fonnte token.
 * Backward compatible: returns plain text if not encrypted.
 */
export function decryptFonnteToken(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    if (!encryptedText.startsWith(PREFIX)) {
        return encryptedText;
    }

    try {
        const data = encryptedText.slice(PREFIX.length);
        const [ivHex, encrypted] = data.split(':');
        
        if (!ivHex || !encrypted) {
            return encryptedText;
        }

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', getFonnteKey(), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Error decrypting Fonnte token:', error);
        return encryptedText; 
    }
}

