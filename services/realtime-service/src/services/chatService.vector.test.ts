import chatService from './chatService';
import type { SearchResult } from '@virtualcoach/shared-types';
import config from '../config/appConfig';

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('./vectorStoreService', () => ({
  isEnabled: jest.fn(),
  search: jest.fn(),
}));

jest.mock('./llmService', () => ({
  generateEmbedding: jest.fn(async () => [0.1, 0.2, 0.3]),
}));

const mockDb = require('../config/database');
const mockVector = require('./vectorStoreService');

describe('chatService vector integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns vector-ranked results when vector service is enabled', async () => {
    mockVector.isEnabled.mockReturnValue(true);
    mockVector.search
      .mockResolvedValueOnce([
        { id: 'kb-1', score: 0.9 },
        { id: 'kb-2', score: 0.8 },
      ])
      .mockResolvedValueOnce([
        { id: 'email-1', score: 0.7 },
      ]);

    mockDb.query
      // knowledge_base fetch
      .mockResolvedValueOnce({
        rows: [
          { id: 'kb-1', title: 'KB1', content: 'foo', fileName: 'a', chunkIndex: 0, contentType: 'doc' },
          { id: 'kb-2', title: 'KB2', content: 'bar', fileName: 'b', chunkIndex: 0, contentType: 'doc' },
        ],
      })
      // email fetch
      .mockResolvedValueOnce({
        rows: [
          { id: 'email-1', subject: 'Hi', body_text: 'hello', sender_name: 's', sender_email: 'e', sent_at: new Date() },
        ],
      });

    const results: any[] = await chatService._performBM25Search('twin-1', 'user-1', 'hello', 3);

    expect(mockVector.search).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('kb-1');
    expect(results[1].id).toBe('kb-2');
    expect(results[2].id).toBe('email-1');
  });

  it('falls back to BM25-like search when vector service is disabled', async () => {
    mockVector.isEnabled.mockReturnValue(false);
    mockDb.query
      // knowledge_base query
      .mockResolvedValueOnce({
        rows: [
          { id: 'kb-1', title: 'KB1', content: 'foo', fileName: 'a', chunkIndex: 0, contentType: 'doc' },
        ],
      })
      // email query
      .mockResolvedValueOnce({
        rows: [
          { id: 'email-1', title: 'Hi', content: 'hello', source: 'email', content_type: 'email', senderName: 's', senderEmail: 'e', sentAt: new Date() },
        ],
      });

    const results: any[] = await chatService._performBM25Search('twin-1', 'user-1', 'hello', 2);

    expect(mockVector.search).not.toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
  });

  it('balances sources when ensemble balancing is enabled', async () => {
    const previous = config.semanticSearch.ensembleBalancing;
    config.semanticSearch.ensembleBalancing = {
      ...previous,
      enabled: true,
      minEmailResults: 1,
      minKBResults: 1,
      maxEmailRatio: 0.5,
      maxKBRatio: 0.5,
    };

    const results = (chatService as any).applySourceBalancing(
      [
        { id: 'e1', content: 'e1', score: 0.99, source: 'email' },
        { id: 'e2', content: 'e2', score: 0.98, source: 'email' },
        { id: 'e3', content: 'e3', score: 0.97, source: 'email' },
        { id: 'k1', content: 'k1', score: 0.96, source: 'knowledge_base' },
        { id: 'k2', content: 'k2', score: 0.95, source: 'knowledge_base' },
      ],
      4
    );

    const emailCount = results.filter((r: any) => r.source === 'email').length;
    const kbCount = results.filter((r: any) => r.source === 'knowledge_base').length;

    expect(results).toHaveLength(4);
    expect(emailCount).toBeLessThanOrEqual(2);
    expect(kbCount).toBeGreaterThanOrEqual(1);

    config.semanticSearch.ensembleBalancing = previous;
  });
});
