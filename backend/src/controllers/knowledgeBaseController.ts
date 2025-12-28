import { Response, NextFunction } from 'express';
import knowledgeBaseService from '../services/knowledgeBaseService';
import contextService from '../services/contextService';
import fileProcessingService from '../services/fileProcessingService';
import documentProcessingService from '../services/documentProcessingService';
import llmService from '../services/llmService';
import db from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

interface RAGConfigInput {
  knowledgeBaseThreshold?: number | string;
  emailThreshold?: number | string;
  vectorWeight?: number | string;
  bm25Weight?: number | string;
  diversityThreshold?: number | string;
  mmrLambda?: number | string;
  maxBoost?: number | string;
  minBoostThreshold?: number | string;
  maxEmailRatio?: number | string;
  maxKBRatio?: number | string;
  maxResults?: number | string;
  decayHalfLifeDays?: number | string;
  fusionMethod?: string;
}

/**
 * Validate RAG configuration values
 * @param config - RAG config to validate
 * @returns Array of validation errors (empty if valid)
 */
function validateRAGConfig(config: RAGConfigInput): string[] {
  const errors: string[] = [];

  // Validate thresholds (0-1 range)
  const thresholdFields: (keyof RAGConfigInput)[] = ['knowledgeBaseThreshold', 'emailThreshold', 'vectorWeight', 'bm25Weight',
    'diversityThreshold', 'mmrLambda', 'maxBoost', 'minBoostThreshold', 'maxEmailRatio', 'maxKBRatio'];

  for (const field of thresholdFields) {
    if (config[field] !== undefined) {
      const value = parseFloat(String(config[field]));
      if (isNaN(value) || value < 0 || value > 1) {
        errors.push(`${field} must be between 0 and 1`);
      }
    }
  }

  // Validate weights sum to 1
  if (config.vectorWeight !== undefined && config.bm25Weight !== undefined) {
    const sum = parseFloat(String(config.vectorWeight)) + parseFloat(String(config.bm25Weight));
    if (Math.abs(sum - 1.0) > 0.01) {
      errors.push('vectorWeight + bm25Weight must equal 1.0');
    }
  }

  // Validate maxResults (1-10)
  if (config.maxResults !== undefined) {
    const value = parseInt(String(config.maxResults));
    if (isNaN(value) || value < 1 || value > 10) {
      errors.push('maxResults must be between 1 and 10');
    }
  }

  // Validate decayHalfLifeDays (positive integer)
  if (config.decayHalfLifeDays !== undefined) {
    const value = parseInt(String(config.decayHalfLifeDays));
    if (isNaN(value) || value < 1) {
      errors.push('decayHalfLifeDays must be a positive integer');
    }
  }

  // Validate fusionMethod
  if (config.fusionMethod !== undefined) {
    if (!['weighted', 'rrf'].includes(config.fusionMethod)) {
      errors.push('fusionMethod must be "weighted" or "rrf"');
    }
  }

  return errors;
}

class KnowledgeBaseController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const kbData = req.body;

      // Check if user already has a knowledge base
      const existingKB = await knowledgeBaseService.getKnowledgeBaseByUserId(userId);
      if (existingKB) {
        res.status(409).json({
          error: 'Knowledge base already exists for this user',
          knowledgeBase: existingKB
        });
        return;
      }

      const kb = await knowledgeBaseService.createKnowledgeBase(userId, kbData);

      res.status(201).json({
        message: 'Knowledge base created successfully',
        knowledgeBase: kb,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyKB(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(userId);

      if (!kb) {
        res.status(404).json({ error: 'Knowledge base not found' });
        return;
      }

      res.json({ knowledgeBase: kb });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { kbId } = req.params;
      const updates = req.body;

      const kb = await knowledgeBaseService.updateKnowledgeBase(kbId, userId, updates);

      res.json({
        message: 'Knowledge base updated successfully',
        knowledgeBase: kb,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found') || (error as Error).message.includes('unauthorized')) {
        res.status(404).json({ error: (error as Error).message });
        return;
      }
      next(error);
    }
  }

  async addKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const entry = req.body;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const knowledge = await knowledgeBaseService.addKnowledgeBaseEntry(kbId, entry);

      res.status(201).json({
        message: 'Knowledge base entry added',
        knowledge,
      });
    } catch (error) {
      next(error);
    }
  }

  async getKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const knowledge = await knowledgeBaseService.getKnowledgeBase(kbId);

      res.json({ knowledge });
    } catch (error) {
      next(error);
    }
  }

  async deleteKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId, entryId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      await knowledgeBaseService.deleteKnowledgeBaseEntry(entryId, kbId);

      res.json({ message: 'Knowledge base entry deleted' });
    } catch (error) {
      next(error);
    }
  }

  async previewContext(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      // Get the full KB data and knowledge base
      const fullKB = await knowledgeBaseService.getKnowledgeBaseById(kbId);
      const knowledge = await knowledgeBaseService.getKnowledgeBase(kbId);

      if (!fullKB) {
        res.status(404).json({ error: 'Knowledge base not found' });
        return;
      }

      // Generate context preview
      const contextPreview = contextService.generateContextPreview(fullKB, knowledge);

      res.json({
        contextPreview,
        knowledgeBase: {
          id: fullKB.id,
          name: fullKB.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateContext(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const { customInstructions } = req.body;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      // Update the system_prompt field with custom instructions
      const updatedKB = await knowledgeBaseService.updateKnowledgeBase(
        kbId,
        req.user!.userId,
        { system_prompt: customInstructions }
      );

      res.json({
        message: 'Custom instructions updated successfully',
        knowledgeBase: updatedKB,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadKnowledgeFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const file = req.file;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized access to knowledge base' });
        return;
      }

      // Validate file
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const validation = fileProcessingService.validateFile(file);
      if (!validation.valid) {
        res.status(400).json({
          error: validation.errors.join(', ')
        });
        return;
      }

      // Process file with options
      const options = {
        provider: req.body.provider || 'openai',
        chunkSize: req.body.chunkSize ? parseInt(req.body.chunkSize) : undefined,
        chunkOverlap: req.body.chunkOverlap ? parseInt(req.body.chunkOverlap) : undefined,
      };

      const result = documentProcessingService.isEnabled()
        ? await documentProcessingService.ingest(kbId, file)
        : await fileProcessingService.processFileForKnowledgeBase(kbId, file, options);

      if ('jobId' in result && result.jobId) {
        res.status(202).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      if ((error as Error).message.includes('Unsupported file type')) {
        res.status(400).json({ error: (error as Error).message });
        return;
      }
      next(error);
    }
  }

  async searchKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const { q: query, limit, provider } = req.query;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      if (!query) {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const searchLimit = limit ? parseInt(limit as string) : 5;
      const searchProvider = (provider as string) || 'openai';

      console.log(`[DEBUG] Semantic search widget: query="${query}", kbId="${kbId}", limit=${searchLimit}`);

      // Search in both knowledge base and emails in parallel
      const knowledgeSearchPromise = fileProcessingService.searchKnowledgeBase(
        kbId,
        query as string,
        {
          limit: searchLimit,
          provider: searchProvider,
        }
      ).catch((err: Error) => {
        console.error('[ERROR] Knowledge base search failed:', err.message);
        console.error('[ERROR] Full error:', err);
        return [];
      });

      // Search emails using the chat service's optimized approach
      const emailSearchPromise = (async () => {
        try {
          console.log('[DEBUG] Starting email search with hybrid approach...');

          console.log(`[DEBUG] Searching emails: userId="${req.user!.userId}", query="${query}", limit=${searchLimit * 2}`);

          // Generate embedding for the query
          const queryEmbedding = await llmService.generateEmbedding(query as string, searchProvider);

          // Search in email_knowledge table WITHOUT threshold filter (like chat approach)
          const allResults = await db.query(
            `SELECT
              id,
              subject AS title,
              sender_name AS "senderName",
              sender_email AS "senderEmail",
              sent_at AS "sentAt",
              body_text AS content,
              1 - (embedding <=> $1::vector) AS similarity,
              'email' as source,
              'email' as content_type
            FROM email_knowledge
            WHERE user_id = $2
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $3`,
            [JSON.stringify(queryEmbedding), req.user!.userId, searchLimit * 2]
          );

          // Just take top N results, no threshold filter
          const topResults = allResults.rows.slice(0, searchLimit);

          // Log results
          console.log('\n=== EMAIL SEARCH RESULTS ===');
          console.log(`Query: "${query}"`);
          console.log(`User ID: ${req.user!.userId}`);
          console.log(`Found ${topResults.length} results (top ${searchLimit} by similarity):`);
          interface EmailSearchResult {
            similarity: number;
            title: string;
            senderName?: string;
            senderEmail?: string;
            content?: string;
          }
          (topResults as EmailSearchResult[]).forEach((r: EmailSearchResult, idx: number) => {
            console.log(`\n[${idx + 1}] Score: ${r.similarity.toFixed(4)} | Subject: ${r.title}`);
            console.log(`From: ${r.senderName || r.senderEmail}`);
            console.log(`Preview: ${r.content ? r.content.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No content'}`);
          });
          console.log('=====================================\n');

          console.log(`[DEBUG] Email search completed, found ${topResults.length} results`);
          return topResults;
        } catch (error) {
          console.error('[ERROR] Email search failed:', (error as Error).message);
          console.error('[ERROR] Full error:', error);
          return [];
        }
      })();

      const [knowledgeResults, emailResults] = await Promise.all([
        knowledgeSearchPromise,
        emailSearchPromise
      ]);

      console.log(`[DEBUG] Search complete: knowledge=${knowledgeResults.length}, emails=${emailResults.length}`);

      res.json({
        knowledge: knowledgeResults || [],
        emails: emailResults || []
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteKnowledgeFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId, entryId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const result = await fileProcessingService.deleteFileFromKnowledgeBase(
        kbId,
        entryId
      );

      res.json(result);
    } catch (error) {
      if ((error as Error).message === 'Entry not found') {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      next(error);
    }
  }

  async listKnowledgeFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const files = await fileProcessingService.listFilesForKB(kbId);

      res.json({ files });
    } catch (error) {
      next(error);
    }
  }

  async getRAGConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const config = await knowledgeBaseService.getRAGConfig(kbId);

      res.json({ config });
    } catch (error) {
      next(error);
    }
  }

  async updateRAGConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const config = req.body;

      // Verify ownership
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(req.user!.userId);
      if (!kb || kb.id !== kbId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      // Validate config values
      const validationErrors = validateRAGConfig(config);
      if (validationErrors.length > 0) {
        res.status(400).json({ error: 'Invalid configuration', details: validationErrors });
        return;
      }

      const updatedConfig = await knowledgeBaseService.updateRAGConfig(kbId, config);

      res.json({
        message: 'RAG configuration updated successfully',
        config: updatedConfig,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new KnowledgeBaseController();
