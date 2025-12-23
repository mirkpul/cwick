import config from '../config/appConfig';

interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
}

interface Chunk {
  text: string;
  index: number;
  totalChunks: number;
}

interface DocumentChunk extends Chunk {
  metadata: Record<string, unknown>;
}

class ChunkingService {
  /**
   * Estimate the number of tokens in a text string
   * Uses rough approximation: ~4 characters per token
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    // Rough estimation: average of N characters per token (configurable)
    return Math.ceil(text.length / config.chunking.charactersPerToken);
  }

  /**
   * Split text into chunks based on token limits
   * Tries to split at natural boundaries (paragraphs, sentences)
   */
  chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
    const {
      maxTokens = config.chunking.maxTokensPerChunk,
      overlap = config.chunking.overlapTokens,
    } = options;

    if (!text || text.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    const estimatedTokens = this.estimateTokens(text);

    // If text fits in one chunk, return it as is
    if (estimatedTokens <= maxTokens) {
      return [
        {
          text,
          index: 0,
          totalChunks: 1,
        },
      ];
    }

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);

      // If single paragraph exceeds maxTokens, split by sentences
      if (paragraphTokens > maxTokens) {
        // Save current chunk if exists
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentTokens = 0;
        }

        // Split paragraph by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        for (const sentence of sentences) {
          const sentenceTokens = this.estimateTokens(sentence);

          if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
            chunks.push(currentChunk.trim());

            // Add overlap from end of previous chunk
            const overlapText = this.getOverlapText(currentChunk, overlap);
            currentChunk = overlapText + sentence;
            currentTokens = this.estimateTokens(currentChunk);
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
            currentTokens += sentenceTokens;
          }
        }
      } else {
        // Check if adding this paragraph exceeds maxTokens
        if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
          chunks.push(currentChunk.trim());

          // Add overlap from end of previous chunk
          const overlapText = this.getOverlapText(currentChunk, overlap);
          currentChunk = overlapText + paragraph;
          currentTokens = this.estimateTokens(currentChunk);
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          currentTokens += paragraphTokens;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Convert to chunk objects with metadata
    const totalChunks = chunks.length;
    return chunks.map((chunkText, index) => ({
      text: chunkText,
      index,
      totalChunks,
    }));
  }

  /**
   * Get overlap text from the end of a chunk
   */
  getOverlapText(text: string, overlapTokens: number): string {
    if (overlapTokens === 0) {
      return '';
    }

    const estimatedChars = overlapTokens * 4;
    const overlapText = text.slice(-estimatedChars);

    // Try to start at a word boundary
    const firstSpace = overlapText.indexOf(' ');
    if (firstSpace > 0 && firstSpace < estimatedChars / 2) {
      return overlapText.slice(firstSpace + 1);
    }

    return overlapText;
  }

  /**
   * Chunk a document with metadata
   */
  chunkDocument(content: string, metadata: Record<string, unknown> = {}, options: ChunkOptions = {}): DocumentChunk[] {
    const chunks = this.chunkText(content, options);

    return chunks.map(chunk => ({
      ...chunk,
      metadata,
    }));
  }
}

export default new ChunkingService();
