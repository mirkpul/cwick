import { Pool } from 'pg';
import config from '../config/appConfig';
import logger from '../config/logger';

interface ContextChunk {
  id: string;
  content: string;
  title?: string;
  source?: string;
  score?: number;
  similarity?: number;
  [key: string]: unknown;
}

interface ConversationMessage {
  role: string;
  content: string;
  [key: string]: unknown;
}

interface KnowledgeBaseProfile {
  name?: string;
  profession?: string;
  bio?: string;
  communication_style?: string;
  capabilities?: Record<string, unknown> | null;
  services?: Record<string, unknown> | null;
  pricing_info?: Record<string, unknown> | null;
  system_prompt?: string;
}

interface KnowledgeEntry {
  id?: string;
  content: string;
  title?: string;
  source_url?: string;
}

export interface SemanticResult {
  title?: string;
  similarity?: number;
  content: string;
  file_name?: string;
  total_chunks?: number;
  chunk_index?: number;
}

/**
 * Context Service
 *
 * Manages context preparation for LLM prompts, including:
 * - Formatting retrieved context chunks
 * - Managing conversation history
 * - Token budget management
 * - Context window optimization
 */
class ContextService {
  /**
   * Format context chunks for LLM prompt
   */
  formatContextForPrompt(chunks: ContextChunk[]): string {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    // Format each chunk with metadata
    const formattedChunks = chunks.map((chunk, index) => {
      const title = chunk.title || `Context ${index + 1}`;
      const source = chunk.source || 'Knowledge Base';

      return `[${index + 1}] ${title} (${source}):\n${chunk.content}`;
    });

    return formattedChunks.join('\n\n');
  }

  /**
   * Prepare conversation history for LLM
   * Limits history to fit within token budget
   */
  prepareConversationHistory(
    pool: Pool,
    conversationId: string,
    maxMessages = config.conversations.messageHistoryLimit
  ): Promise<ConversationMessage[]> {
    return this._getRecentMessages(pool, conversationId, maxMessages);
  }

  /**
   * Get recent messages from a conversation
   */
  private async _getRecentMessages(
    pool: Pool,
    conversationId: string,
    limit: number
  ): Promise<ConversationMessage[]> {
    const result = await pool.query<ConversationMessage>(
      `SELECT sender as role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );

    // Reverse to get chronological order
    return result.rows.reverse().map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  /**
   * Build complete context including retrieved chunks and conversation history
   */
  async buildCompleteContext(
    pool: Pool,
    conversationId: string,
    retrievedChunks: ContextChunk[],
    systemPrompt: string
  ): Promise<{
    formattedContext: string;
    conversationHistory: ConversationMessage[];
    systemMessage: string;
  }> {
    // Format retrieved context
    const formattedContext = this.formatContextForPrompt(retrievedChunks);

    // Get conversation history
    const conversationHistory = await this.prepareConversationHistory(pool, conversationId);

    // Combine system prompt with context
    const systemMessage = formattedContext
      ? `${systemPrompt}\n\nRelevant Context:\n${formattedContext}`
      : systemPrompt;

    return {
      formattedContext,
      conversationHistory,
      systemMessage,
    };
  }

  /**
   * Estimate token count for context
   * Uses rough approximation: ~4 characters per token
   */
  estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / config.chunking.charactersPerToken);
  }

  /**
   * Truncate context to fit within token budget
   */
  truncateContext(
    chunks: ContextChunk[],
    maxTokens: number
  ): ContextChunk[] {
    const truncated: ContextChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokenCount(chunk.content);

      if (currentTokens + chunkTokens > maxTokens) {
        // If we haven't added any chunks yet, add this one but truncate it
        if (truncated.length === 0) {
          const truncatedContent = this._truncateText(chunk.content, maxTokens);
          truncated.push({
            ...chunk,
            content: truncatedContent,
          });
        }
        break;
      }

      truncated.push(chunk);
      currentTokens += chunkTokens;
    }

    logger.debug('Context truncated', {
      originalChunks: chunks.length,
      truncatedChunks: truncated.length,
      estimatedTokens: currentTokens,
    });

    return truncated;
  }

  /**
   * Truncate text to approximate token limit
   */
  private _truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * config.chunking.charactersPerToken;

    if (text.length <= maxChars) {
      return text;
    }

    // Try to truncate at a sentence boundary
    const truncated = text.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');

    if (lastPeriod > maxChars * 0.8) {
      return truncated.substring(0, lastPeriod + 1);
    }

    return truncated + '...';
  }

  /**
   * Generate a preview of the context and system prompt
   */
  generateContextPreview(kb: KnowledgeBaseProfile, knowledge: KnowledgeEntry[] = []): {
    identity: string;
    personality: string;
    expertise: string;
    capabilities: string;
    businessInfo: string;
    knowledgeBase: string;
    guidelines: string;
    customInstructions: string | null;
    fullPrompt: string;
    systemPrompt?: string;
    contextSample?: string;
  } {
    // Build identity section
    const identity = `You are ${kb.name || 'a digital assistant'}, a ${kb.profession || 'professional'}.`;

    // Build personality section
    const personality = kb.communication_style || 'Professional and helpful';

    // Build expertise section
    const expertise = `Professional Expertise: ${kb.profession || 'General assistance'}`;

    // Build capabilities section
    const capabilities = kb.capabilities ? JSON.stringify(kb.capabilities) : 'General Q&A';

    // Build business info section
    const businessInfo = kb.pricing_info ? JSON.stringify(kb.pricing_info) : '';

    // Build knowledge base section
    const sampleChunks = (knowledge ?? []).slice(0, 3).map((k, index) => ({
      id: k.id ?? `kb-${index}`,
      content: k.content,
      title: k.title,
      source: k.source_url || 'Knowledge Base'
    }));
    const knowledgeBase = this.formatContextForPrompt(sampleChunks);

    // Build guidelines section
    const guidelines = 'Conversation Guidelines: Be helpful, accurate, and respectful.';

    // Custom instructions
    const customInstructions = kb.system_prompt || null;

    // Build full prompt
    const fullPromptParts = [identity, personality, expertise, guidelines];
    if (customInstructions) {
      fullPromptParts.push(`Additional Instructions: ${customInstructions}`);
    }
    const fullPrompt = fullPromptParts.join('\n\n');

    return {
      identity,
      personality,
      expertise,
      capabilities,
      businessInfo,
      knowledgeBase,
      guidelines,
      customInstructions,
      fullPrompt,
      systemPrompt: customInstructions || '',
      contextSample: knowledgeBase
    };
  }

  /**
   * Build semantic knowledge section for prompts
   */
  _buildSemanticKnowledgeSection(results: SemanticResult[] | null): string | null {
    if (!results || results.length === 0) {
      return null;
    }

    const lines = ['# RELEVANT CONTEXT'];
    results.forEach((result, index) => {
      const title = result.title || `Context ${index + 1}`;
      const relevance = Math.round((result.similarity || 0) * 100);
      lines.push(`\nContext ${index + 1}: ${title}`);
      lines.push(`Relevance: ${relevance}%`);
      lines.push(result.content);
      if (result.file_name) {
        if (result.total_chunks && result.total_chunks > 1) {
          lines.push(`Source: ${result.file_name} (Part ${(result.chunk_index || 0) + 1}/${result.total_chunks})`);
        } else {
          lines.push(`Source: ${result.file_name}`);
        }
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate continuation prompt with semantic results
   */
  generateContinuationPrompt(kb: KnowledgeBaseProfile, semanticResults: SemanticResult[] | null): string {
    const semanticSection = this._buildSemanticKnowledgeSection(semanticResults);
    const identity = `You are ${kb.name || 'a digital assistant'}, a ${kb.profession || 'professional'}.`;

    if (semanticSection) {
      return `${semanticSection}\n\n${identity}`;
    }

    return `NO CONTEXT AVAILABLE\n\n${identity}`;
  }

  /**
   * Generate enhanced system prompt with semantic results
   */
  generateEnhancedSystemPrompt(kb: KnowledgeBaseProfile, knowledgeBase: KnowledgeEntry[] | null, semanticResults: SemanticResult[] | null): string {
    if (!kb) {
      throw new Error('Knowledge Base is required');
    }

    const sections: string[] = [];

    // Add semantic results first if available
    const semanticSection = this._buildSemanticKnowledgeSection(semanticResults);
    if (semanticSection) {
      sections.push(semanticSection);
    }

    // Knowledge Base Identity
    sections.push('# Knowledge Base Identity');
    sections.push(`You are ${kb.name || 'a digital assistant'}, a ${kb.profession || 'professional'}.`);

    // Professional Expertise
    sections.push('\n# Professional Expertise');
    sections.push(kb.bio || 'Experienced professional.');

    // Add knowledge base only if no semantic results
    if (!semanticResults || semanticResults.length === 0) {
      if (knowledgeBase && knowledgeBase.length > 0) {
        sections.push('\n# Knowledge Base');
        knowledgeBase.forEach(k => {
          sections.push(`- ${k.title || 'Entry'}: ${k.content}`);
        });
      }
    }

    // Conversation Guidelines
    sections.push('\n# Conversation Guidelines');
    sections.push('Be helpful, accurate, and respectful.');

    // Custom instructions
    if (kb.system_prompt) {
      sections.push('\n# Additional Instructions');
      sections.push(kb.system_prompt);
    }

    return sections.join('\n');
  }

  /**
   * Generate system prompt (legacy method)
   */
  generateSystemPrompt(kb: KnowledgeBaseProfile, knowledgeBase: KnowledgeEntry[]): string {
    if (!kb) {
      throw new Error('Knowledge Base is required');
    }
    return this.generateEnhancedSystemPrompt(kb, knowledgeBase, null);
  }
}

export default new ContextService();
