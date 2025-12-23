import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { convert } from 'html-to-text';
import sensitiveDataService from './sensitiveDataService';

/**
 * Represents a parsed email with extracted data
 */
export interface ParsedEmail {
  messageId: string;
  threadId?: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  recipients: Array<{ email: string; name?: string }>;
  ccRecipients: Array<{ email: string; name?: string }>;
  sentAt: Date;
  bodyText: string;
  bodyHtml?: string;
  isReply: boolean;
  inReplyTo?: string;
  hasAttachments: boolean;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }>;
  labels: string[];
  isImportant: boolean;
  isStarred: boolean;
}

/**
 * Represents the result of email processing with sensitive data handling
 */
export interface ProcessedEmail extends ParsedEmail {
  hasSensitiveData: boolean;
  redactedFields: Record<string, number>;
  sanitizedBodyText: string;
}

/**
 * EmailParserService handles parsing and processing of email messages
 */
class EmailParserService {
  /**
   * Parses raw email data (RFC822 format)
   * @param rawEmail - Raw email content in RFC822/MIME format
   * @returns Parsed email object
   */
  async parseRawEmail(rawEmail: string | Buffer): Promise<ParsedEmail> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail);

      // Extract recipients
      const recipients = this.extractAddresses(parsed.to);
      const ccRecipients = this.extractAddresses(parsed.cc);

      // Extract sender
      const senderAddress = Array.isArray(parsed.from)
        ? parsed.from[0]
        : parsed.from;

      const senderEmail = senderAddress?.address || '';
      const senderName = senderAddress?.name;

      // Convert HTML to text if needed
      let bodyText = parsed.text || '';
      if (!bodyText && parsed.html) {
        bodyText = this.htmlToText(parsed.html);
      }

      // Extract message IDs
      const messageId = parsed.messageId || this.generateMessageId();
      const inReplyTo = parsed.inReplyTo;
      const isReply = !!inReplyTo || this.detectReplyFromSubject(parsed.subject || '');

      // Process attachments
      const attachments = this.processAttachments(parsed.attachments || []);

      return {
        messageId,
        threadId: this.extractThreadId(parsed),
        subject: parsed.subject || '(No Subject)',
        senderEmail,
        senderName,
        recipients,
        ccRecipients,
        sentAt: parsed.date || new Date(),
        bodyText,
        bodyHtml: parsed.html || undefined,
        isReply,
        inReplyTo,
        hasAttachments: attachments.length > 0,
        attachments,
        labels: [],
        isImportant: false,
        isStarred: false
      };
    } catch (error) {
      throw new Error(
        `Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Processes a parsed email to detect and redact sensitive data
   * @param parsedEmail - The parsed email
   * @returns Processed email with sensitive data handling
   */
  processEmail(parsedEmail: ParsedEmail): ProcessedEmail {
    // Scan for sensitive data
    const redactionResult = sensitiveDataService.redactSensitiveData(parsedEmail.bodyText);

    return {
      ...parsedEmail,
      hasSensitiveData: redactionResult.hasSensitiveData,
      redactedFields: redactionResult.redactedFields,
      sanitizedBodyText: redactionResult.text
    };
  }

  /**
   * Converts HTML content to plain text
   * @param html - HTML string
   * @returns Plain text string
   */
  private htmlToText(html: string): string {
    return convert(html, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'table', options: { uppercaseHeaderCells: false } }
      ]
    });
  }

  /**
   * Extracts email addresses from parsed address objects
   * @param addresses - Address object(s) from mailparser
   * @returns Array of email/name pairs
   */
  private extractAddresses(
    addresses: ParsedMail['from'] | ParsedMail['to'] | ParsedMail['cc'] | ParsedMail['bcc']
  ): Array<{ email: string; name?: string }> {
    if (!addresses) return [];

    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    const result: Array<{ email: string; name?: string }> = [];

    for (const addr of addressArray) {
      if ('value' in addr && addr.value) {
        // AddressObject with value array
        for (const emailAddr of addr.value) {
          if (emailAddr.address) {
            result.push({
              email: emailAddr.address,
              name: emailAddr.name || undefined
            });
          }
        }
      } else if ('address' in addr && typeof addr.address === 'string') {
        // Direct EmailAddress
        result.push({
          email: addr.address,
          name: ('name' in addr && typeof addr.name === 'string') ? addr.name : undefined
        });
      }
    }

    return result;
  }

  /**
   * Extracts thread ID from email headers
   * @param parsed - Parsed mail object
   * @returns Thread ID if available
   */
  private extractThreadId(parsed: ParsedMail): string | undefined {
    // Try to get thread ID from headers
    // Gmail uses X-GM-THRID, others might use References or In-Reply-To
    const headers = parsed.headers as Map<string, string | string[]>;

    if (headers.has('x-gm-thrid')) {
      const value = headers.get('x-gm-thrid');
      return Array.isArray(value) ? value[0] : value;
    }

    // Fallback: use References or In-Reply-To to group threads
    const references = headers.get('references');
    if (references) {
      // Use the first message ID in the references chain
      const refs = Array.isArray(references) ? references : [references];
      return refs[0];
    }

    return parsed.inReplyTo || undefined;
  }

  /**
   * Detects if an email is a reply based on subject line
   * @param subject - Email subject
   * @returns True if subject indicates a reply
   */
  private detectReplyFromSubject(subject: string): boolean {
    const replyPrefixes = ['re:', 'fwd:', 'fw:', 'aw:'];
    const lowerSubject = subject.toLowerCase().trim();
    return replyPrefixes.some(prefix => lowerSubject.startsWith(prefix));
  }

  /**
   * Processes email attachments
   * @param attachments - Array of attachments from mailparser
   * @returns Processed attachments
   */
  private processAttachments(attachments: Attachment[]): Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }> {
    return attachments
      .filter(att => !att.contentDisposition || att.contentDisposition === 'attachment')
      .map(att => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType,
        size: att.size,
        content: att.content
      }));
  }

  /**
   * Generates a unique message ID
   * @returns Generated message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `<${timestamp}.${random}@virtualcoach>`;
  }

  /**
   * Extracts attachment content as text (for PDF, TXT files)
   * @param attachment - Attachment object
   * @returns Extracted text or null
   */
  async extractAttachmentText(attachment: {
    filename: string;
    contentType: string;
    content?: Buffer;
  }): Promise<string | null> {
    if (!attachment.content) return null;

    // Handle text files
    if (attachment.contentType.includes('text/plain')) {
      return attachment.content.toString('utf-8');
    }

    // For PDF, would need pdf-parse library
    // For now, return null for non-text files
    // TODO: Implement PDF text extraction
    if (attachment.contentType.includes('application/pdf')) {
      // Would use pdf-parse here
      return null;
    }

    return null;
  }

  /**
   * Combines email body and attachments text for indexing
   * @param processedEmail - Processed email object
   * @returns Combined text for knowledge base
   */
  async createKnowledgeBaseText(processedEmail: ProcessedEmail): Promise<string> {
    let combinedText = `Subject: ${processedEmail.subject}\n\n`;
    combinedText += `From: ${processedEmail.senderName || processedEmail.senderEmail}\n`;
    combinedText += `Date: ${processedEmail.sentAt.toISOString()}\n\n`;
    combinedText += processedEmail.sanitizedBodyText;

    // Add attachment content for supported file types
    if (processedEmail.hasAttachments) {
      for (const attachment of processedEmail.attachments) {
        const attachmentText = await this.extractAttachmentText(attachment);
        if (attachmentText) {
          combinedText += `\n\n--- Attachment: ${attachment.filename} ---\n`;
          combinedText += attachmentText;
        }
      }
    }

    return combinedText;
  }
}

// Export singleton instance
export default new EmailParserService();
