import { describe, it, expect, vi } from 'vitest';
import { encrypt, decrypt, hashData, generateSalt, maskSensitiveData } from '@/lib/encryption';

describe('encrypt and decrypt', () => {
  it('successfully encrypts and decrypts a string', () => {
    const originalText = 'my-secret-data';
    const encrypted = encrypt(originalText);
    
    expect(encrypted).not.toBe(originalText);
    expect(encrypted).toContain(':'); // IV and ciphertext are joined by colon
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('returns empty string when encrypting empty/null value', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(null as any)).toBe('');
  });

  it('returns empty string when decrypting empty/null value', () => {
    expect(decrypt('')).toBe('');
    expect(decrypt(null as any)).toBe('');
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const text = 'hello-world';
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(text);
    expect(decrypt(encrypted2)).toBe(text);
  });

  it('handles decryption failure gracefully', () => {
    const invalidEncrypted = 'invalid-iv:invalid-ciphertext';
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const result = decrypt(invalidEncrypted);
    expect(result).toBe('');
    
    consoleSpy.mockRestore();
  });
});

describe('hashData', () => {
  it('produces a deterministic hash', () => {
    const text = 'my-password';
    const hash1 = hashData(text);
    const hash2 = hashData(text);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('produces different hashes for different inputs', () => {
    expect(hashData('password123')).not.toBe(hashData('password124'));
  });
});

describe('generateSalt', () => {
  it('generates a hex string of length 32 (16 bytes)', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    expect(salt).toHaveLength(32);
    // Ensure it's valid hex
    expect(/^[0-9a-f]{32}$/i.test(salt)).toBe(true);
  });

  it('generates unique salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
  });
});

describe('maskSensitiveData', () => {
  it('masks middle characters, keeping default 2 visible on ends', () => {
    expect(maskSensitiveData('12345678')).toBe('12****78');
  });

  it('masks with custom visible characters', () => {
    expect(maskSensitiveData('12345678', 3)).toBe('123**678');
    expect(maskSensitiveData('1234567890', 4)).toBe('1234**7890');
  });

  it('fully masks if string is too short', () => {
    // 4 chars total, requiring 2 on each end = fully visible normally? 
    // The function says `data.length <= visibleChars * 2` returns all `*`
    expect(maskSensitiveData('1234')).toBe('****');
    expect(maskSensitiveData('123')).toBe('***');
  });

  it('returns empty string for empty input', () => {
    expect(maskSensitiveData('')).toBe('');
    expect(maskSensitiveData(null as any)).toBe('');
  });
});
