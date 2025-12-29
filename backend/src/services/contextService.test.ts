import contextService from './contextService';
import { Pool } from 'pg';

jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        conversations: {
            messageHistoryLimit: 10,
        },
        chunking: {
            charactersPerToken: 4,
        },
    },
}));

describe('ContextService', () => {
    describe('formatContextForPrompt', () => {
        it('should return empty string for empty chunks', () => {
            const result = contextService.formatContextForPrompt([]);
            expect(result).toBe('');
        });

        it('should return empty string for null chunks', () => {
            const result = contextService.formatContextForPrompt(null as never);
            expect(result).toBe('');
        });

        it('should format chunks with title and source', () => {
            const chunks = [
                { id: '1', content: 'Content 1', title: 'Title 1', source: 'Source 1' },
                { id: '2', content: 'Content 2', title: 'Title 2', source: 'Source 2' },
            ];

            const result = contextService.formatContextForPrompt(chunks);

            expect(result).toContain('[1] Title 1 (Source 1)');
            expect(result).toContain('Content 1');
            expect(result).toContain('[2] Title 2 (Source 2)');
            expect(result).toContain('Content 2');
        });

        it('should use defaults for missing title and source', () => {
            const chunks = [
                { id: '1', content: 'Content without metadata' },
            ];

            const result = contextService.formatContextForPrompt(chunks);

            expect(result).toContain('[1] Context 1 (Knowledge Base)');
            expect(result).toContain('Content without metadata');
        });

        it('should format multiple chunks with proper separation', () => {
            const chunks = [
                { id: '1', content: 'First chunk', title: 'First' },
                { id: '2', content: 'Second chunk', title: 'Second' },
            ];

            const result = contextService.formatContextForPrompt(chunks);

            expect(result).toContain('\n\n');
            expect(result.split('\n\n')).toHaveLength(2);
        });
    });

    describe('prepareConversationHistory', () => {
        it('should fetch and format conversation messages', async () => {
            const mockPool = {
                query: jest.fn().mockResolvedValue({
                    rows: [
                        { role: 'assistant', content: 'Response', created_at: new Date('2024-01-02') },
                        { role: 'user', content: 'Question', created_at: new Date('2024-01-01') },
                    ],
                }),
            } as unknown as Pool;

            const result = await contextService.prepareConversationHistory(mockPool, 'conv123', 5);

            expect(result).toHaveLength(2);
            // Should be reversed to chronological order
            expect(result[0].role).toBe('user');
            expect(result[0].content).toBe('Question');
            expect(result[1].role).toBe('assistant');
            expect(result[1].content).toBe('Response');
        });

        it('should use default message limit from config', async () => {
            const mockPool = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
            } as unknown as Pool;

            await contextService.prepareConversationHistory(mockPool, 'conv123');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.any(String),
                ['conv123', 10] // default from config
            );
        });

        it('should map sender roles correctly', async () => {
            const mockPool = {
                query: jest.fn().mockResolvedValue({
                    rows: [
                        { role: 'bot', content: 'Another bot message' }, // DESC order: newest first
                        { role: 'assistant', content: 'Bot message' },
                        { role: 'user', content: 'User message' },
                    ],
                }),
            } as unknown as Pool;

            const result = await contextService.prepareConversationHistory(mockPool, 'conv123');

            // After reverse, oldest first
            expect(result[0].role).toBe('user');
            expect(result[1].role).toBe('assistant');
            expect(result[2].role).toBe('assistant'); // bot -> assistant
        });
    });

    describe('buildCompleteContext', () => {
        it('should build complete context with chunks and history', async () => {
            const mockPool = {
                query: jest.fn().mockResolvedValue({
                    rows: [{ role: 'user', content: 'Previous message' }],
                }),
            } as unknown as Pool;

            const chunks = [
                { id: '1', content: 'Chunk content', title: 'Chunk title' },
            ];

            const result = await contextService.buildCompleteContext(
                mockPool,
                'conv123',
                chunks,
                'You are helpful'
            );

            expect(result.formattedContext).toContain('Chunk content');
            expect(result.conversationHistory).toHaveLength(1);
            expect(result.systemMessage).toContain('You are helpful');
            expect(result.systemMessage).toContain('Relevant Context:');
            expect(result.systemMessage).toContain('Chunk content');
        });

        it('should handle empty chunks', async () => {
            const mockPool = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
            } as unknown as Pool;

            const result = await contextService.buildCompleteContext(
                mockPool,
                'conv123',
                [],
                'Base prompt'
            );

            expect(result.formattedContext).toBe('');
            expect(result.systemMessage).toBe('Base prompt');
            expect(result.systemMessage).not.toContain('Relevant Context:');
        });
    });

    describe('estimateTokenCount', () => {
        it('should return 0 for empty text', () => {
            expect(contextService.estimateTokenCount('')).toBe(0);
            expect(contextService.estimateTokenCount(null as never)).toBe(0);
        });

        it('should estimate tokens based on character count', () => {
            const text = 'a'.repeat(100); // 100 characters
            const tokens = contextService.estimateTokenCount(text);

            // 100 chars / 4 chars per token = 25 tokens
            expect(tokens).toBe(25);
        });

        it('should round up partial tokens', () => {
            const text = 'a'.repeat(101); // 101 characters
            const tokens = contextService.estimateTokenCount(text);

            // 101 chars / 4 = 25.25, rounded up to 26
            expect(tokens).toBe(26);
        });
    });

    describe('truncateContext', () => {
        it('should return all chunks if within budget', () => {
            const chunks = [
                { id: '1', content: 'Short content' },
                { id: '2', content: 'Another short' },
            ];

            const result = contextService.truncateContext(chunks, 1000);

            expect(result).toHaveLength(2);
            expect(result).toEqual(chunks);
        });

        it('should truncate chunks that exceed token budget', () => {
            const chunks = [
                { id: '1', content: 'a'.repeat(40) }, // 10 tokens
                { id: '2', content: 'b'.repeat(40) }, // 10 tokens
                { id: '3', content: 'c'.repeat(40) }, // 10 tokens
            ];

            const result = contextService.truncateContext(chunks, 15); // Allow only 15 tokens

            expect(result.length).toBeLessThan(3);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should include at least one chunk even if it exceeds budget', () => {
            const chunks = [
                { id: '1', content: 'a'.repeat(1000) }, // Very long content
            ];

            const result = contextService.truncateContext(chunks, 10); // Small budget

            expect(result).toHaveLength(1);
            expect(result[0].content.length).toBeLessThan(1000);
            expect(result[0].content).toContain('...');
        });

        it('should preserve chunk metadata when truncating', () => {
            const chunks = [
                {
                    id: '1',
                    content: 'a'.repeat(1000),
                    title: 'Important',
                    source: 'Document.pdf',
                    score: 0.95,
                },
            ];

            const result = contextService.truncateContext(chunks, 10);

            expect(result[0].title).toBe('Important');
            expect(result[0].source).toBe('Document.pdf');
            expect(result[0].score).toBe(0.95);
        });

        it('should truncate at sentence boundary when possible', () => {
            const longText = 'First sentence. ' + 'a'.repeat(500) + '. Last sentence.';
            const chunks = [{ id: '1', content: longText }];

            const result = contextService.truncateContext(chunks, 50);

            expect(result[0].content).toMatch(/\.$/);
        });
    });

    describe('generateContextPreview', () => {
        it('should generate preview with all twin properties', () => {
            const twin = {
                name: 'Dr. Smith',
                profession: 'Medical Doctor',
                bio: 'Experienced physician',
                communication_style: 'Professional and empathetic',
                capabilities: { consultation: true, diagnosis: true },
                pricing_info: { consultation: '$100/hour' },
                system_prompt: 'Be careful with medical advice',
            };

            const result = contextService.generateContextPreview(twin, []);

            expect(result.identity).toContain('Dr. Smith');
            expect(result.identity).toContain('Medical Doctor');
            expect(result.personality).toBe('Professional and empathetic');
            expect(result.expertise).toContain('Medical Doctor');
            expect(result.capabilities).toContain('consultation');
            expect(result.businessInfo).toContain('$100/hour');
            expect(result.customInstructions).toBe('Be careful with medical advice');
            expect(result.fullPrompt).toContain('Dr. Smith');
            expect(result.fullPrompt).toContain('Additional Instructions');
        });

        it('should use defaults for missing twin properties', () => {
            const twin = {};

            const result = contextService.generateContextPreview(twin, []);

            expect(result.identity).toContain('digital assistant');
            expect(result.identity).toContain('professional');
            expect(result.personality).toBe('Professional and helpful');
            expect(result.customInstructions).toBeNull();
        });

        it('should format knowledge base entries', () => {
            const twin = { name: 'Assistant' };
            const knowledge = [
                { id: '1', content: 'Fact 1', title: 'Topic 1' },
                { id: '2', content: 'Fact 2', title: 'Topic 2' },
                { id: '3', content: 'Fact 3', title: 'Topic 3' },
                { id: '4', content: 'Fact 4', title: 'Topic 4' },
            ];

            const result = contextService.generateContextPreview(twin, knowledge);

            // Should only include first 3 entries
            expect(result.knowledgeBase).toContain('Fact 1');
            expect(result.knowledgeBase).toContain('Fact 2');
            expect(result.knowledgeBase).toContain('Fact 3');
            expect(result.knowledgeBase).not.toContain('Fact 4');
        });

        it('should handle null knowledge base', () => {
            const twin = { name: 'Assistant' };

            const result = contextService.generateContextPreview(twin, null as never);

            expect(result.knowledgeBase).toBe('');
        });
    });

    describe('_buildSemanticKnowledgeSection', () => {
        it('should return null for empty results', () => {
            const result = contextService._buildSemanticKnowledgeSection([]);
            expect(result).toBeNull();
        });

        it('should return null for null results', () => {
            const result = contextService._buildSemanticKnowledgeSection(null);
            expect(result).toBeNull();
        });

        it('should format semantic results with metadata', () => {
            const results = [
                {
                    content: 'Relevant content',
                    title: 'Important Document',
                    similarity: 0.95,
                    file_name: 'doc.pdf',
                    total_chunks: 5,
                    chunk_index: 2,
                },
            ];

            const result = contextService._buildSemanticKnowledgeSection(results);

            expect(result).toContain('RELEVANT CONTEXT');
            expect(result).toContain('Important Document');
            expect(result).toContain('Relevance: 95%');
            expect(result).toContain('Relevant content');
            expect(result).toContain('doc.pdf');
            expect(result).toContain('Part 3/5'); // chunk_index is 0-based
        });

        it('should use default title when missing', () => {
            const results = [{ content: 'Content', similarity: 0.8 }];

            const result = contextService._buildSemanticKnowledgeSection(results);

            expect(result).toContain('Context 1');
        });

        it('should handle single chunk files', () => {
            const results = [
                {
                    content: 'Content',
                    file_name: 'single.txt',
                    total_chunks: 1,
                },
            ];

            const result = contextService._buildSemanticKnowledgeSection(results);

            expect(result).toContain('Source: single.txt');
            expect(result).not.toContain('Part');
        });
    });

    describe('generateContinuationPrompt', () => {
        it('should generate prompt with semantic results', () => {
            const twin = { name: 'Assistant', profession: 'Helper' };
            const results = [{ content: 'Context data', similarity: 0.9 }];

            const prompt = contextService.generateContinuationPrompt(twin, results);

            expect(prompt).toContain('RELEVANT CONTEXT');
            expect(prompt).toContain('Context data');
            expect(prompt).toContain('Assistant');
            expect(prompt).toContain('Helper');
        });

        it('should generate prompt without semantic results', () => {
            const twin = { name: 'Assistant', profession: 'Helper' };

            const prompt = contextService.generateContinuationPrompt(twin, null);

            expect(prompt).toContain('NO CONTEXT AVAILABLE');
            expect(prompt).toContain('Assistant');
        });

        it('should handle empty semantic results', () => {
            const twin = { name: 'Bot' };

            const prompt = contextService.generateContinuationPrompt(twin, []);

            expect(prompt).toContain('NO CONTEXT AVAILABLE');
        });
    });

    describe('generateEnhancedSystemPrompt', () => {
        it('should throw error if twin is missing', () => {
            expect(() => {
                contextService.generateEnhancedSystemPrompt(null as never, null, null);
            }).toThrow('Twin is required');
        });

        it('should generate complete prompt with all sections', () => {
            const twin = {
                name: 'Dr. Expert',
                profession: 'Consultant',
                bio: 'Expert in the field',
                system_prompt: 'Custom instructions',
            };
            const knowledge = [
                { id: '1', content: 'Knowledge item', title: 'Topic' },
            ];

            const prompt = contextService.generateEnhancedSystemPrompt(twin, knowledge, null);

            expect(prompt).toContain('# Digital Twin Identity');
            expect(prompt).toContain('Dr. Expert');
            expect(prompt).toContain('# Professional Expertise');
            expect(prompt).toContain('Expert in the field');
            expect(prompt).toContain('# Knowledge Base');
            expect(prompt).toContain('Knowledge item');
            expect(prompt).toContain('# Conversation Guidelines');
            expect(prompt).toContain('# Additional Instructions');
            expect(prompt).toContain('Custom instructions');
        });

        it('should prioritize semantic results over knowledge base', () => {
            const twin = { name: 'Assistant' };
            const knowledge = [{ content: 'Static knowledge', title: 'KB Entry' }];
            const semanticResults = [{ content: 'Dynamic context', similarity: 0.9 }];

            const prompt = contextService.generateEnhancedSystemPrompt(
                twin,
                knowledge,
                semanticResults
            );

            expect(prompt).toContain('RELEVANT CONTEXT');
            expect(prompt).toContain('Dynamic context');
            expect(prompt).not.toContain('Static knowledge');
        });

        it('should use knowledge base when no semantic results', () => {
            const twin = { name: 'Assistant' };
            const knowledge = [{ content: 'KB content', title: 'KB Entry' }];

            const prompt = contextService.generateEnhancedSystemPrompt(twin, knowledge, null);

            expect(prompt).toContain('# Knowledge Base');
            expect(prompt).toContain('KB content');
        });

        it('should handle empty knowledge base', () => {
            const twin = { name: 'Assistant' };

            const prompt = contextService.generateEnhancedSystemPrompt(twin, [], null);

            expect(prompt).not.toContain('# Knowledge Base');
            expect(prompt).toContain('# Digital Twin Identity');
        });

        it('should use defaults for missing twin properties', () => {
            const twin = {};

            const prompt = contextService.generateEnhancedSystemPrompt(twin, null, null);

            expect(prompt).toContain('digital assistant');
            expect(prompt).toContain('professional');
            expect(prompt).toContain('Experienced professional');
        });
    });

    describe('generateSystemPrompt', () => {
        it('should throw error if twin is missing', () => {
            expect(() => {
                contextService.generateSystemPrompt(null as never, []);
            }).toThrow('Twin is required');
        });

        it('should delegate to generateEnhancedSystemPrompt', () => {
            const twin = { name: 'Assistant', profession: 'Helper' };
            const knowledge = [{ content: 'Data', title: 'Entry' }];

            const result = contextService.generateSystemPrompt(twin, knowledge);

            // Should produce same result as generateEnhancedSystemPrompt with null semantic results
            const expected = contextService.generateEnhancedSystemPrompt(twin, knowledge, null);
            expect(result).toBe(expected);
        });
    });
});
