import Imap from 'imap';
import { ImapCredentials } from './emailAuthService';

/**
 * IMAP message
 */
export interface ImapMessage {
  id: string;
  uid: number;
  rawEmail: string;
  flags: string[];
  date: Date;
}

/**
 * IMAP sync options
 */
export interface ImapSyncOptions {
  maxResults?: number;
  monthsBack?: number;
  sinceDate?: Date;
}

/**
 * ImapConnector handles interaction with IMAP servers
 */
class ImapConnector {
  /**
   * Lists messages from IMAP inbox
   * @param credentials - IMAP credentials
   * @param options - Sync options
   * @returns Array of IMAP messages
   */
  async listMessages(
    credentials: ImapCredentials,
    options: ImapSyncOptions = {}
  ): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: credentials.user,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        tls: credentials.tls,
        tlsOptions: { rejectUnauthorized: false }
      });

      // Note: messages and processedCount reserved for future use
      // const messages: ImapMessage[] = [];
      // const processedCount = 0;
      const maxResults = options.maxResults || 100;

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: Error, _box: Imap.Box) => {
          if (err) {
            imap.end();
            return reject(new Error(`Failed to open INBOX: ${err.message}`));
          }

          // Build search criteria
          const searchCriteria: (string | string[])[] = ['UNSEEN']; // Start with unread, then expand

          if (options.sinceDate) {
            searchCriteria.push(['SINCE', options.sinceDate.toISOString().split('T')[0]]);
          } else if (options.monthsBack) {
            const dateFrom = new Date();
            dateFrom.setMonth(dateFrom.getMonth() - options.monthsBack);
            searchCriteria.push(['SINCE', dateFrom.toISOString().split('T')[0]]);
          }

          // If no results with UNSEEN, try ALL
          this.searchAndFetch(imap, searchCriteria, maxResults)
            .then((msgs) => {
              if (msgs.length === 0) {
                // Try with ALL messages if UNSEEN returned nothing
                return this.searchAndFetch(imap, ['ALL'], maxResults);
              }
              return msgs;
            })
            .then((msgs) => {
              resolve(msgs);
              imap.end();
            })
            .catch((error) => {
              imap.end();
              reject(error);
            });
        });
      });

      imap.once('error', (err: Error) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.once('end', () => {
        // Connection ended
      });

      imap.connect();
    });
  }

  /**
   * Searches and fetches messages from IMAP
   * @param imap - IMAP connection
   * @param criteria - Search criteria
   * @param limit - Maximum results
   * @returns Promise of messages
   */
  private searchAndFetch(
    imap: Imap,
    criteria: (string | string[])[],
    limit: number
  ): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      imap.search(criteria, (err, results) => {
        if (err) {
          return reject(new Error(`IMAP search failed: ${err.message}`));
        }

        if (!results || results.length === 0) {
          return resolve([]);
        }

        // Limit results
        const uids = results.slice(0, limit);
        const messages: ImapMessage[] = [];

        const fetch = imap.fetch(uids, {
          bodies: '',
          struct: true
        });

        fetch.on('message', (msg, _seqno) => {
          let buffer = '';
          let uid = 0;
          let flags: string[] = [];
          let date = new Date();

          msg.on('body', (stream, _info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs) => {
            uid = attrs.uid;
            flags = attrs.flags || [];
            date = attrs.date || new Date();
          });

          msg.once('end', () => {
            messages.push({
              id: `imap-${uid}`,
              uid,
              rawEmail: buffer,
              flags,
              date
            });
          });
        });

        fetch.once('error', (err) => {
          reject(new Error(`IMAP fetch failed: ${err.message}`));
        });

        fetch.once('end', () => {
          resolve(messages);
        });
      });
    });
  }

  /**
   * Gets messages since a specific date
   * @param credentials - IMAP credentials
   * @param since - Date to fetch from
   * @param maxResults - Maximum results
   * @returns Array of messages
   */
  async getMessagesSince(
    credentials: ImapCredentials,
    since: Date,
    maxResults: number = 100
  ): Promise<ImapMessage[]> {
    return this.listMessages(credentials, {
      sinceDate: since,
      maxResults
    });
  }

  /**
   * Tests IMAP connection
   * @param credentials - IMAP credentials
   * @returns True if connection successful
   */
  async testConnection(credentials: ImapCredentials): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: credentials.user,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        tls: credentials.tls,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000 // 10 second timeout
      });

      let connected = false;

      imap.once('ready', () => {
        connected = true;
        imap.end();
      });

      imap.once('error', (err: Error) => {
        if (!connected) {
          reject(new Error(`IMAP connection test failed: ${err.message}`));
        }
      });

      imap.once('end', () => {
        if (connected) {
          resolve(true);
        }
      });

      try {
        imap.connect();
      } catch (err) {
        reject(
          new Error(
            `IMAP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Parses IMAP flags
   * @param flags - IMAP flags array
   * @returns Parsed flags
   */
  parseFlags(flags: string[]): { isImportant: boolean; isStarred: boolean } {
    return {
      isImportant: flags.includes('\\Flagged'),
      isStarred: flags.includes('\\Flagged')
    };
  }

  /**
   * Gets inbox statistics
   * @param credentials - IMAP credentials
   * @returns Inbox stats
   */
  async getInboxStats(credentials: ImapCredentials): Promise<{
    total: number;
    unseen: number;
  }> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: credentials.user,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        tls: credentials.tls,
        tlsOptions: { rejectUnauthorized: false }
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: Error, box: Imap.Box) => {
          if (err) {
            imap.end();
            return reject(new Error(`Failed to open INBOX: ${err.message}`));
          }

          const stats = {
            total: box.messages.total,
            unseen: box.messages.unseen
          };

          imap.end();
          resolve(stats);
        });
      });

      imap.once('error', (err: Error) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }
}

// Export singleton instance
export default new ImapConnector();
