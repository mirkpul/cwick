# Test Coverage Plan to Reach 90%

## Current Status

### Backend: 21.42% → Target: 90%
- Statements: 21.42%
- Branches: 9.95%
- Functions: 14.61%
- Lines: 22.56%

### Frontend: 20.74% → Target: 90%
- Statements: 20.74%
- Branches: 73.31%
- Functions: 41%
- Lines: 20.74%

## Backend Testing Strategy (Priority Order)

### Phase 1: Core RAG Services (Highest Impact)
These are critical for the RAG functionality and currently have <10% coverage:

1. **hybridSearchService.ts** (2.29%) - 380 lines
   - Test vector + BM25 hybrid search
   - Test weight configurations
   - Test result merging logic

2. **rerankingService.ts** (2.08%) - 407 lines
   - Test reranking algorithms
   - Test score adjustments
   - Test result ordering

3. **contextService.ts** (3%) - 314 lines
   - Test context generation
   - Test prompt enhancement
   - Test token counting

4. **queryEnhancementService.ts** (4.04%) - 304 lines
   - Test query expansion
   - Test HyDE (Hypothetical Document Embeddings)
   - Test multi-query generation

5. **ensembleBalancingService.ts** (4.83%) - 168 lines
   - Test source balancing
   - Test ratio enforcement
   - Test diversity filtering

### Phase 2: File Processing Services
Essential for document ingestion:

6. **fileProcessingService.ts** (3.87%) - 1,411 lines
   - Test PDF processing
   - Test DOCX processing
   - Test text extraction
   - Test error handling

7. **chunkingService.ts** (3.63%) - 127 lines
   - Test chunk splitting
   - Test token counting
   - Test overlap handling

8. **semanticChunkingService.ts** (4.19%) - 387 lines
   - Test semantic boundary detection
   - Test chunk optimization

### Phase 3: Extraction Services

9. **visualExtractionService.ts** (4.8%) - 313 lines
   - Test image extraction from documents
   - Test vision API calls
   - Test description generation

10. **structuredTableExtractionService.ts** (3.93%) - 221 lines
    - Test table detection
    - Test table parsing
    - Test data extraction

11. **powerpointExtractionService.ts** (13.63%) - 107 lines
    - Test slide text extraction
    - Test slide note extraction

12. **contextualEnrichmentService.ts** (6.55%) - 190 lines
    - Test metadata enrichment
    - Test context enhancement

### Phase 4: Improve Existing Tests

13. **chatService.ts** (32.37% → 90%)
    - Add tests for streaming response
    - Add tests for conversation lifecycle
    - Add tests for error scenarios
    - Cover lines 456-948 (large gap)

14. **llmService.ts** (32.14% → 90%)
    - Add tests for streaming responses
    - Add tests for image description
    - Add tests for error handling
    - Cover lines 144-531 (provider-specific code)

15. **chatIntegrationService.ts** (35.71% → 90%)
    - Add integration tests
    - Test websocket scenarios

### Phase 5: Controllers

16. **knowledgeBaseController.ts** (53.63% → 90%)
    - Test remaining CRUD operations
    - Test validation scenarios
    - Test error responses
    - Cover lines 313-475 (large gap)

## Frontend Testing Strategy (Priority Order)

### Phase 1: Core Pages (0% coverage)

1. **Dashboard.tsx** (0% → 90%)
   - Test knowledge base list rendering
   - Test navigation
   - Test action buttons
   - Test data fetching

2. **Chat.tsx** (0% → 90%)
   - Test message sending
   - Test message rendering
   - Test websocket integration
   - Test error states

3. **Register.tsx** (0% → 90%)
   - Test form validation
   - Test registration flow
   - Test OAuth integration
   - Test error handling

4. **Landing.tsx** (0% → 90%)
   - Test navigation
   - Test CTA buttons
   - Test routing

### Phase 2: Email Components (0% coverage)

5. **EmailConnectionCard.tsx** (0% → 90%)
6. **EmailList.tsx** (0% → 90%)
7. **EmailPreview.tsx** (0% → 90%)
8. **EmailSettings.tsx** (0% → 90%)
9. **EmailSyncStatus.tsx** (0% → 90%)

### Phase 3: KB Management Components (0-1% coverage)

10. **ContextPreview.tsx** (0% → 90%)
11. **ConversationDetail.tsx** (0% → 90%)
12. **ConversationsList.tsx** (0% → 90%)
13. **FileDropZone.tsx** (0% → 90%)
14. **KnowledgeBaseFileList.tsx** (0% → 90%)
15. **KnowledgeBaseSettings.tsx** (0% → 90%)
16. **OverviewTab.tsx** (0% → 90%)
17. **RAGConfigPanel.tsx** (1.02% → 90%)
18. **SemanticSearch.tsx** (0% → 90%)

### Phase 4: Web Scraping

19. **WebScrapingTab.tsx** (0% → 90%)

### Phase 5: Other Components

20. **ErrorToast.tsx** (0% → 90%)
21. **useAsyncOperation.ts** hook (0% → 90%)

### Phase 6: Improve Existing Coverage

22. **BenchmarkRunDetailView.tsx** (0.56% → 90%)
23. **RunComparisonTable.tsx** (78.68% → 90%)
24. **AuthContext.tsx** (79.72% → 90%)
25. **useAuthForm.ts** (81.81% → 90%)
26. **Login.tsx** (99.27% → maintain)
27. **OnboardingWizard.tsx** (88.39% → 90%)

## Execution Plan

### Estimated Work Distribution
- **Backend**: ~25-30 test files needed
- **Frontend**: ~25-30 test files needed
- **Time estimate**: High-priority items should be done first

### Testing Guidelines
1. Focus on critical path functionality
2. Test both success and error scenarios
3. Mock external dependencies (DB, APIs, LLMs)
4. Use meaningful test descriptions
5. Aim for 90%+ coverage per file
6. Test edge cases and validation

### Success Metrics
- Backend coverage: ≥90% statements
- Frontend coverage: ≥90% statements
- All tests passing
- No skipped tests
- Meaningful test assertions
