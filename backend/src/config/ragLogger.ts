/**
 * Structured logger for RAG and LLM operations
 * Provides clean, readable logs for debugging the RAG pipeline
 *
 * Set RAG_LOG_VERBOSE=true for detailed logs, otherwise shows compact summary
 */

export const VERBOSE = process.env.RAG_LOG_VERBOSE === 'true';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

interface ScoreHistory {
  stage?: string;
  semanticBoost?: {
    applied: boolean;
    boostAmount?: number;
    queryTermMatches?: number;
    rawBoostedScore?: number;
    reason?: string;
  };
}

interface SearchResult {
  id?: string;
  source?: string;
  title?: string;
  score?: number;
  similarity?: number;
  senderName?: string;
  _scoreHistory?: ScoreHistory;
}

interface SearchConfig {
  threshold?: number;
  maxResults?: number;
  usingPerKBConfig?: boolean;
  kbThreshold?: number;
  emailThreshold?: number;
}

interface EnhancedData {
  enhancedQuery?: string;
  hyde?: string;
  queryVariants?: string[];
}

interface PipelineSummaryData {
  conversationId?: string;
  query?: string;
  config?: SearchConfig;
  vectorResults?: SearchResult[];
  bm25Results?: SearchResult[];
  fusedResults?: SearchResult[];
  afterThreshold?: SearchResult[];
  afterRerank?: SearchResult[];
  finalResults?: SearchResult[];
  totalTimeMs?: number;
}

/**
 * Format a score with color coding
 */
function formatScore(score: number | undefined | null, type = 'similarity', wasNormalized = false): string {
  if (score === undefined || score === null) return 'N/A';

  // BM25 scores are unbounded - show raw value, not percentage
  if (type === 'bm25' || (score > 1.0 && type === 'similarity')) {
    const displayValue = score.toFixed(2);
    const color = colors.cyan; // BM25 scores are always cyan
    return `${color}${displayValue}${colors.reset} (${type})`;
  }

  // For normalized scores [0,1], show as percentage
  const percentage = Math.round(score * 100);
  let color: string;

  if (score >= 0.85) color = colors.green;
  else if (score >= 0.70) color = colors.cyan;
  else if (score >= 0.50) color = colors.yellow;
  else color = colors.red;

  // Add indicator if score was capped at 100%
  const normalizedIndicator = wasNormalized ? `${colors.yellow}*${colors.reset}` : '';

  return `${color}${percentage}%${colors.reset}${normalizedIndicator} (${type})`;
}

/**
 * Log RAG search start
 */
export function logSearchStart(conversationId: string, query: string, config: SearchConfig): void {
  console.log(`\n${colors.bright}${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║ RAG SEARCH START${colors.reset}                                               ${colors.bright}${colors.blue}║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.cyan}Conversation:${colors.reset} ${conversationId}`);
  console.log(`${colors.cyan}Query:${colors.reset} "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  console.log(`${colors.cyan}Config:${colors.reset} threshold=${config.threshold}, maxResults=${config.maxResults}`);
}

/**
 * Log query enhancement results
 */
export function logQueryEnhancement(originalQuery: string, enhancedData: EnhancedData): void {
  console.log(`\n${colors.magenta}┌─ Query Enhancement${colors.reset}`);
  console.log(`${colors.magenta}│${colors.reset} Original: "${originalQuery.substring(0, 80)}..."`);

  if (enhancedData.enhancedQuery && enhancedData.enhancedQuery !== originalQuery) {
    console.log(`${colors.magenta}│${colors.reset} Enhanced: "${enhancedData.enhancedQuery.substring(0, 80)}..."`);
  }

  if (enhancedData.hyde) {
    console.log(`${colors.magenta}│${colors.reset} HyDE: Generated hypothetical document (${enhancedData.hyde.length} chars)`);
  }

  if (enhancedData.queryVariants && enhancedData.queryVariants.length > 0) {
    console.log(`${colors.magenta}│${colors.reset} Variants: ${enhancedData.queryVariants.length} query variations generated`);
    enhancedData.queryVariants.forEach((variant, i) => {
      console.log(`${colors.magenta}│${colors.reset}   ${i + 1}. "${variant.substring(0, 60)}..."`);
    });
  }

  console.log(`${colors.magenta}└─${colors.reset}`);
}

/**
 * Log search results by source
 */
export function logSearchResults(results: SearchResult[], searchType = 'vector'): void {
  const emailResults = results.filter(r => r.source === 'email');
  const kbResults = results.filter(r => r.source === 'knowledge_base');

  console.log(`\n${colors.yellow}┌─ ${searchType.toUpperCase()} Search Results${colors.reset}`);
  console.log(`${colors.yellow}│${colors.reset} Total: ${results.length} (${emailResults.length} emails, ${kbResults.length} KB entries)`);

  if (results.length > 0) {
    const topResults = results.slice(0, 5);
    topResults.forEach((r, idx) => {
      // UNIFIED: Use 'score' as primary field
      const score = r.score || r.similarity || 0;
      // Detect BM25 vs normalized scores
      let scoreType = r._scoreHistory?.stage || 'similarity';
      if (searchType.toLowerCase() === 'bm25' || (score > 1.0 && !r._scoreHistory)) {
        scoreType = 'bm25';
      }
      const icon = r.source === 'email' ? '📧' : '📄';

      console.log(`${colors.yellow}│${colors.reset}   ${idx + 1}. ${icon} ${formatScore(score, scoreType)} - ${r.title?.substring(0, 50) || 'Untitled'}`);
    });

    if (results.length > 5) {
      console.log(`${colors.yellow}│${colors.reset}   ... and ${results.length - 5} more`);
    }
  }

  console.log(`${colors.yellow}└─${colors.reset}`);
}

/**
 * Log hybrid search fusion
 */
export function logHybridFusion(vectorResults: SearchResult[], bm25Results: SearchResult[], fusedResults: SearchResult[], method: string): void {
  console.log(`\n${colors.cyan}┌─ Hybrid Search Fusion (${method})${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} Vector: ${vectorResults.length} results (${vectorResults.filter(r => r.source === 'email').length} emails)`);
  console.log(`${colors.cyan}│${colors.reset} BM25:   ${bm25Results.length} results (${bm25Results.filter(r => r.source === 'email').length} emails)`);
  console.log(`${colors.cyan}│${colors.reset} Fused:  ${fusedResults.length} results (${fusedResults.filter(r => r.source === 'email').length} emails)`);

  const topFused = fusedResults.slice(0, 3);
  if (topFused.length > 0) {
    console.log(`${colors.cyan}│${colors.reset} Top Results:`);
    topFused.forEach((r, idx) => {
      const icon = r.source === 'email' ? '📧' : '📄';
      // UNIFIED: Use 'score' as primary field
      const score = r.score || 0;
      const scoreType = r._scoreHistory?.stage || 'fused';
      console.log(`${colors.cyan}│${colors.reset}   ${idx + 1}. ${icon} ${formatScore(score, scoreType)} - ${r.title?.substring(0, 45) || 'Untitled'}`);
    });
  }

  console.log(`${colors.cyan}└─${colors.reset}`);
}

/**
 * Log reranking results
 */
export function logReranking(beforeCount: number, afterResults: SearchResult[], diversityUsed: boolean, mmrUsed: boolean): void {
  console.log(`\n${colors.green}┌─ Reranking${colors.reset}`);
  console.log(`${colors.green}│${colors.reset} Input:  ${beforeCount} results`);
  console.log(`${colors.green}│${colors.reset} Output: ${afterResults.length} results`);
  console.log(`${colors.green}│${colors.reset} Diversity Filter: ${diversityUsed ? 'Yes' : 'No'}`);
  console.log(`${colors.green}│${colors.reset} MMR: ${mmrUsed ? 'Yes' : 'No'}`);

  if (afterResults.length > 0) {
    console.log(`${colors.green}│${colors.reset} Final Results:`);
    afterResults.forEach((r, idx) => {
      const icon = r.source === 'email' ? '📧' : '📄';
      // UNIFIED: Use 'score' as primary field
      const score = r.score || r.similarity || 0;
      const scoreType = r._scoreHistory?.stage || 'rerank';

      // Check if semantic boost was applied
      const boostInfo = r._scoreHistory?.semanticBoost;
      const wasNormalized = boostInfo?.rawBoostedScore ? boostInfo.rawBoostedScore > 1.0 : false;

      console.log(`${colors.green}│${colors.reset}   ${idx + 1}. ${icon} ${formatScore(score, scoreType, wasNormalized)} - ${r.title?.substring(0, 45) || 'Untitled'}`);

      // Show debug info for semantic boost
      if (boostInfo?.applied) {
        const boostPercent = Math.round((boostInfo.boostAmount || 0) * 100);
        console.log(`${colors.green}│${colors.reset}      ${colors.cyan}(boost: +${boostPercent}%, matches: ${boostInfo.queryTermMatches})${colors.reset}`);
      } else if (boostInfo?.reason === 'below_threshold') {
        console.log(`${colors.green}│${colors.reset}      ${colors.gray}(boost skipped: below threshold)${colors.reset}`);
      }

      // Show normalized score if it exceeded 1.0
      if (wasNormalized && boostInfo?.rawBoostedScore) {
        const rawScore = boostInfo.rawBoostedScore;
        console.log(`${colors.green}│${colors.reset}      ${colors.yellow}(normalized from ${Math.round(rawScore * 100)}%)${colors.reset}`);
      }
    });
  }

  console.log(`${colors.green}└─${colors.reset}`);
}

/**
 * Log final context sent to LLM
 */
export function logLLMContext(conversationId: string, provider: string, model: string, systemPromptLength: number, contextCount: number, messageCount: number): void {
  console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║ LLM PROMPT ASSEMBLY${colors.reset}                                           ${colors.bright}${colors.magenta}║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.magenta}Conversation:${colors.reset} ${conversationId}`);
  console.log(`${colors.magenta}Provider:${colors.reset} ${provider} / ${model}`);
  console.log(`${colors.magenta}System Prompt:${colors.reset} ${systemPromptLength} characters`);
  console.log(`${colors.magenta}Context Chunks:${colors.reset} ${contextCount} relevant items included`);
  console.log(`${colors.magenta}Message History:${colors.reset} ${messageCount} messages`);
}

/**
 * Log LLM response
 */
export function logLLMResponse(conversationId: string, responseLength: number, tokensUsed: number | undefined, finishReason: string | undefined): void {
  console.log(`\n${colors.green}┌─ LLM Response${colors.reset}`);
  console.log(`${colors.green}│${colors.reset} Conversation: ${conversationId}`);
  console.log(`${colors.green}│${colors.reset} Response Length: ${responseLength} characters`);
  console.log(`${colors.green}│${colors.reset} Tokens Used: ${tokensUsed || 'N/A'}`);
  console.log(`${colors.green}│${colors.reset} Finish Reason: ${finishReason || 'N/A'}`);
  console.log(`${colors.green}└─${colors.reset}`);
}

/**
 * Log complete RAG search summary
 */
export function logSearchComplete(conversationId: string, finalResults: SearchResult[], totalTimeMs?: number): void {
  const emailCount = finalResults.filter(r => r.source === 'email').length;
  const kbCount = finalResults.filter(r => r.source === 'knowledge_base').length;

  console.log(`\n${colors.bright}${colors.green}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║ RAG SEARCH COMPLETE${colors.reset}                                            ${colors.bright}${colors.green}║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.green}Conversation:${colors.reset} ${conversationId}`);
  console.log(`${colors.green}Final Results:${colors.reset} ${finalResults.length} (${emailCount} emails, ${kbCount} KB)`);
  if (totalTimeMs) {
    console.log(`${colors.green}Time:${colors.reset} ${totalTimeMs}ms`);
  }

  if (finalResults.length > 0) {
    console.log(`\n${colors.green}Context for LLM:${colors.reset}`);
    finalResults.forEach((r, idx) => {
      const icon = r.source === 'email' ? '📧' : '📄';
      // UNIFIED: Use 'score' as primary field
      const score = r.score || r.similarity || 0;
      const scoreType = r._scoreHistory?.stage || 'similarity';
      console.log(`  ${idx + 1}. ${icon} ${formatScore(score, scoreType)} | ${r.title?.substring(0, 50) || 'Untitled'}`);
      if (r.source === 'email' && r.senderName) {
        console.log(`     ${colors.gray}From: ${r.senderName}${colors.reset}`);
      }
    });
  }

  console.log('');
}

/**
 * Log error in RAG pipeline
 */
export function logError(stage: string, error: Error, context: Record<string, unknown> = {}): void {
  console.error(`\n${colors.bright}${colors.red}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.error(`${colors.bright}${colors.red}║ RAG ERROR${colors.reset}                                                      ${colors.bright}${colors.red}║${colors.reset}`);
  console.error(`${colors.bright}${colors.red}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.error(`${colors.red}Stage:${colors.reset} ${stage}`);
  console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
  if (context && Object.keys(context).length > 0) {
    console.error(`${colors.red}Context:${colors.reset}`, context);
  }
  if (error.stack) {
    console.error(`${colors.gray}${error.stack}${colors.reset}`);
  }
  console.error('');
}

/**
 * Log compact RAG pipeline summary (single block)
 * Shows the entire RAG flow in a clear, concise format
 */
export function logPipelineSummary(data: PipelineSummaryData): void {
  const {
    conversationId,
    query,
    config = {},
    vectorResults = [],
    bm25Results = [],
    fusedResults = [],
    afterThreshold = [],
    afterRerank = [],
    finalResults = [],
    totalTimeMs = 0,
  } = data;

  const c = colors;

  // Header
  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bright}${c.blue}  RAG PIPELINE${c.reset} ${c.gray}[${conversationId?.slice(0, 8)}]${c.reset}`);
  console.log(`${c.bright}${c.blue}═══════════════════════════════════════════════════════════════${c.reset}`);

  // Query
  console.log(`${c.cyan}Query:${c.reset} "${query?.substring(0, 60)}${query && query.length > 60 ? '...' : ''}"`);

  // Config (if using per-KB)
  if (config.usingPerKBConfig) {
    console.log(`${c.cyan}Config:${c.reset} ${c.green}per-KB${c.reset} (KB≥${Math.round((config.kbThreshold || 0.7) * 100)}% Email≥${Math.round((config.emailThreshold || 0.7) * 100)}%)`);
  } else {
    console.log(`${c.cyan}Config:${c.reset} default (threshold≥${Math.round((config.threshold || 0.7) * 100)}%)`);
  }

  // Pipeline steps - one line each
  console.log(`${c.gray}───────────────────────────────────────────────────────────────${c.reset}`);

  // Step 1: Vector Search
  const vEmails = vectorResults.filter(r => r.source === 'email').length;
  const vKB = vectorResults.length - vEmails;
  const vTop = vectorResults[0];
  const vTopScore = vTop ? Math.round((vTop.score || vTop.similarity || 0) * 100) : 0;
  console.log(`${c.yellow}1. Vector${c.reset}    → ${vectorResults.length} results (${vKB}KB + ${vEmails}📧) ${vTop ? `top:${vTopScore}%` : ''}`);

  // Step 2: BM25 Search (if hybrid)
  if (bm25Results.length > 0) {
    const bEmails = bm25Results.filter(r => r.source === 'email').length;
    const bKB = bm25Results.length - bEmails;
    console.log(`${c.yellow}2. BM25${c.reset}      → ${bm25Results.length} results (${bKB}KB + ${bEmails}📧)`);
  }

  // Step 3: Fusion (if hybrid)
  if (fusedResults.length > 0) {
    const fEmails = fusedResults.filter(r => r.source === 'email').length;
    const fKB = fusedResults.length - fEmails;
    const fTop = fusedResults[0];
    const fTopScore = fTop ? Math.round((fTop.score || 0) * 100) : 0;
    console.log(`${c.cyan}3. Fusion${c.reset}    → ${fusedResults.length} results (${fKB}KB + ${fEmails}📧) ${fTop ? `top:${fTopScore}%` : ''}`);
  }

  // Step 4: Threshold Filter - show detailed filtering breakdown
  const tEmails = afterThreshold.filter(r => r.source === 'email').length;
  const tKB = afterThreshold.length - tEmails;

  // Calculate what was filtered from each source
  const preFilterResults = fusedResults.length > 0 ? fusedResults : vectorResults;
  const preFilterKB = preFilterResults.filter(r => r.source !== 'email').length;
  const preFilterEmails = preFilterResults.filter(r => r.source === 'email').length;
  const filteredKB = preFilterKB - tKB;
  const filteredEmails = preFilterEmails - tEmails;

  // Get thresholds from config
  const kbThresholdValue = config.kbThreshold || config.threshold || 0.7;
  const emailThresholdValue = config.emailThreshold || config.threshold || 0.7;
  const kbThresholdPct = Math.round(kbThresholdValue * 100);
  const emailThresholdPct = Math.round(emailThresholdValue * 100);

  // Find the TOP score among FILTERED results (those that didn't pass)
  // This shows the best score that was still rejected
  const afterThresholdIds = new Set(afterThreshold.map(r => r.id));
  const filteredOutKB = preFilterResults.filter(r => r.source !== 'email' && !afterThresholdIds.has(r.id));
  const filteredOutEmails = preFilterResults.filter(r => r.source === 'email' && !afterThresholdIds.has(r.id));

  const topFilteredKB = filteredOutKB.sort((a, b) => (b.score || b.similarity || 0) - (a.score || a.similarity || 0))[0];
  const topFilteredEmail = filteredOutEmails.sort((a, b) => (b.score || b.similarity || 0) - (a.score || a.similarity || 0))[0];

  const topFilteredKBScore = topFilteredKB ? Math.round((topFilteredKB.score || topFilteredKB.similarity || 0) * 100) : 0;
  const topFilteredEmailScore = topFilteredEmail ? Math.round((topFilteredEmail.score || topFilteredEmail.similarity || 0) * 100) : 0;

  // Build detailed filter info - show what the best rejected score was
  const filterDetails: string[] = [];
  if (filteredKB > 0) {
    filterDetails.push(`${c.red}-${filteredKB}KB${c.reset}${c.gray}(best:${topFilteredKBScore}%<${kbThresholdPct}%)${c.reset}`);
  }
  if (filteredEmails > 0) {
    filterDetails.push(`${c.red}-${filteredEmails}📧${c.reset}${c.gray}(best:${topFilteredEmailScore}%<${emailThresholdPct}%)${c.reset}`);
  }

  const filterInfo = filterDetails.length > 0 ? filterDetails.join(' ') : `${c.green}none filtered${c.reset}`;
  console.log(`${c.yellow}4. Threshold${c.reset} → ${afterThreshold.length} results (${tKB}KB + ${tEmails}📧) ${filterInfo}`);

  // Step 5: Reranking
  if (afterRerank.length > 0 || afterThreshold.length > 0) {
    const rEmails = afterRerank.filter(r => r.source === 'email').length;
    const rKB = afterRerank.length - rEmails;
    const rTop = afterRerank[0];
    const rTopScore = rTop ? Math.round((rTop.score || 0) * 100) : 0;
    const boosted = afterRerank.filter(r => r._scoreHistory?.semanticBoost?.applied).length;
    console.log(`${c.green}5. Rerank${c.reset}    → ${afterRerank.length} results (${rKB}KB + ${rEmails}📧) ${rTop ? `top:${rTopScore}%` : ''} ${boosted > 0 ? `+${boosted} boosted` : ''}`);
  }

  // Final Results
  console.log(`${c.gray}───────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bright}${c.green}Final:${c.reset} ${finalResults.length} results for LLM context ${c.gray}(${totalTimeMs}ms)${c.reset}`);

  if (finalResults.length > 0) {
    finalResults.slice(0, 5).forEach((r, i) => {
      const icon = r.source === 'email' ? '📧' : '📄';
      const score = Math.round((r.score || r.similarity || 0) * 100);
      const scoreColor = score >= 80 ? c.green : score >= 60 ? c.cyan : c.yellow;
      const title = r.title?.substring(0, 40) || 'Untitled';
      console.log(`  ${i + 1}. ${icon} ${scoreColor}${score}%${c.reset} ${title}`);
    });
  } else {
    console.log(`  ${c.gray}(no results matched thresholds)${c.reset}`);
  }

  console.log(`${c.bright}${c.blue}═══════════════════════════════════════════════════════════════${c.reset}\n`);
}
