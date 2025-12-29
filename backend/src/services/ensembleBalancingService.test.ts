import ensembleBalancingService from './ensembleBalancingService';

jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        ragOptimization: {
            hybridSearch: {
                vectorWeight: 0.5,
                bm25Weight: 0.5,
            },
        },
        semanticSearch: {
            ensembleBalancing: {
                enabled: true,
            },
        },
    },
}));

describe('EnsembleBalancingService', () => {
    describe('calculateAdaptiveWeights', () => {
        it('should calculate adaptive weights when balancing is enabled', () => {
            const vectorResults = [{ id: '1', score: 0.9 }];
            const bm25Results = [{ id: '1', score: 0.8 }];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'test query'
            );

            // Weights should be adjusted from default 0.5/0.5
            // and should sum to 1
            expect(weights.vector + weights.bm25).toBeCloseTo(1.0, 5);
            expect(weights.vector).toBeGreaterThan(0);
            expect(weights.bm25).toBeGreaterThan(0);
        });

        it('should adjust weights based on score quality', () => {
            const vectorResults = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.85 },
                { id: '3', score: 0.8 },
            ];

            const bm25Results = [
                { id: '1', score: 0.6 },
                { id: '2', score: 0.55 },
                { id: '3', score: 0.5 },
            ];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'mixed query'
            );

            // Vector has higher mean scores (0.85 vs 0.55)
            // With mixed query type, vector should get reasonable weight
            expect(weights.vector).toBeGreaterThanOrEqual(0.3);
            expect(weights.bm25).toBeGreaterThanOrEqual(0.3);
            expect(weights.vector + weights.bm25).toBeCloseTo(1.0, 5);
        });

        it('should prefer BM25 for keyword queries', () => {
            const vectorResults = [{ id: '1', score: 0.7 }];
            const bm25Results = [{ id: '1', score: 0.7 }];

            // Short keyword query
            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'API key'
            );

            // BM25 should get more weight for keyword queries
            expect(weights.bm25).toBeGreaterThan(weights.vector);
        });

        it('should prefer vector for semantic queries', () => {
            const vectorResults = [{ id: '1', score: 0.7 }];
            const bm25Results = [{ id: '1', score: 0.7 }];

            // Longer semantic query with question word
            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'How can I implement authentication in my application?'
            );

            // Vector should get more weight for semantic queries
            expect(weights.vector).toBeGreaterThan(weights.bm25);
        });

        it('should adjust weights based on score variance', () => {
            // Vector results with low variance (consistent)
            const vectorResults = [
                { id: '1', score: 0.75 },
                { id: '2', score: 0.74 },
                { id: '3', score: 0.73 },
            ];

            // BM25 results with high variance (inconsistent)
            const bm25Results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.3 },
                { id: '3', score: 0.4 },
            ];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'this is a mixed query type'
            );

            // Vector has lower variance (more consistent), weights should be reasonable
            expect(weights.vector).toBeGreaterThan(0);
            expect(weights.bm25).toBeGreaterThan(0);
            expect(weights.vector + weights.bm25).toBeCloseTo(1.0, 5);
        });

        it('should normalize weights to sum to 1', () => {
            const vectorResults = [{ id: '1', score: 0.8 }];
            const bm25Results = [{ id: '1', score: 0.6 }];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'query'
            );

            const sum = weights.vector + weights.bm25;
            expect(sum).toBeCloseTo(1.0, 5);
        });

        it('should keep weights within bounds', () => {
            // Extreme scores to test bounds
            const vectorResults = [
                { id: '1', score: 0.99 },
                { id: '2', score: 0.98 },
                { id: '3', score: 0.97 },
            ];

            const bm25Results = [
                { id: '1', score: 0.1 },
                { id: '2', score: 0.09 },
                { id: '3', score: 0.08 },
            ];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'How to do something very specific with detailed requirements?'
            );

            // Weights should be within [0.3, 0.7] before normalization
            expect(weights.vector).toBeGreaterThanOrEqual(0.3);
            expect(weights.vector).toBeLessThanOrEqual(0.7);
            expect(weights.bm25).toBeGreaterThanOrEqual(0.3);
            expect(weights.bm25).toBeLessThanOrEqual(0.7);
        });

        it('should handle empty results', () => {
            const weights = ensembleBalancingService.calculateAdaptiveWeights([], [], 'query');

            // Even with empty results, adaptive weights are calculated
            // Stats will be all zeros, so adjustments still happen based on query type
            expect(weights.vector + weights.bm25).toBeCloseTo(1.0, 5);
            expect(weights.vector).toBeGreaterThan(0);
            expect(weights.bm25).toBeGreaterThan(0);
        });

        it('should use similarity score when score is not present', () => {
            const vectorResults = [
                { id: '1', similarity: 0.9 },
                { id: '2', similarity: 0.85 },
            ];

            const bm25Results = [
                { id: '1', score: 0.6 },
                { id: '2', score: 0.55 },
            ];

            const weights = ensembleBalancingService.calculateAdaptiveWeights(
                vectorResults,
                bm25Results,
                'test'
            );

            // Should still calculate weights properly
            expect(weights.vector).toBeGreaterThan(0);
            expect(weights.bm25).toBeGreaterThan(0);
        });
    });

    describe('_analyzeScoreDistribution', () => {
        it('should return zeros for empty results', () => {
            const stats = ensembleBalancingService._analyzeScoreDistribution([]);

            expect(stats.mean).toBe(0);
            expect(stats.variance).toBe(0);
            expect(stats.min).toBe(0);
            expect(stats.max).toBe(0);
        });

        it('should return zeros for null results', () => {
            const stats = ensembleBalancingService._analyzeScoreDistribution(null as never);

            expect(stats.mean).toBe(0);
            expect(stats.variance).toBe(0);
            expect(stats.min).toBe(0);
            expect(stats.max).toBe(0);
        });

        it('should calculate mean correctly', () => {
            const results = [
                { id: '1', score: 0.8 },
                { id: '2', score: 0.6 },
                { id: '3', score: 0.4 },
            ];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.mean).toBeCloseTo(0.6, 5);
        });

        it('should calculate variance correctly', () => {
            const results = [
                { id: '1', score: 0.5 },
                { id: '2', score: 0.5 },
                { id: '3', score: 0.5 },
            ];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.variance).toBe(0); // No variance when all values are the same
        });

        it('should find min and max scores', () => {
            const results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.3 },
                { id: '3', score: 0.6 },
            ];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.min).toBe(0.3);
            expect(stats.max).toBe(0.9);
        });

        it('should use similarity when score is not present', () => {
            const results = [
                { id: '1', similarity: 0.8 },
                { id: '2', similarity: 0.6 },
            ];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.mean).toBeCloseTo(0.7, 5);
        });

        it('should default to 0 when neither score nor similarity', () => {
            const results = [
                { id: '1', content: 'test' },
                { id: '2', content: 'test2' },
            ];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.mean).toBe(0);
        });

        it('should handle single result', () => {
            const results = [{ id: '1', score: 0.75 }];

            const stats = ensembleBalancingService._analyzeScoreDistribution(results);

            expect(stats.mean).toBe(0.75);
            expect(stats.variance).toBe(0);
            expect(stats.min).toBe(0.75);
            expect(stats.max).toBe(0.75);
        });
    });

    describe('_detectQueryType', () => {
        it('should detect keyword queries (short)', () => {
            expect(ensembleBalancingService._detectQueryType('API key')).toBe('keyword');
            expect(ensembleBalancingService._detectQueryType('login')).toBe('keyword');
            expect(ensembleBalancingService._detectQueryType('error 404')).toBe('keyword');
        });

        it('should detect keyword queries (with quotes)', () => {
            expect(ensembleBalancingService._detectQueryType('"exact phrase match"')).toBe(
                'keyword'
            );
            expect(
                ensembleBalancingService._detectQueryType('search for "specific term" in docs')
            ).toBe('keyword');
        });

        it('should detect semantic queries (long with question words)', () => {
            expect(
                ensembleBalancingService._detectQueryType(
                    'How can I implement user authentication in my application?'
                )
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'What are the best practices for securing API endpoints?'
                )
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'Why does my application crash when loading large files?'
                )
            ).toBe('semantic');
        });

        it('should detect semantic queries (various question words)', () => {
            expect(
                ensembleBalancingService._detectQueryType('When should I use webhooks in my app?')
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'Where can I find the configuration file for the database?'
                )
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'Who is responsible for handling authentication in the system?'
                )
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'Which library should I use for data visualization in my project?'
                )
            ).toBe('semantic');
        });

        it('should detect mixed queries', () => {
            // 4-6 words without question words = mixed
            expect(
                ensembleBalancingService._detectQueryType('implement user authentication system')
            ).toBe('mixed');

            expect(
                ensembleBalancingService._detectQueryType('database connection error handling')
            ).toBe('mixed');

            expect(
                ensembleBalancingService._detectQueryType('best practices for API design')
            ).toBe('mixed');
        });

        it('should handle empty or whitespace queries', () => {
            expect(ensembleBalancingService._detectQueryType('')).toBe('keyword');
            expect(ensembleBalancingService._detectQueryType('   ')).toBe('keyword');
        });

        it('should be case insensitive for question words', () => {
            expect(
                ensembleBalancingService._detectQueryType(
                    'HOW CAN I DO SOMETHING WITH MULTIPLE WORDS IN QUERY?'
                )
            ).toBe('semantic');

            expect(
                ensembleBalancingService._detectQueryType(
                    'what is the best way to handle errors in code?'
                )
            ).toBe('semantic');
        });

        it('should detect keyword for query with 3 words', () => {
            expect(ensembleBalancingService._detectQueryType('three word query')).toBe('keyword');
        });

        it('should handle queries with multiple spaces', () => {
            // 6 words with question word "how" but needs >= 7 words for semantic
            expect(
                ensembleBalancingService._detectQueryType('how   can   I   do   something   here')
            ).toBe('mixed');

            // 8 words with question word = semantic
            expect(
                ensembleBalancingService._detectQueryType(
                    'how   can   I   do   something   interesting   in   application'
                )
            ).toBe('semantic');
        });
    });

    describe('isBalancingEnabled', () => {
        it('should return true when balancing is enabled', () => {
            expect(ensembleBalancingService.isBalancingEnabled()).toBe(true);
        });
    });

    describe('processEnsemble', () => {
        it('should return empty array for empty results', () => {
            const result = ensembleBalancingService.processEnsemble([], 10);
            expect(result).toEqual([]);
        });

        it('should return empty array for null results', () => {
            const result = ensembleBalancingService.processEnsemble(null as never, 10);
            expect(result).toEqual([]);
        });

        it('should limit results to maxResults', () => {
            const results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.8 },
                { id: '3', score: 0.7 },
                { id: '4', score: 0.6 },
                { id: '5', score: 0.5 },
            ];

            const limited = ensembleBalancingService.processEnsemble(results, 3);

            expect(limited).toHaveLength(3);
            expect(limited[0].id).toBe('1');
            expect(limited[1].id).toBe('2');
            expect(limited[2].id).toBe('3');
        });

        it('should return all results if fewer than maxResults', () => {
            const results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.8 },
            ];

            const limited = ensembleBalancingService.processEnsemble(results, 10);

            expect(limited).toHaveLength(2);
            expect(limited).toEqual(results);
        });

        it('should handle maxResults of 0', () => {
            const results = [
                { id: '1', score: 0.9 },
                { id: '2', score: 0.8 },
            ];

            const limited = ensembleBalancingService.processEnsemble(results, 0);

            expect(limited).toEqual([]);
        });

        it('should accept options parameter', () => {
            const results = [{ id: '1', score: 0.9 }];

            const limited = ensembleBalancingService.processEnsemble(results, 5, {
                skipThreshold: true,
            });

            expect(limited).toHaveLength(1);
        });

        it('should preserve result properties', () => {
            const results = [
                {
                    id: '1',
                    score: 0.9,
                    content: 'Test content',
                    metadata: { source: 'doc.pdf' },
                },
            ];

            const limited = ensembleBalancingService.processEnsemble(results, 10);

            expect(limited[0]).toEqual(results[0]);
            expect(limited[0].content).toBe('Test content');
            expect(limited[0].metadata).toEqual({ source: 'doc.pdf' });
        });
    });
});
