import config from '../config/appConfig';
import logger from '../config/logger';

interface SearchResult {
    id: string;
    score?: number;
    similarity?: number;
    fusedScore?: number;
    content?: string;
    text?: string;
    source?: string;
    sentAt?: string | Date;
    mmrScore?: number;
    maxSimilarityToSelected?: number;
    rawMMRScore?: number;
    originalScore?: number;
    _scoreHistory?: Record<string, unknown>;
    _boostSkipped?: boolean;
    [key: string]: unknown;
}

interface RerankOptions {
    threshold?: number;
    lambda?: number;
    topK?: number;
    useDiversity?: boolean;
    useSemanticBoost?: boolean;
    useMMR?: boolean;
    finalK?: number;
    minBoostThreshold?: number;
    maxBoost?: number;
    dynamicBoostEnabled?: boolean;
}

interface TemporalDecayOptions {
    enabled?: boolean;
    halfLifeDays?: number;
    minDecay?: number;
}

/**
 * Reranking Service
 *
 * Applies post-retrieval reranking to improve result quality:
 * 1. Semantic reranking - Boost results semantically closer to query
 * 2. Diversity filtering - Remove overly similar results
 * 3. MMR (Maximal Marginal Relevance) - Balance relevance and diversity
 */
class RerankingService {
    /**
     * Calculate cosine similarity between two vectors
     */
    calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Simple text-based similarity (Jaccard similarity)
     */
    calculateTextSimilarity(textA: string, textB: string): number {
        const tokensA = new Set(
            textA.toLowerCase().split(/\s+/).filter(t => t.length > 2)
        );
        const tokensB = new Set(
            textB.toLowerCase().split(/\s+/).filter(t => t.length > 2)
        );

        const intersection = new Set(
            [...tokensA].filter(token => tokensB.has(token))
        );

        const union = new Set([...tokensA, ...tokensB]);

        if (union.size === 0) return 0;

        return intersection.size / union.size;
    }

    /**
     * Apply diversity filter to remove overly similar results
     */
    applyDiversityFilter(results: SearchResult[], options: RerankOptions = {}): SearchResult[] {
        const {
            threshold = config.ragOptimization.reranking.diversityThreshold,
        } = options;

        if (!results || results.length === 0) {
            return [];
        }

        const filtered = [results[0]]; // Always keep first (highest score)

        for (let i = 1; i < results.length; i++) {
            const candidate = results[i];
            let isDiverse = true;

            // Check similarity with all already selected results
            for (const selected of filtered) {
                const similarity = this.calculateTextSimilarity(
                    candidate.content || '',
                    selected.content || ''
                );

                if (similarity >= threshold) {
                    isDiverse = false;
                    logger.debug('Filtered similar result', {
                        candidateId: candidate.id,
                        selectedId: selected.id,
                        similarity: similarity.toFixed(3),
                        threshold,
                    });
                    break;
                }
            }

            if (isDiverse) {
                filtered.push(candidate);
            }
        }

        logger.debug('Diversity filter applied', {
            originalCount: results.length,
            filteredCount: filtered.length,
            removedCount: results.length - filtered.length,
        });

        return filtered;
    }

    /**
     * Calculate MMR (Maximal Marginal Relevance) scores
     */
    calculateMMR(
        candidates: SearchResult[],
        selected: SearchResult[],
        options: RerankOptions = {}
    ): SearchResult[] {
        const {
            lambda = config.ragOptimization.reranking.mmrLambda,
        } = options;

        return candidates.map(candidate => {
            const relevance = candidate.originalScore || candidate.score || candidate.fusedScore || candidate.similarity || 0;

            let maxSimilarity = 0;

            if (selected.length > 0) {
                for (const selectedItem of selected) {
                    const similarity = this.calculateTextSimilarity(
                        candidate.content || '',
                        selectedItem.content || ''
                    );

                    maxSimilarity = Math.max(maxSimilarity, similarity);
                }
            }

            const rawMMRScore = selected.length === 0
                ? relevance
                : lambda * relevance - (1 - lambda) * maxSimilarity;

            const mmrScore = Math.max(0, Math.min(rawMMRScore, 1.0));

            return {
                ...candidate,
                mmrScore,
                maxSimilarityToSelected: maxSimilarity,
                rawMMRScore,
            };
        });
    }

    /**
     * Rerank results using MMR for diversity
     */
    rerankByDiversity(results: SearchResult[], options: RerankOptions = {}): SearchResult[] {
        const {
            topK = config.ragOptimization.reranking.finalK,
            lambda = config.ragOptimization.reranking.mmrLambda,
        } = options;

        if (!results || results.length === 0) {
            return [];
        }

        if (results.length === 1) {
            return results;
        }

        const selected: SearchResult[] = [];
        const remaining = [...results];

        while (selected.length < topK && remaining.length > 0) {
            const withMMR = this.calculateMMR(remaining, selected, { lambda });

            withMMR.sort((a, b) => (b.mmrScore || 0) - (a.mmrScore || 0));
            const best = withMMR[0];

            selected.push(best);

            const bestIndex = remaining.findIndex(r => r.id === best.id);
            if (bestIndex >= 0) {
                remaining.splice(bestIndex, 1);
            }
        }

        return selected.map((result, index) => ({
            ...result,
            score: result.mmrScore,
            _scoreHistory: {
                ...(result._scoreHistory || {}),
                stage: 'mmr',
                mmr: {
                    mmrScore: result.mmrScore,
                    maxSimilarityToSelected: result.maxSimilarityToSelected,
                    rawMMRScore: result.rawMMRScore,
                    position: index + 1
                }
            }
        }));
    }

    /**
     * Semantic reranking - boost results with higher semantic relevance
     */
    semanticRerank(query: string, results: SearchResult[], options: RerankOptions = {}): SearchResult[] {
        const {
            minBoostThreshold = config.ragOptimization.reranking.semanticBoost?.minThreshold || 0.30,
            maxBoost = config.ragOptimization.reranking.semanticBoost?.maxBoost || 0.05,
            dynamicBoostEnabled = false,
        } = options;

        const MIN_BOOST_THRESHOLD = minBoostThreshold;
        const MAX_BOOST = maxBoost;

        if (!results || results.length === 0) {
            return [];
        }

        const queryTokens = new Set(
            query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
        );

        const withBoost = results.map(result => {
            const content = (result.content || result.text || '').toLowerCase();

            let matches = 0;
            for (const token of queryTokens) {
                if (content.includes(token)) {
                    matches++;
                }
            }

            const matchRatio = queryTokens.size > 0 ? matches / queryTokens.size : 0;

            const originalScore = result.score || result.fusedScore || result.similarity || 0;

            if (originalScore < MIN_BOOST_THRESHOLD) {
                return {
                    ...result,
                    score: originalScore,
                    _scoreHistory: {
                        ...(result._scoreHistory || {}),
                        stage: 'rerank',
                        semanticBoost: {
                            applied: false,
                            reason: 'below_threshold',
                            originalScore,
                            queryTermMatches: matches,
                            matchRatio
                        }
                    }
                };
            }

            let boostAmount: number;
            if (dynamicBoostEnabled) {
                boostAmount = matchRatio * MAX_BOOST * (1 + matchRatio);
                boostAmount = Math.min(boostAmount, MAX_BOOST * 2);
            } else {
                boostAmount = Math.min(matchRatio * MAX_BOOST, MAX_BOOST);
            }
            const boostedScore = originalScore + boostAmount;

            const finalScore = Math.min(Math.max(boostedScore, 0), 1.0);

            return {
                ...result,
                score: finalScore,
                similarity: result.similarity,
                _scoreHistory: {
                    ...(result._scoreHistory || {}),
                    stage: 'rerank',
                    semanticBoost: {
                        applied: true,
                        originalScore,
                        boostAmount,
                        queryTermMatches: matches,
                        matchRatio,
                        rawBoostedScore: boostedScore,
                        finalScore
                    }
                }
            };
        });

        withBoost.sort((a, b) => (b.score || 0) - (a.score || 0));

        const topScoreHistory = withBoost[0]?._scoreHistory;

        logger.debug('Semantic reranking applied', {
            resultsCount: results.length,
            queryTerms: queryTokens.size,
            topBoost: topScoreHistory && typeof topScoreHistory === 'object'
                ? (topScoreHistory as Record<string, unknown>).semanticBoost
                : undefined,
            skippedCount: withBoost.filter(r => r._boostSkipped).length,
        });

        return withBoost;
    }

    /**
     * Full reranking pipeline
     */
    rerank(query: string, results: SearchResult[], options: RerankOptions = {}): SearchResult[] {
        const {
            useDiversity = config.ragOptimization.reranking.useDiversityFilter,
            useSemanticBoost = true,
            useMMR = config.ragOptimization.reranking.useMMR,
            finalK = config.ragOptimization.reranking.finalK,
        } = options;

        if (!results || results.length === 0) {
            return [];
        }

        let reranked = results;

        if (useSemanticBoost) {
            reranked = this.semanticRerank(query, reranked, options);

            logger.debug('Semantic reranking completed', {
                resultsCount: reranked.length,
            });
        }

        if (useMMR) {
            reranked = this.rerankByDiversity(reranked, {
                ...options,
                topK: finalK,
            });

            logger.info('MMR reranking completed', {
                finalCount: reranked.length,
                lambda: options.lambda || config.ragOptimization.reranking.mmrLambda,
            });
        } else if (useDiversity) {
            reranked = this.applyDiversityFilter(reranked, options);
            reranked = reranked.slice(0, finalK);

            logger.info('Diversity filtering completed', {
                finalCount: reranked.length,
            });
        } else {
            reranked = reranked.slice(0, finalK);
        }

        return reranked;
    }

    /**
     * Apply temporal decay to email results
     */
    applyTemporalDecay(results: SearchResult[], options: TemporalDecayOptions = {}): SearchResult[] {
        const {
            enabled = false,
            halfLifeDays = 365,
            minDecay = 0.5,
        } = options;

        if (!enabled || !results || results.length === 0) {
            return results;
        }

        const now = new Date();
        const ln2 = Math.log(2);

        return results.map(result => {
            if (!result.sentAt && result.source !== 'email') {
                return result;
            }

            let sentDate: Date | null;
            try {
                sentDate = result.sentAt ? new Date(result.sentAt) : null;
            } catch {
                sentDate = null;
            }

            if (!sentDate || isNaN(sentDate.getTime())) {
                return result;
            }

            const daysSinceSent = Math.max(0, (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

            const decayFactor = Math.exp(-daysSinceSent / halfLifeDays * ln2);

            const adjustedDecay = Math.max(decayFactor, minDecay);

            const originalScore = result.score || result.similarity || 0;

            const baseWeight = 0.8;
            const decayRange = 0.2;
            const finalScore = originalScore * (baseWeight + decayRange * adjustedDecay);

            return {
                ...result,
                score: finalScore,
                _scoreHistory: {
                    ...(result._scoreHistory || {}),
                    temporalDecay: {
                        applied: true,
                        daysSinceSent: Math.round(daysSinceSent),
                        decayFactor: adjustedDecay.toFixed(4),
                        originalScore,
                        finalScore,
                        halfLifeDays
                    }
                }
            };
        });
    }

    /**
     * Check if reranking is enabled
     */
    isRerankingEnabled(): boolean {
        return config.ragOptimization.reranking.enabled;
    }
}

export default new RerankingService();
