import logger from '../config/logger';

/**
 * Document Preprocessing Service
 *
 * Cleans and normalizes document content before chunking and embedding.
 *
 * Processing steps:
 * 1. Remove excessive whitespace
 * 2. Normalize line breaks
 * 3. Remove special characters (optional)
 * 4. Trim and deduplicate
 */
class DocumentPreprocessingService {
  /**
   * Preprocess document content
   */
  preprocessDocument(content: string, options: {
    removeSpecialChars?: boolean;
    normalizeWhitespace?: boolean;
    removeUrls?: boolean;
    removeEmails?: boolean;
  } = {}): string {
    const {
      removeSpecialChars = false,
      normalizeWhitespace = true,
      removeUrls = false,
      removeEmails = false,
    } = options;

    let processed = content;

    // Remove URLs if requested
    if (removeUrls) {
      processed = this.removeUrls(processed);
    }

    // Remove email addresses if requested
    if (removeEmails) {
      processed = this.removeEmailAddresses(processed);
    }

    // Normalize whitespace
    if (normalizeWhitespace) {
      processed = this.normalizeWhitespace(processed);
    }

    // Remove special characters if requested
    if (removeSpecialChars) {
      processed = this.removeSpecialCharacters(processed);
    }

    // Final trim
    processed = processed.trim();

    logger.debug('Document preprocessed', {
      originalLength: content.length,
      processedLength: processed.length,
      reductionPercent: ((1 - processed.length / content.length) * 100).toFixed(2),
    });

    return processed;
  }

  /**
   * Normalize whitespace
   */
  normalizeWhitespace(text: string): string {
    // Replace multiple spaces with single space
    let normalized = text.replace(/[ \t]+/g, ' ');

    // Replace multiple newlines with double newline (paragraph breaks)
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // Remove spaces at start/end of lines
    normalized = normalized.replace(/^[ \t]+|[ \t]+$/gm, '');

    return normalized;
  }

  /**
   * Remove URLs
   */
  removeUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/g, '');
  }

  /**
   * Remove email addresses
   */
  removeEmailAddresses(text: string): string {
    return text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
  }

  /**
   * Remove special characters (keep alphanumeric, basic punctuation, and newlines)
   */
  removeSpecialCharacters(text: string): string {
    // Keep: letters, numbers, spaces, newlines, basic punctuation (.,!?;:-)
    return text.replace(/[^a-zA-Z0-9\s\n.,!?;:\-()'"]/g, '');
  }

  /**
   * Extract text from HTML
   */
  extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Normalize whitespace
    text = this.normalizeWhitespace(text);

    return text.trim();
  }

  /**
   * Decode common HTML entities
   */
  decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
    };

    return text.replace(/&[a-z]+;|&#\d+;/gi, match => entities[match.toLowerCase()] || match);
  }

  /**
   * Clean email content (remove signatures, disclaimers, etc.)
   */
  cleanEmailContent(content: string): string {
    // Remove common email signatures
    let cleaned = content.replace(/^--\s*$/m, '');

    // Remove "On ... wrote:" blocks (common in email threads)
    cleaned = cleaned.replace(/On .+ wrote:[\s\S]*$/m, '');

    // Remove forwarded message headers
    cleaned = cleaned.replace(/^-+ Forwarded message -+[\s\S]*?^(From|To|Subject|Date):.+$/gm, '');

    // Remove reply headers
    cleaned = cleaned.replace(/^>+\s*.*/gm, '');

    // Normalize whitespace
    cleaned = this.normalizeWhitespace(cleaned);

    return cleaned.trim();
  }

  /**
   * Clean text - alias for normalizeWhitespace with trimming
   */
  cleanText(text: string): string {
    if (!text) return '';
    // Normalize line breaks
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Replace multiple spaces with single space  
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Replace multiple newlines with double newline
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  }

  /**
   * Remove email headers from text
   */
  removeEmailHeaders(text: string): string {
    const headerPatterns = [
      /^From:.*$/gm,
      /^To:.*$/gm,
      /^Subject:.*$/gm,
      /^Date:.*$/gm,
      /^Reply-To:.*$/gm,
      /^CC:.*$/gm,
      /^BCC:.*$/gm,
    ];
    let cleaned = text;
    for (const pattern of headerPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned.trim();
  }

  /**
   * Remove email footers from text
   */
  removeEmailFooters(text: string): string {
    // Remove signature separator and everything after
    let cleaned = text.replace(/^--\s*[\s\S]*$/m, '');
    // Remove common footer patterns
    cleaned = cleaned.replace(/Sent from my.*$/gm, '');
    cleaned = cleaned.replace(/To unsubscribe.*$/gm, '');
    return cleaned.trim();
  }

  /**
   * Remove or normalize URLs - alias for removeUrls
   */
  removeOrNormalizeUrls(text: string): string {
    return this.removeUrls(text);
  }

  /**
   * Truncate text to maximum length
   */
  truncateToMaxLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Extract metadata from email text
   */
  extractMetadata(text: string): {
    from: string | null;
    to: string | null;
    subject: string | null;
    date: string | null;
  } {
    const fromMatch = text.match(/^From:\s*(.*)$/m);
    const toMatch = text.match(/^To:\s*(.*)$/m);
    const subjectMatch = text.match(/^Subject:\s*(.*)$/m);
    const dateMatch = text.match(/^Date:\s*(.*)$/m);

    return {
      from: fromMatch ? fromMatch[1].trim() : null,
      to: toMatch ? toMatch[1].trim() : null,
      subject: subjectMatch ? subjectMatch[1].trim() : null,
      date: dateMatch ? dateMatch[1].trim() : null,
    };
  }

  /**
   * Create enhanced text from content and metadata
   */
  createEnhancedText(text: string, metadata: {
    from?: string | null;
    to?: string | null;
    subject?: string | null;
    date?: string | null;
  }): string {
    const parts: string[] = [];

    if (metadata.subject) {
      parts.push(`Subject: ${metadata.subject}`);
    }
    if (metadata.from) {
      parts.push(`From: ${metadata.from}`);
    }
    if (metadata.to) {
      parts.push(`To: ${metadata.to}`);
    }
    if (metadata.date) {
      parts.push(`Date: ${metadata.date}`);
    }

    if (parts.length > 0) {
      return parts.join('\n') + '\n\n' + text;
    }
    return text;
  }
}

export default new DocumentPreprocessingService();

