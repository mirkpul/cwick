/* eslint-disable @typescript-eslint/no-require-imports */

const queryEnhancementService = require('./queryEnhancementService').default;
const llmService = require('./llmService').default;

// Mock LLM service
jest.mock('./llmService');

interface EnhancedQueryResult {
  originalQuery: string;
  enhancedQuery: string;
  hydeDocument: string | null;
  queryVariants: string[];
}

interface Message {
  sender: string;
  content: string;
}

describe('QueryEnhancementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHyDE', () => {
    it('should generate hypothetical document for query', async () => {
      const query = 'What is machine learning?';

      llmService.generateResponse.mockResolvedValue({
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed...',
      });

      const hydeDoc = await queryEnhancementService.generateHyDE(query);

      expect(hydeDoc).toBeDefined();
      expect(typeof hydeDoc).toBe('string');
      expect(hydeDoc.length).toBeGreaterThan(0);
      expect(llmService.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('should handle LLM errors', async () => {
      const query = 'Test query';

      llmService.generateResponse.mockRejectedValue(
        new Error('LLM API error')
      );

      await expect(
        queryEnhancementService.generateHyDE(query)
      ).rejects.toThrow('LLM API error');
    });

    it('should use provided provider and model', async () => {
      const query = 'Test';

      llmService.generateResponse.mockResolvedValue({
        content: 'Hypothetical answer',
      });

      await queryEnhancementService.generateHyDE(query, {
        provider: 'anthropic',
        model: 'claude-3-haiku',
      });

      const call = llmService.generateResponse.mock.calls[0];
      expect(call[0]).toBe('anthropic');
      expect(call[1]).toBe('claude-3-haiku');
    });
  });

  describe('generateQueryVariants', () => {
    it('should generate multiple query variations', async () => {
      const query = 'How to improve RAG performance?';

      llmService.generateResponse.mockResolvedValue({
        content: JSON.stringify([
          'What are the best practices for improving RAG systems?',
          'How can I optimize retrieval-augmented generation?',
          'Ways to enhance RAG accuracy and speed',
        ]),
      });

      const variants = await queryEnhancementService.generateQueryVariants(
        query,
        { count: 3 }
      );

      expect(Array.isArray(variants)).toBe(true);
      expect(variants).toHaveLength(3);
      expect(variants[0]).not.toBe(query);
    });

    it('should handle malformed JSON response', async () => {
      const query = 'Test query';

      llmService.generateResponse.mockResolvedValue({
        content: 'Not valid JSON',
      });

      const variants = await queryEnhancementService.generateQueryVariants(
        query
      );

      // Should return array with original query as fallback
      expect(Array.isArray(variants)).toBe(true);
      expect(variants.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect variant count parameter', async () => {
      const query = 'Test';

      llmService.generateResponse.mockResolvedValue({
        content: JSON.stringify(['Variant 1', 'Variant 2', 'Variant 3', 'Variant 4', 'Variant 5']),
      });

      const variants = await queryEnhancementService.generateQueryVariants(
        query,
        { count: 5 }
      );

      expect(variants).toHaveLength(5);
    });
  });

  describe('enhanceQueryWithContext', () => {
    it('should inject conversation context into query', async () => {
      const query = 'What about the price?';
      const conversationHistory: Message[] = [
        { sender: 'user', content: 'Tell me about your services' },
        { sender: 'twin', content: 'We offer consulting services' },
        { sender: 'user', content: 'What about the price?' },
      ];

      llmService.generateResponse.mockResolvedValue({
        content: 'What is the price of your consulting services?',
      });

      const enhanced = await queryEnhancementService.enhanceQueryWithContext(
        query,
        conversationHistory
      );

      expect(enhanced).toBeDefined();
      expect(typeof enhanced).toBe('string');
      expect(enhanced).not.toBe(query);
      expect(llmService.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('should return original query if no history', async () => {
      const query = 'Standalone question';

      const enhanced = await queryEnhancementService.enhanceQueryWithContext(
        query,
        []
      );

      expect(enhanced).toBe(query);
      expect(llmService.generateResponse).not.toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      const query = 'Test';
      const history: Message[] = [{ sender: 'user', content: 'Previous message' }];

      llmService.generateResponse.mockRejectedValue(new Error('API error'));

      const enhanced = await queryEnhancementService.enhanceQueryWithContext(
        query,
        history,
        { fallbackToOriginal: true }
      );

      expect(enhanced).toBe(query);
    });

    it('should limit conversation history length', async () => {
      const query = 'Current question';
      const longHistory: Message[] = Array.from({ length: 20 }, (_, i) => ({
        sender: i % 2 === 0 ? 'user' : 'twin',
        content: `Message ${i}`,
      }));

      llmService.generateResponse.mockResolvedValue({
        content: 'Enhanced query',
      });

      await queryEnhancementService.enhanceQueryWithContext(
        query,
        longHistory,
        { maxHistoryMessages: 5 }
      );

      const call = llmService.generateResponse.mock.calls[0];
      const systemPrompt = call[3];

      // Should only include last 5 messages
      expect((systemPrompt.match(/Message/g) || []).length).toBeLessThanOrEqual(5);
    });
  });

  describe('enhanceQuery (full pipeline)', () => {
    it('should apply all enhancements when enabled', async () => {
      const query = 'What is it?';
      const conversationHistory: Message[] = [
        { sender: 'user', content: 'Tell me about machine learning' },
      ];

      // Mock context enhancement
      llmService.generateResponse
        .mockResolvedValueOnce({
          content: 'What is machine learning?',
        })
        // Mock HyDE
        .mockResolvedValueOnce({
          content: 'Machine learning is a field of AI...',
        })
        // Mock query variants
        .mockResolvedValueOnce({
          content: JSON.stringify([
            'Explain machine learning',
            'What does ML mean?',
            'Define machine learning',
          ]),
        });

      const result: EnhancedQueryResult = await queryEnhancementService.enhanceQuery(
        query,
        conversationHistory,
        {
          useContextInjection: true,
          useHyDE: true,
          useMultiQuery: true,
        }
      );

      expect(result.originalQuery).toBe(query);
      expect(result.enhancedQuery).toBeDefined();
      expect(result.hydeDocument).toBeDefined();
      expect(result.queryVariants).toBeDefined();
      expect(Array.isArray(result.queryVariants)).toBe(true);
    });

    it('should skip disabled enhancements', async () => {
      const query = 'Simple query';

      const result: EnhancedQueryResult = await queryEnhancementService.enhanceQuery(query, [], {
        useContextInjection: false,
        useHyDE: false,
        useMultiQuery: false,
      });

      expect(result.originalQuery).toBe(query);
      expect(result.enhancedQuery).toBe(query);
      expect(result.hydeDocument).toBeNull();
      expect(result.queryVariants).toEqual([query]);
      expect(llmService.generateResponse).not.toHaveBeenCalled();
    });

    it('should handle partial failures gracefully', async () => {
      const query = 'Test query';

      llmService.generateResponse
        .mockRejectedValueOnce(new Error('HyDE failed'))
        .mockResolvedValueOnce({
          content: JSON.stringify(['Variant 1', 'Variant 2']),
        });

      const result: EnhancedQueryResult = await queryEnhancementService.enhanceQuery(query, [], {
        useContextInjection: false,
        useHyDE: true,
        useMultiQuery: true,
        fallbackOnError: true,
      });

      expect(result.originalQuery).toBe(query);
      expect(result.hydeDocument).toBeNull(); // Failed
      expect(result.queryVariants).toHaveLength(2); // Succeeded
    });
  });

  describe('getAllSearchQueries', () => {
    it('should return all unique queries for search', () => {
      const enhancedResult: EnhancedQueryResult = {
        originalQuery: 'What is ML?',
        enhancedQuery: 'What is machine learning?',
        hydeDocument: 'Machine learning is...',
        queryVariants: ['Explain ML', 'Define machine learning', 'What is ML?'],
      };

      const queries = queryEnhancementService.getAllSearchQueries(
        enhancedResult
      );

      expect(Array.isArray(queries)).toBe(true);
      expect(queries.length).toBeGreaterThan(0);

      // Should include enhanced query, HyDE doc, and variants
      expect(queries).toContain(enhancedResult.enhancedQuery);

      // Should not have duplicates
      const uniqueQueries = [...new Set(queries)];
      expect(queries.length).toBe(uniqueQueries.length);
    });

    it('should handle null HyDE document', () => {
      const enhancedResult: EnhancedQueryResult = {
        originalQuery: 'Query',
        enhancedQuery: 'Query',
        hydeDocument: null,
        queryVariants: ['Variant 1'],
      };

      const queries = queryEnhancementService.getAllSearchQueries(
        enhancedResult
      );

      expect(Array.isArray(queries)).toBe(true);
      expect(queries).not.toContain(null);
      expect(queries).not.toContain(undefined);
    });
  });

  describe('isEnhancementEnabled', () => {
    it('should return config value', () => {
      const enabled = queryEnhancementService.isEnhancementEnabled();

      expect(typeof enabled).toBe('boolean');
    });
  });
});
