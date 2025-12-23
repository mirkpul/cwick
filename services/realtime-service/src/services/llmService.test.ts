/* eslint-disable @typescript-eslint/no-require-imports */

// Mock config before importing service
jest.mock('../config/appConfig', () => ({
  __esModule: true,
  default: {
    llm: {
      defaultTemperature: 0.7,
      defaultMaxTokens: 1000,
      providers: {
        openai: {
          embeddingModel: 'text-embedding-ada-002',
          embeddingDimensions: 1536,
          legacyEmbeddingModel: 'text-embedding-ada-002',
        },
        anthropic: {},
      },
    },
    chunking: {
      charactersPerToken: 4,
    },
    ragOptimization: {
      performance: {
        useBatchEmbeddings: true,
        maxBatchSize: 100,
        maxBatchTokens: 6000,
        usePromptCaching: true,
        parallelQueries: true,
      },
    },
    handover: {
      defaultThreshold: 0.7,
    },
  },
}));

// Mock the OpenAI and Anthropic clients before importing LLMService
const mockOpenAIEmbeddings = {
  create: jest.fn()
};

const mockOpenAIChat = {
  completions: {
    create: jest.fn()
  }
};

const mockAnthropicMessages = {
  create: jest.fn()
};

const mockGenerateEmbedding = jest.fn();
const mockGenerateBatchEmbeddings = jest.fn();

jest.mock('@virtualcoach/sdk', () => {
  return {
    LLMClient: jest.fn().mockImplementation(() => ({
      generateEmbedding: mockGenerateEmbedding,
      generateBatchEmbeddings: mockGenerateBatchEmbeddings,
      generateResponse: jest.fn(),
    })),
  };
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: mockOpenAIEmbeddings,
    chat: mockOpenAIChat
  }));
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: mockAnthropicMessages
  }));
});

// Now import LLMService after mocks are set up
const LLMService = require('./llmService').default;

describe('LLMService - Embeddings', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings using OpenAI', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const text = 'This is a test text for embedding generation.';
      const embedding = await LLMService.generateEmbedding(text, 'openai');

      expect(mockGenerateEmbedding).toHaveBeenCalledWith({
        text,
        provider: 'openai',
        model: 'text-embedding-ada-002',
      });
      expect(embedding).toEqual(mockEmbedding);
      expect(embedding.length).toBe(1536);
    });

    it('should use openai as default provider', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const text = 'Test text';
      await LLMService.generateEmbedding(text);

      expect(mockGenerateEmbedding).toHaveBeenCalledWith({
        text,
        provider: 'openai',
        model: 'text-embedding-ada-002',
      });
    });

    it('should handle empty text', async () => {
      const mockEmbedding = new Array(1536).fill(0);
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const embedding = await LLMService.generateEmbedding('', 'openai');

      expect(mockGenerateEmbedding).toHaveBeenCalledWith({
        text: '',
        provider: 'openai',
        model: 'text-embedding-ada-002',
      });
      expect(embedding).toBeDefined();
    });

    it('should handle long text', async () => {
      const longText = 'word '.repeat(10000);
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const embedding = await LLMService.generateEmbedding(longText, 'openai');

      expect(mockGenerateEmbedding).toHaveBeenCalledWith({
        text: longText,
        provider: 'openai',
        model: 'text-embedding-ada-002',
      });
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });

    it('should throw error for unsupported provider', async () => {
      const text = 'Test text';

      await expect(
        LLMService.generateEmbedding(text, 'unsupported-provider')
      ).rejects.toThrow('Embeddings not supported for provider');
    });

    it('should handle OpenAI API errors', async () => {
      mockGenerateEmbedding.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const text = 'Test text';

      await expect(
        LLMService.generateEmbedding(text, 'openai')
      ).rejects.toThrow('OpenAI API error');
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbeddings = texts.map(() =>
        new Array(1536).fill(0).map(() => Math.random())
      );

      // Mock the batch API response (OpenAI accepts array and returns all embeddings)
      mockGenerateBatchEmbeddings.mockResolvedValue(mockEmbeddings);

      const embeddings = await LLMService.generateBatchEmbeddings(texts, 'openai');

      expect(embeddings).toHaveLength(3);
      expect(mockGenerateBatchEmbeddings).toHaveBeenCalledTimes(1);
      expect(mockGenerateBatchEmbeddings).toHaveBeenCalledWith(texts, 'openai');
      embeddings.forEach((embedding: number[]) => {
        expect(embedding.length).toBe(1536);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await LLMService.generateBatchEmbeddings([], 'openai');

      expect(embeddings).toEqual([]);
      expect(mockGenerateBatchEmbeddings).not.toHaveBeenCalled();
    });

    it('should handle single text in array', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const embeddings = await LLMService.generateBatchEmbeddings(['Single text'], 'openai');

      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(mockEmbedding);
    });

    it('should handle partial failures gracefully', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];

      // Mock API error (batch API fails on first attempt)
      mockGenerateBatchEmbeddings.mockRejectedValue(new Error('API error'));

      await expect(
        LLMService.generateBatchEmbeddings(texts, 'openai')
      ).rejects.toThrow('API error');
    });
  });

  describe('Anthropic embeddings support', () => {
    it('should throw error as Anthropic embeddings are not yet supported', async () => {
      const text = 'Test text';

      await expect(
        LLMService.generateEmbedding(text, 'anthropic')
      ).rejects.toThrow('Embeddings not supported for provider: anthropic');
    });
  });

  describe('Embedding validation', () => {
    it('should return embedding with correct dimensions', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const embedding = await LLMService.generateEmbedding('Test', 'openai');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      embedding.forEach((value: number) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should return normalized embeddings', async () => {
      // Create a normalized vector (magnitude = 1)
      const unnormalized = new Array(1536).fill(0).map(() => Math.random());
      const magnitude = Math.sqrt(
        unnormalized.reduce((sum, val) => sum + val * val, 0)
      );
      const mockEmbedding = unnormalized.map(val => val / magnitude);

      mockGenerateEmbedding.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const embedding = await LLMService.generateEmbedding('Test', 'openai');

      // Calculate vector magnitude (should be close to 1 for normalized vectors)
      const resultMagnitude = Math.sqrt(
        embedding.reduce((sum: number, val: number) => sum + val * val, 0)
      );

      // OpenAI embeddings are normalized, so magnitude should be close to 1
      expect(resultMagnitude).toBeGreaterThan(0.99);
      expect(resultMagnitude).toBeLessThan(1.01);
    });
  });
});
