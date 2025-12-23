/* eslint-disable @typescript-eslint/no-require-imports */

// Mock config before importing service
jest.mock('../config/appConfig', () => ({
  default: {
    handover: {
      defaultThreshold: 0.7,
    },
  },
}));

// Mock logger before importing ContextService
jest.mock('../config/logger', () => ({
  default: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const contextService = require('./contextService').default;

interface SemanticResult {
  title: string;
  content: string;
  similarity: number;
  file_name?: string;
  chunk_index?: number;
  total_chunks?: number;
}

interface Twin {
  name: string;
  profession: string;
  bio?: string;
  communication_style?: string;
  personality_traits?: string[];
  capabilities?: Record<string, boolean>;
  services?: string[];
  pricing_info?: Array<{ service: string; price: string }>;
  availability_schedule?: Record<string, string>;
  handover_threshold?: number;
  system_prompt?: string;
}

interface KnowledgeBaseEntry {
  title: string;
  content: string;
  source_url?: string;
}

describe('ContextService - Semantic Search Integration', () => {
  describe('_buildSemanticKnowledgeSection', () => {
    it('should build semantic knowledge section with results', () => {
      const results: SemanticResult[] = [
        {
          title: 'Pricing Information',
          content: 'We charge $99/month for our basic plan',
          similarity: 0.95,
          file_name: 'pricing.pdf',
          chunk_index: 0,
          total_chunks: 3,
        },
        {
          title: 'Service Details',
          content: 'Our service includes 24/7 support',
          similarity: 0.87,
          file_name: 'services.txt',
          chunk_index: 1,
          total_chunks: 2,
        },
      ];

      const section = contextService._buildSemanticKnowledgeSection(results);

      expect(section).toContain('# RELEVANT CONTEXT');
      expect(section).toContain('Context 1: Pricing Information');
      expect(section).toContain('Relevance: 95%');
      expect(section).toContain('We charge $99/month for our basic plan');
      expect(section).toContain('Source: pricing.pdf (Part 1/3)');
      expect(section).toContain('Context 2: Service Details');
      expect(section).toContain('Our service includes 24/7 support');
      expect(section).toContain('Source: services.txt (Part 2/2)');
    });

    it('should return null for empty results', () => {
      const section = contextService._buildSemanticKnowledgeSection([]);
      expect(section).toBeNull();
    });

    it('should return null for null results', () => {
      const section = contextService._buildSemanticKnowledgeSection(null);
      expect(section).toBeNull();
    });

    it('should handle results without file_name', () => {
      const results: SemanticResult[] = [
        {
          title: 'General Knowledge',
          content: 'Some content',
          similarity: 0.80,
        },
      ];

      const section = contextService._buildSemanticKnowledgeSection(results);

      expect(section).toContain('General Knowledge');
      expect(section).toContain('Some content');
      // Should still contain Type and Relevance metadata but no Source with file_name
      expect(section).toContain('Relevance: 80%');
    });

    it('should handle results with single chunk', () => {
      const results: SemanticResult[] = [
        {
          title: 'Short Document',
          content: 'Brief content',
          similarity: 0.90,
          file_name: 'short.txt',
          chunk_index: 0,
          total_chunks: 1,
        },
      ];

      const section = contextService._buildSemanticKnowledgeSection(results);

      expect(section).toContain('Source: short.txt');
      // Single chunk should not have Part notation
      expect(section).not.toContain('Part 1/1');
    });

    it('should round similarity scores correctly', () => {
      const results: SemanticResult[] = [
        { title: 'Test 1', content: 'Content 1', similarity: 0.856 },
        { title: 'Test 2', content: 'Content 2', similarity: 0.854 },
        { title: 'Test 3', content: 'Content 3', similarity: 0.801 },
      ];

      const section = contextService._buildSemanticKnowledgeSection(results);

      expect(section).toContain('Relevance: 86%'); // 0.856 rounds to 86
      expect(section).toContain('Relevance: 85%'); // 0.854 rounds to 85
      expect(section).toContain('Relevance: 80%'); // 0.801 rounds to 80
    });
  });

  describe('generateContinuationPrompt', () => {
    const mockTwin: Twin = {
      name: 'Dr. Jane Smith',
      profession: 'Psychologist',
    };

    it('should generate continuation prompt without semantic results', () => {
      const prompt = contextService.generateContinuationPrompt(mockTwin, null);

      expect(prompt).toContain('You are Dr. Jane Smith');
      expect(prompt).toContain('Psychologist');
      expect(prompt).toContain('NO CONTEXT AVAILABLE');
      expect(prompt).not.toContain('# RELEVANT CONTEXT');
    });

    it('should generate continuation prompt with semantic results', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'Therapy Approaches',
          content: 'CBT is effective for anxiety',
          similarity: 0.92,
        },
      ];

      const prompt = contextService.generateContinuationPrompt(mockTwin, semanticResults);

      expect(prompt).toContain('# RELEVANT CONTEXT');
      expect(prompt).toContain('Therapy Approaches');
      expect(prompt).toContain('CBT is effective for anxiety');
      expect(prompt).toContain('You are Dr. Jane Smith');
    });

    it('should handle empty semantic results array', () => {
      const prompt = contextService.generateContinuationPrompt(mockTwin, []);

      expect(prompt).toContain('You are Dr. Jane Smith');
      expect(prompt).not.toContain('# RELEVANT CONTEXT');
    });

    it('should prioritize semantic results at the beginning', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'Important Info',
          content: 'Very relevant content',
          similarity: 0.95,
        },
      ];

      const prompt = contextService.generateContinuationPrompt(mockTwin, semanticResults);
      const semanticIndex = prompt.indexOf('# RELEVANT CONTEXT');
      const identityIndex = prompt.indexOf('You are Dr. Jane Smith');

      expect(semanticIndex).toBeLessThan(identityIndex);
    });
  });

  describe('generateEnhancedSystemPrompt', () => {
    const mockTwin: Twin = {
      name: 'Dr. Jane Smith',
      profession: 'Psychologist',
      bio: 'Experienced therapist',
      communication_style: 'Empathetic and professional',
      personality_traits: ['Patient', 'Understanding'],
      capabilities: { q_and_a: true, consultation: true },
      services: ['Individual Therapy', 'Group Sessions'],
      pricing_info: [{ service: 'Session', price: '$150' }],
      availability_schedule: { general: 'Monday-Friday 9-5' },
      handover_threshold: 0.5,
    };

    const mockKnowledgeBase: KnowledgeBaseEntry[] = [
      {
        title: 'General Info',
        content: 'General knowledge content',
        source_url: 'https://example.com',
      },
    ];

    it('should generate enhanced prompt without semantic results', () => {
      const prompt = contextService.generateEnhancedSystemPrompt(mockTwin, mockKnowledgeBase, null);

      expect(prompt).toContain('Dr. Jane Smith');
      expect(prompt).toContain('Psychologist');
      expect(prompt).toContain('General knowledge content');
      expect(prompt).not.toContain('# RELEVANT CONTEXT');
    });

    it('should generate enhanced prompt with semantic results', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'Anxiety Treatment',
          content: 'Evidence-based approaches',
          similarity: 0.94,
          file_name: 'treatments.pdf',
        },
      ];

      const prompt = contextService.generateEnhancedSystemPrompt(
        mockTwin,
        mockKnowledgeBase,
        semanticResults
      );

      expect(prompt).toContain('# RELEVANT CONTEXT');
      expect(prompt).toContain('Anxiety Treatment');
      expect(prompt).toContain('Evidence-based approaches');
      expect(prompt).toContain('Dr. Jane Smith');
    });

    it('should include full knowledge base when no semantic results', () => {
      const prompt = contextService.generateEnhancedSystemPrompt(mockTwin, mockKnowledgeBase, []);

      expect(prompt).toContain('General knowledge content');
      expect(prompt).toContain('Knowledge Base');
    });

    it('should NOT include full knowledge base when semantic results exist', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'Relevant Info',
          content: 'Semantic content',
          similarity: 0.90,
        },
      ];

      const prompt = contextService.generateEnhancedSystemPrompt(
        mockTwin,
        mockKnowledgeBase,
        semanticResults
      );

      expect(prompt).toContain('# RELEVANT CONTEXT');
      expect(prompt).toContain('Semantic content');
      // Should NOT contain the generic "Knowledge Base" section header
      const semanticHeaderCount = (prompt.match(/# RELEVANT CONTEXT/g) || []).length;
      const generalHeaderCount = (prompt.match(/^# Knowledge Base$/gm) || []).length;
      expect(semanticHeaderCount).toBe(1);
      expect(generalHeaderCount).toBe(0);
    });

    it('should append custom system_prompt if provided', () => {
      const twinWithCustom: Twin = {
        ...mockTwin,
        system_prompt: 'Additional custom instructions',
      };

      const prompt = contextService.generateEnhancedSystemPrompt(
        twinWithCustom,
        mockKnowledgeBase,
        null
      );

      expect(prompt).toContain('Additional Instructions');
      expect(prompt).toContain('Additional custom instructions');
    });

    it('should prioritize semantic results first in prompt', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'High Priority',
          content: 'Most relevant',
          similarity: 0.98,
        },
      ];

      const prompt = contextService.generateEnhancedSystemPrompt(
        mockTwin,
        mockKnowledgeBase,
        semanticResults
      );

      const semanticIndex = prompt.indexOf('# RELEVANT CONTEXT');
      const identityIndex = prompt.indexOf('Digital Twin Identity');

      expect(semanticIndex).toBeLessThan(identityIndex);
      expect(semanticIndex).toBeGreaterThanOrEqual(0);
    });

    it('should handle null knowledge base gracefully', () => {
      const semanticResults: SemanticResult[] = [
        {
          title: 'Only Result',
          content: 'Semantic content',
          similarity: 0.85,
        },
      ];

      const prompt = contextService.generateEnhancedSystemPrompt(mockTwin, null, semanticResults);

      expect(prompt).toContain('# RELEVANT CONTEXT');
      expect(prompt).toContain('Only Result');
      expect(prompt).toContain('Dr. Jane Smith');
    });

    it('should filter out null sections', () => {
      const minimalTwin: Twin = {
        name: 'John Doe',
        profession: 'Coach',
      };

      const prompt = contextService.generateEnhancedSystemPrompt(minimalTwin, [], null);

      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('Coach');
      // Prompt should be generated successfully with all required sections
      expect(prompt).toContain('Professional Expertise');
      expect(prompt).toContain('Conversation Guidelines');
      expect(prompt).toContain('Handover Protocol');
    });
  });

  describe('generateContextPreview', () => {
    const mockTwin: Twin = {
      name: 'Dr. Jane Smith',
      profession: 'Psychologist',
      system_prompt: 'Custom instructions',
    };

    const mockKnowledgeBase: KnowledgeBaseEntry[] = [
      { title: 'KB Entry', content: 'Knowledge content' },
    ];

    it('should generate context preview with all sections', () => {
      const preview = contextService.generateContextPreview(mockTwin, mockKnowledgeBase);

      expect(preview).toHaveProperty('identity');
      expect(preview).toHaveProperty('personality');
      expect(preview).toHaveProperty('expertise');
      expect(preview).toHaveProperty('capabilities');
      expect(preview).toHaveProperty('businessInfo');
      expect(preview).toHaveProperty('knowledgeBase');
      expect(preview).toHaveProperty('guidelines');
      expect(preview).toHaveProperty('handoverProtocol');
      expect(preview).toHaveProperty('customInstructions');
      expect(preview).toHaveProperty('fullPrompt');
    });

    it('should include custom instructions in preview', () => {
      const preview = contextService.generateContextPreview(mockTwin, mockKnowledgeBase);

      expect(preview.customInstructions).toBe('Custom instructions');
    });

    it('should return null for customInstructions if not provided', () => {
      const twinWithoutCustom = { ...mockTwin };
      delete twinWithoutCustom.system_prompt;

      const preview = contextService.generateContextPreview(twinWithoutCustom, mockKnowledgeBase);

      expect(preview.customInstructions).toBeNull();
    });

    it('should generate full prompt using generateSystemPrompt', () => {
      const preview = contextService.generateContextPreview(mockTwin, mockKnowledgeBase);

      expect(preview.fullPrompt).toContain('Dr. Jane Smith');
      expect(preview.fullPrompt).toContain('Custom instructions');
    });
  });

  describe('Error handling', () => {
    it('should handle errors in generateEnhancedSystemPrompt', () => {
      const invalidTwin = null; // This will cause an error

      expect(() => {
        contextService.generateEnhancedSystemPrompt(invalidTwin, [], null);
      }).toThrow();
    });

    it('should handle errors in generateSystemPrompt', () => {
      const invalidTwin = null;

      expect(() => {
        contextService.generateSystemPrompt(invalidTwin, []);
      }).toThrow();
    });
  });
});
