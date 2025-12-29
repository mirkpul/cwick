import hybridSearchService from './hybridSearchService';

jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        ragOptimization: {
            hybridSearch: {
                enabled: true,
                fusionMethod: 'weighted',
                vectorWeight: 0.7,
                bm25Weight: 0.3,
                bm25K1: 1.2,
                bm25B: 0.75,
                rffK: 60,
            },
        },
    },
}));

describe('HybridSearchService', () => {
    describe('calculateBM25Score', () => {
        it('should calculate BM25 score correctly', () => {
            const score = hybridSearchService.calculateBM25Score(
                3, // term frequency
                100, // doc length
                100, // avg doc length
                1000, // doc count
                10 // docs with term
            );

            expect(score).toBeGreaterThan(0);
            expect(typeof score).toBe('number');
        });

        it('should return 0 when term frequency is 0', () => {
            const score = hybridSearchService.calculateBM25Score(
                0, // no occurrences
                100,
                100,
                1000,
                10
            );

            expect(score).toBe(0);
        });

        it('should use custom k1 and b parameters', () => {
            const score1 = hybridSearchService.calculateBM25Score(
                3,
                100,
                100,
                1000,
                10,
                { k1: 1.5, b: 0.75 }
            );

            const score2 = hybridSearchService.calculateBM25Score(
                3,
                100,
                100,
                1000,
                10,
                { k1: 1.2, b: 0.75 }
            );

            // Different k1 should produce different scores
            expect(score1).not.toBe(score2);
        });

        it('should handle rare terms (high IDF)', () => {
            const rareTermScore = hybridSearchService.calculateBM25Score(
                1,
                100,
                100,
                1000,
                1 // very rare term
            );

            const commonTermScore = hybridSearchService.calculateBM25Score(
                1,
                100,
                100,
                1000,
                500 // common term
            );

            // Rare terms should have higher scores
            expect(rareTermScore).toBeGreaterThan(commonTermScore);
        });

        it('should consider document length normalization', () => {
            // Short document
            const shortDocScore = hybridSearchService.calculateBM25Score(
                3,
                50, // short doc
                100,
                1000,
                10
            );

            // Long document
            const longDocScore = hybridSearchService.calculateBM25Score(
                3,
                200, // long doc
                100,
                1000,
                10
            );

            // Short docs with same term frequency should score higher
            expect(shortDocScore).toBeGreaterThan(longDocScore);
        });
    });

    describe('reciprocalRankFusion', () => {
        it('should fuse results from both sources', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.8 },
            ];

            const bm25Results = [
                { id: '2', score: 10 },
                { id: '3', score: 8 },
            ];

            const fused = hybridSearchService.reciprocalRankFusion(
                vectorResults,
                bm25Results
            );

            // Should have all 3 unique IDs
            expect(fused).toHaveLength(3);
            expect(fused.every(r => r.fusedScore !== undefined)).toBe(true);
            expect(fused.every(r => r.fusionMethod === 'rrf')).toBe(true);
        });

        it('should rank items appearing in both sources higher', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.8 },
            ];

            const bm25Results = [
                { id: '2', score: 10 },
                { id: '3', score: 9 },
            ];

            const fused = hybridSearchService.reciprocalRankFusion(
                vectorResults,
                bm25Results
            );

            // ID '2' appears in both, should be ranked first
            expect(fused[0].id).toBe('2');
        });

        it('should use custom k parameter', () => {
            const vectorResults = [{ id: '1', similarity: 0.9 }];
            const bm25Results = [{ id: '1', score: 10 }];

            const fused = hybridSearchService.reciprocalRankFusion(
                vectorResults,
                bm25Results,
                { k: 100 }
            );

            expect(fused).toHaveLength(1);
            expect(fused[0].fusedScore).toBeGreaterThan(0);
        });

        it('should handle empty vector results', () => {
            const bm25Results = [
                { id: '1', score: 10 },
                { id: '2', score: 8 },
            ];

            const fused = hybridSearchService.reciprocalRankFusion([], bm25Results);

            expect(fused).toHaveLength(2);
            expect(fused[0].vectorRank).toBeNull();
            expect(fused[0].bm25Rank).toBe(1);
        });

        it('should handle empty BM25 results', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.8 },
            ];

            const fused = hybridSearchService.reciprocalRankFusion(vectorResults, []);

            expect(fused).toHaveLength(2);
            expect(fused[0].bm25Rank).toBeNull();
            expect(fused[0].vectorRank).toBe(1);
        });

        it('should sort by fused score descending', () => {
            const vectorResults = [
                { id: '1', similarity: 0.5 },
                { id: '2', similarity: 0.9 },
            ];

            const bm25Results = [
                { id: '2', score: 10 },
                { id: '1', score: 5 },
            ];

            const fused = hybridSearchService.reciprocalRankFusion(
                vectorResults,
                bm25Results
            );

            // Results should be sorted by fused score
            for (let i = 0; i < fused.length - 1; i++) {
                expect(fused[i].fusedScore).toBeGreaterThanOrEqual(
                    fused[i + 1].fusedScore || 0
                );
            }
        });
    });

    describe('weightedFusion', () => {
        it('should fuse results with default weights', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.8 },
            ];

            const bm25Results = [
                { id: '1', score: 10 },
                { id: '3', score: 8 },
            ];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results
            );

            expect(fused).toHaveLength(3);
            expect(fused.every(r => r.score !== undefined)).toBe(true);
        });

        it('should use custom weights', () => {
            const vectorResults = [{ id: '1', similarity: 0.9 }];
            const bm25Results = [{ id: '1', score: 0.5 }];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results,
                { vectorWeight: 0.8, bm25Weight: 0.2 }
            );

            expect(fused).toHaveLength(1);
            // Score should be weighted combination
            expect(fused[0].score).toBeGreaterThan(0);
        });

        it('should use robust normalization by default', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.8 },
            ];

            const bm25Results = [
                { id: '1', score: 10 },
                { id: '2', score: 5 },
            ];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results
            );

            // Should preserve similarity for vector results
            expect(fused.some(r => r.similarity !== undefined)).toBe(true);
        });

        it('should support min-max normalization', () => {
            const vectorResults = [{ id: '1', similarity: 0.9 }];
            const bm25Results = [{ id: '1', score: 10 }];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results,
                { normalizationMethod: 'min-max' }
            );

            expect(fused).toHaveLength(1);
            expect(fused[0].score).toBeDefined();
        });

        it('should support z-score normalization', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.5 },
            ];
            const bm25Results = [
                { id: '1', score: 10 },
                { id: '2', score: 2 },
            ];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results,
                { normalizationMethod: 'z-score' }
            );

            expect(fused).toHaveLength(2);
        });

        it('should support no normalization', () => {
            const vectorResults = [{ id: '1', similarity: 0.9 }];
            const bm25Results = [{ id: '1', score: 10 }];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results,
                { normalizationMethod: 'none' }
            );

            expect(fused).toHaveLength(1);
        });

        it('should include score history metadata', () => {
            const vectorResults = [{ id: '1', similarity: 0.9 }];
            const bm25Results = [{ id: '1', score: 10 }];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results
            );

            expect(fused[0]._scoreHistory).toBeDefined();
            expect(fused[0]._scoreHistory?.stage).toBe('fusion');
            expect(fused[0]._scoreHistory?.method).toBe('weighted');
        });

        it('should sort results by score descending', () => {
            const vectorResults = [
                { id: '1', similarity: 0.5 },
                { id: '2', similarity: 0.9 },
            ];
            const bm25Results = [
                { id: '1', score: 2 },
                { id: '2', score: 10 },
            ];

            const fused = hybridSearchService.weightedFusion(
                vectorResults,
                bm25Results
            );

            for (let i = 0; i < fused.length - 1; i++) {
                expect(fused[i].score || 0).toBeGreaterThanOrEqual(
                    fused[i + 1].score || 0
                );
            }
        });
    });

    describe('tokenize', () => {
        it('should tokenize text into words', () => {
            const tokens = hybridSearchService.tokenize('Hello world test');
            expect(tokens).toContain('hello');
            expect(tokens).toContain('world');
            expect(tokens).toContain('test');
        });

        it('should remove stopwords', () => {
            const tokens = hybridSearchService.tokenize('the quick brown fox');
            expect(tokens).not.toContain('the');
            expect(tokens).toContain('quick');
            expect(tokens).toContain('brown');
        });

        it('should remove punctuation', () => {
            const tokens = hybridSearchService.tokenize('Hello, world! How are you?');
            expect(tokens).toContain('hello');
            expect(tokens).toContain('world');
        });

        it('should convert to lowercase', () => {
            const tokens = hybridSearchService.tokenize('HELLO World TEST');
            expect(tokens).toContain('hello');
            expect(tokens).toContain('world');
            expect(tokens).toContain('test');
        });

        it('should filter short words', () => {
            const tokens = hybridSearchService.tokenize('a an to be or not');
            // 'or' has 2 chars, should be filtered (> 2 required)
            expect(tokens).not.toContain('or');
        });

        it('should remove duplicates', () => {
            const tokens = hybridSearchService.tokenize('test test test');
            expect(tokens).toEqual(['test']);
        });

        it('should handle empty string', () => {
            const tokens = hybridSearchService.tokenize('');
            expect(tokens).toEqual([]);
        });

        it('should handle null/undefined', () => {
            const tokens = hybridSearchService.tokenize(null as never);
            expect(tokens).toEqual([]);
        });

        it('should handle multiple spaces', () => {
            const tokens = hybridSearchService.tokenize('hello    world    test');
            expect(tokens).toHaveLength(3);
        });

        it('should handle special characters', () => {
            const tokens = hybridSearchService.tokenize('user@example.com test-case');
            expect(tokens.length).toBeGreaterThan(0);
        });
    });

    describe('normalizeScores', () => {
        it('should return empty array for empty results', () => {
            const normalized = hybridSearchService.normalizeScores([]);
            expect(normalized).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const normalized = hybridSearchService.normalizeScores(null as never);
            expect(normalized).toEqual([]);
        });

        it('should return 1.0 for single result', () => {
            const results = [{ id: '1', score: 5 }];
            const normalized = hybridSearchService.normalizeScores(results, 'min-max');

            expect(normalized).toHaveLength(1);
            expect(normalized[0].normalizedScore).toBe(1.0);
            expect(normalized[0]._normalization?.singleResult).toBe(true);
        });

        it('should use min-max normalization', () => {
            const results = [
                { id: '1', score: 10 },
                { id: '2', score: 5 },
                { id: '3', score: 0 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'min-max');

            expect(normalized[0].normalizedScore).toBe(1.0); // max
            expect(normalized[1].normalizedScore).toBe(0.5); // middle
            expect(normalized[2].normalizedScore).toBe(0.0); // min
        });

        it('should handle identical scores in min-max', () => {
            const results = [
                { id: '1', score: 5 },
                { id: '2', score: 5 },
                { id: '3', score: 5 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'min-max');

            // All should be 1.0 when identical
            expect(normalized.every(r => r.normalizedScore === 1.0)).toBe(true);
            expect(normalized[0]._normalization?.identicalScores).toBe(true);
        });

        it('should use z-score normalization', () => {
            const results = [
                { id: '1', score: 10 },
                { id: '2', score: 5 },
                { id: '3', score: 0 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'z-score');

            expect(normalized).toHaveLength(3);
            normalized.forEach(r => {
                expect(r.normalizedScore).toBeGreaterThanOrEqual(0);
                expect(r.normalizedScore).toBeLessThanOrEqual(1);
            });
        });

        it('should handle identical scores in z-score', () => {
            const results = [
                { id: '1', score: 5 },
                { id: '2', score: 5 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'z-score');

            // Should return 1.0 when no variance
            expect(normalized.every(r => r.normalizedScore === 1.0)).toBe(true);
            expect(normalized[0]._normalization?.identicalScores).toBe(true);
        });

        it('should use sigmoid for z-score clamping', () => {
            const results = [
                { id: '1', score: 100 }, // outlier
                { id: '2', score: 5 },
                { id: '3', score: 4 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'z-score');

            // All scores should be in [0, 1]
            normalized.forEach(r => {
                expect(r.normalizedScore).toBeGreaterThanOrEqual(0);
                expect(r.normalizedScore).toBeLessThanOrEqual(1);
            });
        });

        it('should skip normalization when method is none', () => {
            const results = [
                { id: '1', score: 10 },
                { id: '2', score: 5 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'none');

            expect(normalized[0].normalizedScore).toBe(10);
            expect(normalized[1].normalizedScore).toBe(5);
            expect(normalized[0]._normalization?.method).toBe('none');
        });

        it('should attach normalization metadata', () => {
            const results = [
                { id: '1', score: 10 },
                { id: '2', score: 5 },
            ];

            const normalized = hybridSearchService.normalizeScores(results, 'min-max');

            expect(normalized[0]._normalization).toBeDefined();
            expect(normalized[0]._normalization?.method).toBe('min-max');
        });
    });

    describe('mergeResults', () => {
        it('should merge multiple result sets', () => {
            const set1 = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.8 },
            ];

            const set2 = [
                { id: '2', score: 0.7 },
                { id: '3', score: 0.6 },
            ];

            const merged = hybridSearchService.mergeResults([set1, set2]);

            expect(merged).toHaveLength(3); // 3 unique IDs
        });

        it('should use max method by default', () => {
            const set1 = [{ id: '1', score: 0.5 }];
            const set2 = [{ id: '1', score: 0.9 }];

            const merged = hybridSearchService.mergeResults([set1, set2]);

            expect(merged[0].score).toBe(0.9); // max
        });

        it('should use average method', () => {
            const set1 = [{ id: '1', score: 0.4 }];
            const set2 = [{ id: '1', score: 0.8 }];

            const merged = hybridSearchService.mergeResults([set1, set2], {
                combineMethod: 'average',
            });

            expect(merged[0].score).toBeCloseTo(0.6, 5); // average
        });

        it('should use sum method with clamping', () => {
            const set1 = [{ id: '1', score: 0.7 }];
            const set2 = [{ id: '1', score: 0.8 }];

            const merged = hybridSearchService.mergeResults([set1, set2], {
                combineMethod: 'sum',
            });

            // Sum would be 1.5, but should be clamped to 1.0
            expect(merged[0].score).toBe(1.0);
        });

        it('should handle single occurrence', () => {
            const set1 = [{ id: '1', score: 0.9 }];
            const set2 = [{ id: '2', score: 0.8 }];

            const merged = hybridSearchService.mergeResults([set1, set2]);

            expect(merged[0]._scoreHistory?.mergeMethod).toBe('single');
            expect(merged[0]._scoreHistory?.occurrences).toBe(1);
        });

        it('should track multiple occurrences', () => {
            const set1 = [{ id: '1', score: 0.5 }];
            const set2 = [{ id: '1', score: 0.9 }];
            const set3 = [{ id: '1', score: 0.7 }];

            const merged = hybridSearchService.mergeResults([set1, set2, set3], {
                combineMethod: 'max',
            });

            expect(merged[0]._scoreHistory?.occurrences).toBe(3);
            expect(merged[0]._scoreHistory?.mergeMethod).toBe('max');
        });

        it('should return empty array for empty input', () => {
            const merged = hybridSearchService.mergeResults([]);
            expect(merged).toEqual([]);
        });

        it('should return empty array for array of empty arrays', () => {
            const merged = hybridSearchService.mergeResults([[], [], []]);
            expect(merged).toEqual([]);
        });

        it('should sort results by score descending', () => {
            const set1 = [
                { id: '1', score: 0.5 },
                { id: '2', score: 0.9 },
            ];
            const set2 = [
                { id: '3', score: 0.7 },
            ];

            const merged = hybridSearchService.mergeResults([set1, set2]);

            for (let i = 0; i < merged.length - 1; i++) {
                expect(merged[i].score || 0).toBeGreaterThanOrEqual(
                    merged[i + 1].score || 0
                );
            }
        });

        it('should preserve result properties', () => {
            const set1 = [
                {
                    id: '1',
                    score: 0.9,
                    content: 'Test content',
                    metadata: { source: 'doc.pdf' },
                },
            ];

            const merged = hybridSearchService.mergeResults([set1]);

            expect(merged[0].content).toBe('Test content');
            expect(merged[0].metadata).toEqual({ source: 'doc.pdf' });
        });
    });

    describe('isHybridSearchEnabled', () => {
        it('should return true when enabled', () => {
            expect(hybridSearchService.isHybridSearchEnabled()).toBe(true);
        });
    });

    describe('getFusionMethod', () => {
        it('should return configured fusion method', () => {
            expect(hybridSearchService.getFusionMethod()).toBe('weighted');
        });
    });
});
