import cryptoService from './cryptoService';

describe('CryptoService', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'my-secret-token-12345';
      const encrypted = cryptoService.encrypt(plaintext);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'my-secret-token';
      const encrypted1 = cryptoService.encrypt(plaintext);
      const encrypted2 = cryptoService.encrypt(plaintext);

      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same plaintext
      expect(cryptoService.decrypt(encrypted1)).toBe(plaintext);
      expect(cryptoService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'token@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = cryptoService.encrypt(plaintext);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Héllo Wörld 你好世界 🔐';
      const encrypted = cryptoService.encrypt(plaintext);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when encrypting empty string', () => {
      expect(() => cryptoService.encrypt('')).toThrow('Cannot encrypt empty value');
    });

    it('should throw error when decrypting empty string', () => {
      expect(() => cryptoService.decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => cryptoService.decrypt('invalid-format')).toThrow('Invalid encrypted data format');
    });

    it('should throw error when decrypting tampered data', () => {
      const plaintext = 'my-secret-token';
      const encrypted = cryptoService.encrypt(plaintext);

      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + 'ff'; // Change last byte
      const tampered = parts.join(':');

      expect(() => cryptoService.decrypt(tampered)).toThrow('Decryption failed');
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt an object', () => {
      const obj = {
        accessToken: 'token123',
        refreshToken: 'refresh456',
        expiresAt: new Date().toISOString(),
        metadata: { provider: 'gmail' }
      };

      const encrypted = cryptoService.encryptObject(obj);
      const decrypted = cryptoService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it('should handle nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              secret: 'deep-secret'
            }
          }
        }
      };

      const encrypted = cryptoService.encryptObject(obj);
      const decrypted = cryptoService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it('should handle arrays', () => {
      const obj = {
        tokens: ['token1', 'token2', 'token3'],
        numbers: [1, 2, 3],
        mixed: [{ id: 1 }, { id: 2 }]
      };

      const encrypted = cryptoService.encryptObject(obj);
      const decrypted = cryptoService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });
  });

  describe('hash', () => {
    it('should create consistent hash for same input', () => {
      const value = 'test-value';
      const hash1 = cryptoService.hash(value);
      const hash2 = cryptoService.hash(value);

      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = cryptoService.hash('value1');
      const hash2 = cryptoService.hash('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should create 64-character hex string (SHA-256)', () => {
      const hash = cryptoService.hash('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = cryptoService.generateToken();
      const token2 = cryptoService.generateToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of specified length', () => {
      const token = cryptoService.generateToken(16);
      // 16 bytes = 32 hex characters
      expect(token).toHaveLength(32);
    });

    it('should generate hex string', () => {
      const token = cryptoService.generateToken();
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      const value = 'secret-token-123';
      expect(cryptoService.constantTimeCompare(value, value)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(cryptoService.constantTimeCompare('token1', 'token2')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(cryptoService.constantTimeCompare('short', 'longer-string')).toBe(false);
    });

    it('should work with special characters', () => {
      const value = 'token@#$%^&*()';
      expect(cryptoService.constantTimeCompare(value, value)).toBe(true);
    });
  });
});
