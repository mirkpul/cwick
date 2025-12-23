import config from '../config/appConfig';
import logger from '../config/logger';

interface NormalizationMetadata {
    method: string;
    [key: string]: unknown;
}

interface ScoreHistory {
    stage?: string;
    [key: string]: unknown;
}

interface SearchResult {
    id: string;
    score?: number;
    similarity?: number;
    fusedScore?: number;
    normalizedScore?: number;
    vectorRank?: number | null;
    bm25Rank?: number | null;
    fusionMethod?: string;
    content?: string;
    _normalization?: NormalizationMetadata;
    _scoreHistory?: ScoreHistory;
    [key: string]: unknown;
}

interface BM25Params {
    k1?: number;
    b?: number;
}

interface FusionOptions {
    k?: number;
    vectorWeight?: number;
    bm25Weight?: number;
    normalizationMethod?: 'robust' | 'min-max' | 'z-score' | 'none';
}

interface MergeOptions {
    combineMethod?: 'max' | 'average' | 'sum';
}

/**
 * Hybrid Search Service
 *
 * Combines dense vector search (semantic) with sparse BM25 search (keyword)
 * for improved retrieval accuracy.
 */
class HybridSearchService {
    /**
     * Calculate BM25 score for a term in a document
     */
    calculateBM25Score(
        termFreq: number,
        docLength: number,
        avgDocLength: number,
        docCount: number,
        docsWithTerm: number,
        params: BM25Params = {}
    ): number {
        const k1 = params.k1 || config.ragOptimization.hybridSearch.bm25K1;
        const b = params.b || config.ragOptimization.hybridSearch.bm25B;

        if (termFreq === 0) return 0;

        // Calculate IDF (Inverse Document Frequency)
        const idf = Math.log(
            (docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1
        );

        // Calculate term frequency component
        const tfComponent =
            (termFreq * (k1 + 1)) /
            (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));

        return idf * tfComponent;
    }

    /**
     * Reciprocal Rank Fusion (RRF)
     */
    reciprocalRankFusion(
        vectorResults: SearchResult[],
        bm25Results: SearchResult[],
        options: FusionOptions = {}
    ): SearchResult[] {
        const { k = config.ragOptimization.hybridSearch.rffK } = options;

        // Create rank maps
        const vectorRanks = new Map<string, number>();
        const bm25Ranks = new Map<string, number>();

        vectorResults.forEach((result, index) => {
            vectorRanks.set(result.id, index + 1);
        });

        bm25Results.forEach((result, index) => {
            bm25Ranks.set(result.id, index + 1);
        });

        // Get all unique IDs
        const allIds = new Set([
            ...vectorRanks.keys(),
            ...bm25Ranks.keys(),
        ]);

        // Calculate RRF scores
        const fusedResults: SearchResult[] = [];

        for (const id of allIds) {
            const vectorRank = vectorRanks.get(id) || Infinity;
            const bm25Rank = bm25Ranks.get(id) || Infinity;

            const rrfScore =
                (vectorRank !== Infinity ? 1 / (k + vectorRank) : 0) +
                (bm25Rank !== Infinity ? 1 / (k + bm25Rank) : 0);

            // Find original result object
            const vectorResult = vectorResults.find(r => r.id === id);
            const bm25Result = bm25Results.find(r => r.id === id);

            const result = vectorResult || bm25Result;

            fusedResults.push({
                ...result,
                id,
                fusedScore: rrfScore,
                vectorRank: vectorRank !== Infinity ? vectorRank : null,
                bm25Rank: bm25Rank !== Infinity ? bm25Rank : null,
                fusionMethod: 'rrf',
            });
        }

        // Sort by fused score (descending)
        fusedResults.sort((a, b) => (b.fusedScore || 0) - (a.fusedScore || 0));

        logger.debug('RRF fusion completed', {
            vectorResultsCount: vectorResults.length,
            bm25ResultsCount: bm25Results.length,
            fusedResultsCount: fusedResults.length,
            topScore: fusedResults[0]?.fusedScore,
        });

        return fusedResults;
    }

    /**
     * Weighted score fusion
     */
    weightedFusion(
        vectorResults: SearchResult[],
        bm25Results: SearchResult[],
        options: FusionOptions = {}
    ): SearchResult[] {
        const {
            vectorWeight = config.ragOptimization.hybridSearch.vectorWeight,
            bm25Weight = config.ragOptimization.hybridSearch.bm25Weight,
            normalizationMethod = 'robust',
        } = options;

        let normalizedVector: SearchResult[];
        let normalizedBM25: SearchResult[];

        if (normalizationMethod === 'robust') {
            // Vector: Keep original similarity (already 0-1)
            normalizedVector = vectorResults.map(r => ({
                ...r,
                score: r.similarity || r.score,
                normalizedScore: r.similarity || r.score,
                _normalization: { method: 'passthrough', reason: 'cosine_similarity_already_normalized' }
            }));

            // BM25: Use z-score + sigmoid for robustness against outliers
            normalizedBM25 = this.normalizeScores(bm25Results, 'z-score');
        } else {
            // Legacy behavior
            normalizedVector = this.normalizeScores(
                vectorResults.map(r => ({ ...r, score: r.similarity || r.score })),
                normalizationMethod
            );
            normalizedBM25 = this.normalizeScores(bm25Results, normalizationMethod);
        }

        // Create lookup maps
        const vectorMap = new Map(
            normalizedVector.map(r => [r.id, r.normalizedScore || 0])
        );
        const bm25Map = new Map(
            normalizedBM25.map(r => [r.id, r.normalizedScore || 0])
        );

        // Get all unique IDs
        const allIds = new Set([...vectorMap.keys(), ...bm25Map.keys()]);

        // Calculate weighted scores
        const fusedResults: SearchResult[] = [];

        for (const id of allIds) {
            const vectorScore = vectorMap.get(id) || 0;
            const bm25Score = bm25Map.get(id) || 0;

            const finalScore = vectorScore * vectorWeight + bm25Score * bm25Weight;

            // Find original result
            const vectorResult = vectorResults.find(r => r.id === id);
            const bm25Result = bm25Results.find(r => r.id === id);
            const result = vectorResult || bm25Result;

            fusedResults.push({
                ...result,
                id,
                score: finalScore,
                similarity: result?.similarity,
                _scoreHistory: {
                    stage: 'fusion',
                    method: 'weighted',
                    inputs: {
                        vector: { original: result?.similarity || 0, normalized: vectorScore },
                        bm25: { original: result?.score || 0, normalized: bm25Score }
                    },
                    weights: { vector: vectorWeight, bm25: bm25Weight },
                    output: finalScore
                }
            });
        }

        // Sort by fused score (descending)
        fusedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

        logger.debug('Weighted fusion completed', {
            vectorResultsCount: vectorResults.length,
            bm25ResultsCount: bm25Results.length,
            fusedResultsCount: fusedResults.length,
            weights: { vectorWeight, bm25Weight },
        });

        return fusedResults;
    }

    /**
     * Tokenize text for BM25 search
     */
    tokenize(text: string): string[] {
        if (!text) return [];

        // Common English stopwords
        const stopwords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'will', 'with', 'or', 'but', 'not', 'have', 'had',
            'over', 'this', 'can', 'were', 'been', 'into', 'would', 'there',
        ]);

        // Lowercase and remove punctuation
        const cleaned = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Split and filter
        const tokens = cleaned
            .split(' ')
            .filter(token => token.length > 2 && !stopwords.has(token));

        // Remove duplicates
        return [...new Set(tokens)];
    }

    /**
     * Normalize scores to 0-1 range
     */
    normalizeScores(results: SearchResult[], method: string = 'min-max'): SearchResult[] {
        if (!results || results.length === 0) {
            return [];
        }

        // Edge case: Single result → always return 1.0 (best possible)
        if (results.length === 1) {
            return results.map(result => ({
                ...result,
                normalizedScore: 1.0,
                _normalization: { method, singleResult: true }
            }));
        }

        const scores = results.map(r => r.score || 0);

        if (method === 'min-max') {
            const min = Math.min(...scores);
            const max = Math.max(...scores);
            const range = max - min;

            // Edge case: All scores identical → return 1.0 for all
            if (range === 0) {
                return results.map(result => ({
                    ...result,
                    normalizedScore: 1.0,
                    _normalization: { method, identicalScores: true, originalScore: result.score }
                }));
            }

            return results.map(result => ({
                ...result,
                normalizedScore: ((result.score || 0) - min) / range,
                _normalization: { method, min, max, range }
            }));
        }

        if (method === 'z-score') {
            const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            const variance =
                scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
                scores.length;
            const stdDev = Math.sqrt(variance);

            // Edge case: No variance → all identical → return 1.0
            if (stdDev === 0) {
                return results.map(result => ({
                    ...result,
                    normalizedScore: 1.0,
                    _normalization: { method, identicalScores: true, originalScore: result.score }
                }));
            }

            // Clamp z-score to [0, 1] using sigmoid
            return results.map(result => {
                const zScore = ((result.score || 0) - mean) / stdDev;
                // Sigmoid: maps (-∞, +∞) → (0, 1)
                const normalizedScore = 1 / (1 + Math.exp(-zScore));

                return {
                    ...result,
                    normalizedScore,
                    _normalization: { method, mean, stdDev, zScore }
                };
            });
        }

        // No normalization
        return results.map(result => ({
            ...result,
            normalizedScore: result.score,
            _normalization: { method: 'none' }
        }));
    }

    /**
     * Merge results from multiple search queries
     */
    mergeResults(resultSets: SearchResult[][], options: MergeOptions = {}): SearchResult[] {
        const { combineMethod = 'max' } = options;

        // Flatten all results
        const allResults = resultSets.flat();

        if (allResults.length === 0) {
            return [];
        }

        // Group by ID
        const resultMap = new Map<string, SearchResult[]>();

        for (const result of allResults) {
            if (!resultMap.has(result.id)) {
                resultMap.set(result.id, [result]);
            } else {
                resultMap.get(result.id)!.push(result);
            }
        }

        // Combine scores for duplicates
        const merged: SearchResult[] = [];

        for (const [_id, results] of resultMap.entries()) {
            if (results.length === 1) {
                // Single occurrence - keep as-is with unified score structure
                merged.push({
                    ...results[0],
                    _scoreHistory: {
                        ...(results[0]._scoreHistory || {}),
                        mergeMethod: 'single',
                        occurrences: 1
                    }
                });
            } else {
                // Multiple occurrences - combine scores using UNIFIED 'score' field
                const scores = results.map(r => r.score || 0);

                let finalScore: number;
                if (combineMethod === 'max') {
                    finalScore = Math.max(...scores);
                } else if (combineMethod === 'average') {
                    finalScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
                } else if (combineMethod === 'sum') {
                    // CRITICAL FIX: Clamp sum to [0, 1] to prevent accumulation
                    const sum = scores.reduce((sum, s) => sum + s, 0);
                    finalScore = Math.min(sum, 1.0);
                } else {
                    finalScore = Math.max(...scores);
                }

                merged.push({
                    ...results[0],
                    score: finalScore,
                    _scoreHistory: {
                        ...(results[0]._scoreHistory || {}),
                        mergeMethod: combineMethod,
                        occurrences: results.length,
                        individualScores: scores,
                        output: finalScore
                    }
                });
            }
        }

        // Sort by unified score
        merged.sort((a, b) => (b.score || 0) - (a.score || 0));

        logger.debug('Results merged', {
            inputResultSets: resultSets.length,
            totalResults: allResults.length,
            mergedResults: merged.length,
            combineMethod,
        });

        return merged;
    }

    /**
     * Check if hybrid search is enabled
     */
    isHybridSearchEnabled(): boolean {
        return config.ragOptimization.hybridSearch.enabled;
    }

    /**
     * Get configured fusion method
     */
    getFusionMethod(): string {
        return config.ragOptimization.hybridSearch.fusionMethod;
    }
}

export default new HybridSearchService();
