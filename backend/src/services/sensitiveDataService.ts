/**
 * SensitiveDataService detects and redacts sensitive information from text
 * Patterns include: credit cards, SSN, passwords, API keys, etc.
 */

interface SensitiveDataMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

interface RedactionResult {
  text: string;
  redactedFields: Record<string, number>;
  hasSensitiveData: boolean;
}

interface PatternConfig {
  pattern: RegExp;
  name: string;
  contextRequired?: boolean;
  contextKeywords?: string[];
}

class SensitiveDataService {
  // Regular expression patterns for sensitive data
  private patterns: Record<string, PatternConfig> = {
    // Credit card numbers (various formats, with or without spaces/dashes)
    creditCard: {
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      name: 'credit_cards'
    },

    // US Social Security Numbers (XXX-XX-XXXX)
    ssn: {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      name: 'ssn'
    },

    // API keys (common formats)
    apiKey: {
      pattern: /\b[A-Za-z0-9_-]{32,}\b/g,
      name: 'api_keys',
      // Only match if it looks like an API key (has certain keywords nearby)
      contextRequired: true,
      contextKeywords: ['api', 'key', 'token', 'secret', 'auth', 'bearer']
    },

    // AWS Access Keys
    awsAccessKey: {
      pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
      name: 'aws_keys'
    },

    // Common password patterns in text
    password: {
      pattern: /(?:password|passwd|pwd)[\s:=]+[^\s]{6,}/gi,
      name: 'passwords'
    },

    // Email with password pattern (e.g., "email: x@y.com password: xxxxx")
    emailPassword: {
      pattern: /(?:email|username)[\s:=]+\S+@\S+\s+(?:password|passwd|pwd)[\s:=]+[^\s]{6,}/gi,
      name: 'credentials'
    },

    // Private keys (PEM format)
    privateKey: {
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      name: 'private_keys'
    },

    // OAuth tokens (look for Bearer tokens)
    bearerToken: {
      pattern: /Bearer\s+[A-Za-z0-9_\-.]{20,}/gi,
      name: 'bearer_tokens'
    },

    // Credit card CVV (3 or 4 digits, with context)
    cvv: {
      pattern: /\b\d{3,4}\b/g,
      name: 'cvv',
      contextRequired: true,
      contextKeywords: ['cvv', 'cvc', 'security code', 'card verification']
    }
  };

  /**
   * Detects sensitive data in text
   * @param text - The text to scan
   * @returns Array of detected sensitive data matches
   */
  detectSensitiveData(text: string): SensitiveDataMatch[] {
    if (!text) return [];

    const matches: SensitiveDataMatch[] = [];
    const lowerText = text.toLowerCase();

    for (const [key, config] of Object.entries(this.patterns)) {
      const pattern = new RegExp(config.pattern.source, config.pattern.flags);
      let match;

      while ((match = pattern.exec(text)) !== null) {
        // If context is required, check for keywords nearby
        if (config.contextRequired && config.contextKeywords) {
          const contextWindow = 50; // characters before/after
          const start = Math.max(0, match.index - contextWindow);
          const end = Math.min(text.length, match.index + match[0].length + contextWindow);
          const context = lowerText.slice(start, end);

          const hasContext = config.contextKeywords.some(keyword =>
            context.includes(keyword.toLowerCase())
          );

          if (!hasContext) continue;
        }

        // Special validation for credit cards (Luhn algorithm)
        if (key === 'creditCard') {
          const cardNumber = match[0].replace(/[-\s]/g, '');
          if (!this.isValidCreditCard(cardNumber)) continue;
        }

        matches.push({
          type: config.name,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    return matches;
  }

  /**
   * Redacts sensitive data from text
   * @param text - The text to redact
   * @param replacement - Replacement string (default: '[REDACTED]')
   * @returns Redaction result with redacted text and statistics
   */
  redactSensitiveData(text: string, replacement: string = '[REDACTED]'): RedactionResult {
    if (!text) {
      return {
        text: '',
        redactedFields: {},
        hasSensitiveData: false
      };
    }

    const matches = this.detectSensitiveData(text);

    if (matches.length === 0) {
      return {
        text,
        redactedFields: {},
        hasSensitiveData: false
      };
    }

    // Sort matches by position (descending) to replace from end to start
    matches.sort((a, b) => b.start - a.start);

    let redactedText = text;
    const redactedFields: Record<string, number> = {};

    for (const match of matches) {
      // Count occurrences by type
      redactedFields[match.type] = (redactedFields[match.type] || 0) + 1;

      // Replace the sensitive data
      redactedText =
        redactedText.slice(0, match.start) +
        replacement +
        redactedText.slice(match.end);
    }

    return {
      text: redactedText,
      redactedFields,
      hasSensitiveData: true
    };
  }

  /**
   * Validates a credit card number using Luhn algorithm
   * @param cardNumber - The card number to validate (digits only)
   * @returns True if valid
   */
  private isValidCreditCard(cardNumber: string): boolean {
    // Remove any non-digit characters
    const digits = cardNumber.replace(/\D/g, '');

    // Credit cards are typically 13-19 digits
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Checks if text contains sensitive data
   * @param text - The text to check
   * @returns True if sensitive data is detected
   */
  hasSensitiveData(text: string): boolean {
    return this.detectSensitiveData(text).length > 0;
  }

  /**
   * Gets statistics about detected sensitive data
   * @param text - The text to analyze
   * @returns Object with counts by type
   */
  getSensitiveDataStats(text: string): Record<string, number> {
    const matches = this.detectSensitiveData(text);
    const stats: Record<string, number> = {};

    for (const match of matches) {
      stats[match.type] = (stats[match.type] || 0) + 1;
    }

    return stats;
  }
}

// Export singleton instance
export default new SensitiveDataService();
