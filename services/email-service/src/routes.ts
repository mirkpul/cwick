import express, { Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { ApiResponse } from '@virtualcoach/shared-types';
import { config } from './config';
import { logger } from './logger';
import emailAuthService from './emailAuthService';
import emailSyncService from './emailSyncService';
import emailEmbeddingService from './emailEmbeddingService';
import imapConnector from './imapConnector';
import { db } from './db';

function requireUserId(req: Request, res: Response<ApiResponse>): string | null {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ success: false, error: 'x-user-id header required' });
    return null;
  }
  return userId;
}

function getCallbackParams(req: Request): { code?: string; state?: string } {
  const queryCode = typeof req.query.code === 'string' ? req.query.code : undefined;
  const queryState = typeof req.query.state === 'string' ? req.query.state : undefined;
  const bodyCode = typeof req.body?.code === 'string' ? req.body.code : undefined;
  const bodyState = typeof req.body?.state === 'string' ? req.body.state : undefined;
  return {
    code: queryCode || bodyCode,
    state: queryState || bodyState,
  };
}

export function buildRouter() {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use(limiter as unknown as RequestHandler);
  router.use(express.json({ limit: '2mb' }));

  router.get('/health', (_req, res: Response<ApiResponse>) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'email-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.get('/email/auth/gmail', async (req: Request, res: Response<ApiResponse<{ authUrl: string }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const authUrl = emailAuthService.getGmailAuthUrl(userId);
      return res.status(200).json({ success: true, data: { authUrl } });
    } catch (error) {
      logger.error('Get Gmail auth URL failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to generate Gmail authorization URL' });
    }
  });

  const handleGmailCallback = async (req: Request, res: Response<ApiResponse<{ userId: string; credentialId: string }>>) => {
    try {
      const { code, state } = getCallbackParams(req);
      if (!code || !state) {
        return res.status(400).json({ success: false, error: 'Missing code or state' });
      }
      const result = await emailAuthService.handleGmailCallback(code, state);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Gmail OAuth callback failed', { error });
      return res.status(500).json({ success: false, error: 'Gmail OAuth failed' });
    }
  };

  router.get('/email/auth/gmail/callback', handleGmailCallback);
  router.post('/email/auth/gmail/callback', handleGmailCallback);

  router.get('/email/auth/outlook', async (req: Request, res: Response<ApiResponse<{ authUrl: string }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const authUrl = emailAuthService.getOutlookAuthUrl(userId);
      return res.status(200).json({ success: true, data: { authUrl } });
    } catch (error) {
      logger.error('Get Outlook auth URL failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to generate Outlook authorization URL' });
    }
  });

  const handleOutlookCallback = async (req: Request, res: Response<ApiResponse<{ userId: string; credentialId: string }>>) => {
    try {
      const { code, state } = getCallbackParams(req);
      if (!code || !state) {
        return res.status(400).json({ success: false, error: 'Missing code or state' });
      }
      const result = await emailAuthService.handleOutlookCallback(code, state);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Outlook OAuth callback failed', { error });
      return res.status(500).json({ success: false, error: 'Outlook OAuth failed' });
    }
  };

  router.get('/email/auth/outlook/callback', handleOutlookCallback);
  router.post('/email/auth/outlook/callback', handleOutlookCallback);

  router.post('/email/auth/imap', async (req: Request, res: Response<ApiResponse<{ credentialId: string }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { emailAddress, host, port, password } = req.body as {
        emailAddress?: string;
        host?: string;
        port?: string | number;
        password?: string;
      };
      if (!emailAddress || !host || !port || !password) {
        return res.status(400).json({ success: false, error: 'Missing required fields: emailAddress, host, port, password' });
      }
      const imapConfig = {
        host,
        port: typeof port === 'string' ? parseInt(port, 10) : port,
        user: emailAddress,
        password,
        tls: true,
      };
      await imapConnector.testConnection(imapConfig);
      const credentialId = await emailAuthService.storeImapCredentials(userId, emailAddress, imapConfig);
      return res.status(200).json({ success: true, data: { credentialId } });
    } catch (error) {
      logger.error('Store IMAP credentials failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to store IMAP credentials' });
    }
  });

  router.post('/email/sync', async (req: Request, res: Response<ApiResponse<{ syncType: string }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { credentialId, type = 'incremental' } = req.body as { credentialId?: string; type?: string };
      let cred = credentialId;
      if (!cred) {
        const credentials = await emailAuthService.getCredentials(userId);
        if (!credentials) {
          return res.status(404).json({ success: false, error: 'No email account connected' });
        }
        cred = credentials.id;
      }

      const syncPromise = type === 'initial'
        ? emailSyncService.performInitialSync(userId, cred)
        : emailSyncService.performIncrementalSync(userId, cred);

      res.status(200).json({
        success: true,
        data: { syncType: type },
      });

      syncPromise
        .then(async (result) => {
          logger.info(`Email sync completed for user ${userId}`, { result });
          await emailEmbeddingService.generateEmbeddingsForUser(userId, 20);
        })
        .catch((error) => {
          logger.error(`Email sync failed for user ${userId}`, { error });
        });
    } catch (error) {
      logger.error('Trigger email sync failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to trigger email sync' });
    }
  });

  router.get('/email/sync/status', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const credentials = await emailAuthService.getCredentials(userId);
      if (!credentials) {
        return res.status(200).json({
          success: true,
          data: {
            connected: false,
            message: 'No email account connected',
          },
        });
      }
      const syncStats = await emailSyncService.getSyncStats(credentials.id);
      const embeddingStats = await emailEmbeddingService.getStats(userId);
      return res.status(200).json({
        success: true,
        data: {
          connected: true,
          provider: credentials.provider,
          emailAddress: credentials.emailAddress,
          autoSyncEnabled: credentials.autoSyncEnabled,
          lastSyncAt: credentials.lastSyncAt,
          syncStats,
          embeddingStats,
        },
      });
    } catch (error) {
      logger.error('Get sync status failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to get sync status' });
    }
  });

  router.put('/email/auto-sync', async (req: Request, res: Response<ApiResponse<{ autoSyncEnabled: boolean }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { enabled } = req.body as { enabled?: boolean };
      await db.pool.query(
        `UPDATE email_credentials
         SET auto_sync_enabled = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [enabled, userId]
      );
      return res.status(200).json({ success: true, data: { autoSyncEnabled: Boolean(enabled) } });
    } catch (error) {
      logger.error('Toggle auto-sync failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to toggle auto-sync' });
    }
  });

  router.get('/email/list', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { limit = '50', offset = '0', search } = req.query as {
        limit?: string;
        offset?: string;
        search?: string;
      };

      let countQuery = `SELECT COUNT(*) FROM email_knowledge WHERE user_id = $1`;
      const countParams: (string | number)[] = [userId];

      if (search) {
        countQuery += ` AND (subject ILIKE $2 OR body_text ILIKE $2)`;
        countParams.push(`%${search}%`);
      }

      const countResult = await db.pool.query<{ count: string }>(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      let query = `
        SELECT id, subject, sender_email AS "senderEmail", sender_name AS "senderName",
               sent_at AS "receivedAt", sent_at,
               is_important AS "isImportant", is_starred AS "isStarred",
               has_attachments AS "hasAttachments", labels,
               body_text AS "textContent", body_html AS "htmlContent",
               recipients,
               false AS "isRead"
        FROM email_knowledge
        WHERE user_id = $1
      `;
      const params: (string | number)[] = [userId];

      if (search) {
        query += ` AND (subject ILIKE $${params.length + 1} OR body_text ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await db.pool.query(query, params);

      interface EmailRow {
        senderName?: string;
        senderEmail?: string;
        recipients?: Array<{ email: string }>;
        textContent?: string;
        [key: string]: unknown;
      }

      const emails = result.rows.map((email: EmailRow) => ({
        ...email,
        sender: email.senderName || email.senderEmail,
        recipient: email.recipients && email.recipients.length > 0
          ? email.recipients[0].email
          : null,
        snippet: email.textContent ? email.textContent.substring(0, 200) : null,
      }));

      return res.status(200).json({
        success: true,
        data: {
          emails,
          pagination: {
            total,
            totalPages: Math.ceil(total / parseInt(limit, 10)),
            page: Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1,
            limit: parseInt(limit, 10),
          },
        },
      });
    } catch (error) {
      logger.error('List emails failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to list emails' });
    }
  });

  router.delete('/email/:id', async (req: Request, res: Response<ApiResponse<{ success: boolean }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { id } = req.params;
      await emailSyncService.deleteEmail(userId, id);
      return res.status(200).json({ success: true, data: { success: true } });
    } catch (error) {
      logger.error('Delete email failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to delete email' });
    }
  });

  router.delete('/email/disconnect', async (req: Request, res: Response<ApiResponse<{ success: boolean }>>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const credentials = await emailAuthService.getCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ success: false, error: 'No email account connected' });
      }
      await emailAuthService.deleteCredentials(userId, credentials.id);
      return res.status(200).json({ success: true, data: { success: true } });
    } catch (error) {
      logger.error('Disconnect email failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to disconnect email account' });
    }
  });

  router.post('/email/search', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { query, limit = 5, threshold = 0.7 } = req.body as {
        query?: string;
        limit?: number;
        threshold?: number;
      };
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
      }
      const results = await emailEmbeddingService.semanticSearch(userId, query, {
        limit: parseInt(String(limit), 10),
        threshold: parseFloat(String(threshold)),
      });
      return res.status(200).json({ success: true, data: { results } });
    } catch (error) {
      logger.error('Email semantic search failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to search emails' });
    }
  });

  return router;
}
