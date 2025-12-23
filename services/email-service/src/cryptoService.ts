import crypto from 'crypto';

/**
 * CryptoService handles encryption and decryption of sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */
class CryptoService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private saltLength = 64;
  private tagLength = 16; // 128 bits
  private encryptionKey: Buffer;

  constructor() {
    // Get encryption key from environment variable
    const envKey = process.env.ENCRYPTION_KEY;

    if (!envKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive a proper 256-bit key from the environment variable
    this.encryptionKey = crypto.scryptSync(envKey, 'salt', this.keyLength);
  }

  /**
   * Encrypts a string value
   * @param plaintext - The string to encrypt
   * @returns Encrypted string in format: iv:authTag:encrypted
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty value');
    }

    // Generate random IV
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = (cipher as crypto.CipherGCM).getAuthTag();

    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string
   * @param encryptedData - The encrypted string in format: iv:authTag:encrypted
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      throw new Error('Cannot decrypt empty value');
    }

    try {
      // Parse the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      (decipher as crypto.DecipherGCM).setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts an object by converting it to JSON first
   * @param data - The object to encrypt
   * @returns Encrypted string
   */
  encryptObject(data: unknown): string {
    const json = JSON.stringify(data);
    return this.encrypt(json);
  }

  /**
   * Decrypts an encrypted object
   * @param encryptedData - The encrypted string
   * @returns Decrypted object
   */
  decryptObject<T = unknown>(encryptedData: string): T {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }

  /**
   * Hashes a value using SHA-256
   * Useful for creating deterministic identifiers
   * @param value - The value to hash
   * @returns Hex-encoded hash
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generates a random token
   * @param length - Length in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Compares two values in constant time to prevent timing attacks
   * @param a - First value
   * @param b - Second value
   * @returns True if values are equal
   */
  constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}

// Export singleton instance
export default new CryptoService();
