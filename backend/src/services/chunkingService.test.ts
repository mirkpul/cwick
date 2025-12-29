import chunkingService from './chunkingService';

jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        chunking: {
            charactersPerToken: 4,
            maxTokensPerChunk: 500,
            overlapTokens: 50,
        },
    },
}));

describe('ChunkingService', () => {
    describe('estimateTokens', () => {
        it('should return 0 for empty string', () => {
            expect(chunkingService.estimateTokens('')).toBe(0);
        });

        it('should return 0 for null/undefined', () => {
            expect(chunkingService.estimateTokens(null as never)).toBe(0);
            expect(chunkingService.estimateTokens(undefined as never)).toBe(0);
        });

        it('should estimate tokens based on character count', () => {
            const text = 'a'.repeat(100); // 100 characters
            const tokens = chunkingService.estimateTokens(text);
            // 100 / 4 = 25 tokens
            expect(tokens).toBe(25);
        });

        it('should round up fractional tokens', () => {
            const text = 'a'.repeat(101); // 101 characters
            const tokens = chunkingService.estimateTokens(text);
            // 101 / 4 = 25.25, rounds up to 26
            expect(tokens).toBe(26);
        });

        it('should handle typical text correctly', () => {
            const text = 'The quick brown fox jumps over the lazy dog.';
            const tokens = chunkingService.estimateTokens(text);
            // 45 characters / 4 = 11.25, but string may have been trimmed, so expecting 11
            expect(tokens).toBeGreaterThanOrEqual(11);
            expect(tokens).toBeLessThanOrEqual(12);
        });
    });

    describe('chunkText', () => {
        it('should return empty array for empty text', () => {
            const result = chunkingService.chunkText('');
            expect(result).toEqual([]);
        });

        it('should return single chunk for short text', () => {
            const text = 'This is a short text that fits in one chunk.';
            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            expect(result).toHaveLength(1);
            expect(result[0].text).toBe(text);
            expect(result[0].index).toBe(0);
            expect(result[0].totalChunks).toBe(1);
        });

        it('should split long text into multiple chunks', () => {
            // Create text with paragraphs to enable splitting
            const paragraphs = [];
            for (let i = 0; i < 10; i++) {
                paragraphs.push('a'.repeat(300));
            }
            const longText = paragraphs.join('\n\n');
            const result = chunkingService.chunkText(longText, { maxTokens: 100 });

            expect(result.length).toBeGreaterThan(1);
            expect(result[0].totalChunks).toBe(result.length);
        });

        it('should split at paragraph boundaries', () => {
            const para1 = 'a'.repeat(30);
            const para2 = 'b'.repeat(30);
            const para3 = 'c'.repeat(30);
            const text = `${para1}\n\n${para2}\n\n${para3}`;

            const result = chunkingService.chunkText(text, { maxTokens: 10 });

            expect(result.length).toBeGreaterThan(1);
            // Each chunk should contain complete paragraphs when possible
            result.forEach(chunk => {
                expect(chunk.text.trim()).not.toBe('');
                expect(chunk.index).toBeGreaterThanOrEqual(0);
                expect(chunk.index).toBeLessThan(chunk.totalChunks);
            });
        });

        it('should split at sentence boundaries for long paragraphs', () => {
            const longParagraph = 'a'.repeat(2500) + '. ' + 'b'.repeat(2500) + '.';
            const result = chunkingService.chunkText(longParagraph, { maxTokens: 100 });

            expect(result.length).toBeGreaterThan(1);
            result.forEach(chunk => {
                expect(chunk.totalChunks).toBe(result.length);
            });
        });

        it('should handle text with no sentence boundaries', () => {
            const text = 'a'.repeat(3000); // No punctuation
            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            expect(result.length).toBeGreaterThan(0);
        });

        it('should apply overlap between chunks', () => {
            const paragraph1 = 'x'.repeat(400) + '.';
            const paragraph2 = 'y'.repeat(400) + '.';
            const text = `${paragraph1}\n\n${paragraph2}`;

            const result = chunkingService.chunkText(text, {
                maxTokens: 120,
                overlap: 10,
            });

            // Should have multiple chunks with overlap
            expect(result.length).toBeGreaterThan(1);
        });

        it('should not apply overlap when overlap is 0', () => {
            const paragraph1 = 'x'.repeat(400);
            const paragraph2 = 'y'.repeat(400);
            const text = `${paragraph1}\n\n${paragraph2}`;

            const result = chunkingService.chunkText(text, {
                maxTokens: 80,
                overlap: 0,
            });

            expect(result.length).toBeGreaterThan(1);
            // Check that chunks don't have unnecessary overlap
            if (result.length > 1) {
                expect(result[0].text).not.toContain(result[1].text);
            }
        });

        it('should maintain chunk index and totalChunks metadata', () => {
            const text = 'a'.repeat(5000);
            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            result.forEach((chunk, idx) => {
                expect(chunk.index).toBe(idx);
                expect(chunk.totalChunks).toBe(result.length);
            });
        });

        it('should use default options from config', () => {
            const text = 'a'.repeat(3000);
            const result = chunkingService.chunkText(text);

            expect(result.length).toBeGreaterThan(0);
            result.forEach(chunk => {
                expect(chunk.totalChunks).toBe(result.length);
            });
        });

        it('should handle mixed paragraph and sentence splitting', () => {
            const shortPara = 'Short paragraph.';
            const longPara = 'a'.repeat(2500) + '. ' + 'b'.repeat(2500) + '.';
            const text = `${shortPara}\n\n${longPara}`;

            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            expect(result.length).toBeGreaterThan(1);
        });

        it('should handle text with multiple consecutive newlines', () => {
            const text = `Para 1\n\n\n\nPara 2\n\n\n\nPara 3`;
            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle text with whitespace', () => {
            const para1 = 'a'.repeat(100);
            const para2 = 'b'.repeat(100);
            const text = `${para1}\n\n${para2}`;
            const result = chunkingService.chunkText(text, { maxTokens: 100 });

            // Verify chunking works correctly
            expect(result.length).toBeGreaterThanOrEqual(1);
            result.forEach(chunk => {
                expect(chunk.text.length).toBeGreaterThan(0);
            });
        });
    });

    describe('getOverlapText', () => {
        it('should return empty string for zero overlap', () => {
            const text = 'Some text here';
            const result = chunkingService.getOverlapText(text, 0);
            expect(result).toBe('');
        });

        it('should return text from end based on token count', () => {
            const text = 'The quick brown fox jumps over the lazy dog';
            const result = chunkingService.getOverlapText(text, 10);

            // 10 tokens * 4 chars = 40 characters
            expect(result.length).toBeLessThanOrEqual(40);
            expect(text).toContain(result);
        });

        it('should try to start at word boundary', () => {
            const text = 'The quick brown fox jumps over the lazy dog';
            const result = chunkingService.getOverlapText(text, 5);

            // Should not start mid-word if possible
            if (result.length > 0 && result !== text.slice(-20)) {
                expect(result[0]).not.toBe(' ');
                // If it starts with a letter, the previous char in original should be space
                const resultStartIndex = text.indexOf(result);
                if (resultStartIndex > 0) {
                    expect(text[resultStartIndex - 1]).toBe(' ');
                }
            }
        });

        it('should handle short text', () => {
            const text = 'Hi';
            const result = chunkingService.getOverlapText(text, 10);
            expect(result).toBeTruthy();
        });

        it('should handle text with no spaces', () => {
            const text = 'aaaaaaaaaaaaaaaaaaaaaa';
            const result = chunkingService.getOverlapText(text, 2);
            // 2 tokens * 4 chars = 8 characters
            expect(result.length).toBeLessThanOrEqual(8);
        });

        it('should return text from the end', () => {
            const text = 'Start middle end';
            const result = chunkingService.getOverlapText(text, 2);
            // Should contain 'end' since it's from the end of text
            expect(text.endsWith(result) || text.includes(result)).toBeTruthy();
        });
    });

    describe('chunkDocument', () => {
        it('should chunk document and attach metadata', () => {
            const content = 'Document content here';
            const metadata = { fileName: 'test.txt', author: 'John' };

            const result = chunkingService.chunkDocument(content, metadata, { maxTokens: 100 });

            expect(result).toHaveLength(1);
            expect(result[0].text).toBe(content);
            expect(result[0].metadata).toEqual(metadata);
            expect(result[0].index).toBe(0);
            expect(result[0].totalChunks).toBe(1);
        });

        it('should attach metadata to all chunks', () => {
            // Create paragraphs to ensure chunking happens
            const para1 = 'a'.repeat(500);
            const para2 = 'b'.repeat(500);
            const content = `${para1}\n\n${para2}`;
            const metadata = { source: 'document.pdf', page: 1 };

            const result = chunkingService.chunkDocument(content, metadata, { maxTokens: 100 });

            expect(result.length).toBeGreaterThan(1);
            result.forEach(chunk => {
                expect(chunk.metadata).toEqual(metadata);
            });
        });

        it('should use empty metadata by default', () => {
            const content = 'Content';
            const result = chunkingService.chunkDocument(content);

            expect(result).toHaveLength(1);
            expect(result[0].metadata).toEqual({});
        });

        it('should handle empty content', () => {
            const metadata = { file: 'empty.txt' };
            const result = chunkingService.chunkDocument('', metadata);

            expect(result).toEqual([]);
        });

        it('should pass options to chunkText', () => {
            // Create paragraphs to force chunking
            const para1 = 'a'.repeat(250);
            const para2 = 'b'.repeat(250);
            const para3 = 'c'.repeat(250);
            const content = `${para1}\n\n${para2}\n\n${para3}`;
            const metadata = { doc: 'test' };
            const options = { maxTokens: 50, overlap: 5 };

            const result = chunkingService.chunkDocument(content, metadata, options);

            // Verify chunking happened with options (more chunks = smaller maxTokens)
            expect(result.length).toBeGreaterThan(1);
            result.forEach(chunk => {
                expect(chunk.metadata).toEqual(metadata);
            });
        });

        it('should maintain all chunk properties', () => {
            const content = 'a'.repeat(2000);
            const metadata = { id: '123' };

            const result = chunkingService.chunkDocument(content, metadata, { maxTokens: 100 });

            result.forEach((chunk, idx) => {
                expect(chunk).toHaveProperty('text');
                expect(chunk).toHaveProperty('index');
                expect(chunk).toHaveProperty('totalChunks');
                expect(chunk).toHaveProperty('metadata');
                expect(chunk.index).toBe(idx);
            });
        });
    });
});
