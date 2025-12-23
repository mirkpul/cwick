import sensitiveDataService from './sensitiveDataService';

describe('SensitiveDataService', () => {
  describe('detectSensitiveData', () => {
    it('should detect credit card numbers', () => {
      const text = 'My card number is 4111-1111-1111-1111'; // Valid test card
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('credit_cards');
    });

    it('should detect SSN', () => {
      const text = 'SSN: 123-45-6789';
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('ssn');
    });

    it('should detect AWS access keys', () => {
      const text = 'AWS Key: AKIAIOSFODNN7EXAMPLE';
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('aws_keys');
    });

    it('should detect passwords', () => {
      const text = 'Password: mySecretPass123!';
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('passwords');
    });

    it('should detect Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      // Find the bearer_tokens match
      const bearerMatch = matches.find(m => m.type === 'bearer_tokens');
      expect(bearerMatch).toBeDefined();
      expect(bearerMatch?.type).toBe('bearer_tokens');
    });

    it('should detect private keys', () => {
      const text = `Here is the key:
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAtest
-----END RSA PRIVATE KEY-----`;
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].type).toBe('private_keys');
    });

    it('should not detect invalid credit card numbers', () => {
      const text = 'Random numbers: 1234-5678-9012-3456'; // Invalid by Luhn
      const matches = sensitiveDataService.detectSensitiveData(text);

      const creditCardMatches = matches.filter(m => m.type === 'credit_cards');
      expect(creditCardMatches.length).toBe(0);
    });

    it('should return empty array for empty text', () => {
      const matches = sensitiveDataService.detectSensitiveData('');
      expect(matches).toEqual([]);
    });

    it('should handle multiple sensitive data types', () => {
      const text = `
        Credit Card: 4111-1111-1111-1111
        SSN: 123-45-6789
        Password: secret123
      `;
      const matches = sensitiveDataService.detectSensitiveData(text);

      expect(matches.length).toBeGreaterThanOrEqual(2); // At least SSN and password
      const types = matches.map(m => m.type);
      expect(types).toContain('ssn');
      expect(types).toContain('passwords');
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact credit card numbers', () => {
      const text = 'My card is 4111-1111-1111-1111 please use it';
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.text).toContain('[REDACTED]');
      expect(result.text).not.toContain('4111-1111-1111-1111');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.redactedFields.credit_cards).toBe(1);
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.text).toContain('[REDACTED]');
      expect(result.text).not.toContain('123-45-6789');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.redactedFields.ssn).toBe(1);
    });

    it('should use custom replacement text', () => {
      const text = 'SSN: 123-45-6789';
      const result = sensitiveDataService.redactSensitiveData(text, '***');

      expect(result.text).toContain('***');
      expect(result.text).not.toContain('[REDACTED]');
    });

    it('should handle multiple occurrences of same type', () => {
      const text = `
        Card 1: 4111-1111-1111-1111
        Card 2: 5425-2334-3010-9903
      `;
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.redactedFields.credit_cards).toBeGreaterThanOrEqual(1); // At least one valid card
      expect(result.text.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve non-sensitive text', () => {
      const text = 'Hello world, SSN: 123-45-6789, how are you?';
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.text).toContain('Hello world');
      expect(result.text).toContain('how are you?');
      expect(result.text).not.toContain('123-45-6789');
    });

    it('should return original text when no sensitive data found', () => {
      const text = 'This is a normal email with no sensitive data';
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.text).toBe(text);
      expect(result.hasSensitiveData).toBe(false);
      expect(result.redactedFields).toEqual({});
    });

    it('should handle empty text', () => {
      const result = sensitiveDataService.redactSensitiveData('');

      expect(result.text).toBe('');
      expect(result.hasSensitiveData).toBe(false);
      expect(result.redactedFields).toEqual({});
    });

    it('should redact multiple types of sensitive data', () => {
      const text = `
        Credit Card: 4111-1111-1111-1111
        SSN: 123-45-6789
        Password: mySecret123
      `;
      const result = sensitiveDataService.redactSensitiveData(text);

      expect(result.hasSensitiveData).toBe(true);
      expect(Object.keys(result.redactedFields).length).toBeGreaterThanOrEqual(2);
      expect(result.text).not.toContain('123-45-6789');
      expect(result.text).toContain('[REDACTED]');
    });
  });

  describe('hasSensitiveData', () => {
    it('should return true when sensitive data exists', () => {
      const text = 'SSN: 123-45-6789';
      expect(sensitiveDataService.hasSensitiveData(text)).toBe(true);
    });

    it('should return false when no sensitive data exists', () => {
      const text = 'This is a normal email';
      expect(sensitiveDataService.hasSensitiveData(text)).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(sensitiveDataService.hasSensitiveData('')).toBe(false);
    });
  });

  describe('getSensitiveDataStats', () => {
    it('should return empty object for clean text', () => {
      const text = 'No sensitive data here';
      const stats = sensitiveDataService.getSensitiveDataStats(text);

      expect(stats).toEqual({});
    });

    it('should count sensitive data by type', () => {
      const text = `
        Card 1: 4111-1111-1111-1111
        Card 2: 5425-2334-3010-9903
        SSN: 123-45-6789
      `;
      const stats = sensitiveDataService.getSensitiveDataStats(text);

      expect(stats.credit_cards).toBeGreaterThanOrEqual(1); // At least one valid card
      expect(stats.ssn).toBe(1);
    });

    it('should handle multiple types', () => {
      const text = `
        Password: secret123
        pwd: another456
        SSN: 123-45-6789
      `;
      const stats = sensitiveDataService.getSensitiveDataStats(text);

      expect(Object.keys(stats).length).toBeGreaterThanOrEqual(2);
      expect(stats.passwords).toBeGreaterThanOrEqual(1);
    });
  });
});
