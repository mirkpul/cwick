/* eslint-disable @typescript-eslint/no-require-imports */
import type { SearchResult } from '@virtualcoach/shared-types';

const rerankingService = require('./rerankingService').default;

type TestSearchResult = SearchResult & {
  rerankScore?: number;
  mmrScore?: number;
  _scoreHistory?: {
    semanticBoost: {
      originalScore: number;
    };
  };
};

const makeResult = (overrides: Partial<TestSearchResult>): TestSearchResult => ({
  id: 'id',
  content: 'content',
  score: 0,
  source_type: 'knowledge_base',
  ...overrides,
});

describe('RerankingService', () => {
  describe('calculateCosineSimilarity', () => {
    it('should calculate cosine similarity between two vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];

      const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

      expect(similarity).toBe(0);
    });

    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];

      const similarity = rerankingService.calculateCosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle negative values', () => {
      const vecA = [1, -1, 0];
      const vecB = [-1, 1, 0];

      const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(-1, 5);
    });
  });

  describe('applyDiversityFilter', () => {
    it('should filter out similar results', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'machine learning fundamentals basics introduction tutorial guide', score: 0.9 }),
        makeResult({ id: 'b', content: 'machine learning fundamentals basics tutorial guide overview', score: 0.85 }),
        makeResult({ id: 'c', content: 'deep learning neural networks architecture', score: 0.8 }),
      ];

      const filtered = rerankingService.applyDiversityFilter(results, {
        threshold: 0.5, // Lower threshold to catch similar results
      });

      // Should remove 'b' as it's very similar to 'a'
      expect(filtered.length).toBeLessThan(results.length);
      expect(filtered.map((r: TestSearchResult) => r.id)).toContain('a');
      expect(filtered.map((r: TestSearchResult) => r.id)).toContain('c');
    });

    it('should keep all results if threshold is high', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'First result', score: 0.9 }),
        makeResult({ id: 'b', content: 'Second result', score: 0.8 }),
      ];

      const filtered = rerankingService.applyDiversityFilter(results, {
        threshold: 0.95,
      });

      expect(filtered.length).toBe(results.length);
    });

    it('should handle empty results', () => {
      const filtered = rerankingService.applyDiversityFilter([]);

      expect(filtered).toEqual([]);
    });
  });

  describe('calculateMMR', () => {
    it('should calculate MMR scores', () => {
      const candidates: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Test A', score: 0.9 }),
        makeResult({ id: 'b', content: 'Test B', score: 0.8 }),
        makeResult({ id: 'c', content: 'Test C', score: 0.7 }),
      ];

      const selected: TestSearchResult[] = [candidates[0]];

      const mmrScores = rerankingService.calculateMMR(
        candidates.slice(1),
        selected,
        { lambda: 0.7 }
      );

      expect(Array.isArray(mmrScores)).toBe(true);
      expect(mmrScores.length).toBe(2);
      expect(mmrScores[0]).toHaveProperty('mmrScore');
    });

    it('should balance relevance and diversity based on lambda', () => {
      const candidates: TestSearchResult[] = [
        makeResult({ id: 'b', content: 'Machine learning AI', score: 0.85 }),
        makeResult({ id: 'c', content: 'Machine learning basics', score: 0.80 }),
      ];

      const selected: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Machine learning', score: 0.9 }),
      ];

      const highRelevance = rerankingService.calculateMMR(candidates, selected, {
        lambda: 0.9,
      });

      const highDiversity = rerankingService.calculateMMR(candidates, selected, {
        lambda: 0.3,
      });

      // With selected items, different lambdas should give different scores
      expect(highRelevance[0].mmrScore).not.toBe(highDiversity[0].mmrScore);
    });

    it('should handle empty selected set', () => {
      const candidates: TestSearchResult[] = [makeResult({ id: 'a', content: 'Test', score: 0.9 })];

      const mmrScores = rerankingService.calculateMMR(candidates, []);

      expect(mmrScores[0].mmrScore).toBe(0.9);
    });
  });

  describe('rerankByDiversity', () => {
    it('should rerank results for diversity', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Machine learning basics', score: 0.9 }),
        makeResult({ id: 'b', content: 'Machine learning intro', score: 0.88 }),
        makeResult({ id: 'c', content: 'Deep learning networks', score: 0.85 }),
        makeResult({ id: 'd', content: 'Neural network architecture', score: 0.83 }),
      ];

      const reranked = rerankingService.rerankByDiversity(results, {
        topK: 3,
        lambda: 0.7,
      });

      expect(reranked.length).toBeLessThanOrEqual(3);
      // UPDATED: Use unified 'score' field instead of 'rerankScore'
      expect(reranked[0]).toHaveProperty('score');
    });

    it('should respect topK parameter', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Test 1', score: 0.9 }),
        makeResult({ id: 'b', content: 'Test 2', score: 0.8 }),
        makeResult({ id: 'c', content: 'Test 3', score: 0.7 }),
        makeResult({ id: 'd', content: 'Test 4', score: 0.6 }),
      ];

      const reranked = rerankingService.rerankByDiversity(results, { topK: 2 });

      expect(reranked.length).toBe(2);
    });

    it('should handle single result', () => {
      const results: TestSearchResult[] = [makeResult({ id: 'a', content: 'Test', score: 0.9 })];

      const reranked = rerankingService.rerankByDiversity(results);

      expect(reranked).toHaveLength(1);
      expect(reranked[0].id).toBe('a');
    });
  });

  describe('semanticRerank', () => {
    it('should boost results with higher semantic relevance', () => {
      const query = 'machine learning';
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Deep learning is fun', score: 0.7 }),
        makeResult({ id: 'b', content: 'Machine learning basics', score: 0.8 }),
      ];

      const reranked = rerankingService.semanticRerank(query, results, {
        boostFactor: 1.5,
      });

      // Result 'b' should be boosted due to exact keyword match
      expect(reranked[0].id).toBe('b');
      // UPDATED: Use unified 'score' field instead of 'rerankScore'
      expect(reranked[0]).toHaveProperty('score');
      // UPDATED: Use unified 'score' field
      expect(reranked[0].score).toBeGreaterThan(reranked[1].score);
    });

    it('should apply semantic boost when query matches content', () => {
      const query = 'test';
      const results: TestSearchResult[] = [makeResult({ id: 'a', content: 'test content', score: 0.9 })];

      const reranked = rerankingService.semanticRerank(query, results);

      // UPDATED: Score should be boosted because query term matches content
      // Original: 0.9, with 100% match and MAX_BOOST=0.05, becomes 0.95
      expect(reranked[0].score).toBeCloseTo(0.95, 2);
      expect(reranked[0]._scoreHistory.semanticBoost.originalScore).toBe(0.9);
    });

    it('should handle empty results', () => {
      const reranked = rerankingService.semanticRerank('query', []);

      expect(reranked).toEqual([]);
    });
  });

  describe('rerank', () => {
    it('should apply full reranking pipeline', () => {
      const query = 'machine learning';
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'Machine learning basics', score: 0.9 }),
        makeResult({ id: 'b', content: 'Machine learning intro', score: 0.88 }),
        makeResult({ id: 'c', content: 'Deep learning guide', score: 0.85 }),
        makeResult({ id: 'd', content: 'AI fundamentals', score: 0.83 }),
      ];

      const reranked = rerankingService.rerank(query, results, {
        useDiversity: true,
        useSemanticBoost: true,
        finalK: 3,
      });

      expect(reranked.length).toBeLessThanOrEqual(3);
      // UPDATED: Use unified 'score' field instead of 'rerankScore'
      expect(reranked[0]).toHaveProperty('score');
    });

    it('should skip reranking when disabled', () => {
      const query = 'test';
      const results: TestSearchResult[] = [makeResult({ id: 'a', content: 'test', score: 0.9 })];

      const reranked = rerankingService.rerank(query, results, {
        useDiversity: false,
        useSemanticBoost: false,
      });

      expect(reranked).toEqual(results);
    });

    it('should handle configuration from config', () => {
      const query = 'test';
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', content: 'test 1', score: 0.9 }),
        makeResult({ id: 'b', content: 'test 2', score: 0.8 }),
      ];

      const reranked = rerankingService.rerank(query, results);

      expect(Array.isArray(reranked)).toBe(true);
    });
  });

  describe('isRerankingEnabled', () => {
    it('should return config value', () => {
      const enabled = rerankingService.isRerankingEnabled();

      expect(typeof enabled).toBe('boolean');
    });
  });
});
