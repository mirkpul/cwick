import rerankingService from './rerankingService';

jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        ragOptimization: {
            reranking: {
                enabled: true,
                diversityThreshold: 0.7,
                mmrLambda: 0.5,
                finalK: 5,
                useDiversityFilter: true,
                useMMR: true,
                semanticBoost: {
                    minThreshold: 0.3,
                    maxBoost: 0.05,
                },
            },
        },
    },
}));

describe('RerankingService', () => {
    describe('calculateCosineSimilarity', () => {
        it('should calculate cosine similarity for identical vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [1, 0, 0];

            const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

            expect(similarity).toBe(1);
        });

        it('should calculate cosine similarity for orthogonal vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];

            const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

            expect(similarity).toBe(0);
        });

        it('should calculate cosine similarity for opposite vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [-1, 0, 0];

            const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

            expect(similarity).toBe(-1);
        });

        it('should return 0 for zero vectors', () => {
            const vecA = [0, 0, 0];
            const vecB = [1, 2, 3];

            const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

            expect(similarity).toBe(0);
        });

        it('should throw error for vectors of different lengths', () => {
            const vecA = [1, 2, 3];
            const vecB = [1, 2];

            expect(() => {
                rerankingService.calculateCosineSimilarity(vecA, vecB);
            }).toThrow('Vectors must have same length');
        });

        it('should handle high-dimensional vectors', () => {
            const vecA = Array(1536).fill(0.1);
            const vecB = Array(1536).fill(0.1);

            const similarity = rerankingService.calculateCosineSimilarity(vecA, vecB);

            expect(similarity).toBeCloseTo(1, 5);
        });
    });

    describe('calculateTextSimilarity', () => {
        it('should calculate Jaccard similarity for identical text', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'hello world test',
                'hello world test'
            );

            expect(similarity).toBe(1);
        });

        it('should calculate Jaccard similarity for different text', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'hello world',
                'goodbye universe'
            );

            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThan(1);
        });

        it('should calculate Jaccard similarity for partially overlapping text', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'the quick brown fox',
                'the lazy brown dog'
            );

            // 'brown' is common
            expect(similarity).toBeGreaterThan(0);
        });

        it('should be case insensitive', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'HELLO WORLD',
                'hello world'
            );

            expect(similarity).toBe(1);
        });

        it('should filter short tokens', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'a an in on the test',
                'test'
            );

            // Should only consider 'test' (length > 2)
            expect(similarity).toBeGreaterThan(0);
        });

        it('should return 0 for empty text', () => {
            const similarity = rerankingService.calculateTextSimilarity('', '');

            expect(similarity).toBe(0);
        });

        it('should handle text with punctuation', () => {
            const similarity = rerankingService.calculateTextSimilarity(
                'Hello, world! Testing here.',
                'Hello world testing'
            );

            // 'hello', 'world', 'testing' all match
            expect(similarity).toBeGreaterThan(0);
        });
    });

    describe('applyDiversityFilter', () => {
        it('should return empty array for empty results', () => {
            const filtered = rerankingService.applyDiversityFilter([]);
            expect(filtered).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const filtered = rerankingService.applyDiversityFilter(null as never);
            expect(filtered).toEqual([]);
        });

        it('should always keep first result', () => {
            const results = [
                { id: '1', content: 'First result', score: 0.9 },
                { id: '2', content: 'Second result', score: 0.8 },
            ];

            const filtered = rerankingService.applyDiversityFilter(results);

            expect(filtered[0].id).toBe('1');
        });

        it('should filter out similar results', () => {
            const results = [
                { id: '1', content: 'the quick brown fox jumps', score: 0.9 },
                { id: '2', content: 'the quick brown fox runs', score: 0.8 }, // very similar
                { id: '3', content: 'completely different content here', score: 0.7 },
            ];

            const filtered = rerankingService.applyDiversityFilter(results, {
                threshold: 0.5,
            });

            // Should filter out result 2 (similar to result 1)
            expect(filtered.length).toBeLessThan(results.length);
            expect(filtered.some(r => r.id === '1')).toBe(true);
            expect(filtered.some(r => r.id === '3')).toBe(true);
        });

        it('should keep diverse results', () => {
            const results = [
                { id: '1', content: 'artificial intelligence machine learning', score: 0.9 },
                { id: '2', content: 'cooking recipes and food preparation', score: 0.8 },
                { id: '3', content: 'sports and physical fitness', score: 0.7 },
            ];

            const filtered = rerankingService.applyDiversityFilter(results);

            // All results are diverse, should keep all
            expect(filtered).toHaveLength(3);
        });

        it('should use custom threshold', () => {
            const results = [
                { id: '1', content: 'hello world test', score: 0.9 },
                { id: '2', content: 'hello world example', score: 0.8 },
            ];

            const filtered = rerankingService.applyDiversityFilter(results, {
                threshold: 0.9, // very high threshold
            });

            // Lower threshold means more filtering
            expect(filtered.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle results without content', () => {
            const results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.8 },
            ];

            const filtered = rerankingService.applyDiversityFilter(results);

            // Should not crash, should keep all (no content to compare)
            expect(filtered).toHaveLength(2);
        });
    });

    describe('calculateMMR', () => {
        it('should calculate MMR scores for candidates', () => {
            const candidates = [
                { id: '1', content: 'test content', score: 0.9 },
                { id: '2', content: 'other content', score: 0.8 },
            ];
            const selected: any[] = [];

            const withMMR = rerankingService.calculateMMR(candidates, selected);

            expect(withMMR).toHaveLength(2);
            expect(withMMR[0].mmrScore).toBeDefined();
        });

        it('should use relevance score when no selected items', () => {
            const candidates = [{ id: '1', content: 'test', score: 0.9 }];
            const selected: any[] = [];

            const withMMR = rerankingService.calculateMMR(candidates, selected);

            // MMR score should equal relevance when no selected items
            expect(withMMR[0].mmrScore).toBe(0.9);
        });

        it('should penalize similar candidates to selected items', () => {
            const candidates = [
                { id: '2', content: 'the quick brown fox jumps', score: 0.9 },
            ];
            const selected = [
                { id: '1', content: 'the quick brown fox runs', score: 0.95 },
            ];

            const withMMR = rerankingService.calculateMMR(candidates, selected);

            // MMR score should be lower than original due to similarity penalty
            expect(withMMR[0].mmrScore).toBeLessThan(0.9);
            expect(withMMR[0].maxSimilarityToSelected).toBeGreaterThan(0);
        });

        it('should use custom lambda parameter', () => {
            const candidates = [{ id: '1', content: 'test', score: 0.8 }];
            const selected = [{ id: '2', content: 'test similar', score: 0.9 }];

            const withMMR1 = rerankingService.calculateMMR(candidates, selected, {
                lambda: 0.9,
            });
            const withMMR2 = rerankingService.calculateMMR(candidates, selected, {
                lambda: 0.1,
            });

            // Different lambdas should produce different scores
            expect(withMMR1[0].mmrScore).not.toBe(withMMR2[0].mmrScore);
        });

        it('should clamp MMR score to [0, 1]', () => {
            const candidates = [{ id: '1', content: 'test', score: 0.1 }];
            const selected = [{ id: '2', content: 'test', score: 0.9 }];

            const withMMR = rerankingService.calculateMMR(candidates, selected, {
                lambda: 0.1,
            });

            expect(withMMR[0].mmrScore).toBeGreaterThanOrEqual(0);
            expect(withMMR[0].mmrScore).toBeLessThanOrEqual(1);
        });

        it('should use originalScore if available', () => {
            const candidates = [
                { id: '1', content: 'test', score: 0.5, originalScore: 0.9 },
            ];
            const selected: any[] = [];

            const withMMR = rerankingService.calculateMMR(candidates, selected);

            // Should use originalScore
            expect(withMMR[0].mmrScore).toBe(0.9);
        });

        it('should attach maxSimilarityToSelected', () => {
            const candidates = [{ id: '1', content: 'test content', score: 0.8 }];
            const selected = [
                { id: '2', content: 'test similar content', score: 0.9 },
            ];

            const withMMR = rerankingService.calculateMMR(candidates, selected);

            expect(withMMR[0].maxSimilarityToSelected).toBeGreaterThan(0);
        });
    });

    describe('rerankByDiversity', () => {
        it('should return empty array for empty results', () => {
            const reranked = rerankingService.rerankByDiversity([]);
            expect(reranked).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const reranked = rerankingService.rerankByDiversity(null as never);
            expect(reranked).toEqual([]);
        });

        it('should return single result as-is', () => {
            const results = [{ id: '1', content: 'test', score: 0.9 }];
            const reranked = rerankingService.rerankByDiversity(results);

            expect(reranked).toHaveLength(1);
            expect(reranked[0].id).toBe('1');
        });

        it('should select diverse results using MMR', () => {
            const results = [
                { id: '1', content: 'artificial intelligence machine learning', score: 0.9 },
                { id: '2', content: 'artificial intelligence deep learning', score: 0.85 },
                { id: '3', content: 'cooking recipes food preparation', score: 0.8 },
                { id: '4', content: 'sports physical fitness exercise', score: 0.75 },
            ];

            const reranked = rerankingService.rerankByDiversity(results, { topK: 3 });

            expect(reranked).toHaveLength(3);
            // Should prefer diverse results
            expect(reranked.some(r => r.id === '1')).toBe(true);
        });

        it('should respect topK parameter', () => {
            const results = [
                { id: '1', score: 0.9, content: 'content1' },
                { id: '2', score: 0.8, content: 'content2' },
                { id: '3', score: 0.7, content: 'content3' },
                { id: '4', score: 0.6, content: 'content4' },
            ];

            const reranked = rerankingService.rerankByDiversity(results, { topK: 2 });

            expect(reranked).toHaveLength(2);
        });

        it('should use custom lambda', () => {
            const results = [
                { id: '1', content: 'test content one', score: 0.9 },
                { id: '2', content: 'test content two', score: 0.8 },
            ];

            const reranked = rerankingService.rerankByDiversity(results, {
                lambda: 0.9,
                topK: 2,
            });

            expect(reranked).toHaveLength(2);
        });

        it('should include MMR score history', () => {
            const results = [
                { id: '1', content: 'content1', score: 0.9 },
                { id: '2', content: 'content2', score: 0.8 },
            ];

            const reranked = rerankingService.rerankByDiversity(results);

            expect(reranked[0]._scoreHistory).toBeDefined();
            expect(reranked[0]._scoreHistory?.stage).toBe('mmr');
        });

        it('should update score to mmrScore', () => {
            const results = [
                { id: '1', content: 'test', score: 0.9 },
                { id: '2', content: 'other', score: 0.8 },
            ];

            const reranked = rerankingService.rerankByDiversity(results);

            expect(reranked[0].score).toBe(reranked[0].mmrScore);
        });
    });

    describe('semanticRerank', () => {
        it('should return empty array for empty results', () => {
            const reranked = rerankingService.semanticRerank('query', []);
            expect(reranked).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const reranked = rerankingService.semanticRerank('query', null as never);
            expect(reranked).toEqual([]);
        });

        it('should boost results with query term matches', () => {
            const results = [
                { id: '1', content: 'artificial intelligence deep learning', score: 0.5 },
                { id: '2', content: 'completely unrelated content here', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank(
                'artificial intelligence',
                results
            );

            // Result 1 should be boosted and ranked higher
            expect(reranked[0].id).toBe('1');
            expect(reranked[0].score).toBeGreaterThan(0.5);
        });

        it('should not boost below threshold scores', () => {
            const results = [
                { id: '1', content: 'matching query terms here', score: 0.2 },
            ];

            const reranked = rerankingService.semanticRerank('query terms', results, {
                minBoostThreshold: 0.3,
            });

            expect(reranked[0].score).toBe(0.2); // no boost
            expect((reranked[0]._scoreHistory?.semanticBoost as any)?.applied).toBe(false);
        });

        it('should use custom minBoostThreshold', () => {
            const results = [
                { id: '1', content: 'query matching content', score: 0.35 },
            ];

            const reranked = rerankingService.semanticRerank('query', results, {
                minBoostThreshold: 0.4,
            });

            expect((reranked[0]._scoreHistory?.semanticBoost as any)?.applied).toBe(false);
        });

        it('should use custom maxBoost', () => {
            const results = [
                { id: '1', content: 'query terms matching all', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('query terms matching', results, {
                maxBoost: 0.1,
            });

            expect(reranked[0].score).toBeGreaterThan(0.5);
            expect(reranked[0].score).toBeLessThanOrEqual(0.6);
        });

        it('should enable dynamic boost', () => {
            const results = [
                { id: '1', content: 'query matching content here', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('query matching', results, {
                dynamicBoostEnabled: true,
            });

            expect(reranked[0].score).toBeGreaterThan(0.5);
        });

        it('should clamp score to [0, 1]', () => {
            const results = [
                { id: '1', content: 'query query query query query', score: 0.99 },
            ];

            const reranked = rerankingService.semanticRerank('query', results, {
                maxBoost: 0.5,
            });

            expect(reranked[0].score).toBeLessThanOrEqual(1.0);
        });

        it('should include score history metadata', () => {
            const results = [
                { id: '1', content: 'query matching content', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('query', results);

            expect(reranked[0]._scoreHistory).toBeDefined();
            expect(reranked[0]._scoreHistory?.stage).toBe('rerank');
            expect(reranked[0]._scoreHistory?.semanticBoost).toBeDefined();
        });

        it('should sort results by boosted score', () => {
            const results = [
                { id: '1', content: 'unrelated content', score: 0.6 },
                { id: '2', content: 'query matching perfectly', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('query matching', results);

            // Result 2 should be ranked higher after boost
            for (let i = 0; i < reranked.length - 1; i++) {
                expect(reranked[i].score || 0).toBeGreaterThanOrEqual(
                    reranked[i + 1].score || 0
                );
            }
        });

        it('should filter short query tokens', () => {
            const results = [
                { id: '1', content: 'unrelated content without any matches', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('the is an at', results);

            // Short tokens (length <= 2) should be filtered, no matches
            expect((reranked[0]._scoreHistory?.semanticBoost as any)?.queryTermMatches).toBe(0);
        });

        it('should use text field if content is missing', () => {
            const results = [
                { id: '1', text: 'query matching text field', score: 0.5 },
            ];

            const reranked = rerankingService.semanticRerank('query matching', results);

            expect(reranked[0].score).toBeGreaterThan(0.5);
        });
    });

    describe('rerank', () => {
        it('should return empty array for empty results', () => {
            const reranked = rerankingService.rerank('query', []);
            expect(reranked).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const reranked = rerankingService.rerank('query', null as never);
            expect(reranked).toEqual([]);
        });

        it('should apply semantic boost by default', () => {
            const results = [
                { id: '1', content: 'query matching content', score: 0.5 },
            ];

            const reranked = rerankingService.rerank('query', results);

            expect(reranked[0]._scoreHistory?.semanticBoost).toBeDefined();
        });

        it('should skip semantic boost when disabled', () => {
            const results = [
                { id: '1', content: 'query matching content', score: 0.5 },
            ];

            const reranked = rerankingService.rerank('query', results, {
                useSemanticBoost: false,
            });

            // Should not have semantic boost in history
            expect(reranked[0]._scoreHistory?.stage).not.toBe('rerank');
        });

        it('should apply MMR when enabled', () => {
            const results = [
                { id: '1', content: 'content1', score: 0.9 },
                { id: '2', content: 'content2', score: 0.8 },
            ];

            const reranked = rerankingService.rerank('query', results, {
                useMMR: true,
            });

            expect(reranked[0]._scoreHistory?.stage).toBe('mmr');
        });

        it('should apply diversity filter when MMR disabled', () => {
            const results = [
                { id: '1', content: 'the quick brown fox jumps over lazy', score: 0.9 },
                { id: '2', content: 'the quick brown fox runs over lazy', score: 0.8 },
                { id: '3', content: 'the quick brown fox walks over lazy', score: 0.75 },
                { id: '4', content: 'completely different unrelated content here', score: 0.7 },
            ];

            const reranked = rerankingService.rerank('query', results, {
                useMMR: false,
                useDiversity: true,
                threshold: 0.6, // Lower threshold to filter more aggressively
            });

            // Should filter similar results (2 and 3 are very similar to 1)
            expect(reranked.length).toBeLessThan(results.length);
        });

        it('should respect finalK parameter', () => {
            const results = [
                { id: '1', content: 'content1', score: 0.9 },
                { id: '2', content: 'content2', score: 0.8 },
                { id: '3', content: 'content3', score: 0.7 },
                { id: '4', content: 'content4', score: 0.6 },
            ];

            const reranked = rerankingService.rerank('query', results, {
                finalK: 2,
                useMMR: false,
                useDiversity: false,
            });

            expect(reranked).toHaveLength(2);
        });

        it('should combine semantic boost and MMR', () => {
            const results = [
                { id: '1', content: 'query matching content', score: 0.5 },
                { id: '2', content: 'other content', score: 0.6 },
            ];

            const reranked = rerankingService.rerank('query', results, {
                useSemanticBoost: true,
                useMMR: true,
            });

            expect(reranked.length).toBeGreaterThan(0);
        });
    });

    describe('applyTemporalDecay', () => {
        it('should return results unchanged when disabled', () => {
            const results = [
                { id: '1', content: 'test', score: 0.9, source: 'email', sentAt: '2024-01-01' },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: false,
            });

            expect(decayed[0].score).toBe(0.9);
        });

        it('should return empty array for empty results', () => {
            const decayed = rerankingService.applyTemporalDecay([], { enabled: true });
            expect(decayed).toEqual([]);
        });

        it('should return null for null results', () => {
            const decayed = rerankingService.applyTemporalDecay(null as never, {
                enabled: true,
            });
            // Service returns null when input is null
            expect(decayed).toBeNull();
        });

        it('should apply decay to email results', () => {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const results = [
                {
                    id: '1',
                    content: 'test',
                    score: 0.9,
                    source: 'email',
                    sentAt: oneYearAgo.toISOString(),
                },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
                halfLifeDays: 365,
            });

            // Score should be decayed
            expect(decayed[0].score).toBeLessThan(0.9);
            expect(decayed[0]._scoreHistory?.temporalDecay).toBeDefined();
        });

        it('should not decay results without sentAt', () => {
            const results = [{ id: '1', content: 'test', score: 0.9 }];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
            });

            expect(decayed[0].score).toBe(0.9);
        });

        it('should not decay results without sentAt', () => {
            const results = [
                { id: '1', content: 'test', score: 0.9, source: 'document' },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
            });

            // No sentAt means no decay applied
            expect(decayed[0].score).toBe(0.9);
        });

        it('should respect minDecay parameter', () => {
            const veryOldDate = new Date('2000-01-01');

            const results = [
                {
                    id: '1',
                    content: 'test',
                    score: 0.9,
                    source: 'email',
                    sentAt: veryOldDate.toISOString(),
                },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
                minDecay: 0.5,
            });

            // Decay should not go below minDecay
            expect(decayed[0].score).toBeGreaterThanOrEqual(0.9 * 0.8); // baseWeight is 0.8
        });

        it('should use custom halfLifeDays', () => {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const results = [
                {
                    id: '1',
                    content: 'test',
                    score: 0.9,
                    source: 'email',
                    sentAt: oneYearAgo.toISOString(),
                },
            ];

            const decayed1 = rerankingService.applyTemporalDecay(results, {
                enabled: true,
                halfLifeDays: 365,
            });

            const decayed2 = rerankingService.applyTemporalDecay(results, {
                enabled: true,
                halfLifeDays: 730,
            });

            // Different half-lives should produce different scores
            expect(decayed1[0].score).not.toBe(decayed2[0].score);
        });

        it('should handle invalid dates gracefully', () => {
            const results = [
                {
                    id: '1',
                    content: 'test',
                    score: 0.9,
                    source: 'email',
                    sentAt: 'invalid-date',
                },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
            });

            // Should not crash, should return original score
            expect(decayed[0].score).toBe(0.9);
        });

        it('should include temporal decay metadata', () => {
            const results = [
                {
                    id: '1',
                    content: 'test',
                    score: 0.9,
                    source: 'email',
                    sentAt: new Date().toISOString(),
                },
            ];

            const decayed = rerankingService.applyTemporalDecay(results, {
                enabled: true,
            });

            expect(decayed[0]._scoreHistory?.temporalDecay).toBeDefined();
            expect((decayed[0]._scoreHistory?.temporalDecay as any)?.applied).toBe(true);
        });
    });

    describe('isRerankingEnabled', () => {
        it('should return true when enabled', () => {
            expect(rerankingService.isRerankingEnabled()).toBe(true);
        });
    });
});
