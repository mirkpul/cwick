import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const mockGenerateBatchEmbeddings = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@virtualcoach/sdk', () => ({
  LLMClient: jest.fn().mockImplementation(() => ({
    generateBatchEmbeddings: mockGenerateBatchEmbeddings,
  })),
  VectorClient: jest.fn().mockImplementation(() => ({
    upsert: mockUpsert,
  })),
}));

jest.mock('./config', () => ({
  config: {
    chunkSize: 5,
    chunkOverlap: 1,
    llmGatewayUrl: 'http://llm',
    llmGatewayApiKey: 'test',
    vectorServiceUrl: 'http://vector',
    vectorServiceApiKey: 'test',
  },
}));

const mockQuery = jest.fn();
jest.mock('./db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.mock('./logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

jest.mock('pdf-parse');
jest.mock('mammoth');

import { extractTextFromBuffer, processTextDocument } from './processor';

describe('document processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractTextFromBuffer', () => {
    it('returns plain text content for text files', async () => {
      const result = await extractTextFromBuffer(Buffer.from('hello'), 'text/plain');
      expect(result).toBe('hello');
    });

    it('parses PDF content', async () => {
      const pdfParseMock = pdfParse as jest.Mock;
      pdfParseMock.mockResolvedValue({ text: 'pdf text' });
      const result = await extractTextFromBuffer(Buffer.from('pdf'), 'application/pdf');
      expect(result).toBe('pdf text');
    });

    it('parses DOCX content', async () => {
      const extractRawTextMock = mammoth.extractRawText as jest.Mock;
      extractRawTextMock.mockResolvedValue({ value: 'docx text' });
      const result = await extractTextFromBuffer(
        Buffer.from('docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(result).toBe('docx text');
    });

    it('throws for unsupported file types', async () => {
      await expect(
        extractTextFromBuffer(Buffer.from('data'), 'application/octet-stream')
      ).rejects.toThrow('Unsupported file type');
    });
  });

  describe('processTextDocument', () => {
    it('returns zero when content is empty', async () => {
      const result = await processTextDocument({
        twinId: 't1',
        fileName: 'empty.txt',
        content: '',
        contentType: 'text/plain',
      });

      expect(result).toEqual({ entriesCreated: 0, chunks: 0 });
      expect(mockGenerateBatchEmbeddings).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('chunks content, stores rows, and upserts vectors', async () => {
      mockGenerateBatchEmbeddings.mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ]);
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'id-1' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'id-2' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'id-3' }] });

      const result = await processTextDocument({
        twinId: 't1',
        fileName: 'doc.txt',
        content: 'abcdefghij',
        contentType: 'text/plain',
      });

      expect(mockGenerateBatchEmbeddings).toHaveBeenCalledWith(
        ['abcde', 'efghi', 'ij'],
        'openai'
      );
      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockUpsert).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ entriesCreated: 3, chunks: 3 });
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Processed document',
        expect.objectContaining({ fileName: 'doc.txt', entriesCreated: 3, chunks: 3 })
      );
    });
  });
});
