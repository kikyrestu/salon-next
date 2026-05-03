import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// Set required env vars for tests
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes for AES-256
process.env.HASH_SALT = 'test-salt';
vi.stubEnv('NODE_ENV', 'test');

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});
