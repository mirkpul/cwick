/* eslint-disable @typescript-eslint/no-require-imports */
import type { SearchResult } from '@virtualcoach/shared-types';

const hybridSearchService = require('./hybridSearchService').default;

type TestSearchResult = SearchResult & {
  similarity?: number;
  fusedScore?: number;
  normalizedScore?: number;
  normalizedVector?: number;
  source?: string;
};

const makeResult = (overrides: Partial<TestSearchResult>): TestSearchResult => ({
  id: 'id',
  content: 'content',
  score: 0,
  source_type: 'knowledge_base',
  ...overrides,
});

describe('HybridSearchService', () => {
  describe('calculateBM25Score', () => {
    it('should calculate BM25 score for term frequency', () => {
      const termFreq = 3;
      const docLength = 100;
      const avgDocLength = 100;
      const docCount = 1000;
      const docsWithTerm = 50;

      const score = hybridSearchService.calculateBM25Score(
        termFreq,
        docLength,
        avgDocLength,
        docCount,
        docsWithTerm
      );

      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
      expect(isFinite(score)).toBe(true);
    });

    it('should return 0 for zero term frequency', () => {
      const score = hybridSearchService.calculateBM25Score(0, 100, 100, 1000, 50);

      expect(score).toBe(0);
    });

    it('should handle rare terms with higher scores', () => {
      const commonScore = hybridSearchService.calculateBM25Score(1, 100, 100, 1000, 500);
      const rareScore = hybridSearchService.calculateBM25Score(1, 100, 100, 1000, 10);

      expect(rareScore).toBeGreaterThan(commonScore);
    });

    it('should handle document length normalization', () => {
      const shortDocScore = hybridSearchService.calculateBM25Score(1, 50, 100, 1000, 50);
      const longDocScore = hybridSearchService.calculateBM25Score(1, 200, 100, 1000, 50);

      expect(shortDocScore).toBeGreaterThan(longDocScore);
    });
  });

  describe('reciprocalRankFusion', () => {
    it('should fuse two result sets using RRF', () => {
      const vectorResults: TestSearchResult[] = [
        makeResult({ id: 'a', score: 0.9 }),
        makeResult({ id: 'b', score: 0.8 }),
        makeResult({ id: 'c', score: 0.7 }),
      ];

      const bm25Results: TestSearchResult[] = [
        makeResult({ id: 'b', score: 10.5 }),
        makeResult({ id: 'a', score: 8.2 }),
        makeResult({ id: 'd', score: 5.1 }),
      ];

      const fused = hybridSearchService.reciprocalRankFusion(
        vectorResults,
        bm25Results,
        { k: 60 }
      );

      expect(Array.isArray(fused)).toBe(true);
      expect(fused.length).toBeGreaterThan(0);

      // Check that results are sorted by fused score
      for (let i = 0; i < fused.length - 1; i++) {
        expect(fused[i].fusedScore).toBeGreaterThanOrEqual(fused[i + 1].fusedScore);
      }

      // Item 'b' should rank high (appears in both lists)
      const bIndex = fused.findIndex((r: TestSearchResult) => r.id === 'b');
      expect(bIndex).toBeLessThan(2); // Should be in top 2
    });

    it('should handle empty vector results', () => {
      const bm25Results: TestSearchResult[] = [makeResult({ id: 'a', score: 10 })];

      const fused = hybridSearchService.reciprocalRankFusion([], bm25Results);

      expect(fused).toHaveLength(1);
      expect(fused[0].id).toBe('a');
    });

    it('should handle empty BM25 results', () => {
      const vectorResults: TestSearchResult[] = [makeResult({ id: 'a', score: 0.9 })];

      const fused = hybridSearchService.reciprocalRankFusion(vectorResults, []);

      expect(fused).toHaveLength(1);
      expect(fused[0].id).toBe('a');
    });

    it('should handle both empty result sets', () => {
      const fused = hybridSearchService.reciprocalRankFusion([], []);

      expect(fused).toEqual([]);
    });

    it('should respect k parameter', () => {
      const vectorResults: TestSearchResult[] = [makeResult({ id: 'a', score: 0.9 })];
      const bm25Results: TestSearchResult[] = [makeResult({ id: 'a', score: 10 })];

      const fusedK60 = hybridSearchService.reciprocalRankFusion(
        vectorResults,
        bm25Results,
        { k: 60 }
      );

      const fusedK100 = hybridSearchService.reciprocalRankFusion(
        vectorResults,
        bm25Results,
        { k: 100 }
      );

      // Different k should give different scores
      expect(fusedK60[0].fusedScore).not.toBe(fusedK100[0].fusedScore);
    });
  });

  describe('weightedFusion', () => {
    it('should combine scores with weights', () => {
      const vectorResults: TestSearchResult[] = [
        makeResult({ id: 'a', similarity: 0.9 }),
        makeResult({ id: 'b', similarity: 0.8 }),
      ];

      const bm25Results: TestSearchResult[] = [
        makeResult({ id: 'a', score: 10 }),
        makeResult({ id: 'c', score: 8 }),
      ];

      const fused = hybridSearchService.weightedFusion(
        vectorResults,
        bm25Results,
        { vectorWeight: 0.6, bm25Weight: 0.4 }
      );

      expect(Array.isArray(fused)).toBe(true);
      expect(fused.length).toBeGreaterThan(0);

      // UPDATED: Results should have unified 'score' field instead of 'fusedScore'
      expect(fused[0]).toHaveProperty('score');
    });

    it('should normalize vector scores to 0-1 range', () => {
      const vectorResults: TestSearchResult[] = [
        makeResult({ id: 'a', similarity: 0.5 }),
        makeResult({ id: 'b', similarity: 1.0 }),
      ];

      const bm25Results: TestSearchResult[] = [makeResult({ id: 'a', score: 10 })];

      const fused = hybridSearchService.weightedFusion(
        vectorResults,
        bm25Results
      );

      // All normalized scores should be between 0 and 1
      fused.forEach((result: TestSearchResult) => {
        if (result.normalizedVector !== undefined) {
          expect(result.normalizedVector).toBeGreaterThanOrEqual(0);
          expect(result.normalizedVector).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should handle weights that sum to 1', () => {
      const vectorResults: TestSearchResult[] = [makeResult({ id: 'a', similarity: 0.9 })];
      const bm25Results: TestSearchResult[] = [makeResult({ id: 'a', score: 10 })];

      const fused = hybridSearchService.weightedFusion(
        vectorResults,
        bm25Results,
        { vectorWeight: 0.7, bm25Weight: 0.3 }
      );

      // UPDATED: Use unified 'score' field instead of 'fusedScore'
      expect(fused[0].score).toBeGreaterThan(0);
      expect(fused[0].score).toBeLessThanOrEqual(1);
    });
  });

  describe('tokenize', () => {
    it('should tokenize text into words', () => {
      const text = 'Hello world, this is a test!';
      const tokens = hybridSearchService.tokenize(text);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('test');
    });

    it('should convert to lowercase', () => {
      const text = 'UPPERCASE lowercase MixedCase';
      const tokens = hybridSearchService.tokenize(text);

      expect(tokens.every((t: string) => t === t.toLowerCase())).toBe(true);
    });

    it('should remove punctuation', () => {
      const text = 'hello, world! test?';
      const tokens = hybridSearchService.tokenize(text);

      tokens.forEach((token: string) => {
        expect(token).not.toMatch(/[.,!?]/);
      });
    });

    it('should remove stopwords', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const tokens = hybridSearchService.tokenize(text);

      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('over');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
    });

    it('should handle empty string', () => {
      const tokens = hybridSearchService.tokenize('');

      expect(tokens).toEqual([]);
    });

    it('should remove duplicate tokens', () => {
      const text = 'test test test';
      const tokens = hybridSearchService.tokenize(text);

      expect(tokens).toEqual(['test']);
    });
  });

  describe('normalizeScores', () => {
    it('should normalize scores to 0-1 range using min-max', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', score: 10 }),
        makeResult({ id: 'b', score: 20 }),
        makeResult({ id: 'c', score: 15 }),
      ];

      const normalized = hybridSearchService.normalizeScores(results, 'min-max');

      expect(normalized[0].normalizedScore).toBe(0); // Min
      expect(normalized[1].normalizedScore).toBe(1); // Max
      expect(normalized[2].normalizedScore).toBe(0.5); // Middle
    });

    it('should handle single result', () => {
      const results: TestSearchResult[] = [makeResult({ id: 'a', score: 10 })];

      const normalized = hybridSearchService.normalizeScores(results, 'min-max');

      expect(normalized[0].normalizedScore).toBe(1);
    });

    it('should handle identical scores', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', score: 10 }),
        makeResult({ id: 'b', score: 10 }),
      ];

      const normalized = hybridSearchService.normalizeScores(results, 'min-max');

      expect(normalized[0].normalizedScore).toBe(1);
      expect(normalized[1].normalizedScore).toBe(1);
    });

    it('should preserve original scores', () => {
      const results: TestSearchResult[] = [
        makeResult({ id: 'a', score: 10 }),
        makeResult({ id: 'b', score: 20 }),
      ];

      const normalized = hybridSearchService.normalizeScores(results, 'min-max');

      expect(normalized[0].score).toBe(10);
      expect(normalized[1].score).toBe(20);
    });
  });

  describe('mergeResults', () => {
    it('should merge results from multiple sources', () => {
      const results1: TestSearchResult[] = [
        makeResult({ id: 'a', score: 0.9, source: 'source1' }),
        makeResult({ id: 'b', score: 0.8, source: 'source1' }),
      ];

      const results2: TestSearchResult[] = [
        makeResult({ id: 'a', score: 0.85, source: 'source2' }),
        makeResult({ id: 'c', score: 0.75, source: 'source2' }),
      ];

      const merged = hybridSearchService.mergeResults([results1, results2]);

      expect(Array.isArray(merged)).toBe(true);

      // Should have unique IDs
      const ids = merged.map((r: TestSearchResult) => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should combine scores for duplicate items', () => {
      const results1: TestSearchResult[] = [makeResult({ id: 'a', score: 0.5 })];
      const results2: TestSearchResult[] = [makeResult({ id: 'a', score: 0.5 })];

      const merged = hybridSearchService.mergeResults([results1, results2], {
        combineMethod: 'average',
      });

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('a');
      // UPDATED: Use unified 'score' field instead of 'combinedScore'
      expect(merged[0].score).toBeDefined();
    });

    it('should handle empty result sets', () => {
      const merged = hybridSearchService.mergeResults([[], []]);

      expect(merged).toEqual([]);
    });
  });
});
